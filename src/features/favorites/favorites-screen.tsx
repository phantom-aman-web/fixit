"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Heart,
  MapPin,
  Star,
  Trash2,
  UserRound,
  Wrench,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
} from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badges";
import { apiFetch, useApi } from "@/hooks/use-api";
import { navigate } from "@/store/router";

// ────────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────────

type Skill = {
  id: string;
  skill: string;
  equipmentCategory?: string | null;
  proficiency: number;
};

type ServiceArea = { id: string; name: string; city: string };

type Technician = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  yearsExperience: number;
  completedJobs: number;
  rating: number;
  ratingCount: number;
  responseTimeHours: number;
  baseCallOutFee?: number | null;
  hourlyRate?: number | null;
  verified: boolean;
  status: string;
  availability: string;
  skills: Skill[];
  serviceAreas: { id: string; serviceArea: ServiceArea }[];
};

type Favorite = {
  id: string;
  createdAt: string;
  technician: Technician;
};

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

// ────────────────────────────────────────────────────────────────────────────────
// Favorite card
// ────────────────────────────────────────────────────────────────────────────────

function FavoriteCard({
  fav,
  onRemove,
}: {
  fav: Favorite;
  onRemove: (tech: Technician) => void;
}) {
  const t = fav.technician;
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 border">
            {t.avatarUrl ? <AvatarImage src={t.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials(t.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-semibold leading-tight">{t.displayName}</h3>
              {t.verified && (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                >
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                <span className="font-medium text-foreground">{t.rating.toFixed(1)}</span>
                <span>({t.ratingCount})</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5" aria-hidden />
                {t.completedJobs} jobs
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {t.yearsExperience}y exp
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={t.availability} />
        </div>

        {t.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {t.skills.slice(0, 5).map((s) => (
              <Badge key={s.id} variant="secondary" className="text-xs">
                {s.skill.replaceAll("_", " ")}
              </Badge>
            ))}
            {t.skills.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{t.skills.length - 5} more
              </Badge>
            )}
          </div>
        )}

        {t.serviceAreas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {t.serviceAreas.slice(0, 4).map((a) => (
              <Badge
                key={a.id}
                variant="outline"
                className="gap-1 text-xs text-muted-foreground"
              >
                <MapPin className="h-3 w-3" aria-hidden /> {a.serviceArea.name}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`technicians/${t.id}`)}
          >
            <UserRound className="h-4 w-4" aria-hidden />
            View profile
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:bg-destructive/5"
            onClick={() => onRemove(t)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────────

export function FavoritesScreen() {
  const { status } = useSession();
  const { data, isLoading, isError, error, refetch } = useApi<{ favorites: Favorite[] }>(
    ["favorites"],
    "/api/favorites",
    { enabled: status === "authenticated" },
  );

  const [pendingRemove, setPendingRemove] = useState<Technician | null>(null);
  const [removing, setRemoving] = useState(false);

  const remove = async (tech: Technician) => {
    setRemoving(true);
    try {
      await apiFetch(`/api/favorites/${tech.id}`, { method: "DELETE" });
      toast.success(`Removed ${tech.displayName} from favorites.`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove favorite");
    } finally {
      setRemoving(false);
      setPendingRemove(null);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Favorite technicians" />
        <LoadingState label="Loading favorites…" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <PageHeader title="Favorite technicians" />
        <ErrorState
          title="Could not load favorites"
          detail={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  const favorites = data?.favorites ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Favorite technicians"
        description="Technicians you've saved for quick access."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("technicians")}>
            <Wrench className="h-4 w-4" aria-hidden /> Browse marketplace
          </Button>
        }
      />

      {favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No favorite technicians yet"
          description="Browse the marketplace to find ones you trust."
          action={
            <Button onClick={() => navigate("technicians")}>
              <Wrench className="h-4 w-4" aria-hidden /> Find technicians
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {favorites.map((f) => (
            <FavoriteCard key={f.id} fav={f} onRemove={setPendingRemove} />
          ))}
        </div>
      )}

      <AlertDialog
        open={!!pendingRemove}
        onOpenChange={(o) => !o && setPendingRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from favorites?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove
                ? `${pendingRemove.displayName} will no longer appear in your saved list. You can favorite them again later.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={removing}
              onClick={() => pendingRemove && remove(pendingRemove)}
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

export default FavoritesScreen;
