import { getEnvConfig } from "@/lib/env";
import { PaymentProvider } from "./payment-provider";
import { StripeProvider } from "./stripe";
import { MockPaymentProvider } from "./mock";

export * from "./payment-provider";

let providerInstance: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (providerInstance) return providerInstance;
  
  const config = getEnvConfig();

  if (config.paymentProvider === "stripe") {
    providerInstance = new StripeProvider();
  } else {
    // mock or fallback
    providerInstance = new MockPaymentProvider();
  }

  return providerInstance;
}

export const paymentProvider = getPaymentProvider();
