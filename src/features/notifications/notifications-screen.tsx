"use client";

import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  CheckCheck,
  CalendarCheck,
  Wrench,
  Receipt,
  Star,
  ShieldCheck,
  Info,
  AlertCircle,
} from "lucide-react";

import {
  PageContainer,
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { useApi, apiFetch } from "@/hooks/use-api";
import { navigate } from "@/store/router";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

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

export function NotificationsScreen() {
  const { data: session, status } = useSession();
  const qc = useQueryClient();

  const query = useApi<{ notifications: Notification[] }>(
    ["notifications"],
    "/api/notifications",
    { enabled: status === "authenticated" }
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
    if (d.quoteId) return `history`;
    if (d.sessionId) return `diagnose/session/${d.sessionId}`;
    return null;
  }

  async function handleOpen(n: Notification) {
    if (!n.read) {
      try {
        await apiFetch(`/api/notifications/${n.id}/read`, { method: "POST" });
        qc.invalidateQueries({ queryKey: ["notifications"] });
        qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
      } catch (e: any) {
        // non-blocking; we still navigate
      }
    }
    const path = targetPath(n);
    if (path) navigate(path);
  }

  async function markAllRead() {
    if (unread.length === 0) return;
    try {
      await Promise.all(
        unread.map((n) =>
          apiFetch(`/api/notifications/${n.id}/read`, { method: "POST" })
        )
      );
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread"] });
      toast.success(`Marked ${unread.length} as read`);
    } catch (e: any) {
      toast.error("Could not mark all as read", { description: e?.message });
    }
  }

  if (status === "loading") {
    return (
      <PageContainer>
        <LoadingState label="Loading notifications…" />
      </PageContainer>
    );
  }

  if (status !== "authenticated") {
    return (
      <PageContainer>
        <EmptyState
          icon={Bell}
          title="Sign in to see your notifications"
          description="Booking updates, quotes, and warranty reminders live here."
          action={<Button onClick={() => navigate("auth/signin")}>Sign in</Button>}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        description={
          unread.length > 0
            ? `${unread.length} unread · ${items.length} total`
            : `${items.length} total`
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={unread.length === 0}
          >
            <CheckCheck className="h-4 w-4" aria-hidden />
            Mark all read
          </Button>
        }
      />

      {query.isLoading ? (
        <LoadingState label="Loading…" />
      ) : query.error ? (
        <ErrorState
          detail={query.error.message}
          onRetry={() => query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title="You're all caught up"
          description="New booking updates, quotes, and warranty reminders will appear here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                const target = targetPath(n);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleOpen(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50 sm:px-6",
                        !n.read && "bg-primary/5"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                          n.read
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={cn(
                              "truncate text-sm",
                              !n.read ? "font-semibold" : "font-medium"
                            )}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-primary"
                              aria-label="Unread"
                            />
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {n.body}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{timeAgo(n.createdAt)}</span>
                          {target && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="text-primary">
                                Open
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}

export default NotificationsScreen;
