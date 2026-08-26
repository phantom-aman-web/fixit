import type { TechnicianAssignedTemplateData, RenderedEmail } from "@/lib/providers/email/types";
import { emailLayout, ctaButton, h1, p, infoTable, infoRow, plainTextLayout, escapeHtml } from "./base";

export function renderTechnicianAssigned(data: TechnicianAssignedTemplateData): RenderedEmail {
  const html = emailLayout(`
    ${h1("A technician has been assigned 🔧")}
    ${p(`Hi ${escapeHtml(data.customerName)},`)}
    ${p("Great news — a qualified technician has been assigned to your repair request.")}
    ${infoTable(
      infoRow("Technician:", escapeHtml(data.technicianName)) +
      infoRow("Equipment:", escapeHtml(data.equipmentName)) +
      infoRow("Scheduled:", escapeHtml(data.scheduledAt))
    )}
    ${p("You can view the full details of your appointment on your dashboard.")}
    ${ctaButton("View Appointment", data.dashboardUrl)}
  `, `${data.technicianName} has been assigned to your ${data.equipmentName} repair`);

  const text = plainTextLayout([
    `Hi ${data.customerName},`,
    "A technician has been assigned to your repair request.",
    `Technician: ${data.technicianName}`,
    `Equipment: ${data.equipmentName}`,
    `Scheduled: ${data.scheduledAt}`,
    `View appointment: ${data.dashboardUrl}`,
  ]);

  return { subject: "A technician has been assigned to your FixIt request", html, text };
}
