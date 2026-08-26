// Email provider factory — the ONLY place that imports a concrete provider.
// Business logic and the email service must import from here only.
//
// Supported providers (EMAIL_PROVIDER env var):
//   console  — development/testing (default)
//   resend   — production (requires RESEND_API_KEY)

import { getEnvConfig } from "@/lib/env";
import { ConsoleEmailProvider } from "./console";
import { ResendEmailProvider } from "./resend";
import { EmailConfigurationError } from "./types";
import type { EmailProvider } from "./types";

let _provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (_provider) return _provider;

  const env = getEnvConfig();
  const providerName = env.emailProvider;

  switch (providerName) {
    case "resend": {
      if (!env.resendApiKey) {
        throw new EmailConfigurationError(
          "EMAIL_PROVIDER=resend requires RESEND_API_KEY to be set"
        );
      }
      _provider = new ResendEmailProvider(env.resendApiKey, env.emailFrom);
      break;
    }

    case "console":
    default: {
      // Default to console in all non-resend environments.
      _provider = new ConsoleEmailProvider();
      break;
    }
  }

  return _provider;
}

// Reset provider instance — used in tests only.
export function _resetEmailProviderForTests() {
  _provider = null;
}

export type { EmailProvider } from "./types";
export {
  EmailError,
  EmailValidationError,
  EmailConfigurationError,
  EmailProviderError,
  EmailRateLimitError,
} from "./types";
