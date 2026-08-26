import type { QuoteDecisionTemplateData, RenderedEmail } from "@/lib/providers/email/types";
import { emailLayout, ctaButton, h1, p, infoTable, infoRow, plainTextLayout, escapeHtml } from "./base";

export function renderQuoteDecision(data: QuoteDecisionTemplateData): RenderedEmail {
  const approved = data.decision === "APPROVED";

  const html = emailLayout(`
    ${h1(approved ? "Your quote was approved! ✅" : "Quote declined")}
    ${p(`Hi ${escapeHtml(data.technicianName)},`)}
    ${p(approved
      ? "The customer has approved your repair quote. You can now proceed with the repair."
      : "The customer has declined your quote for this repair request. No further action is required."
    )}
    ${infoTable(
      infoRow("Equipment:", escapeHtml(data.equipmentName)) +
      infoRow("Decision:", approved ? "Approved ✅" : "Declined ❌")
    )}
    ${approved ? ctaButton("View Job Details", data.jobUrl) : ""}
  `, `Your quote for ${data.equipmentName} was ${approved ? "approved" : "declined"}`);

  const text = plainTextLayout([
    `Hi ${data.technicianName},`,
    approved
      ? "Good news — the customer approved your quote. You can now begin the repair."
      : "The customer has declined your quote for this repair.",
    `Equipment: ${data.equipmentName}`,
    ...(approved ? [`View job: ${data.jobUrl}`] : []),
  ]);

  const subject = approved
    ? "Your FixIt quote was approved — get ready to repair!"
    : "Your FixIt quote was declined";

  return { subject, html, text };
}
