export type PaymentStatus = 
  | "PENDING"
  | "REQUIRES_ACTION"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUND_PENDING"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export interface CreatePaymentResult {
  paymentId: string;
  checkoutUrl: string;
}

export interface RefundResult {
  paymentId: string;
  status: PaymentStatus;
}
