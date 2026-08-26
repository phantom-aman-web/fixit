import { db } from "../src/lib/db";
import { logInfo, logError } from "../src/lib/logger";

async function replayEvent(eventId: string) {
  try {
    const event = await db.outboxEvent.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      logError(`Event not found: ${eventId}`, null);
      process.exit(1);
    }

    if (event.status !== "DEAD_LETTER" && event.status !== "FAILED") {
      logError(`Event ${eventId} is currently in status ${event.status}. Only DEAD_LETTER or FAILED events can be replayed.`, null);
      process.exit(1);
    }

    await db.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: "PENDING",
        attempts: 0,
        lastError: null,
        availableAt: new Date(),
        updatedAt: new Date()
      }
    });

    logInfo(`Successfully queued event ${eventId} for replay.`);
  } catch (e) {
    logError("Failed to replay event", e);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("Usage: npx tsx scripts/replay-outbox-event.ts <eventId>");
  process.exit(1);
}

replayEvent(args[0]).then(() => process.exit(0));
