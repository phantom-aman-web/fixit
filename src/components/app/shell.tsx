"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Wrench, Menu, X, Bell, User as UserIcon, LogOut, Loader2, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { navigate, useCurrentPath } from "@/store/router";
import { useUnreadNotifications } from "@/features/notifications/hooks";
import { useUnreadMessages } from "@/features/messages/hooks";
import { NotificationsDropdown } from "@/features/notifications/notifications-dropdown";

const CUSTOMER_NAV = [
  { label: "AI Diagnose", path: "ai-diagnose" },
  { label: "Diagnose", path: "diagnose" },
  { label: "Technicians", path: "technicians" },
  { label: "My Equipment", path: "equipment" },
  { label: "History", path: "history" },
  { label: "Warranties", path: "warranties" },
  { label: "Messages", path: "messages" },
];

const TECH_NAV = [
  { label: "Workspace", path: "technician" },
  { label: "My Jobs", path: "technician/jobs" },
  { label: "Messages", path: "messages" },
];

const ADMIN_NAV = [
  { label: "Admin Workspace", path: "admin" },
  { label: "Disputes", path: "disputes" },
];

export function AppHeader() {
  const { data: session, status } = useSession();
  const path = useCurrentPath();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const unread = useUnreadNotifications();
  const unreadMessagesCount = useUnreadMessages();

  const role = session?.user?.role;
  const homePath = role === "ADMIN" ? "admin" : role === "TECHNICIAN" ? "technician" : "home";

  const nav =
    role === "ADMIN"
      ? ADMIN_NAV
      : role === "TECHNICIAN"
      ? TECH_NAV
      : CUSTOMER_NAV;

  const go = (p: string) => {
    navigate(p);
    setOpen(false);
  };



  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => go(homePath)}
          className="flex items-center gap-2 font-semibold"
          aria-label="FixIt home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-lg tracking-tight">FixIt</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {status === "authenticated" &&
            nav.map((item) => {
              let active = false;
              if (item.path === homePath) {
                active = path === homePath;
              } else if (item.path === "history" && (path.startsWith("repair/") || path.startsWith("booking/"))) {
                active = true;
              } else if (item.path === "technician/jobs" && (path.startsWith("booking/") || path.startsWith("repair/"))) {
                active = true;
              } else {
                active = path === item.path || path.startsWith(item.path + "/");
              }
              
              return (
                <button
                  key={item.path}
                  onClick={() => go(item.path)}
                  className={cn(
                    "relative rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "text-muted-foreground font-medium hover:text-foreground"
                  )}
                >
                  {item.label}
                  {item.path === "messages" && unreadMessagesCount > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {unreadMessagesCount}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>

        <div className="flex items-center gap-2">
          {status === "authenticated" && (
            <>

              <NotificationsDropdown 
                unreadCount={unread} 
                open={notifOpen}
                onOpenChange={setNotifOpen} 
              />
            </>
          )}

          {status === "authenticated" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted sm:flex"
                >
                  <Avatar className="h-5 w-5 border">
                    {session.user.image ? <AvatarImage src={session.user.image} /> : null}
                    <AvatarFallback className="text-[10px]"><UserIcon className="h-3 w-3" /></AvatarFallback>
                  </Avatar>
                  <span className="max-w-[8rem] truncate">
                    {session.user.name || session.user.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session.user.name || session.user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground">{session.user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => go("settings")} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            status !== "loading" && (
              <Button size="sm" onClick={() => go("auth/signin")}>
                Sign in
              </Button>
            )
          )}

          <button
            className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          className="border-t border-border bg-background md:hidden"
          aria-label="Mobile"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-2 sm:px-6">
            {status === "authenticated" ? (
              <>
                {nav.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => go(item.path)}
                    className="relative rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                  >
                    {item.label}
                    {item.path === "messages" && unreadMessagesCount > 0 && (
                      <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => {
                    navigate(role === "ADMIN" ? "admin" : role === "TECHNICIAN" ? "technician" : "dashboard");
                    setOpen(false);
                  }}
                  className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                >
                  {role === "ADMIN" ? "Admin Workspace" : role === "TECHNICIAN" ? "Technician Workspace" : "Dashboard"}
                </button>
                <button
                  onClick={() => go("settings")}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                >
                  <Settings className="h-4 w-4" /> Settings
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </>
            ) : (
              <button
                onClick={() => go("auth/signin")}
                className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
              >
                Sign in
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            FixIt — diagnose, troubleshoot, or find the right technician. Addis
            Ababa demo.
          </p>
          <p className="text-xs">
            Phase 1 demo · Deterministic engine · No AI integrated
          </p>
        </div>
      </div>
    </footer>
  );
}
