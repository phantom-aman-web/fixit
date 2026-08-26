"use client";

import { useSegments, useRouter } from "@/store/router";
import { useSession } from "next-auth/react";
import {
  LoadingState,
  PageContainer,
  DashboardSkeleton,
  DetailSkeleton,
  FormSkeleton,
  GridSkeleton,
  ListSkeleton,
} from "@/components/shared/states";
import dynamic from "next/dynamic";

// ─── Skeleton wrappers used as loading fallbacks ────────────────────────────

function DashboardLoading() {
  return (
    <PageContainer>
      <DashboardSkeleton />
    </PageContainer>
  );
}

function DetailLoading() {
  return (
    <PageContainer>
      <DetailSkeleton />
    </PageContainer>
  );
}

function FormLoading() {
  return (
    <PageContainer>
      <FormSkeleton />
    </PageContainer>
  );
}

function GridLoading() {
  return (
    <PageContainer>
      <GridSkeleton count={6} />
    </PageContainer>
  );
}

function ListLoading() {
  return (
    <PageContainer>
      <ListSkeleton count={5} />
    </PageContainer>
  );
}

// ─── Client-only lazy screens ───────────────────────────────────────────────
// ssr:false avoids server-side compilation of every screen on the initial route.
// Each screen gets a contextual skeleton loader as its loading fallback.

const LandingScreen = dynamic(() => import("@/features/landing/landing-screen").then((m) => m.LandingScreen), { ssr: false });
const SignInScreen = dynamic(() => import("@/features/auth/signin-screen").then((m) => m.SignInScreen), { ssr: false, loading: () => <FormLoading /> });
const SignUpScreen = dynamic(() => import("@/features/auth/signup-screen").then((m) => m.SignUpScreen), { ssr: false, loading: () => <FormLoading /> });
const DashboardScreen = dynamic(() => import("@/features/dashboard/dashboard-screen").then((m) => m.DashboardScreen), { ssr: false, loading: () => <DashboardLoading /> });
const DiagnoseScreen = dynamic(() => import("@/features/diagnose/diagnose-screen").then((m) => m.DiagnoseScreen), { ssr: false, loading: () => <FormLoading /> });
const DiagnoseSessionScreen = dynamic(() => import("@/features/diagnose/session-screen").then((m) => m.DiagnoseSessionScreen), { ssr: false, loading: () => <DetailLoading /> });
const EquipmentScreen = dynamic(() => import("@/features/equipment/equipment-screen").then((m) => m.EquipmentScreen), { ssr: false, loading: () => <GridLoading /> });
const EquipmentDetailScreen = dynamic(() => import("@/features/equipment/equipment-detail").then((m) => m.EquipmentDetailScreen), { ssr: false, loading: () => <DetailLoading /> });
const TechniciansScreen = dynamic(() => import("@/features/marketplace/technicians-screen").then((m) => m.TechniciansScreen), { ssr: false, loading: () => <GridLoading /> });
const TechnicianProfileScreen = dynamic(() => import("@/features/marketplace/technician-profile-screen").then((m) => m.TechnicianProfileScreen), { ssr: false, loading: () => <DetailLoading /> });
const BookingScreen = dynamic(() => import("@/features/bookings/booking-screen").then((m) => m.BookingScreen), { ssr: false, loading: () => <DetailLoading /> });
const RepairScreen = dynamic(() => import("@/features/repairs/repair-screen").then((m) => m.RepairScreen), { ssr: false, loading: () => <DetailLoading /> });
const HistoryScreen = dynamic(() => import("@/features/history/history-screen").then((m) => m.HistoryScreen), { ssr: false, loading: () => <ListLoading /> });
const WarrantiesScreen = dynamic(() => import("@/features/warranties/warranties-screen").then((m) => m.WarrantiesScreen), { ssr: false, loading: () => <ListLoading /> });
const NotificationsScreen = dynamic(() => import("@/features/notifications/notifications-screen").then((m) => m.NotificationsScreen), { ssr: false, loading: () => <ListLoading /> });
const TechnicianWorkspace = dynamic(() => import("@/features/technician/technician-workspace").then((m) => m.TechnicianWorkspace), { ssr: false, loading: () => <DashboardLoading /> });
const TechnicianJobs = dynamic(() => import("@/features/technician/technician-jobs").then((m) => m.TechnicianJobs), { ssr: false, loading: () => <ListLoading /> });
const AdminScreen = dynamic(() => import("@/features/admin/admin-screen").then((m) => m.AdminScreen), { ssr: false, loading: () => <DashboardLoading /> });
const AIDiagnoseScreen = dynamic(() => import("@/features/ai-diagnose/ai-diagnose-screen").then((m) => m.AIDiagnoseScreen), { ssr: false, loading: () => <FormLoading /> });
const DisputesScreen = dynamic(() => import("@/features/disputes/disputes-screen").then((m) => m.DisputesScreen), { ssr: false, loading: () => <ListLoading /> });
const WarrantyClaimsScreen = dynamic(() => import("@/features/warranty-claims/warranty-claims-screen").then((m) => m.WarrantyClaimsScreen), { ssr: false, loading: () => <ListLoading /> });
const FavoritesScreen = dynamic(() => import("@/features/favorites/favorites-screen").then((m) => m.FavoritesScreen), { ssr: false, loading: () => <GridLoading /> });
const CompareScreen = dynamic(() => import("@/features/compare/compare-screen").then((m) => m.CompareScreen), { ssr: false, loading: () => <GridLoading /> });
const AvailabilityScreen = dynamic(() => import("@/features/availability/availability-screen").then((m) => m.AvailabilityScreen), { ssr: false, loading: () => <FormLoading /> });
const SettingsScreen = dynamic(() => import("@/features/settings/settings-screen").then((m) => m.SettingsScreen), { ssr: false, loading: () => <FormLoading /> });
const MessagesScreen = dynamic(() => import("@/features/messages/messages-screen").then((m) => m.MessagesScreen), { ssr: false, loading: () => <ListLoading /> });

export function ScreenRouter() {
  const { route, isReady } = useRouter();
  const navigate = useRouter((s) => s.navigate);
  const { status, data: session } = useSession();

  const seg = route.segments;
  const first = seg[0] ?? "home";

  if (status === "loading" || !isReady) {
    return <LoadingState label="Starting FixIt…" />;
  }

  const role = (session as any)?.user?.role;

  switch (first) {
    case "home":
      if (status === "authenticated" && (role === "ADMIN" || role === "TECHNICIAN")) {
        const target = role === "ADMIN" ? "admin" : "technician";
        Promise.resolve().then(() => navigate(target));
        return null;
      }
      return <LandingScreen />;
    case "auth":
      if (status === "authenticated") {
        const target = role === "ADMIN" ? "admin" : role === "TECHNICIAN" ? "technician" : "dashboard";
        Promise.resolve().then(() => navigate(target));
        return null;
      }
      return seg[1] === "signup" ? <SignUpScreen /> : <SignInScreen />;
    case "dashboard":
      return <DashboardScreen />;
    case "diagnose":
      return seg[1] === "session" && seg[2] ? (
        <DiagnoseSessionScreen sessionId={seg[2]} />
      ) : (
        <DiagnoseScreen />
      );
    case "ai-diagnose":
      return <AIDiagnoseScreen />;
    case "equipment":
      return seg[1] ? <EquipmentDetailScreen equipmentId={seg[1]} /> : <EquipmentScreen />;
    case "technicians":
      return seg[1] ? <TechnicianProfileScreen technicianId={seg[1]} /> : <TechniciansScreen />;
    case "booking":
      return seg[1] ? <BookingScreen bookingId={seg[1]} /> : <DashboardScreen />;
    case "repair":
      return seg[1] ? <RepairScreen jobId={seg[1]} /> : <DashboardScreen />;
    case "history":
      return <HistoryScreen />;
    case "warranties":
      return <WarrantiesScreen />;
    case "notifications":
      return <NotificationsScreen />;
    case "technician":
      return seg[1] === "jobs" ? <TechnicianJobs /> : <TechnicianWorkspace />;
    case "admin":
      return <AdminScreen />;
    case "disputes":
      return <DisputesScreen />;
    case "warranty-claims":
      return <WarrantyClaimsScreen />;
    case "favorites":
      return <FavoritesScreen />;
    case "compare":
      return <CompareScreen />;
    case "availability":
      return <AvailabilityScreen />;
    case "settings":
      return <SettingsScreen />;
    case "messages":
      return <MessagesScreen />;
    default:
      // Unknown route: redirect authenticated users to their workspace,
      // show landing page for unauthenticated users.
      if (status === "authenticated" && (role === "ADMIN" || role === "TECHNICIAN")) {
        const target = role === "ADMIN" ? "admin" : "technician";
        Promise.resolve().then(() => navigate(target));
        return null;
      }
      return <LandingScreen />;
  }
}
