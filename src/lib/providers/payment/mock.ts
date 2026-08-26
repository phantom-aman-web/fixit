import { randomUUID } from "crypto";
import { PaymentProvider, CheckoutSession, PaymentRefund, WebhookEventData } from "./payment-provider";

// Deterministic mock provider for tests and local development
export class MockPaymentProvider implements PaymentProvider {
  async createCheckoutSession(params: {
    amount: number;
    currency: string;
    bookingId: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }): Promise<CheckoutSession> {
    const id = `cs_mock_${randomUUID().slice(0, 8)}`;
    const separator = params.successUrl.includes("?") ? "&" : "?";
    return {
      id,
      url: `${params.successUrl}${separator}session_id=${id}`,
    };
  }

  async refundPayment(providerPaymentId: string, amount?: number): Promise<PaymentRefund> {
    return {
      id: `re_mock_${randomUUID().slice(0, 8)}`,
      status: "succeeded",
    };
  }

  async verifyWebhook(rawBody: string, signature: string, secret: string): Promise<any> {
    // For mock, simply parse the raw JSON. The webhook handler will skip signature checks for mock.
    return JSON.parse(rawBody);
  }

  parseWebhookEvent(event: any): WebhookEventData | null {
    let providerPaymentId: string | undefined;
    
    if (event.data?.object?.payment_intent) {
      providerPaymentId = event.data.object.payment_intent;
    } else if (event.data?.object?.id) {
      providerPaymentId = event.data.object.id;
    }

    return {
      eventId: event.id || `evt_mock_${randomUUID()}`,
      eventType: event.type || "unknown",
      providerPaymentId,
      metadata: event.data?.object?.metadata,
      rawEvent: event,
    };
  }
}
