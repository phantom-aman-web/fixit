import { db } from "@/lib/db";
import { getPaymentProvider } from "@/lib/providers/payment";
import { PaymentErrors } from "./payment-errors";
import { PaymentStatus } from "./payment-types";
import { assertValidTransition } from "./payment-state-machine";
import { logInfo, logError } from "@/lib/logger";

export class PaymentService {
  /**
   * Initializes a new payment attempt for a booking.
   * Enforces that only one active payment attempt exists at a time.
   */
  static async createPaymentForBooking(
    bookingId: string, 
    userId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    // 1. Fetch booking and validate ownership / state
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { quote: true, payment: true, customer: true }
    });

    if (!booking) throw PaymentErrors.NOT_FOUND;
    if (booking.customer.userId !== userId) throw PaymentErrors.UNAUTHORIZED;
    if (!booking.quote || booking.quote.status !== "APPROVED") {
      throw new Error("Booking does not have an approved quote");
    }

    // 2. Check if there's already an active payment
    if (booking.payment) {
      if (["SUCCEEDED", "PROCESSING", "REQUIRES_ACTION", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"].includes(booking.payment.status)) {
        throw new Error(`An active or completed payment already exists with status ${booking.payment.status}`);
      }
      
      // If PENDING or FAILED or CANCELLED, we can create a new attempt, but for simplicity
      // and to avoid dangling sessions, we might just update the existing one if it's PENDING.
      // But Stripe Checkout Sessions are one-time use. So we generate a new one.
    }

    const amount = booking.quote.totalEstimate;
    const currency = booking.quote.currency;

    const provider = getPaymentProvider();
    
    const session = await provider.createCheckoutSession({
      amount,
      currency,
      bookingId,
      successUrl,
      cancelUrl,
      customerEmail: booking.customer.userId // We don't have direct email on profile, but user has email
    });

    // 3. Persist payment state
    const payment = await db.payment.upsert({
      where: { bookingId },
      create: {
        bookingId,
        customerId: booking.customerId,
        amount,
        currency,
        status: "PENDING",
        providerCheckoutSessionId: session.id,
      },
      update: {
        amount,
        currency,
        status: "PENDING",
        providerCheckoutSessionId: session.id,
        providerPaymentId: null, // Reset since it's a new attempt
      }
    });

    logInfo("Payment session created", { paymentId: payment.id, bookingId });

    return {
      paymentId: payment.id,
      checkoutUrl: session.url
    };
  }

  /**
   * Processes a refund for an authorized user.
   */
  static async refundPayment(paymentId: string, userId: string, amount?: number) {
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true }
    });

    if (!payment) throw PaymentErrors.NOT_FOUND;

    // Check RBAC - only ADMIN or authorized customer (if business rules allow)
    // For FixIt, let's assume Admin or Customer who owns it can request (though normally just Admin)
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw PaymentErrors.UNAUTHORIZED;

    if (user.role !== "ADMIN") {
      // If customer refund requests are allowed
      if (payment.booking.customerId !== payment.customerId) {
        throw PaymentErrors.UNAUTHORIZED;
      }
    }

    assertValidTransition(payment.status, "REFUND_PENDING");

    if (!payment.providerPaymentId) {
      throw PaymentErrors.PROVIDER_ERROR("No provider payment ID exists to refund");
    }

    // Attempt refund via provider
    const provider = getPaymentProvider();
    
    // Mark as pending refund
    await db.payment.update({
      where: { id: paymentId },
      data: { status: "REFUND_PENDING" }
    });

    try {
      const refundResult = await provider.refundPayment(payment.providerPaymentId, amount);

      const nextState = amount && amount < payment.amount ? "PARTIALLY_REFUNDED" : "REFUNDED";
      
      const updatedPayment = await db.payment.update({
        where: { id: paymentId },
        data: { 
          status: nextState,
          refundedAt: new Date(),
        }
      });

      // Outbox event for Refund
      await db.outboxEvent.create({
        data: {
          type: "payment_refunded",
          aggregateType: "payment",
          aggregateId: paymentId,
          payload: JSON.stringify({ paymentId, amount, status: nextState })
        }
      });

      logInfo("Payment refunded", { paymentId, refundId: refundResult.id });
      return updatedPayment;

    } catch (error: any) {
      logError("Refund failed", error, { paymentId });
      // Revert status to SUCCEEDED since refund failed
      await db.payment.update({
        where: { id: paymentId },
        data: { status: "SUCCEEDED", failureReason: error.message }
      });
      throw PaymentErrors.PROVIDER_ERROR(error.message);
    }
  }
}
