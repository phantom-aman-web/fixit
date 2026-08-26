import type { JobAssignedTechTemplateData, RenderedEmail } from "@/lib/providers/email/types";
import { emailLayout, ctaButton, h1, p, infoTable, infoRow, plainTextLayout, escapeHtml } from "./base";

export function renderJobAssignedTech(data: JobAssignedTechTemplateData): RenderedEmail {
  const html = emailLayout(`
    ${h1("New job assigned to you 📋")}
    ${p(`Hi ${escapeHtml(data.technicianName)},`)}
    ${p("You have been assigned a new repair job. Please review the details and prepare for the appointment.")}
    ${infoTable(
      infoRow("Customer:", escapeHtml(data.customerFirstName)) +
      infoRow("Equipment:", escapeHtml(data.equipmentName)) +
      infoRow("Scheduled:", escapeHtml(data.scheduledAt))
    )}
    ${p("View the full job details on your technician dashboard.")}
    ${ctaButton("View Job", data.jobUrl)}
  `, `New repair job: ${data.equipmentName} for ${data.customerFirstName}`);

  const text = plainTextLayout([
    `Hi ${data.technicianName},`,
    "You have been assigned a new repair job.",
    `Customer: ${data.customerFirstName}`,
    `Equipment: ${data.equipmentName}`,
    `Scheduled: ${data.scheduledAt}`,
    `View job: ${data.jobUrl}`,
  ]);

  return { subject: "You have a new FixIt repair job", html, text };
}
