import type { JobStatusTemplateData, RenderedEmail } from "@/lib/providers/email/types";
import { emailLayout, ctaButton, h1, p, infoTable, infoRow, plainTextLayout, escapeHtml } from "./base";

const STATUS_LABELS: Record<string, { label: string; description: string }> = {
  EN_ROUTE: {
    label: "Technician en route",
    description: "Your technician is on the way. Please be available to receive them.",
  },
  ARRIVED: {
    label: "Technician arrived",
    description: "Your technician has arrived and will begin the inspection shortly.",
  },
  INSPECTING: {
    label: "Inspection in progress",
    description: "Your technician is inspecting the equipment.",
  },
  DIAGNOSING: {
    label: "Diagnosis in progress",
    description: "Your technician is diagnosing the issue.",
  },
  REPAIRING: {
    label: "Repair in progress",
    description: "Your technician is actively repairing your equipment.",
  },
  COMPLETED: {
    label: "Repair completed",
    description: "Your repair has been completed. Please review and provide feedback.",
  },
  CANCELLED: {
    label: "Job cancelled",
    description: "This repair job has been cancelled. Please contact support if you have questions.",
  },
};

export function renderJobStatus(data: JobStatusTemplateData): RenderedEmail {
  const info = STATUS_LABELS[data.newStatus] ?? {
    label: escapeHtml(data.statusLabel),
    description: `Your repair status has been updated to: ${escapeHtml(data.statusLabel)}.`,
  };

  const html = emailLayout(`
    ${h1(`Repair update: ${info.label}`)}
    ${p(`Hi ${escapeHtml(data.customerName)},`)}
    ${p(info.description)}
    ${infoTable(
      infoRow("Equipment:", escapeHtml(data.equipmentName)) +
      infoRow("Status:", escapeHtml(info.label))
    )}
    ${ctaButton("View Repair Details", data.dashboardUrl)}
  `, `Your ${data.equipmentName} repair status: ${info.label}`);

  const text = plainTextLayout([
    `Hi ${data.customerName},`,
    `Status update for your ${data.equipmentName} repair:`,
    info.description,
    `View details: ${data.dashboardUrl}`,
  ]);

  return {
    subject: `Your FixIt repair status: ${info.label}`,
    html,
    text,
  };
}
