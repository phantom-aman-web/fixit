// Provider abstractions for FixIt.
// Phase 1 implementations:
//   - DatabaseProvider → Prisma + SQLite (src/lib/db.ts)
//   - StorageProvider  → LocalStorageProvider
//   - RealtimeProvider → SocketIoRealtimeProvider (mini-service on :3003)
//   - PaymentProvider  → MockPaymentProvider
//   - AIProvider       → DISABLED (throws notImplemented) — Phase 9 only
//
// The feature layer imports only the interfaces from this file, never concrete
// implementations. A future Supabase/S3/Stripe swap replaces the concrete classes
// here without touching services or UI.

import { db } from "@/lib/db";

// ─────────────────────────── DatabaseProvider ───────────────────────────────
export interface DatabaseProvider {
  readonly client: typeof db;
}

class PrismaDatabaseProvider implements DatabaseProvider {
  readonly client = db;
}

// ─────────────────────────── StorageProvider ────────────────────────────────
export interface StoredFile {
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StorageProvider {
  save(buffer: Buffer, fileName: string, mimeType: string): Promise<StoredFile>;
  read(key: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string } | null>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
  getSignedUrl?(key: string, expiresIn?: number): Promise<string>;
}

// ─────────────────────────── RealtimeProvider ───────────────────────────────
export interface RealtimeProvider {
  emit(channel: string, event: string, payload: unknown): Promise<void>;
}

class NoopRealtimeProvider implements RealtimeProvider {
  async emit() {}
}

// ─────────────────────────── PaymentProvider ────────────────────────────────
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  providerRef: string;
}

export interface PaymentProvider {
  createIntent(params: { amount: number; currency: string; bookingId: string }): Promise<PaymentIntent>;
  capture(intentId: string): Promise<PaymentIntent>;
  refund(intentId: string): Promise<PaymentIntent>;
}

// ─────────────────────────── AIProvider (DISABLED) ──────────────────────────
export interface AIProvider {
  analyzeProblem(input: string): Promise<never>;
  extractSymptoms(input: string): Promise<never>;
  generateExplanation(input: unknown): Promise<never>;
  analyzeImage(input: Buffer): Promise<never>;
}

class DisabledAIProvider implements AIProvider {
  analyzeProblem() {
    return Promise.reject(new Error("AIProvider disabled in Phase 1"));
  }
  extractSymptoms() {
    return Promise.reject(new Error("AIProvider disabled in Phase 1"));
  }
  generateExplanation() {
    return Promise.reject(new Error("AIProvider disabled in Phase 1"));
  }
  analyzeImage() {
    return Promise.reject(new Error("AIProvider disabled in Phase 1"));
  }
}

// ─────────────────────────── Resolved providers ─────────────────────────────

export const database: DatabaseProvider = new PrismaDatabaseProvider();
export const ai: AIProvider = new DisabledAIProvider();
export const noopRealtime: RealtimeProvider = new NoopRealtimeProvider();
