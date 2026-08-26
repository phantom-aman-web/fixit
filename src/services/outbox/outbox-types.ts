export type OutboxEventType =
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  // Future events can be added here
  | "BOOKING_CREATED"
  | "BOOKING_CONFIRMED"
  | "QUOTE_APPROVED";

export interface BaseOutboxPayload {
  eventVersion: number;
}

export interface PaymentSucceededPayload extends BaseOutboxPayload {
  paymentId: string;
  status: string;
  eventId: string; // The provider's event ID for deduplication if needed
}

export interface PaymentFailedPayload extends BaseOutboxPayload {
  paymentId: string;
  status: string;
  eventId: string;
}

export interface PaymentRefundedPayload extends BaseOutboxPayload {
  paymentId: string;
  status: string;
  eventId: string;
}

export interface OutboxEventHandler<T extends BaseOutboxPayload = any> {
  (payload: T, aggregateId: string | null): Promise<void>;
}
