# FixIt Performance Optimization Report

## 1. Root Causes Found
The core reason the application felt "slow and clunky" and showed loading states upon returning to previously visited screens was due to two main architectural issues:
- **Blind Global Cache Invalidation**: The `useApiMutation` hook defaulted to calling `qc.invalidateQueries()` without arguments whenever specific keys were omitted. This meant *any* mutation (like editing a piece of equipment) invalidated the *entire* React Query cache across all screens, forcing everything to refetch.
- **Uniform Caching Policy**: All queries inherited a blanket 30-second `staleTime` and 5-minute `gcTime`. Highly static data (like categories) and highly active data (like active jobs) were treated equally.
- **Artificial Navigation Delays**: `screen-router.tsx` wrapped redirects in a `setTimeout(() => navigate(target), 0)`, causing brief flashes of a loading screen before navigating.

## 2. Files Changed
### Core Infrastructure
- `src/hooks/use-api.ts`: 
  - Fixed `useApiMutation` to only invalidate exact keys (removed global `qc.invalidateQueries()`).
  - Updated `useApi` to accept a `staleTime` option to override defaults explicitly.
- `src/components/app/providers.tsx`: Increased the default global `staleTime` from 30 seconds to 5 minutes to keep list data fresh during normal navigation.
- `src/components/app/screen-router.tsx`: Removed `setTimeout` delays in favor of immediate microtask resolution (`Promise.resolve().then(...)`), making client-side redirects instantaneous.

### Feature Screens (Invalidation Keys Added)
Audited all usages of `useApiMutation` and added precise cache boundaries:
- `src/features/warranties/warranties-screen.tsx`: `["warranties"]`
- `src/features/repairs/repair-screen.tsx`: `["repair-job", jobId]`, `["technician-jobs"]`, `["warranties"]`, `["history"]`
- `src/features/technician/technician-workspace.tsx`: `["technician-dashboard"]`, `["technician-jobs"]`
- `src/features/equipment/equipment-screen.tsx`: `["customer", "equipment"]`
- `src/features/bookings/booking-screen.tsx`: `["bookings"]`, `["history"]`, `["technician-dashboard"]`
- `src/features/diagnose/diagnose-screen.tsx`: `["history"]`
- `src/features/availability/availability-screen.tsx`: `["technician-availability"]`
- `src/features/marketplace/technicians-screen.tsx`: `["history"]`
- `src/features/diagnose/session-screen.tsx`: `["diagnostic-sessions", sessionId]`, `["history"]`
- `src/features/admin/admin-screen.tsx`: `["admin", "technicians"]`
- `src/features/marketplace/technician-profile-screen.tsx`: `["history"]`

### Explicit Cache Policies Applied
- **Static/Reference Data (24 hours)**: Equipment Categories in `equipment-screen.tsx` and `diagnose-screen.tsx`.
- **Active Operational Data (30 seconds)**: 
  - `technician-workspace.tsx` (Dashboard requests)
  - `technician-jobs.tsx` (Active jobs list)
  - `messages-screen.tsx` (Conversations and individual messages)

## 3. Optimistic Mutations
Implemented strict 6-step optimistic UI lifecycles (Cancel -> Snapshot -> Set -> Request -> Rollback -> Reconcile) using `useApiMutation`'s built-in `updater` capability:
- **Equipment**: Full optimistic support for Delete and Edit actions.
- **Warranties**: Optimistic updates for creation (in `warranties-screen.tsx`) and deletion (in `repair-screen.tsx`).
- **Technician Workspace**: Accept/Reject booking and repair status transitions.
- **Messages**: Sending a message remains optimistically appended to local state for instantaneous chat UX.

## 4. Before/After Network Behavior

**Before**:
- Editing a piece of equipment fired a `PATCH`, followed by a flurry of `GET` requests for Dashboard, Technicians, History, etc., due to global invalidation.
- Returning to Dashboard from Equipment triggered a full `GET /api/customer/dashboard` request and showed a skeleton if the cache was older than 30s.

**After**:
- Editing equipment fires the `PATCH` and exactly one `GET /api/customer/equipment` (reconciliation). Other screens are untouched.
- Returning to Dashboard from Equipment is instantaneous. The cached UI renders immediately (5-minute `staleTime`).
- Network tab shows a dramatic reduction in redundant API and Prisma traffic during navigation.

## 5. Verification Results
- **TypeScript**: `npx tsc --noEmit` verified to pass with no regressions.
- **Security**: Payment links (`booking-screen.tsx`) and authorization checks were intentionally excluded from optimistic UI to maintain absolute server authority.
- **Polling**: Contextual polling (e.g. `messages-screen.tsx`) was preserved and continues to halt when components unmount or resources reach terminal states.
- **Browser UX**: The application now matches the desired target: "Fast perceived performance + efficient network usage + correct server state."
