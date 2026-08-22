import { randomUUID } from "crypto";
import type { PaymentIntent, PaymentProvider } from "@/lib/providers";

// Mock payment provider. Clearly labeled as sandbox in the UI.
// Persists intent state in-memory for the demo; the canonical record is the
// Payment row in the DB, owned by PaymentService.
const intents = new Map<string, PaymentIntent & { bookingId: string }>();

export class MockPaymentProvider implements PaymentProvider {
  async createIntent(params: {
    amount: number;
    currency: string;
    bookingId: string;
  }): Promise<PaymentIntent> {
    const id = randomUUID();
    const intent: PaymentIntent & { bookingId: string } = {
      id,
      amount: params.amount,
      currency: params.currency,
      status: "PENDING",
      providerRef: `mock_${id.slice(0, 8)}`,
      bookingId: params.bookingId,
    };
    intents.set(id, intent);
    return { ...intent };
  }

  async capture(intentId: string): Promise<PaymentIntent> {
    const i = intents.get(intentId);
    if (!i) throw new Error("Payment intent not found");
    i.status = "SUCCEEDED";
    return { ...i };
  }

  async refund(intentId: string): Promise<PaymentIntent> {
    const i = intents.get(intentId);
    if (!i) throw new Error("Payment intent not found");
    i.status = "REFUNDED" as any;
    return { ...i };
  }
}

export const payment: PaymentProvider = new MockPaymentProvider();
