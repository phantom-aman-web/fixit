import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnvConfig } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";
import { createHmac, timingSafeEqual } from "crypto";

// POST /api/webhooks/payment — receive payment provider webhooks.
// This is the AUTHORITATIVE source for payment state changes.
// The browser redirect is NOT trusted for payment confirmation.
//
// Security:
// - Signature verification (provider-specific)
// - Raw body handling (signature is computed on raw bytes)
// - Replay protection (event ID stored, duplicates rejected)
// - Idempotent processing (duplicate events don't duplicate state transitions)
// - Audit logging

export async function POST(req: NextRequest) {
  const config = getEnvConfig();

  // Get the raw body for signature verification.
  const rawBody = await req.text();
  if (!rawBody) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify signature (provider-specific).
  // For mock provider, no signature verification needed (development only).
  if (config.paymentProvider !== "mock") {
    const signature = req.headers.get("x-signature") || req.headers.get("stripe-signature") || "";
    const webhookSecret = config.paymentWebhookSecret;
    if (!webhookSecret) {
      logError("Payment webhook received but no webhook secret configured", null);
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    // HMAC-SHA256 signature verification.
    const expectedSignature = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    const signaturesMatch = timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
    if (!signaturesMatch) {
      logError("Payment webhook signature verification failed", null, { provider: config.paymentProvider });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // Extract event metadata.
  const eventId = payload.id || payload.event_id || `evt_${Date.now()}`;
  const eventType = payload.type || payload.event_type || "unknown";
  const provider = config.paymentProvider;

  // Idempotent processing — check if we've already processed this event.
  const payloadHash = createHmac("sha256", "fixit-webhook").update(rawBody).digest("hex").slice(0, 32);
  const existing = await db.paymentWebhookEvent.findUnique({ where: { eventId } });
  if (existing) {
    if (existing.status === "PROCESSED") {
      logInfo("Duplicate webhook event received, already processed", { eventId, eventType });
      return NextResponse.json({ ok: true, duplicate: true });
    }
    // If previously failed, we can retry.
  }

  // Store the webhook event.
  const event = await db.paymentWebhookEvent.upsert({
    where: { eventId },
    create: {
      provider,
      eventId,
      eventType,
      payloadHash,
      status: "PENDING",
    },
    update: {},
  });

  try {
    // Process the event based on type.
    // Extract the payment reference from the payload.
    const paymentRef = payload.data?.object?.id || payload.data?.id || payload.payment_id;
    if (!paymentRef) {
      logError("Webhook event has no payment reference", null, { eventId, eventType });
      await db.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", error: "No payment reference in payload", processedAt: new Date() },
      });
      return NextResponse.json({ error: "No payment reference" }, { status: 400 });
    }

    // Find the payment by provider reference.
    const payment = await db.payment.findFirst({
      where: { providerRef: paymentRef },
      include: { booking: { include: { repairJob: true } } },
    });

    if (!payment) {
      logError("Webhook payment reference not found in database", null, { eventId, paymentRef });
      await db.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", error: "Payment not found", processedAt: new Date() },
      });
      // Return 200 so the provider doesn't keep retrying.
      return NextResponse.json({ ok: true, ignored: "payment not found" });
    }

    // Process based on event type.
    if (eventType.includes("succeeded") || eventType.includes("completed")) {
      if (payment.status === "PENDING") {
        await db.payment.update({
          where: { id: payment.id },
          data: { status: "SUCCEEDED", paidAt: new Date() },
        });
        // Complete the booking + repair job if confirmed.
        if (payment.booking.status === "CONFIRMED" && payment.booking.repairJob) {
          await db.booking.update({
            where: { id: payment.booking.id },
            data: { status: "COMPLETED" },
          });
          await db.repairJob.update({
            where: { id: payment.booking.repairJob.id },
            data: { status: "COMPLETED", completedAt: new Date() },
          });
        }
        logInfo("Payment succeeded via webhook", { paymentId: payment.id, eventId });
      }
    } else if (eventType.includes("failed")) {
      if (payment.status === "PENDING") {
        await db.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
        logInfo("Payment failed via webhook", { paymentId: payment.id, eventId });
      }
    } else if (eventType.includes("refunded")) {
      if (payment.status !== "REFUNDED") {
        await db.payment.update({
          where: { id: payment.id },
          data: { status: "REFUNDED" },
        });
        logInfo("Payment refunded via webhook", { paymentId: payment.id, eventId });
      }
    }

    // Mark event as processed.
    await db.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    logError("Webhook processing failed", e, { eventId, eventType });
    await db.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", error: e instanceof Error ? e.message : "Unknown error", processedAt: new Date() },
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
