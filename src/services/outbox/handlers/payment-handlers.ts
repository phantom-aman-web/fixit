import { db } from "@/lib/db";
import { emailPaymentReceipt, sendEmail } from "@/services/email-service";
import { logInfo, logError } from "@/lib/logger";
import { PaymentSucceededPayload, PaymentFailedPayload, PaymentRefundedPayload } from "../outbox-types";

export async function handlePaymentSucceeded(payload: PaymentSucceededPayload, aggregateId: string | null) {
  if (!aggregateId) throw new Error("Missing aggregateId");

  const payment = await db.payment.findUnique({
    where: { id: aggregateId },
    include: {
      booking: {
        include: {
          customer: { include: { user: true } },
          repairJob: true
        }
      }
    }
  });

  if (!payment) throw new Error(`Payment not found: ${aggregateId}`);
  if (!payment.booking?.customer?.user?.email) throw new Error("No customer email found for payment");

  await emailPaymentReceipt({
    customerUserId: payment.booking.customer.userId,
    customerName: payment.booking.customer.user.name || "Customer",
    customerEmail: payment.booking.customer.user.email,
    jobId: payment.booking.id,
    equipmentName: payment.booking.repairJob?.diagnosis || "your equipment",
    amount: payment.amount,
    currency: payment.currency,
    paidAt: new Date(),
  });

  logInfo("Processed PAYMENT_SUCCEEDED outbox event", { paymentId: payment.id });
}

export async function handlePaymentFailed(payload: PaymentFailedPayload, aggregateId: string | null) {
  if (!aggregateId) throw new Error("Missing aggregateId");
  
  const payment = await db.payment.findUnique({
    where: { id: aggregateId },
    include: {
      booking: {
        include: {
          customer: { include: { user: true } },
        }
      }
    }
  });

  if (!payment) throw new Error(`Payment not found: ${aggregateId}`);
  if (!payment.booking?.customer?.user?.email) throw new Error("No customer email found for payment");

  // Since emailPaymentFailed doesn't exist, use sendEmail directly
  await sendEmail({
    recipient: { name: payment.booking.customer.user.name || "Customer", email: payment.booking.customer.user.email },
    event: "PAYMENT_FAILED",
    deduplicationKey: `payment:${payment.id}:failed`,
    rendered: {
      subject: "Payment Failed",
      html: `<p>Your payment of ${payment.amount / 100} ${payment.currency} has failed.</p>`,
      text: `Your payment of ${payment.amount / 100} ${payment.currency} has failed.`
    }
  });

  logInfo("Processed PAYMENT_FAILED outbox event", { paymentId: payment.id });
}

export async function handlePaymentRefunded(payload: PaymentRefundedPayload, aggregateId: string | null) {
  if (!aggregateId) throw new Error("Missing aggregateId");
  
  const payment = await db.payment.findUnique({
    where: { id: aggregateId },
    include: {
      booking: {
        include: {
          customer: { include: { user: true } },
        }
      }
    }
  });

  if (!payment) throw new Error(`Payment not found: ${aggregateId}`);
  if (!payment.booking?.customer?.user?.email) throw new Error("No customer email found for payment");

  // Since emailRefundProcessed doesn't exist, use sendEmail directly
  await sendEmail({
    recipient: { name: payment.booking.customer.user.name || "Customer", email: payment.booking.customer.user.email },
    event: "PAYMENT_REFUNDED",
    deduplicationKey: `payment:${payment.id}:refunded`,
    rendered: {
      subject: "Payment Refunded",
      html: `<p>Your payment of ${payment.amount / 100} ${payment.currency} has been refunded.</p>`,
      text: `Your payment of ${payment.amount / 100} ${payment.currency} has been refunded.`
    }
  });

  logInfo("Processed PAYMENT_REFUNDED outbox event", { paymentId: payment.id });
}
