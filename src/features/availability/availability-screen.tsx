"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Ban,
  CalendarDays,
  CalendarRange,
  Clock,
  Info,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
} from "@/components/shared/states";
import { apiFetch, useApi, useApiMutation } from "@/hooks/use-api";
import { navigate } from "@/store/router";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type AvailabilitySlot = {
  id: string;
  dayOfWeek: number | null; // 0=Sun .. 6=Sat
  specificDate: string | null; // ISO date
  startMinutes: number;
  endMinutes: number;
  isBlock: boolean;
  createdAt: string;
};

// ────────────────────────────────────────────────────────────────────────────────
// Time helpers
// ────────────────────────────────────────────────────────────────────────────────

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mm.toString().padStart(2, "0")} ${period}`;
}

// Parse "HH:MM" 24h input → minutes from midnight.
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

function minutesToInputValue(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

// Convert ISO date string to YYYY-MM-DD for date input.
function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getUTCDate().toString().padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Add slot dialog
// ────────────────────────────────────────────────────────────────────────────────

function AddSlotDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"recurring" | "block">("recurring");
  const [dayOfWeek, setDayOfWeek] = useState("1"); // Monday
  const [specificDate, setSpecificDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [submitting, setSubmitting] = useState(false);

  const mutation = useApiMutation("/api/technician/availability", "POST");

  const reset = () => {
    setMode("recurring");
    setDayOfWeek("1");
    setSpecificDate("");
    setStartTime("09:00");
    setEndTime("17:00");
  };

  const submit = async () => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (startMinutes < 0 || endMinutes < 0) {
      toast.error("Please enter valid start and end times.");
      return;
    }
    if (startMinutes >= endMinutes) {
      toast.error("Start time must be before end time.");
      return;
    }
    if (mode === "block" && !specificDate) {
      toast.error("Please pick a date for the block.");
      return;
    }

    const payload: any = {
      startMinutes,
      endMinutes,
      isBlock: mode === "block",
    };
    if (mode === "recurring") {
      payload.dayOfWeek = parseInt(dayOfWeek, 10);
    } else {
      payload.specificDate = new Date(`${specificDate}T00:00:00Z`).toISOString();
    }

    setSubmitting(true);
    try {
      await mutation.mutateAsync(payload);
      toast.success(mode === "block" ? "Block added." : "Availability slot added.");
      setOpen(false);
      reset();
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add slot");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Add slot
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-primary" aria-hidden />
              Add availability
            </DialogTitle>
            <DialogDescription>
              Slots define when you&apos;re available for bookings. Blocks override slots for
              specific dates.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setMode("recurring")}
                className={`flex-1 rounded-md border p-3 text-left text-sm transition-colors ${
                  mode === "recurring"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  Recurring weekly slot
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Available every week on this day.
                </p>
              </button>
              <button
                onClick={() => setMode("block")}
                className={`flex-1 rounded-md border p-3 text-left text-sm transition-colors ${
                  mode === "block"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Ban className="h-4 w-4" aria-hidden />
                  One-off block
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Unavailable on a specific date.
                </p>
              </button>
            </div>

            {mode === "recurring" ? (
              <div className="space-y-1.5">
                <Label htmlFor="slot-day">Day of week</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger id="slot-day" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => (
                      <SelectItem key={d} value={i.toString()}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="slot-date">Date</Label>
                <Input
                  id="slot-date"
                  type="date"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="slot-start">Start time</Label>
                <Input
                  id="slot-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slot-end">End time</Label>
                <Input
                  id="slot-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
              Preview: {minutesToLabel(timeToMinutes(startTime) || 540)} →{" "}
              {minutesToLabel(timeToMinutes(endTime) || 1020)}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Saving…" : mode === "block" ? "Add block" : "Add slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Weekly grid view
// ────────────────────────────────────────────────────────────────────────────────

function WeeklyGrid({
  slots,
  onDelete,
}: {
  slots: AvailabilitySlot[];
  onDelete: (slot: AvailabilitySlot) => void;
}) {
  // Bucket recurring slots by dayOfWeek.
  const byDay: Record<number, AvailabilitySlot[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const dateBlocks: AvailabilitySlot[] = [];
  for (const s of slots) {
    if (s.dayOfWeek != null) {
      byDay[s.dayOfWeek].push(s);
    } else if (s.specificDate) {
      dateBlocks.push(s);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {DAYS.map((day, i) => {
          const daySlots = (byDay[i] ?? []).sort((a, b) => a.startMinutes - b.startMinutes);
          return (
            <Card key={day} className="overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30 px-3 py-2">
                <CardTitle className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>{DAYS_SHORT[i]}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {daySlots.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {daySlots.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">Off</p>
                ) : (
                  <ul className="space-y-1.5">
                    {daySlots.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 font-medium">
                            <Clock className="h-3 w-3 text-primary" aria-hidden />
                            {minutesToLabel(s.startMinutes)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            → {minutesToLabel(s.endMinutes)}
                          </p>
                        </div>
                        <button
                          onClick={() => onDelete(s)}
                          aria-label={`Delete slot`}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {dateBlocks.length > 0 && (
        <Card>
          <CardHeader className="border-b border-border bg-muted/30 px-4 py-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Ban className="h-4 w-4 text-amber-600" aria-hidden />
              One-off blocks
              <Badge variant="secondary" className="ml-1 text-xs">
                {dateBlocks.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <ul className="space-y-1.5">
              {dateBlocks
                .sort(
                  (a, b) =>
                    new Date(a.specificDate!).getTime() - new Date(b.specificDate!).getTime(),
                )
                .map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(s.specificDate!).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Blocked {minutesToLabel(s.startMinutes)} → {minutesToLabel(s.endMinutes)}
                      </p>
                    </div>
                    <button
                      onClick={() => onDelete(s)}
                      aria-label="Delete block"
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// 7-day preview
// ────────────────────────────────────────────────────────────────────────────────

type DayPreview = {
  date: Date;
  label: string;
  status: "available" | "blocked" | "off";
  windows: { start: number; end: number }[];
};

function build7DayPreview(slots: AvailabilitySlot[]): DayPreview[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days: DayPreview[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const dow = d.getUTCDay();
    const matching = slots.filter((s) => {
      if (s.dayOfWeek != null) return s.dayOfWeek === dow;
      if (s.specificDate) return sameDay(new Date(s.specificDate), d);
      return false;
    });
    const blocks = matching.filter((s) => s.isBlock);
    const windows = matching
      .filter((s) => !s.isBlock)
      .map((s) => ({ start: s.startMinutes, end: s.endMinutes }));
    let status: DayPreview["status"] = "off";
    if (blocks.length > 0 && windows.length === 0) status = "blocked";
    else if (windows.length > 0) status = "available";
    else if (blocks.length > 0) status = "blocked";
    days.push({
      date: d,
      label: d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      }),
      status,
      windows: windows.sort((a, b) => a.start - b.start),
    });
  }
  return days;
}

function Preview7Days({ slots }: { slots: AvailabilitySlot[] }) {
  const days = useMemo(() => build7DayPreview(slots), [slots]);

  return (
    <Card>
      <CardHeader className="border-b border-border bg-muted/30 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
          Next 7 days
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {days.map((d) => (
            <div
              key={d.label}
              className={`flex flex-col gap-1 rounded-md border p-2 text-xs ${
                d.status === "available"
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                  : d.status === "blocked"
                  ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                  : "border-border bg-muted/20"
              }`}
            >
              <p className="font-medium">{d.label}</p>
              <p
                className={`text-[10px] font-medium uppercase ${
                  d.status === "available"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : d.status === "blocked"
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-muted-foreground"
                }`}
              >
                {d.status === "available"
                  ? "Available"
                  : d.status === "blocked"
                  ? "Blocked"
                  : "Off"}
              </p>
              {d.windows.length > 0 && (
                <ul className="space-y-0.5 text-[10px] text-muted-foreground">
                  {d.windows.slice(0, 2).map((w, i) => (
                    <li key={i}>
                      {minutesToLabel(w.start)}–{minutesToLabel(w.end)}
                    </li>
                  ))}
                  {d.windows.length > 2 && <li>+{d.windows.length - 2} more</li>}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────────

export function AvailabilityScreen() {
  const { status } = useSession();
  const { data, isLoading, isError, error, refetch } = useApi<{ slots: AvailabilitySlot[] }>(
    ["technician", "availability"],
    "/api/technician/availability",
    { enabled: status === "authenticated" },
  );

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const slots = data?.slots ?? [];

  const onDelete = async (slot: AvailabilitySlot) => {
    setDeletingId(slot.id);
    try {
      await apiFetch(`/api/technician/availability/${slot.id}`, { method: "DELETE" });
      toast.success(slot.isBlock ? "Block removed." : "Slot removed.");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete slot");
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Availability" />
        <LoadingState label="Loading availability…" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="Availability" />
        <ErrorState
          title="Could not load availability"
          detail={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Availability"
        description="Define when customers can book you. Add weekly recurring slots and one-off blocks for time off."
        actions={<AddSlotDialog onCreated={() => refetch()} />}
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p>
          <span className="font-medium">Slots</span> define when you&apos;re available for
          bookings. <span className="font-medium">Blocks</span> override slots for specific
          dates — useful for holidays, sick leave, or other commitments.
        </p>
      </div>

      {slots.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No availability set"
          description="Add your first weekly slot so customers can book you. By default, FixIt assumes 9 AM – 5 PM every day."
          action={
            <Button variant="outline" onClick={() => navigate("technician")}>
              Back to workspace
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <WeeklyGrid
            slots={slots}
            onDelete={(s) => onDelete(s)}
          />
          <Preview7Days slots={slots} />
        </div>
      )}

      {deletingId && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-md">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
          Deleting…
        </div>
      )}

      <div className="mt-8 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Clock className="h-4 w-4 text-primary" aria-hidden /> Tips
        </p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>Set realistic windows (e.g. 9 AM – 5 PM) — bookings are slotted into these hours.</li>
          <li>Use blocks for public holidays, vacations, or scheduled maintenance on your own equipment.</li>
          <li>Blocks only affect their specific date; recurring slots remain active every other week.</li>
        </ul>
      </div>
    </PageContainer>
  );
}

export default AvailabilityScreen;
