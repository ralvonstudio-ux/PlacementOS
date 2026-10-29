import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

// Outgoing email over SMTP — works with any provider (Google Workspace, Zoho, Brevo, Amazon SES,
// Resend's SMTP relay…). Configure SMTP_HOST/PORT/USER/PASS and EMAIL_FROM. With no SMTP_HOST:
// in development the message is printed to the console so flows can be tested end to end; in
// production it is logged as not sent (callers never fail a request because email is down).

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporter: Transporter | null = null;

export const isMailerConfigured = () => !!env.SMTP_HOST;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // Port 465 is implicit TLS; 587/25 upgrade with STARTTLS.
    secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/** Sends an email; returns whether it was handed to the SMTP server. Never throws. */
export async function sendEmail(mail: OutgoingEmail): Promise<boolean> {
  if (!isMailerConfigured()) {
    if (env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(`\n[mailer:dev] To: ${mail.to}\n[mailer:dev] Subject: ${mail.subject}\n${mail.text}\n`);
    } else {
      logger.warn('Email not sent — SMTP is not configured', { subject: mail.subject });
    }
    return false;
  }
  try {
    await getTransporter().sendMail({ from: env.EMAIL_FROM, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
    return true;
  } catch (err) {
    logger.error('Email send failed', { subject: mail.subject, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
