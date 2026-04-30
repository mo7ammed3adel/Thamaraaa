import nodemailer from "nodemailer";

/**
 * Sends a warning notification email via SMTP.
 * Failures are silently caught and returned — email should never block warning creation.
 * @param to Recipient email address
 * @param subject Email subject line
 * @param message Warning message body
 * @param senderName Name of the person who issued the warning
 * @returns Object with success flag and optional error message
 */
export async function sendWarningEmail(
  to: string,
  subject: string,
  message: string,
  senderName: string
): Promise<{ success: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !pass || !from) {
    return { success: false, error: "SMTP not configured" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"Thamaraa ERP" <${from}>`,
      to,
      subject: `[Warning] ${subject}`,
      text: `Warning issued by ${senderName}:\n\n${message}\n\n---\nPlease log in to the system to acknowledge this warning.\nThamaraa ERP`,
    });

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown email error";
    console.error(`Failed to send warning email to ${to}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}
