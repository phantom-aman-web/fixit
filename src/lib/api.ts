import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { type User } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "CUSTOMER" | "TECHNICIAN" | "ADMIN";
};

let mockUser: User | null = null;
export function setMockUserForTests(user: User | null) { mockUser = user; }

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function requireAuth(): Promise<User> {
  if (mockUser) return mockUser;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new HttpError(401, "Unauthorized");
  
  const user = await db.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new HttpError(401, "User not found");
  
  return user;
}

export async function requireRole(...roles: SessionUser["role"][]): Promise<SessionUser> {
  const u = await requireAuth();
  if (!roles.includes(u.role as any)) throw new HttpError(403, "Not authorized");
  return u as SessionUser;
}

export async function requireCustomerProfile() {
  const u = await requireRole("CUSTOMER", "ADMIN");
  let profile = await db.customerProfile.findUnique({ where: { userId: u.id } });
  
  console.log("DEBUG requireCustomerProfile CALLED. role:", u.role, "profileExists:", !!profile);

  if (!profile) {
    if (u.role === "ADMIN") {
      console.log("DEBUG: Auto-creating profile for ADMIN", u.id);
      // Auto-create a real profile for admins testing customer flows
      profile = await db.customerProfile.create({
        data: {
          userId: u.id,
          phone: "+0000000000",
          city: "Admin City",
        }
      });
      console.log("DEBUG: Profile created", profile.id);
    } else {
      console.log("DEBUG: Throwing 404 Customer profile not found");
      throw new HttpError(404, "Customer profile not found");
    }
  }
  return { user: u, profile };
}

export async function requireTechnicianProfile() {
  const u = await requireRole("TECHNICIAN", "ADMIN");
  let profile = await db.technicianProfile.findUnique({ where: { userId: u.id } });
  
  if (!profile) {
    if (u.role === "ADMIN") {
      // Auto-create a real profile for admins testing technician flows
      profile = await db.technicianProfile.create({
        data: {
          userId: u.id,
          displayName: "Admin Technician",
          phone: "+0000000000",
          status: "ACTIVE",
          verified: true
        }
      });
    } else {
      throw new HttpError(404, "Technician profile not found");
    }
  }
  // A PENDING or SUSPENDED technician must not perform technician operations.
  // Admins bypass this.
  if (u.role !== "ADMIN" && profile.status !== "ACTIVE") {
    throw new HttpError(403, "Your technician account is not yet approved");
  }
  return { user: u, profile };
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function apiError(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  // Use structured logging for internal errors — never expose stack traces.
  const msg = err instanceof Error ? err.message : String(err);
  if (process.env.NODE_ENV === "production") {
    console.error(JSON.stringify({ level: "error", message: "Internal server error", error: msg, timestamp: new Date().toISOString() }));
  } else {
    console.error("[api]", err);
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export async function isAdmin(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId } });
  return u?.role === "ADMIN";
}
