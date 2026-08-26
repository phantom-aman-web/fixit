import { PaymentStatus } from "./payment-types";

// Deterministic state machine enforcing valid transitions
// Key: Current state, Value: Allowed next states
const allowedTransitions: Record<PaymentStatus, Set<PaymentStatus>> = {
  PENDING: new Set(["REQUIRES_ACTION", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"]),
  REQUIRES_ACTION: new Set(["PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"]),
  PROCESSING: new Set(["SUCCEEDED", "FAILED"]),
  SUCCEEDED: new Set(["REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"]),
  FAILED: new Set([]), // terminal for this payment attempt. Client should create a new attempt.
  CANCELLED: new Set([]), // terminal
  EXPIRED: new Set([]), // terminal
  REFUND_PENDING: new Set(["PARTIALLY_REFUNDED", "REFUNDED", "SUCCEEDED"]), // SUCCEEDED if refund fails
  PARTIALLY_REFUNDED: new Set(["REFUNDED"]),
  REFUNDED: new Set([]), // terminal
};

export function canTransitionPayment(currentState: string, nextState: string): boolean {
  if (currentState === nextState) return true; // idempotent
  
  const current = currentState as PaymentStatus;
  const next = nextState as PaymentStatus;
  
  if (!allowedTransitions[current]) return false;
  return allowedTransitions[current].has(next);
}

export function assertValidTransition(currentState: string, nextState: string) {
  if (!canTransitionPayment(currentState, nextState)) {
    throw new Error(`Invalid payment state transition from ${currentState} to ${nextState}`);
  }
}
