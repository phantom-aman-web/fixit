import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";
import { parse } from "cookie";

const BASE_URL = "http://localhost:3000";

async function loginAndGetCookie(email: string, password: string = "password123"): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfJson = await csrfRes.json();
  const csrfToken = csrfJson.csrfToken;
  const csrfCookies = csrfRes.headers.get("set-cookie") || "";

  const params = new URLSearchParams();
  params.append("email", email);
  params.append("password", password);
  params.append("csrfToken", csrfToken);
  params.append("json", "true");

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": csrfCookies
    },
    body: params.toString()
  });

  const setCookieHeader = loginRes.headers.get("set-cookie");
  if (!setCookieHeader) throw new Error("No set-cookie after login");
  
  const cookies = setCookieHeader.split(',').map(c => c.split(';')[0]).join('; ');
  return cookies;
}

async function verifySecurity() {
  console.log("Starting P7.5 / P7.15 Security & RBAC Audit...");

  // 1. Setup Test Users
  const users = [
    { email: "custA@test.com", role: "CUSTOMER" },
    { email: "custB@test.com", role: "CUSTOMER" },
    { email: "techA@test.com", role: "TECHNICIAN" },
    { email: "adminA@test.com", role: "ADMIN" }
  ];

  for (const u of users) {
    let ex = await db.user.findUnique({ where: { email: u.email } });
    if (ex) await db.user.delete({ where: { id: ex.id } });
    
    const hash = await bcrypt.hash("password123", 10);
    const created = await db.user.create({
      data: {
        email: u.email,
        name: u.role,
        passwordHash: hash,
        role: u.role,
        ...(u.role === "CUSTOMER" ? { customerProfile: { create: { city: "City" } } } : {}),
        ...(u.role === "TECHNICIAN" ? { technicianProfile: { create: { displayName: "Tech", status: "ACTIVE" } } } : {})
      }
    });
    // @ts-ignore
    u.id = created.id;
  }

  // 2. Setup Resources for IDOR testing
  const custA = await db.user.findUnique({ where: { email: "custA@test.com" }, include: { customerProfile: true } });
  const techA = await db.user.findUnique({ where: { email: "techA@test.com" }, include: { technicianProfile: true } });
  
  const cat = await db.equipmentCategory.findFirst();
  const eqA = await db.customerEquipment.create({
    data: { customerId: custA!.customerProfile!.id, categoryId: cat!.id }
  });
  
  const problemA = await db.problemReport.create({
    data: { customerId: custA!.customerProfile!.id, categoryId: cat!.id, description: "Problem A" }
  });

  const requestA = await db.repairRequest.create({
    data: { customerId: custA!.customerProfile!.id, problemId: problemA.id }
  });

  console.log("[x] Test users and resources created.");

  const cookieCustA = await loginAndGetCookie("custA@test.com");
  const cookieCustB = await loginAndGetCookie("custB@test.com");
  const cookieTechA = await loginAndGetCookie("techA@test.com");
  
  let passed = 0;
  let failed = 0;

  async function testAccess(name: string, path: string, method: string, cookie: string, expectedStatus: number) {
    const res = await fetch(`${BASE_URL}${path}`, { method, headers: { "Cookie": cookie } });
    if (res.status === expectedStatus || (expectedStatus === 200 && (res.status === 200 || res.status === 201))) {
      console.log(`[PASS] ${name} (Expected ${expectedStatus}, got ${res.status})`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} (Expected ${expectedStatus}, got ${res.status})`);
      failed++;
    }
  }

  console.log("\n--- Unauthenticated Access ---");
  const unauthRes = await fetch(`${BASE_URL}/api/customer/dashboard`);
  if (unauthRes.status === 401) { passed++; console.log("[PASS] Unauthenticated access rejected (401)"); }
  else { failed++; console.error(`[FAIL] Unauthenticated access allowed? Got ${unauthRes.status}`); }

  console.log("\n--- Cross-User Access (IDOR) ---");
  // Cust B trying to access Cust A's problem report
  // Actually the GET problem endpoint doesn't exist for a specific problem ID, maybe we fetch equipment?
  // Let's try customer dashboard for B, it should only return B's items.
  const resB = await fetch(`${BASE_URL}/api/customer/dashboard`, { headers: { "Cookie": cookieCustB } });
  if (resB.status === 401) {
    console.error(`[FAIL] Login failed for CustB. Got 401.`);
    failed++;
  } else {
    const dataB = await resB.json();
    if (dataB.equipment && dataB.equipment.length === 0) {
      passed++; console.log("[PASS] Cust B cannot see Cust A's equipment in dashboard.");
    } else {
      failed++; console.error("[FAIL] Cust B saw Cust A's equipment?");
    }
  }

  // Tech trying to access Admin dashboard
  await testAccess("Tech accessing Admin analytics", "/api/admin/analytics", "GET", cookieTechA, 403);
  
  // Cust trying to access Tech dashboard
  await testAccess("Cust accessing Tech dashboard", "/api/technician/dashboard", "GET", cookieCustA, 403);

  console.log(`\nVerification Complete: ${passed} PASS, ${failed} FAIL`);
}

verifySecurity()
  .catch(e => { console.error("Error:", e); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); });
