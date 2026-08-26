// Centralized environment configuration + validation.
// Fail-fast in production if critical variables are missing.
// Sensible development defaults only where safe.

export type AppEnvironment = "development" | "test" | "staging" | "production";

export interface EnvConfig {
  nodeEnv: AppEnvironment;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;

  // Database
  databaseUrl: string;

  // Auth
  nextauthSecret: string;
  nextauthUrl: string;

  // AI
  aiProvider: string;
  aiApiKey?: string;
  aiModel?: string;
  aiBaseUrl?: string;

  // Payment
  paymentProvider: string; // "mock" | "stripe" | "chapa"
  paymentApiKey?: string;
  paymentWebhookSecret?: string;

  // Storage
  storageProvider: string; // "local" | "s3" | "supabase"
  storageBucket?: string;
  storageRegion?: string;
  storageAccessKey?: string;
  storageSecretKey?: string;
  uploadDir: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseStorageBucket?: string;

  // Email
  emailProvider: string; // "console" | "resend" | "smtp"
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  emailFrom: string;
  emailReplyTo?: string;
  appUrl: string; // validated base URL — used for email links ONLY

  // Realtime
  realtimePort: number;

  // Location
  locationProvider: string; // "demo" | "production"

  // Monitoring
  sentryDsn?: string;
  logLevel: string;

  // Feature flags
  features: {
    realPayments: boolean;
    realStorage: boolean;
    realEmail: boolean;
    realLocation: boolean;
    aiFeatures: boolean;
  };
}

function getEnv(key: string, fallback?: string): string {
  const val = process.env[key];
  if (!val && fallback !== undefined) return fallback;
  if (!val) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return fallback ?? "";
  }
  return val;
}

function getBool(key: string, fallback: boolean): boolean {
  const val = process.env[key];
  if (!val) return fallback;
  return val === "true" || val === "1";
}

let _config: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (_config) return _config;

  const nodeEnv = (process.env.NODE_ENV || "development") as AppEnvironment;
  const isProduction = nodeEnv === "production";
  const isDevelopment = nodeEnv === "development";
  const isTest = nodeEnv === "test";

  const paymentProvider = getEnv("PAYMENT_PROVIDER", "mock");
  const storageProvider = getEnv("STORAGE_PROVIDER", "local");
  const emailProvider = getEnv("EMAIL_PROVIDER", "console");
  const locationProvider = getEnv("LOCATION_PROVIDER", "demo");

  _config = {
    nodeEnv,
    isProduction,
    isDevelopment,
    isTest,

    databaseUrl: getEnv("DATABASE_URL", "file:./prisma/dev.db"),
    nextauthSecret: getEnv("NEXTAUTH_SECRET"),
    nextauthUrl: getEnv("NEXTAUTH_URL", "http://localhost:3000"),

    aiProvider: getEnv("AI_PROVIDER", "zai"),
    aiApiKey: process.env.AI_API_KEY,
    aiModel: process.env.AI_MODEL,
    aiBaseUrl: process.env.AI_BASE_URL,

    paymentProvider,
    paymentApiKey: process.env.PAYMENT_API_KEY,
    paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,

    storageProvider,
    storageBucket: process.env.STORAGE_BUCKET,
    storageRegion: process.env.STORAGE_REGION,
    storageAccessKey: process.env.STORAGE_ACCESS_KEY,
    storageSecretKey: process.env.STORAGE_SECRET_KEY,
    uploadDir: getEnv("UPLOAD_DIR", "./uploads"),
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET,

    emailProvider,
    resendApiKey: process.env.RESEND_API_KEY,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    emailFrom: getEnv("EMAIL_FROM", "noreply@fixit.app"),
    emailReplyTo: process.env.EMAIL_REPLY_TO,
    appUrl: getEnv("APP_URL", "http://localhost:3000"),

    realtimePort: Number(process.env.REALTIME_PORT) || 3003,

    locationProvider,

    sentryDsn: process.env.SENTRY_DSN,
    logLevel: getEnv("LOG_LEVEL", isProduction ? "info" : "debug"),

    features: {
      realPayments: paymentProvider !== "mock" && isProduction,
      realStorage: storageProvider !== "local" && isProduction,
      realEmail: emailProvider !== "console" && isProduction,
      realLocation: locationProvider !== "demo" && isProduction,
      aiFeatures: getBool("AI_FEATURES_ENABLED", true),
    },
  };

  return _config;
}

// Production readiness validator — detects unsafe configuration.
export interface ReadinessCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: "critical" | "warning" | "info";
}

export function validateProductionReadiness(): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];
  const config = getEnvConfig();

  // Critical: must have NEXTAUTH_SECRET
  checks.push({
    name: "NEXTAUTH_SECRET",
    passed: !!config.nextauthSecret,
    message: config.nextauthSecret ? "Configured" : "Missing — application cannot sign JWTs securely",
    severity: "critical",
  });

  // Critical: must have DATABASE_URL
  checks.push({
    name: "DATABASE_URL",
    passed: !!config.databaseUrl,
    message: config.databaseUrl ? "Configured" : "Missing — no database connection",
    severity: "critical",
  });

  // Warning: mock payment in production
  if (config.isProduction) {
    checks.push({
      name: "Payment provider",
      passed: config.paymentProvider !== "mock",
      message: config.paymentProvider === "mock" ? "Mock payment provider in production — payments are not real" : `Provider: ${config.paymentProvider}`,
      severity: "warning",
    });

    checks.push({
      name: "Storage provider",
      passed: config.storageProvider !== "local",
      message: config.storageProvider === "local" ? "Local file storage in production — not scalable" : `Provider: ${config.storageProvider}`,
      severity: "warning",
    });

    if (config.storageProvider === "supabase") {
      const hasSupabase = !!config.supabaseUrl && !!config.supabaseServiceRoleKey && !!config.supabaseStorageBucket;
      checks.push({
        name: "Supabase Storage Config",
        passed: hasSupabase,
        message: hasSupabase ? "Configured" : "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_STORAGE_BUCKET",
        severity: "critical",
      });
    }

    checks.push({
      name: "Email provider",
      passed: config.emailProvider !== "console",
      message: config.emailProvider === "console" ? "Console email in production — no real email delivery" : `Provider: ${config.emailProvider}`,
      severity: "warning",
    });

    checks.push({
      name: "Location provider",
      passed: config.locationProvider !== "demo",
      message: config.locationProvider === "demo" ? "Demo location in production — no real GPS" : `Provider: ${config.locationProvider}`,
      severity: "info",
    });

    // Webhook secret required if real payments
    if (config.paymentProvider !== "mock") {
      checks.push({
        name: "Payment webhook secret",
        passed: !!config.paymentWebhookSecret,
        message: config.paymentWebhookSecret ? "Configured" : "Missing — webhooks cannot be verified",
        severity: "critical",
      });
    }
  }

  return checks;
}
