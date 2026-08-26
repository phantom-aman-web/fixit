import type { QuoteReceivedTemplateData, RenderedEmail } from "@/lib/providers/email/types";
import { emailLayout, ctaButton, h1, p, infoTable, infoRow, plainTextLayout, escapeHtml, formatCurrency } from "./base";

export function renderQuoteReceived(data: QuoteReceivedTemplateData): RenderedEmail {
  const formattedAmount = formatCurrency(data.totalEstimate, data.currency);

  const html = emailLayout(`
    ${h1("You received a repair quote 💬")}
    ${p(`Hi ${escapeHtml(data.customerName)},`)}
    ${p("A technician has submitted a quote for your repair request. Please review it and let us know if you'd like to proceed.")}
    ${infoTable(
      infoRow("Equipment:", escapeHtml(data.equipmentName)) +
      infoRow("Estimate:", escapeHtml(formattedAmount))
    )}
    ${p("You can approve or decline the quote from your dashboard. Quotes expire after a limited time.")}
    ${ctaButton("Review Quote", data.quoteUrl)}
  `, `You received a repair quote for ${data.equipmentName}`);

  const text = plainTextLayout([
    `Hi ${data.customerName},`,
    "A technician has submitted a repair quote for your request.",
    `Equipment: ${data.equipmentName}`,
    `Estimated total: ${formattedAmount}`,
    "Please review and approve or decline the quote.",
    `View quote: ${data.quoteUrl}`,
  ]);

  return { subject: "You received a new repair quote on FixIt", html, text };
}
