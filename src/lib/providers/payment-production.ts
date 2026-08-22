// Production payment provider abstraction.
// The MockPaymentProvider remains for development.
// The ProductionPaymentProvider is a template for real provider integration
// (Stripe, Chapa, etc.) — it requires real credentials and is only activated
// when PAYMENT_PROVIDER is not "mock".

import type { PaymentIntent, PaymentProvider } from "@/lib/providers";
import { getEnvConfig } from "@/lib/env";
import { MockPaymentProvider } from "@/lib/providers/payment";
import { logError } from "@/lib/logger";

// Production payment provider template.
// In a real deployment, this would call the actual payment provider's SDK
// (Stripe, Chapa, etc.). For now, it's a documented placeholder that throws
// if used without real credentials.
export class ProductionPaymentProvider implements PaymentProvider {
  private apiKey: string;
  private provider: string;

  constructor() {
    const config = getEnvConfig();
    this.apiKey = config.paymentApiKey ?? "";
    this.provider = config.paymentProvider;

    if (!this.apiKey && config.isProduction) {
      throw new Error(`Production payment provider "${this.provider}" requires PAYMENT_API_KEY`);
    }
  }

  async createIntent(params: { amount: number; currency: string; bookingId: string }): Promise<PaymentIntent> {
    if (!this.apiKey) {
      throw new Error("Payment API key not configured");
    }

    // In production, this would call the real provider's API:
    //   const intent = await stripe.paymentIntents.create({ amount, currency, metadata: { bookingId } });
    //   return { id: intent.id, amount: intent.amount, currency, status: "PENDING", providerRef: intent.id };
    //
    // For now, throw to prevent accidental use without real integration.
    throw new Error(`Production payment provider "${this.provider}" not yet integrated. Configure PAYMENT_PROVIDER=mock for development.`);

    // Integration template:
    // try {
    //   const response = await fetch(`${this.baseUrl}/payment_intents`, {
    //     method: "POST",
    //     headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
    //     body: JSON.stringify({ amount: params.amount, currency: params.currency, metadata: { bookingId: params.bookingId } }),
    //   });
    //   const data = await response.json();
    //   return { id: data.id, amount: params.amount, currency: params.currency, status: "PENDING", providerRef: data.id };
    // } catch (e) {
    //   logError("Payment intent creation failed", e, { bookingId: params.bookingId });
    //   throw e;
    // }
  }

  async capture(intentId: string): Promise<PaymentIntent> {
    throw new Error(`Production payment provider "${this.provider}" not yet integrated.`);
  }

  async refund(intentId: string): Promise<PaymentIntent> {
    throw new Error(`Production payment provider "${this.provider}" not yet integrated.`);
  }
}

// Factory: returns the appropriate provider based on environment configuration.
export function createPaymentProvider(): PaymentProvider {
  const config = getEnvConfig();

  if (config.paymentProvider === "mock" || !config.isProduction) {
    // Use mock provider for development and non-production environments.
    return new MockPaymentProvider();
  }

  // Use production provider when configured and in production.
  return new ProductionPaymentProvider();
}
