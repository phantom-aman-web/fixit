export interface CheckoutSession {
  id: string;
  url: string;
}

export interface PaymentRefund {
  id: string;
  status: string;
}

export interface WebhookEventData {
  eventId: string;
  eventType: string;
  providerPaymentId?: string;
  metadata?: Record<string, string>;
  rawEvent: any;
}

export interface PaymentProvider {
  createCheckoutSession(params: {
    amount: number;
    currency: string;
    bookingId: string;
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
  }): Promise<CheckoutSession>;

  refundPayment(providerPaymentId: string, amount?: number): Promise<PaymentRefund>;

  verifyWebhook(rawBody: string, signature: string, secret: string): Promise<any>;

  parseWebhookEvent(event: any): WebhookEventData | null;
}
