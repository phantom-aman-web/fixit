import Stripe from "stripe";
import { getEnvConfig } from "@/lib/env";
import { PaymentProvider, CheckoutSession, PaymentRefund, WebhookEventData } from "./payment-provider";

export class StripeProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor() {
    const config = getEnvConfig();
    const apiKey = config.paymentApiKey;
    if (!apiKey) {
      throw new Error("StripeProvider requires PAYMENT_API_KEY");
    }
    this.stripe = new Stripe(apiKey, { apiVersion: "2026-07-29.dahlia" as any });
  }

  async createCheckoutSession(params: {
    amount: number;
    currency: string;
    bookingId: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: `FixIt Service Booking`,
              description: `Booking reference: ${params.bookingId}`,
            },
            unit_amount: params.amount, // In minor units
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      metadata: {
        bookingId: params.bookingId,
      },
    });

    return {
      id: session.id,
      url: session.url || "",
    };
  }

  async refundPayment(providerPaymentId: string, amount?: number): Promise<PaymentRefund> {
    const refund = await this.stripe.refunds.create({
      payment_intent: providerPaymentId,
      amount, // if undefined, full refund
    });

    return {
      id: refund.id,
      status: refund.status || "pending",
    };
  }

  async verifyWebhook(rawBody: string, signature: string, secret: string): Promise<Stripe.Event> {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  parseWebhookEvent(event: any): WebhookEventData | null {
    const stripeEvent = event as Stripe.Event;
    
    let providerPaymentId: string | undefined;
    let metadata: Record<string, string> | undefined;

    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        providerPaymentId = session.payment_intent as string | undefined;
        metadata = session.metadata as Record<string, string>;
        break;
      }
      case "checkout.session.expired": {
        const session = stripeEvent.data.object as Stripe.Checkout.Session;
        providerPaymentId = session.payment_intent as string | undefined;
        metadata = session.metadata as Record<string, string>;
        break;
      }
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed": {
        const intent = stripeEvent.data.object as Stripe.PaymentIntent;
        providerPaymentId = intent.id;
        metadata = intent.metadata as Record<string, string>;
        break;
      }
      case "charge.refunded": {
        const charge = stripeEvent.data.object as Stripe.Charge;
        providerPaymentId = charge.payment_intent as string | undefined;
        metadata = charge.metadata as Record<string, string>;
        break;
      }
      default:
        // We might not care about other event types, but we still return them.
        break;
    }

    return {
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
      providerPaymentId,
      metadata,
      rawEvent: stripeEvent,
    };
  }
}
