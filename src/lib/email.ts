import { Resend } from 'resend';

let resendInstance: Resend | null = null;

export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return null;
  }

  const { data, error } = await resend.emails.send({
    from: options.from || process.env.RESEND_FROM_EMAIL || 'CXD Canvas <noreply@cyberdelic.design>',
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  if (error) {
    console.error('Failed to send email:', error);
    throw error;
  }

  return data;
}
