import type { OutgoingEmail } from '../../lib/mailer';
import { emailLayout as layout, escapeHtml as esc, emailButton, type EmailBrand as Brand } from '../../lib/email-layout';

// Password-reset emails: the shared PlacementOS frame plus a plain-text twin for clients that
// don't show HTML.

/** The 6-digit code email sent when a user asks to reset their password. */
export function resetCodeEmail(opts: { to: string; firstName: string; code: string; expiresMinutes: number; resetUrl: string } & Brand): OutgoingEmail {
  const spaced = opts.code.split('').join(' ');
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;color:#1f1d2b;">Reset your password</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;">Hi ${esc(opts.firstName)},</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:24px;">We received a request to reset the password for your PlacementOS account. Enter this verification code on the reset page:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:6px 0 22px;">
      <div style="display:inline-block;padding:16px 28px;border-radius:12px;background:#f3effe;border:1px solid #ddd3fd;font-family:Consolas,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:#5b21b6;">${esc(spaced)}</div>
    </td></tr></table>
    <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#52525b;">The code expires in <strong>${opts.expiresMinutes} minutes</strong> and can only be used once.</p>
    ${emailButton(opts.resetUrl, 'Open the reset page')}
    <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #eeecf6;font-size:13px;line-height:20px;color:#71717a;">
      Didn't ask for this? You can safely ignore this email — your password stays the same. Never share this code with anyone, including placement cell staff.
    </p>`;
  const text = [
    `Hi ${opts.firstName},`,
    '',
    'We received a request to reset the password for your PlacementOS account.',
    '',
    `Your verification code: ${opts.code}`,
    '',
    `It expires in ${opts.expiresMinutes} minutes and can only be used once.`,
    `Reset page: ${opts.resetUrl}`,
    '',
    "Didn't ask for this? Ignore this email — your password stays the same. Never share this code with anyone.",
    '',
    `— PlacementOS${opts.instituteName ? ` · ${opts.instituteName}` : ''}`,
  ].join('\n');
  return {
    to: opts.to,
    subject: `${opts.code} is your PlacementOS password reset code`,
    html: layout(opts, `Your code is ${opts.code}. It expires in ${opts.expiresMinutes} minutes.`, body),
    text,
  };
}

/** Confirmation sent after the password has actually been changed. */
export function passwordChangedEmail(opts: { to: string; firstName: string; when: Date; loginUrl: string } & Brand): OutgoingEmail {
  const when = opts.when.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' IST';
  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;color:#1f1d2b;">Your password was changed</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;">Hi ${esc(opts.firstName)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;">The password for your PlacementOS account was reset on <strong>${esc(when)}</strong>. You've been signed out on your other devices — sign in again with your new password.</p>
    ${emailButton(opts.loginUrl, 'Sign in to PlacementOS')}
    <p style="margin:24px 0 0;padding:14px 16px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;font-size:13px;line-height:20px;color:#991b1b;">
      <strong>Wasn't you?</strong> Reset your password again straight away and tell your placement cell (TPO) — someone may have access to your email.
    </p>`;
  const text = [
    `Hi ${opts.firstName},`,
    '',
    `The password for your PlacementOS account was reset on ${when}.`,
    "You've been signed out on your other devices — sign in again with your new password.",
    `Sign in: ${opts.loginUrl}`,
    '',
    "Wasn't you? Reset your password again straight away and tell your placement cell (TPO).",
    '',
    `— PlacementOS${opts.instituteName ? ` · ${opts.instituteName}` : ''}`,
  ].join('\n');
  return {
    to: opts.to,
    subject: 'Your PlacementOS password was changed',
    html: layout(opts, 'Your PlacementOS password was just changed.', body),
    text,
  };
}
