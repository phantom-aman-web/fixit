"use client";

import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  CalendarCheck,
  Wrench,
  Receipt,
  Star,
  ShieldCheck,
  Info,
  AlertCircle,
  CheckCheck,
} from "lucide-react";

import { useApi, apiFetch } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const TYPE_ICON: Record<string, typeof Bell> = {
  booking_accepted: CalendarCheck,
  booking_scheduled: CalendarCheck,
  booking_confirmed: CalendarCheck,
  booking_cancelled: CalendarCheck,
  job_status: Wrench,
  quote_submitted: Receipt,
  quote_decision: Receipt,
  review_request: Star,
  warranty: ShieldCheck,
  warranty_created: ShieldCheck,
  warranty_expiring: ShieldCheck,
  system: Info,
  alert: AlertCircle,
};

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  dataJson?: string | null;
  read: boolean;
  createdAt: string;
};

type NotificationData = {
  bookingId?: string;
  jobId?: string;
  repairRequestId?: string;
  requestId?: string;
  quoteId?: string;
  sessionId?: string;
  warrantyId?: string;
  path?: string;
};

export function NotificationsDropdown({ unreadCount, onOpenChange, open }: { unreadCount: number, onOpenChange: (open: boolean) => void, open: boolean }) {
  const { data: session, status } = useSession();
  const qc = useQueryClient();

  const query = useApi<{ notifications: Notification[] }>(
    ["notifications"],
    "/api/notifications",
    { enabled: status === "authenticated" && open }
  );

  const items = query.data?.notifications ?? [];
  const unread = items.filter((n) => !n.read);

  function parseData(n: Notification): NotificationData {
    if (!n.dataJson) return {};
    try {
      return JSON.parse(n.dataJson) as NotificationData;
    } catch {
      return {};
    }
  }

  function targetPath(n: Notification): string | null {
    const d = parseData(n);
    const isTech = session?.user?.role === "TECHNICIAN";
    
    if (d.path) return d.path;
    if (d.bookingId) return isTech ? "technician" : `booking/${d.bookingId}`;
    if (d.jobId) return `repair/${d.jobId}`;
    if (d.repairRequestId || d.requestId) return isTech ? "technician" : `repair/${d.repairRequestId || d.requestId}`;
    if (d.sessionId) return `diagnose/session/${d.sessionId}`;
    if (d.warrantyId) return `warranties`;
    return null;
  }

  async function markRead(id: string) {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
      qc.setQueryData(["notifications"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: Notification) =>
            n.id === id ? { ...n, read: true } : n
          ),
        };
      });
      qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
    } catch (e) {
      toast.error("Failed to mark notification as read");
    }
  }

  async function markAllRead() {
    try {
      await Promise.all(unread.map(n => apiFetch(`/api/notifications/${n.id}/read`, { method: "POST" })));
      qc.setQueryData(["notifications"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: Notification) => ({ ...n, read: true })),
        };
      });
      qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
      toast.success("All notifications marked as read");
    } catch (e) {
      toast.error("Failed to mark all as read");
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {query.isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p>You have no notifications.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type] || Bell;
                const path = targetPath(n);
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 p-4 transition-colors hover:bg-muted/50",
                      !n.read && "bg-primary/5 hover:bg-primary/10"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        !n.read ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1 overflow-hidden">
                      <p
                        className={cn(
                          "text-sm",
                          !n.read ? "font-semibold" : "font-medium"
                        )}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {n.body}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {timeAgo(n.createdAt)}
                        </span>
                        <div className="flex gap-2">
                          {!n.read && (
                            <button
                              onClick={() => markRead(n.id)}
                              className="text-[10px] font-medium text-primary hover:underline"
                            >
                              Mark read
                            </button>
                          )}
                          {path && (
                            <button
                              onClick={() => {
                                if (!n.read) markRead(n.id);
                                onOpenChange(false);
                                navigate(path);
                              }}
                              className="text-[10px] font-medium text-primary hover:underline"
                            >
                              View details
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="p-2 border-t border-border bg-muted/30">
           <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { onOpenChange(false); navigate("notifications"); }}>
             View all notifications
           </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
