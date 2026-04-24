import { Resend } from "resend";

// Lazy init — avoids crash at module load when AUTH_RESEND_KEY is not set
let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.AUTH_RESEND_KEY);
  return _resend;
}
const FROM = process.env.EMAIL_FROM ?? "QMS <noreply@yourdomain.com>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  if (!process.env.AUTH_RESEND_KEY) {
    // Dev fallback: log instead of sending
    console.log("[email] (no RESEND key — dry run)");
    console.log("  To:", to);
    console.log("  Subject:", subject);
    return { ok: true };
  }

  const result = await getResend().emails.send({
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });

  return result;
}

export function buildStatusNotificationHtml({
  itemName,
  boardName,
  columnName,
  newStatus,
  changedByName,
}: {
  itemName: string;
  boardName: string;
  columnName: string;
  newStatus: string;
  changedByName: string;
}) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e293b">Status Update — ${boardName}</h2>
      <p>The status of <strong>${itemName}</strong> has changed.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;border:1px solid #e2e8f0">Board</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0">${boardName}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;border:1px solid #e2e8f0">Item</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0">${itemName}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;border:1px solid #e2e8f0">Column</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0">${columnName}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;border:1px solid #e2e8f0">New Status</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0">
            <span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:99px;font-weight:600">${newStatus}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;border:1px solid #e2e8f0">Changed by</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0">${changedByName}</td>
        </tr>
      </table>
      <p style="color:#64748b;font-size:13px">This is an automated notification from QMS.</p>
    </div>
  `;
}
