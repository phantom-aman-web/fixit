"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Wrench, Menu, X, Bell, User as UserIcon, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { navigate, useCurrentPath } from "@/store/router";
import { useUnreadNotifications } from "@/features/notifications/hooks";

const CUSTOMER_NAV = [
  { label: "Home", path: "home" },
  { label: "AI Diagnose", path: "ai-diagnose" },
  { label: "Diagnose", path: "diagnose" },
  { label: "Technicians", path: "technicians" },
  { label: "My Equipment", path: "equipment" },
  { label: "History", path: "history" },
  { label: "Warranties", path: "warranties" },
];

const TECH_NAV = [
  { label: "Home", path: "home" },
  { label: "Technician Workspace", path: "technician" },
  { label: "My Jobs", path: "technician/jobs" },
];

const ADMIN_NAV = [
  { label: "Home", path: "home" },
  { label: "Admin", path: "admin" },
];

export function AppHeader() {
  const { data: session, status } = useSession();
  const path = useCurrentPath();
  const [open, setOpen] = useState(false);
  const unread = useUnreadNotifications();

  const nav =
    session?.user.role === "ADMIN"
      ? ADMIN_NAV
      : session?.user.role === "TECHNICIAN"
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
          onClick={() => go("home")}
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
              const active = path === item.path || path.startsWith(item.path + "/");
              return (
                <button
                  key={item.path}
                  onClick={() => go(item.path)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
        </nav>

        <div className="flex items-center gap-2">
          {status === "authenticated" && (
            <button
              onClick={() => go("notifications")}
              className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          )}

          {status === "authenticated" ? (
            <button
              onClick={() => go("dashboard")}
              className="hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted sm:flex"
            >
              <UserIcon className="h-4 w-4" aria-hidden />
              <span className="max-w-[10rem] truncate">
                {session.user.name || session.user.email}
              </span>
            </button>
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
                    className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    navigate("dashboard");
                    setOpen(false);
                  }}
                  className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
                >
                  Dashboard
                </button>
                <Link
                  href="/api/auth/signout"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </Link>
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
