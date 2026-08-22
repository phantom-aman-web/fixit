"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bell,
  Briefcase,
  FileText,
  Loader2,
  LogOut,
  Save,
  ShieldCheck,
  Upload,
  User as UserIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { apiFetch, useApi } from "@/hooks/use-api";
import { formatCurrency, formatDate } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type NotificationPreferences = {
  bookingUpdates: boolean;
  repairUpdates: boolean;
  paymentNotifications: boolean;
  warrantyReminders: boolean;
  reviewRequests: boolean;
  disputeUpdates: boolean;
  marketing: boolean;
};

type TechnicianDocument = {
  id: string;
  type: "identity" | "certification" | "insurance" | "other";
  fileName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote?: string | null;
  createdAt: string;
};

type TechnicianProfile = {
  id: string;
  displayName: string;
  bio?: string | null;
  phone?: string | null;
  yearsExperience: number;
  baseCallOutFee?: number | null;
  hourlyRate?: number | null;
  verified: boolean;
  status: string;
  documents?: TechnicianDocument[];
};

// ────────────────────────────────────────────────────────────────────────────────
// Notification preferences card
// ────────────────────────────────────────────────────────────────────────────────

const PREF_LABELS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: "bookingUpdates", label: "Booking updates", description: "Confirmations, reminders, and reschedules." },
  { key: "repairUpdates", label: "Repair progress", description: "Status changes on your active repair jobs." },
  { key: "paymentNotifications", label: "Payments", description: "Receipts, refunds, and payment failures." },
  { key: "warrantyReminders", label: "Warranty reminders", description: "Heads-up before an active warranty expires." },
  { key: "reviewRequests", label: "Review requests", description: "Prompt to review after a completed repair." },
  { key: "disputeUpdates", label: "Dispute updates", description: "New messages and resolutions on your disputes." },
  { key: "marketing", label: "Tips & promotions", description: "Occasional tips for maintaining your appliances." },
];

function NotificationPreferencesCard() {
  const { data, isLoading, isError, error, refetch } = useApi<{ preferences: NotificationPreferences }>(
    ["notification-preferences"],
    "/api/notification-preferences",
  );

  const [local, setLocal] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSerialized, setLastSerialized] = useState<string>("");

  // Sync local state when server data changes (avoid setState-in-effect loop).
  const server = data?.preferences;
  useEffect(() => {
    if (server) {
      const serialized = JSON.stringify(server);
      if (serialized !== lastSerialized) {
        setLocal(server);
        setLastSerialized(serialized);
      }
    }
  }, [server, lastSerialized]);

  const dirty = useMemo(() => {
    if (!server || !local) return false;
    return JSON.stringify(server) !== JSON.stringify(local);
  }, [server, local]);

  const toggle = (key: keyof NotificationPreferences, value: boolean) => {
    setLocal((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!local) return;
    setSaving(true);
    try {
      await apiFetch("/api/notification-preferences", {
        method: "PATCH",
        body: JSON.stringify(local),
      });
      toast.success("Notification preferences saved.");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading preferences…" />;
  if (isError)
    return (
      <ErrorState
        title="Could not load preferences"
        detail={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" aria-hidden />
          Notification preferences
        </CardTitle>
        <CardDescription>
          Choose which notifications you want to receive. Critical account alerts cannot be turned off.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {local &&
          PREF_LABELS.map(({ key, label, description }) => (
            <div
              key={key}
              className="flex items-start justify-between gap-3 rounded-md border border-border bg-background p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                checked={local[key]}
                onCheckedChange={(v) => toggle(key, v)}
                aria-label={label}
              />
            </div>
          ))}
        <div className="flex justify-end gap-2 pt-1">
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => server && setLocal(server)}
              disabled={saving}
            >
              Reset
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden /> Save changes
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Technician profile edit
// ────────────────────────────────────────────────────────────────────────────────

function TechnicianProfileCard() {
  const { data, isLoading, isError, error, refetch } = useApi<{ profile: TechnicianProfile }>(
    ["technician", "verification"],
    "/api/technician/verification",
  );

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [yearsExperience, setYearsExperience] = useState("0");
  const [baseCallOutFee, setBaseCallOutFee] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const server = data?.profile;
  useEffect(() => {
    if (server && !hydrated) {
      setDisplayName(server.displayName || "");
      setBio(server.bio || "");
      setPhone(server.phone || "");
      setYearsExperience(String(server.yearsExperience ?? 0));
      setBaseCallOutFee(
        server.baseCallOutFee != null ? String(Math.round(server.baseCallOutFee / 100)) : "",
      );
      setHourlyRate(
        server.hourlyRate != null ? String(Math.round(server.hourlyRate / 100)) : "",
      );
      setHydrated(true);
    }
  }, [server, hydrated]);

  const dirty = useMemo(() => {
    if (!server || !hydrated) return false;
    if (displayName !== (server.displayName || "")) return true;
    if (bio !== (server.bio || "")) return true;
    if (phone !== (server.phone || "")) return true;
    if (yearsExperience !== String(server.yearsExperience ?? 0)) return true;
    const srvCallOut =
      server.baseCallOutFee != null ? String(Math.round(server.baseCallOutFee / 100)) : "";
    if (baseCallOutFee !== srvCallOut) return true;
    const srvHourly =
      server.hourlyRate != null ? String(Math.round(server.hourlyRate / 100)) : "";
    if (hourlyRate !== srvHourly) return true;
    return false;
  }, [server, hydrated, displayName, bio, phone, yearsExperience, baseCallOutFee, hourlyRate]);

  const save = async () => {
    if (!server) return;
    setSaving(true);
    try {
      const payload: any = {
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        phone: phone.trim() || undefined,
        yearsExperience: parseInt(yearsExperience || "0", 10),
      };
      if (baseCallOutFee.trim() !== "") {
        const v = parseInt(baseCallOutFee, 10);
        if (!isNaN(v)) payload.baseCallOutFee = v * 100;
      }
      if (hourlyRate.trim() !== "") {
        const v = parseInt(hourlyRate, 10);
        if (!isNaN(v)) payload.hourlyRate = v * 100;
      }
      await apiFetch("/api/technician/verification", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("Profile updated.");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (!server) return;
    setDisplayName(server.displayName || "");
    setBio(server.bio || "");
    setPhone(server.phone || "");
    setYearsExperience(String(server.yearsExperience ?? 0));
    setBaseCallOutFee(
      server.baseCallOutFee != null ? String(Math.round(server.baseCallOutFee / 100)) : "",
    );
    setHourlyRate(
      server.hourlyRate != null ? String(Math.round(server.hourlyRate / 100)) : "",
    );
  };

  if (isLoading) return <LoadingState label="Loading profile…" />;
  if (isError)
    return (
      <ErrorState
        title="Could not load profile"
        detail={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" aria-hidden />
            Technician profile
          </span>
          {server && (
            <div className="flex items-center gap-2">
              <StatusBadge status={server.status} />
              {server.verified ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                >
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Pending verification
                </Badge>
              )}
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Customers see your display name, bio, and rates on the marketplace. Rates are in ETB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tp-name">Display name</Label>
            <Input
              id="tp-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Abebe Repair Co."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tp-phone">Phone</Label>
            <Input
              id="tp-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+251 9…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tp-exp">Years of experience</Label>
            <Input
              id="tp-exp"
              type="number"
              min={0}
              max={60}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tp-callout">Call-out fee (ETB)</Label>
            <Input
              id="tp-callout"
              type="number"
              min={0}
              value={baseCallOutFee}
              onChange={(e) => setBaseCallOutFee(e.target.value)}
              placeholder="e.g. 500"
            />
            <p className="text-xs text-muted-foreground">
              {baseCallOutFee && !isNaN(parseInt(baseCallOutFee, 10))
                ? `Charged as ${formatCurrency(parseInt(baseCallOutFee, 10) * 100)} per visit`
                : "Leave empty to use the platform default."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tp-hourly">Hourly rate (ETB)</Label>
            <Input
              id="tp-hourly"
              type="number"
              min={0}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="e.g. 300"
            />
            <p className="text-xs text-muted-foreground">
              {hourlyRate && !isNaN(parseInt(hourlyRate, 10))
                ? `Charged as ${formatCurrency(parseInt(hourlyRate, 10) * 100)} per hour of work`
                : "Leave empty to use the platform default."}
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tp-bio">Bio</Label>
            <Textarea
              id="tp-bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell customers about your expertise, certifications, and the brands you service…"
            />
            <p className="text-xs text-muted-foreground">{bio.length}/2000</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {dirty && (
            <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
              Reset
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden /> Save profile
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Document upload card
// ────────────────────────────────────────────────────────────────────────────────

const DOC_TYPES: { value: TechnicianDocument["type"]; label: string; description: string }[] = [
  { value: "identity", label: "Identity document", description: "National ID, passport, or driving licence." },
  { value: "certification", label: "Certification", description: "Trade license or technical certification." },
  { value: "insurance", label: "Insurance", description: "Liability or business insurance certificate." },
  { value: "other", label: "Other", description: "Any other supporting document." },
];

const ALLOWED_DOC_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_DOC_BYTES = 5 * 1024 * 1024;

function TechnicianDocumentsCard() {
  const { data, isLoading, isError, error, refetch } = useApi<{ documents: TechnicianDocument[] }>(
    ["technician", "documents"],
    "/api/technician/documents",
  );

  const [docType, setDocType] = useState<TechnicianDocument["type"]>("identity");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async () => {
    if (!file) {
      toast.error("Please pick a file.");
      return;
    }
    if (!ALLOWED_DOC_MIME.includes(file.type)) {
      toast.error("Unsupported file type. Use JPG, PNG, WebP, or PDF.");
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      toast.error("File too large. Max 5MB.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      await apiFetch("/api/technician/documents", {
        method: "POST",
        body: JSON.stringify({
          type: docType,
          fileName: file.name,
          mimeType: file.type,
          data: dataUrl,
        }),
      });
      toast.success("Document uploaded. Awaiting admin review.");
      setFile(null);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not upload document");
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading documents…" />;
  if (isError)
    return (
      <ErrorState
        title="Could not load documents"
        detail={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    );

  const documents = data?.documents ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" aria-hidden />
          Verification documents
        </CardTitle>
        <CardDescription>
          Upload identity, certification, and insurance documents to get verified. Verified
          technicians rank higher in the marketplace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-dashed border-border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc-type">Document type</Label>
              <Select
                value={docType}
                onValueChange={(v) => setDocType(v as TechnicianDocument["type"])}
              >
                <SelectTrigger id="doc-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {DOC_TYPES.find((d) => d.value === docType)?.description}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-file">File</Label>
              <Input
                id="doc-file"
                type="file"
                accept={ALLOWED_DOC_MIME.join(",")}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP, or PDF · max 5MB</p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={upload} disabled={uploading || !file}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" aria-hidden /> Upload
                </>
              )}
            </Button>
          </div>
        </div>

        {documents.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
            No documents uploaded yet. Upload one above to start verification.
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOC_TYPES.find((d) => d.value === doc.type)?.label ?? doc.type} ·{" "}
                      {formatDate(doc.createdAt)}
                    </p>
                    {doc.reviewNote && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Reviewer: {doc.reviewNote}
                      </p>
                    )}
                  </div>
                </div>
                <StatusBadge status={doc.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Account summary card
// ────────────────────────────────────────────────────────────────────────────────

function AccountCard({
  email,
  name,
  role,
}: {
  email?: string | null;
  name?: string | null;
  role?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserIcon className="h-4 w-4 text-primary" aria-hidden />
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{name || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="truncate font-medium">{email || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <Badge variant="secondary" className="capitalize">
              {role?.toLowerCase() ?? "—"}
            </Badge>
          </div>
        </div>
        <div className="pt-2">
          <Link
            href="/api/auth/signout"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isTechnician = role === "TECHNICIAN";

  if (status === "loading") {
    return (
      <PageContainer>
        <PageHeader title="Settings" />
        <LoadingState />
      </PageContainer>
    );
  }

  if (status !== "authenticated") {
    return (
      <PageContainer>
        <EmptyState
          icon={UserIcon}
          title="Sign in to manage settings"
          description="Customize your notifications, profile, and account preferences."
        />
      </PageContainer>
    );
  }

  const tabs = isTechnician
    ? [
        { value: "notifications", label: "Notifications" },
        { value: "profile", label: "Profile" },
        { value: "documents", label: "Documents" },
        { value: "account", label: "Account" },
      ]
    : [
        { value: "notifications", label: "Notifications" },
        { value: "account", label: "Account" },
      ];

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage your notification preferences, profile, and account."
      />

      <Tabs defaultValue="notifications">
        <TabsList className="mb-4 flex w-full justify-start overflow-x-auto sm:w-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="notifications" className="mt-0">
          <NotificationPreferencesCard />
        </TabsContent>

        {isTechnician && (
          <TabsContent value="profile" className="mt-0">
            <TechnicianProfileCard />
          </TabsContent>
        )}

        {isTechnician && (
          <TabsContent value="documents" className="mt-0">
            <TechnicianDocumentsCard />
          </TabsContent>
        )}

        <TabsContent value="account" className="mt-0">
          <AccountCard email={session.user?.email} name={session.user?.name} role={role} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

export default SettingsScreen;
