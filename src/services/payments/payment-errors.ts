import { HttpError } from "@/lib/api";

export class PaymentError extends HttpError {
  constructor(status: number, message: string, public code: string) {
    super(status, message);
  }
}

export const PaymentErrors = {
  NOT_FOUND: new PaymentError(404, "Payment not found", "PAYMENT_NOT_FOUND"),
  ALREADY_PAID: new PaymentError(400, "Payment is already completed", "PAYMENT_ALREADY_PAID"),
  INVALID_STATE: (state: string) => new PaymentError(400, `Invalid payment state transition from ${state}`, "INVALID_PAYMENT_STATE"),
  PROVIDER_ERROR: (msg: string) => new PaymentError(500, `Provider error: ${msg}`, "PROVIDER_ERROR"),
  REFUND_NOT_ALLOWED: new PaymentError(400, "Refund not allowed for this payment", "REFUND_NOT_ALLOWED"),
  UNAUTHORIZED: new PaymentError(403, "Not authorized to access this payment", "UNAUTHORIZED"),
  IDEMPOTENCY_CONFLICT: new PaymentError(409, "Idempotency conflict", "IDEMPOTENCY_CONFLICT"),
};
