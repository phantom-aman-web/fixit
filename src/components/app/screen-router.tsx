"use client";

import { useSegments, useRouter } from "@/store/router";
import { useSession } from "next-auth/react";
import { LoadingState } from "@/components/shared/states";
import dynamic from "next/dynamic";

// Client-only lazy screens. ssr:false avoids server-side compilation of every
// screen on the initial route, which keeps dev-mode memory low.
const LandingScreen = dynamic(() => import("@/features/landing/landing-screen").then((m) => m.LandingScreen), { ssr: false });
const SignInScreen = dynamic(() => import("@/features/auth/signin-screen").then((m) => m.SignInScreen), { ssr: false });
const SignUpScreen = dynamic(() => import("@/features/auth/signup-screen").then((m) => m.SignUpScreen), { ssr: false });
const DashboardScreen = dynamic(() => import("@/features/dashboard/dashboard-screen").then((m) => m.DashboardScreen), { ssr: false });
const DiagnoseScreen = dynamic(() => import("@/features/diagnose/diagnose-screen").then((m) => m.DiagnoseScreen), { ssr: false });
const DiagnoseSessionScreen = dynamic(() => import("@/features/diagnose/session-screen").then((m) => m.DiagnoseSessionScreen), { ssr: false });
const EquipmentScreen = dynamic(() => import("@/features/equipment/equipment-screen").then((m) => m.EquipmentScreen), { ssr: false });
const TechniciansScreen = dynamic(() => import("@/features/marketplace/technicians-screen").then((m) => m.TechniciansScreen), { ssr: false });
const TechnicianProfileScreen = dynamic(() => import("@/features/marketplace/technician-profile-screen").then((m) => m.TechnicianProfileScreen), { ssr: false });
const BookingScreen = dynamic(() => import("@/features/bookings/booking-screen").then((m) => m.BookingScreen), { ssr: false });
const RepairScreen = dynamic(() => import("@/features/repairs/repair-screen").then((m) => m.RepairScreen), { ssr: false });
const HistoryScreen = dynamic(() => import("@/features/history/history-screen").then((m) => m.HistoryScreen), { ssr: false });
const WarrantiesScreen = dynamic(() => import("@/features/warranties/warranties-screen").then((m) => m.WarrantiesScreen), { ssr: false });
const NotificationsScreen = dynamic(() => import("@/features/notifications/notifications-screen").then((m) => m.NotificationsScreen), { ssr: false });
const TechnicianWorkspace = dynamic(() => import("@/features/technician/technician-workspace").then((m) => m.TechnicianWorkspace), { ssr: false });
const TechnicianJobs = dynamic(() => import("@/features/technician/technician-jobs").then((m) => m.TechnicianJobs), { ssr: false });
const AdminScreen = dynamic(() => import("@/features/admin/admin-screen").then((m) => m.AdminScreen), { ssr: false });
const AIDiagnoseScreen = dynamic(() => import("@/features/ai-diagnose/ai-diagnose-screen").then((m) => m.AIDiagnoseScreen), { ssr: false });
const DisputesScreen = dynamic(() => import("@/features/disputes/disputes-screen").then((m) => m.DisputesScreen), { ssr: false });
const WarrantyClaimsScreen = dynamic(() => import("@/features/warranty-claims/warranty-claims-screen").then((m) => m.WarrantyClaimsScreen), { ssr: false });
const FavoritesScreen = dynamic(() => import("@/features/favorites/favorites-screen").then((m) => m.FavoritesScreen), { ssr: false });
const CompareScreen = dynamic(() => import("@/features/compare/compare-screen").then((m) => m.CompareScreen), { ssr: false });
const AvailabilityScreen = dynamic(() => import("@/features/availability/availability-screen").then((m) => m.AvailabilityScreen), { ssr: false });
const SettingsScreen = dynamic(() => import("@/features/settings/settings-screen").then((m) => m.SettingsScreen), { ssr: false });

export function ScreenRouter() {
  const seg = useSegments();
  const navigate = useRouter((s) => s.navigate);
  const { status, data: session } = useSession();

  const first = seg[0] ?? "home";

  if (status === "loading") {
    return <LoadingState label="Starting FixIt…" />;
  }

  switch (first) {
    case "home":
      return <LandingScreen />;
    case "auth":
      if (status === "authenticated") {
        const role = (session as any)?.user?.role;
        const target = role === "ADMIN" ? "admin" : role === "TECHNICIAN" ? "technician" : "dashboard";
        setTimeout(() => navigate(target), 0);
        return <LoadingState label="Redirecting..." />;
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
      return <EquipmentScreen />;
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
    default:
      return <LandingScreen />;
  }
}
