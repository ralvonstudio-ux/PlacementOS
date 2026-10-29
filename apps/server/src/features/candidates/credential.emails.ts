import type { OutgoingEmail } from '../../lib/mailer';
import { emailLayout, escapeHtml as esc, emailButton, type EmailBrand } from '../../lib/email-layout';

// Login details a TPO/admin issues to a student — on first account creation ("welcome") or
// after resetting their password ("reset") — sent instead of handing over a printed slip.

export function credentialsEmail(
  opts: { to: string; fullName: string; loginId: string; password: string; loginUrl: string; kind: 'welcome' | 'reset' } & EmailBrand
): OutgoingEmail {
  const firstName = opts.fullName.split(' ')[0] || opts.fullName;
  const welcome = opts.kind === 'welcome';
  const heading = welcome ? 'Your PlacementOS account is ready' : 'Your PlacementOS password was reset';
  const intro = welcome
    ? `Your placement cell has created your PlacementOS account. You'll use it for training, practice tests, proctored assessments and placement drives.`
    : `Your placement cell has set a new password for your PlacementOS account. Your old password no longer works.`;

  const row = (label: string, value: string) => `
        <tr>
          <td style="padding:10px 14px;font-size:13px;color:#71717a;width:110px;">${label}</td>
          <td style="padding:10px 14px;font-family:Consolas,Menlo,monospace;font-size:17px;font-weight:700;color:#1f1d2b;letter-spacing:0.5px;">${esc(value)}</td>
        </tr>`;

  const body = `
    <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;color:#1f1d2b;">${heading}</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;">Hi ${esc(firstName)},</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:24px;">${intro} Here are your sign-in details:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border-radius:12px;background:#f3effe;border:1px solid #ddd3fd;">
      ${row('Login ID', opts.loginId)}
      ${row('Password', opts.password)}
    </table>
    ${emailButton(opts.loginUrl, 'Sign in to PlacementOS')}
    <p style="margin:22px 0 8px;font-size:14px;line-height:22px;font-weight:700;color:#1f1d2b;">Next steps</p>
    <ol style="margin:0 0 4px;padding-left:20px;font-size:14px;line-height:22px;color:#52525b;">
      <li>Sign in with the details above.</li>
      <li>Change this password to one only you know — open <strong>Settings</strong> after signing in.</li>
      <li>Forgot it later? Use <strong>Forgot password?</strong> on the sign-in page to get a code by email.</li>
    </ol>
    <p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #eeecf6;font-size:13px;line-height:20px;color:#71717a;">
      Keep these details private — don't share them with friends or post them in groups. Anyone with them can sign in as you, including during a test.
    </p>`;

  const text = [
    `Hi ${firstName},`,
    '',
    intro,
    '',
    `Login ID: ${opts.loginId}`,
    `Password: ${opts.password}`,
    `Sign in: ${opts.loginUrl}`,
    '',
    'Next steps:',
    '1. Sign in with the details above.',
    '2. Change this password to one only you know (Settings, after signing in).',
    '3. Forgot it later? Use "Forgot password?" on the sign-in page.',
    '',
    "Keep these details private — anyone with them can sign in as you.",
    '',
    `— PlacementOS${opts.instituteName ? ` · ${opts.instituteName}` : ''}`,
  ].join('\n');

  return {
    to: opts.to,
    subject: welcome ? 'Your PlacementOS login details' : 'Your new PlacementOS password',
    html: emailLayout(opts, welcome ? 'Your account is ready — here are your sign-in details.' : 'Your password was reset — here are your new sign-in details.', body),
    text,
  };
}
