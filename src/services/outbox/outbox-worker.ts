import { db } from "@/lib/db";
import { logInfo, logError } from "@/lib/logger";
import { OutboxEvent } from "@prisma/client";
import { OutboxEventType, BaseOutboxPayload } from "./outbox-types";
import { handlePaymentSucceeded, handlePaymentFailed, handlePaymentRefunded } from "./handlers/payment-handlers";

// Helper to delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class OutboxWorker {
  private isRunning = false;

  async start(pollInterval = 5000) {
    if (this.isRunning) return;
    this.isRunning = true;
    logInfo("Outbox worker started");

    while (this.isRunning) {
      try {
        const events = await this.claimEvents(10);
        if (events.length > 0) {
          logInfo(`Claimed ${events.length} outbox events`);
          await Promise.all(events.map(e => this.processEvent(e)));
        }
      } catch (err) {
        logError("Outbox worker error during processing loop", err);
      }
      await delay(pollInterval);
    }
  }

  stop() {
    this.isRunning = false;
    logInfo("Outbox worker stopped");
  }

  // Atomic claim using FOR UPDATE SKIP LOCKED
  async claimEvents(limit = 10): Promise<OutboxEvent[]> {
    // In PostgreSQL, this updates the rows and returns them atomically
    // avoiding the need for a long-lived transaction while we process.
    const claimed: OutboxEvent[] = await db.$queryRawUnsafe(`
      UPDATE "OutboxEvent"
      SET status = 'PROCESSING', "updatedAt" = NOW()
      WHERE id IN (
        SELECT id FROM "OutboxEvent"
        WHERE (status = 'PENDING' AND "availableAt" <= NOW() + INTERVAL '1 minute')
           OR (status = 'PROCESSING' AND "updatedAt" <= NOW() - INTERVAL '15 minutes')
        ORDER BY "availableAt" ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `, limit);
    return claimed;
  }

  async processEvent(event: OutboxEvent) {
    try {
      const payload = JSON.parse(event.payload) as BaseOutboxPayload;
      
      // Dispatch based on event type
      switch (event.type as OutboxEventType) {
        case "PAYMENT_SUCCEEDED":
          await handlePaymentSucceeded(payload as any, event.aggregateId);
          break;
        case "PAYMENT_FAILED":
          await handlePaymentFailed(payload as any, event.aggregateId);
          break;
        case "PAYMENT_REFUNDED":
          await handlePaymentRefunded(payload as any, event.aggregateId);
          break;
        default:
          throw new Error(`Unsupported event type: ${event.type}`);
      }

      // Mark as success
      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          updatedAt: new Date(),
        }
      });
      logInfo("Successfully processed outbox event", { eventId: event.id, type: event.type });

    } catch (err: any) {
      logError("Failed to process outbox event", err, { eventId: event.id, type: event.type });
      await this.handleFailure(event, err);
    }
  }

  async handleFailure(event: OutboxEvent, err: any) {
    const attempts = event.attempts + 1;
    const maxAttempts = event.maxAttempts;
    const errorMessage = err.message || "Unknown error";
    
    // Check if permanent error (unsupported type, parsing failed, missing aggregateId)
    const isPermanent = 
      err instanceof SyntaxError || 
      errorMessage.includes("Unsupported event type") ||
      errorMessage.includes("Missing aggregateId");

    if (isPermanent || attempts >= maxAttempts) {
      // Dead letter
      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "DEAD_LETTER",
          attempts,
          lastError: errorMessage,
          failedAt: new Date(),
          updatedAt: new Date(),
        }
      });
      logError("Outbox event dead-lettered", null, { eventId: event.id, type: event.type });
    } else {
      // Retry with exponential backoff (e.g. 5s, 25s, 125s)
      const backoffSeconds = Math.pow(5, attempts);
      const nextAvailable = new Date(Date.now() + backoffSeconds * 1000);
      
      await db.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "PENDING",
          attempts,
          lastError: errorMessage,
          availableAt: nextAvailable,
          updatedAt: new Date(),
        }
      });
      logInfo("Outbox event scheduled for retry", { eventId: event.id, attempt: attempts, nextAvailable });
    }
  }
}
