import type { RepairRequestCreatedTemplateData, RenderedEmail } from "@/lib/providers/email/types";
import { emailLayout, ctaButton, h1, p, infoTable, infoRow, plainTextLayout, escapeHtml } from "./base";

export function renderJobCreated(data: RepairRequestCreatedTemplateData): RenderedEmail {
  const html = emailLayout(`
    ${h1("Your repair request was received ✅")}
    ${p(`Hi ${escapeHtml(data.customerName)},`)}
    ${p("We've received your repair request and are finding the best available technician for you.")}
    ${infoTable(
      infoRow("Equipment:", escapeHtml(data.equipmentName)) +
      infoRow("Issue:", escapeHtml(data.problemSummary)) +
      infoRow("Request ID:", escapeHtml(data.jobId))
    )}
    ${p("You'll receive another notification as soon as a technician is matched to your request.")}
    ${ctaButton("View My Request", data.dashboardUrl)}
  `, `Your repair request for ${data.equipmentName} was received`);

  const text = plainTextLayout([
    `Hi ${data.customerName},`,
    "Your repair request was received successfully.",
    `Equipment: ${data.equipmentName}`,
    `Issue: ${data.problemSummary}`,
    `Request ID: ${data.jobId}`,
    "We'll notify you when a technician is assigned.",
    `View your request: ${data.dashboardUrl}`,
  ]);

  return { subject: "Your FixIt repair request was received", html, text };
}
