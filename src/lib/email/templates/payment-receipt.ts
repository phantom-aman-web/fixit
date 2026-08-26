import type { PaymentReceiptTemplateData, RenderedEmail } from "@/lib/providers/email/types";
import { emailLayout, ctaButton, h1, p, infoTable, infoRow, plainTextLayout, escapeHtml, formatCurrency } from "./base";

export function renderPaymentReceipt(data: PaymentReceiptTemplateData): RenderedEmail {
  const formattedAmount = formatCurrency(data.amount, data.currency);

  const html = emailLayout(`
    ${h1("Payment successful 🎉")}
    ${p(`Hi ${escapeHtml(data.customerName)},`)}
    ${p("Your payment has been processed and your repair is now complete. Thank you for using FixIt!")}
    ${infoTable(
      infoRow("Equipment:", escapeHtml(data.equipmentName)) +
      infoRow("Amount paid:", escapeHtml(formattedAmount)) +
      infoRow("Paid on:", escapeHtml(data.paidAt))
    )}
    ${p("You can view your repair history and leave a review on your dashboard.")}
    ${ctaButton("View Dashboard", data.dashboardUrl)}
  `, `Your FixIt payment of ${formattedAmount} was successful`);

  const text = plainTextLayout([
    `Hi ${data.customerName},`,
    "Your payment has been successfully processed.",
    `Equipment: ${data.equipmentName}`,
    `Amount: ${formattedAmount}`,
    `Date: ${data.paidAt}`,
    `View dashboard: ${data.dashboardUrl}`,
  ]);

  return { subject: "Your FixIt payment was successful", html, text };
}
