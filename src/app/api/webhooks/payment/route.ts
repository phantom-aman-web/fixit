import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnvConfig } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";
import { createHmac } from "crypto";
import { getPaymentProvider } from "@/lib/providers/payment";

export async function POST(req: NextRequest) {
  const config = getEnvConfig();
  const provider = getPaymentProvider();

  // Get the raw body for signature verification.
  const rawBody = await req.text();
  if (!rawBody) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  const signature = req.headers.get("stripe-signature") || "";
  let rawEvent: any;

  if (config.paymentProvider === "stripe") {
    const webhookSecret = config.paymentWebhookSecret;
    if (!webhookSecret) {
      logError("Payment webhook received but no webhook secret configured", null);
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }
    try {
      rawEvent = await provider.verifyWebhook(rawBody, signature, webhookSecret);
    } catch (e: any) {
      logError("Payment webhook signature verification failed", e, { provider: config.paymentProvider });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    // For mock, simply parse the body
    try {
      rawEvent = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const eventData = provider.parseWebhookEvent(rawEvent);
  
  if (!eventData) {
    return NextResponse.json({ ok: true, ignored: "unsupported event type" });
  }

  const { eventId, eventType, providerPaymentId } = eventData;

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
      provider: config.paymentProvider,
      eventId,
      eventType,
      payloadHash,
      status: "PENDING",
    },
    update: {},
  });

  try {
    if (!providerPaymentId) {
      logError("Webhook event has no payment reference", null, { eventId, eventType });
      await db.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", error: "No payment reference in payload", processedAt: new Date() },
      });
      return NextResponse.json({ error: "No payment reference" }, { status: 400 });
    }

    // Process inside a transaction
    await db.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { 
          OR: [
            { providerPaymentId },
            { providerCheckoutSessionId: providerPaymentId }
          ]
        },
        include: { booking: { include: { repairJob: true } } },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      // Update providerPaymentId if we only had Checkout Session ID
      if (!payment.providerPaymentId) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { providerPaymentId }
        });
      }

      let newState = payment.status;
      let generateOutbox = false;

      // Map event types to statuses
      if (eventType.includes("succeeded") || eventType.includes("completed")) {
        if (payment.status === "PENDING" || payment.status === "PROCESSING" || payment.status === "REQUIRES_ACTION") {
          newState = "SUCCEEDED";
          generateOutbox = true;
          
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: newState, paidAt: new Date() },
          });

          // Transition booking to CONFIRMED when paid (new hiring flow).
          if (payment.booking.status === "AWAITING_PAYMENT") {
            await tx.booking.update({
              where: { id: payment.booking.id },
              data: { status: "CONFIRMED" },
            });
            
            // Create the repair job now that booking is confirmed.
            const existingJob = await tx.repairJob.findUnique({ where: { bookingId: payment.booking.id } });
            if (!existingJob) {
              await tx.repairJob.create({
                data: { bookingId: payment.booking.id, status: "SCHEDULED" },
              });
            }
          }
          logInfo("Payment succeeded via webhook", { paymentId: payment.id, eventId });
        }
      } else if (eventType.includes("failed")) {
        if (["PENDING", "PROCESSING", "REQUIRES_ACTION"].includes(payment.status)) {
          newState = "FAILED";
          generateOutbox = true;
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: newState, failedAt: new Date(), failureReason: eventType },
          });
          logInfo("Payment failed via webhook", { paymentId: payment.id, eventId });
        }
      } else if (eventType.includes("refunded")) {
        if (payment.status !== "REFUNDED") {
          newState = "REFUNDED";
          generateOutbox = true;
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: newState, refundedAt: new Date() },
          });
          logInfo("Payment refunded via webhook", { paymentId: payment.id, eventId });
        }
      } else if (eventType.includes("expired")) {
        if (payment.status === "PENDING") {
          newState = "EXPIRED";
          generateOutbox = true;
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: newState },
          });
        }
      }

      // Mark event as processed.
      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });

      // Insert Outbox event for Phase 8.6 readiness
      if (generateOutbox) {
        await tx.outboxEvent.create({
          data: {
            type: `payment_${newState.toLowerCase()}`,
            aggregateType: "payment",
            aggregateId: payment.id,
            payload: JSON.stringify({ paymentId: payment.id, status: newState, eventId }),
          }
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    logError("Webhook processing failed", e, { eventId, eventType });
    
    if (e.message === "Payment not found") {
      // Don't mark webhook as permanently failed for missing payment (yet) to allow retries,
      // but return 200 so Stripe doesn't keep blowing up the log if it never existed.
      await db.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: "FAILED", error: e.message, processedAt: new Date() },
      });
      return NextResponse.json({ ok: true, ignored: "payment not found" });
    }
    
    await db.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", error: e instanceof Error ? e.message : "Unknown error", processedAt: new Date() },
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
