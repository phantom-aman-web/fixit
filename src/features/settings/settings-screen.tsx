"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bell,
  Briefcase,
  FileText,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  User as UserIcon,
  Wrench,
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
  FormSkeleton,
  ListSkeleton,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { apiFetch, useApi } from "@/hooks/use-api";
import { formatCurrency, formatDate } from "@/lib/format";
import { MediaUploader } from "@/components/shared/media-uploader";

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

type CustomerProfile = {
  id: string;
  subCity?: string | null;
  phone?: string | null;
  user?: { name?: string | null; image?: string | null } | null;
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

  if (isLoading) return <FormSkeleton />;
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

  if (isLoading) return <FormSkeleton />;
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
// Customer profile edit
// ────────────────────────────────────────────────────────────────────────────────

function CustomerProfileCard() {
  const { data, isLoading, isError, error, refetch } = useApi<{ profile: CustomerProfile }>(
    ["customer", "profile"],
    "/api/customer/profile",
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [subCity, setSubCity] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const server = data?.profile;
  useEffect(() => {
    if (server && !hydrated) {
      setName(server.user?.name || "");
      setPhone(server.phone || "");
      setSubCity(server.subCity || "");
      setImages(server.user?.image ? [server.user.image] : []);
      setHydrated(true);
    }
  }, [server, hydrated]);

  const dirty = useMemo(() => {
    if (!server || !hydrated) return false;
    if (name !== (server.user?.name || "")) return true;
    if (phone !== (server.phone || "")) return true;
    if (subCity !== (server.subCity || "")) return true;
    const currentImage = server.user?.image || "";
    const newImage = images[0] || "";
    if (currentImage !== newImage) return true;
    return false;
  }, [server, hydrated, name, phone, subCity, images]);

  const save = async () => {
    if (!server) return;
    setSaving(true);
    try {
      await apiFetch("/api/customer/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          subCity: subCity.trim() || undefined,
          image: images[0] || undefined,
        }),
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
    setName(server.user?.name || "");
    setPhone(server.phone || "");
    setSubCity(server.subCity || "");
    setImages(server.user?.image ? [server.user.image] : []);
  };

  if (isLoading) return <FormSkeleton />;
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
        <CardTitle className="flex items-center gap-2 text-base">
          <UserIcon className="h-4 w-4 text-primary" aria-hidden />
          Customer profile
        </CardTitle>
        <CardDescription>
          Update your personal information and profile picture.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Profile Picture</Label>
          <MediaUploader value={images} onChange={setImages} maxFiles={1} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cp-name">Full name</Label>
            <Input
              id="cp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Abebe Kebede"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-phone">Phone</Label>
            <Input
              id="cp-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+251 9…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-subcity">Sub-city</Label>
            <Input
              id="cp-subcity"
              value={subCity}
              onChange={(e) => setSubCity(e.target.value)}
              placeholder="e.g. Bole"
            />
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

  const { data: userData } = useApi<{ user: { image: string | null } }>(
    ["user-profile"],
    "/api/user"
  );
  
  const hasProfilePicture = !!userData?.user?.image;

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

  if (isLoading) return <ListSkeleton />;
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
          <div className="mt-3 flex items-center gap-3">
            {hasProfilePicture ? (
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
            ) : (
              <div className="text-sm text-destructive font-medium border border-destructive/20 bg-destructive/10 p-2 rounded-md">
                Please upload a profile picture in the Account Profile section above before you can submit verification documents.
              </div>
            )}
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
// Technician skills management
// ────────────────────────────────────────────────────────────────────────────────

type SkillRow = {
  id: string;
  skill: string;
  equipmentCategory: string | null;
  proficiency: number;
};

const PROFICIENCY_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Intermediate",
  3: "Advanced",
  4: "Expert",
  5: "Master",
};

function TechnicianSkillsCard() {
  const { data, isLoading, isError, error, refetch } = useApi<{
    profile: { skills: SkillRow[] };
  }>(["technician", "verification"], "/api/technician/verification");

  const categoriesApi = useApi<{ categories: { id: string; slug: string; name: string }[] }>(
    ["equipment-categories"],
    "/api/equipment-categories",
  );

  const [newSkill, setNewSkill] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newProficiency, setNewProficiency] = useState(3);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const skills = data?.profile?.skills ?? [];
  const categories = categoriesApi.data?.categories ?? [];

  const addSkill = async () => {
    if (!newSkill.trim()) {
      toast.error("Please enter a skill name.");
      return;
    }
    setAdding(true);
    try {
      await apiFetch("/api/technician/skills", {
        method: "POST",
        body: JSON.stringify({
          skill: newSkill.trim(),
          equipmentCategory: newCategory || undefined,
          proficiency: newProficiency,
        }),
      });
      toast.success("Skill added.");
      setNewSkill("");
      setNewCategory("");
      setNewProficiency(3);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add skill");
    } finally {
      setAdding(false);
    }
  };

  const removeSkill = async (skillId: string) => {
    setDeletingId(skillId);
    try {
      await apiFetch("/api/technician/skills", {
        method: "DELETE",
        body: JSON.stringify({ skillId }),
      });
      toast.success("Skill removed.");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove skill");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) return <FormSkeleton />;
  if (isError)
    return (
      <ErrorState
        title="Could not load skills"
        detail={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="h-4 w-4 text-primary" aria-hidden />
          Skills
        </CardTitle>
        <CardDescription>
          Add your repair skills so customers can find you for the right jobs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing skills */}
        {skills.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
            No skills added yet. Add your first skill below.
          </p>
        ) : (
          <div className="space-y-2">
            {skills.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium capitalize">
                      {s.skill.replace(/_/g, " ")}
                    </p>
                    {s.equipmentCategory && (
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {s.equipmentCategory.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <Star
                          key={level}
                          className={`h-3 w-3 ${level <= s.proficiency ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {PROFICIENCY_LABELS[s.proficiency] ?? `Level ${s.proficiency}`}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => removeSkill(s.id)}
                  disabled={deletingId === s.id}
                >
                  {deletingId === s.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new skill */}
        <div className="rounded-md border border-dashed border-border p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Add a skill
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sk-name">Skill name</Label>
              <Input
                id="sk-name"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="e.g. refrigerator_repair"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sk-cat">Equipment category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger id="sk-cat">
                  <SelectValue placeholder="(optional)" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Proficiency: {PROFICIENCY_LABELS[newProficiency]}</Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setNewProficiency(level)}
                    className="p-0.5 focus:outline-none focus:ring-1 focus:ring-primary rounded"
                  >
                    <Star
                      className={`h-5 w-5 transition-colors ${level <= newProficiency ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-300"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button size="sm" onClick={addSkill} disabled={adding}>
            {adding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Adding…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden /> Add skill
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Technician service areas management
// ────────────────────────────────────────────────────────────────────────────────

function TechnicianServiceAreasCard() {
  const { data, isLoading, isError, error, refetch } = useApi<{
    areas: { id: string; name: string; city: string }[];
    assignedIds: string[];
  }>(["technician", "service-areas"], "/api/technician/service-areas");

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const areas = data?.areas ?? [];
  const assignedIds = data?.assignedIds ?? [];

  const toggle = async (areaId: string, currentlyAssigned: boolean) => {
    setTogglingId(areaId);
    try {
      if (currentlyAssigned) {
        await apiFetch("/api/technician/service-areas", {
          method: "DELETE",
          body: JSON.stringify({ serviceAreaId: areaId }),
        });
        toast.success("Service area removed.");
      } else {
        await apiFetch("/api/technician/service-areas", {
          method: "POST",
          body: JSON.stringify({ serviceAreaId: areaId }),
        });
        toast.success("Service area added.");
      }
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update service area");
    } finally {
      setTogglingId(null);
    }
  };

  if (isLoading) return <FormSkeleton />;
  if (isError)
    return (
      <ErrorState
        title="Could not load service areas"
        detail={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-primary" aria-hidden />
          Service areas
        </CardTitle>
        <CardDescription>
          Toggle on the sub-cities where you can provide service. Customers in those areas will see you in their search results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {areas.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
            No service areas configured. Contact admin.
          </p>
        ) : (
          areas.map((area) => {
            const assigned = assignedIds.includes(area.id);
            const toggling = togglingId === area.id;
            return (
              <div
                key={area.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className={`h-4 w-4 shrink-0 ${assigned ? "text-primary" : "text-muted-foreground/40"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{area.name}</p>
                    <p className="text-xs text-muted-foreground">{area.city}</p>
                  </div>
                </div>
                <Switch
                  checked={assigned}
                  disabled={toggling}
                  onCheckedChange={() => toggle(area.id, assigned)}
                  aria-label={`Toggle ${area.name}`}
                />
              </div>
            );
          })
        )}
        <p className="pt-1 text-xs text-muted-foreground">
          {assignedIds.length} of {areas.length} areas selected
        </p>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Account summary card
// ────────────────────────────────────────────────────────────────────────────────

function AccountProfileCard({ email, role }: { email?: string | null; role?: string }) {
  const { data, isLoading, refetch } = useApi<{ user: { id: string; name: string | null; email: string; image: string | null; role: string } }>(
    ["user-profile"],
    "/api/user"
  );

  const [name, setName] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.user) {
      setName(data.user.name || "");
      setImageUrls(data.user.image ? [data.user.image] : []);
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/user", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          image: imageUrls.length > 0 ? imageUrls[0] : "",
        }),
      });
      toast.success("Account profile saved");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <FormSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserIcon className="h-4 w-4 text-primary" aria-hidden />
          Account Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">Full Name</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Profile Picture</Label>
            <MediaUploader value={imageUrls} onChange={setImageUrls} maxFiles={1} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mt-4 rounded-md border p-3">
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
        
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="inline-flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" aria-hidden /> Save changes
              </>
            )}
          </Button>
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
        <FormSkeleton />
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
        { value: "skills", label: "Skills & Areas" },
        { value: "documents", label: "Documents" },
        { value: "account", label: "Account" },
      ]
    : [
        { value: "notifications", label: "Notifications" },
        { value: "profile", label: "Profile" },
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
        
        {!isTechnician && (
          <TabsContent value="profile" className="mt-0">
            <CustomerProfileCard />
          </TabsContent>
        )}

        {isTechnician && (
          <TabsContent value="skills" className="mt-0 space-y-6">
            <TechnicianSkillsCard />
            <TechnicianServiceAreasCard />
          </TabsContent>
        )}

        {isTechnician && (
          <TabsContent value="documents" className="mt-0">
            <TechnicianDocumentsCard />
          </TabsContent>
        )}

        <TabsContent value="account" className="mt-0">
          <AccountProfileCard email={session.user?.email} role={role} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

export default SettingsScreen;
