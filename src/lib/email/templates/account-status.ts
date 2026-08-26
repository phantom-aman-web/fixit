import type { AccountStatusTemplateData, RenderedEmail } from "@/lib/providers/email/types";
import { emailLayout, ctaButton, h1, p, infoTable, infoRow, plainTextLayout, securityNote, escapeHtml } from "./base";

export function renderAccountStatus(data: AccountStatusTemplateData): RenderedEmail {
  const approved = data.newStatus === "ACTIVE";

  const html = emailLayout(`
    ${h1(approved ? "Your FixIt account is approved! ✅" : "Account update")}
    ${p(`Hi ${escapeHtml(data.technicianName)},`)}
    ${p(approved
      ? "Your technician account has been reviewed and approved. You can now log in and start receiving repair requests."
      : "Your technician account status has been updated. Please log in to see more details or contact support."
    )}
    ${infoTable(
      infoRow("Account status:", approved ? "Approved — Active" : "Suspended")
    )}
    ${ctaButton("Go to Dashboard", data.dashboardUrl)}
    ${securityNote("If you did not expect this change, please contact support@fixit.app immediately.")}
  `, `Your FixIt technician account is now ${approved ? "active" : "suspended"}`);

  const text = plainTextLayout([
    `Hi ${data.technicianName},`,
    approved
      ? "Your technician account has been approved. You can now receive repair requests."
      : "Your technician account status has been updated. Please log in for more details.",
    `Dashboard: ${data.dashboardUrl}`,
    "If you did not expect this, contact support@fixit.app.",
  ]);

  return {
    subject: approved
      ? "Your FixIt technician account is now active"
      : "FixIt account status update",
    html,
    text,
  };
}
