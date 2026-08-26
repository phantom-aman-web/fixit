import type { WelcomeTemplateData, RenderedEmail } from "@/lib/providers/email/types";
import { emailLayout, ctaButton, h1, p, plainTextLayout, escapeHtml } from "./base";

export function renderWelcome(data: WelcomeTemplateData): RenderedEmail {
  const name = escapeHtml(data.customerName);
  const html = emailLayout(`
    ${h1("Welcome to FixIt! 🎉")}
    ${p(`Hi ${name},`)}
    ${p("You're all set to diagnose, troubleshoot, and repair almost any equipment — from kitchen appliances and power tools to laptops, HVAC units, and more.")}
    ${p("Head to your dashboard to get started.")}
    ${ctaButton("Go to Dashboard", data.dashboardUrl)}
    ${p("If you have questions, our support team is here to help.")}
  `, "Welcome to FixIt — your universal equipment repair platform");

  const text = plainTextLayout([
    `Welcome to FixIt, ${data.customerName}!`,
    "You're all set to diagnose and repair almost any equipment — appliances, power tools, laptops, HVAC, and more.",
    `Dashboard: ${data.dashboardUrl}`,
  ]);

  return { subject: "Welcome to FixIt!", html, text };
}
