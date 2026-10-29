// Shared frame for every PlacementOS email: table-based HTML (the only layout email clients render
// reliably), inline styles, a dark brand header and a muted footer. Callers supply the body.

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface EmailBrand {
  instituteName?: string;
  supportLine: string;
}

export function emailLayout(brand: EmailBrand, preheader: string, body: string): string {
  const institute = brand.instituteName ? escapeHtml(brand.instituteName) : 'Training &amp; Placement Cell';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PlacementOS</title></head>
<body style="margin:0;padding:0;background:#f4f2fb;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2fb;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f1d2b;">
      <tr><td style="background:#120b25;padding:22px 28px;">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Placement</span><span style="font-size:22px;font-weight:800;color:#a78bfa;letter-spacing:-0.3px;">OS</span>
        <div style="font-size:11px;letter-spacing:2px;color:#a1a1aa;margin-top:4px;text-transform:uppercase;">${institute}</div>
      </td></tr>
      <tr><td style="padding:28px;">${body}</td></tr>
      <tr><td style="padding:18px 28px;background:#faf9fd;border-top:1px solid #eeecf6;font-size:12px;line-height:18px;color:#71717a;">
        ${escapeHtml(brand.supportLine)}<br>This is an automated message from PlacementOS — please don't reply to it.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** A violet call-to-action button that survives Outlook and Gmail. */
export const emailButton = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:#7c3aed;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr></table>`;
