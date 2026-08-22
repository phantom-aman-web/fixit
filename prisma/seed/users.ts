import { db } from "../../src/lib/db";
import bcrypt from "bcryptjs";
import { ADDIS_ABABA_AREAS } from "../../src/lib/geo";

// Demo users + customer/technician/admin profiles.
// Passwords are weak on purpose and shown on the sign-in page.

const DEMO_PASSWORDS = {
  admin: "fixit-admin",
  customer: "fixit-cust",
  technician: "fixit-tech",
};

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function seedUsersAndProfiles() {
  const adminHash = await hash(DEMO_PASSWORDS.admin);
  const customerHash = await hash(DEMO_PASSWORDS.customer);
  const techHash = await hash(DEMO_PASSWORDS.technician);

  // Admin
  const admin = await db.user.create({
    data: {
      email: "admin@fixit.demo",
      name: "FixIt Admin",
      role: "ADMIN",
      passwordHash: adminHash,
    },
  });
  // Admin has no customer/technician profile by design.

  // Demo customer
  const cust = await db.user.create({
    data: {
      email: "customer@fixit.demo",
      name: "Selam Bekele",
      role: "CUSTOMER",
      passwordHash: customerHash,
      customerProfile: {
        create: {
          phone: "+251911000111",
          city: "Addis Ababa",
          subCity: "Bole",
          latitude: ADDIS_ABABA_AREAS.Bole.latitude,
          longitude: ADDIS_ABABA_AREAS.Bole.longitude,
        },
      },
    },
    include: { customerProfile: true },
  });

  // A second customer without equipment, for a clean experience.
  await db.user.create({
    data: {
      email: "abebe@fixit.demo",
      name: "Abebe Tadesse",
      role: "CUSTOMER",
      passwordHash: await hash("fixit-cust"),
      customerProfile: {
        create: {
          phone: "+251922000222",
          city: "Addis Ababa",
          subCity: "Kazanchis",
          latitude: ADDIS_ABABA_AREAS.Kazanchis.latitude,
          longitude: ADDIS_ABABA_AREAS.Kazanchis.longitude,
        },
      },
    },
  });

  // Demo technician user (the technician profile is created in technicians.ts
  // and linked to this user).
  const techUser = await db.user.create({
    data: {
      email: "tech@fixit.demo",
      name: "Dawit Mechanic",
      role: "TECHNICIAN",
      passwordHash: techHash,
    },
  });

  // Persist the technician user id so the technicians seed can link to it.
  (globalThis as any).__FIXIT_TECH_USER_ID = techUser.id;
  (globalThis as any).__FIXIT_CUSTOMER_PROFILE_ID = cust.customerProfile?.id;

  console.log(
    `  users: admin=${admin.email}, customer=${cust.email}, technician=${techUser.email}`
  );
}
