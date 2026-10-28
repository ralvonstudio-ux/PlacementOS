import type { IssuedCredential } from '@placementos/types';

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** CSV of issued logins — the only copy of these passwords, so the TPO keeps this file safe. */
export function downloadCredentialsCsv(creds: IssuedCredential[], fileName = 'student-logins.csv') {
  const head = ['Name', 'Roll Number', 'Batch', 'Login ID', 'Password'];
  const rows = creds.map((c) => [c.fullName, c.rollNumber, c.batch, c.loginId, c.password]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Opens a print-ready sheet of cut-out slips, one per student, to hand out in the lab. */
export function printCredentialSlips(creds: IssuedCredential[], loginUrl = window.location.origin + '/login') {
  const slips = creds
    .map(
      (c) => `<div class="slip">
  <div class="name">${esc(c.fullName)}</div>
  <div class="meta">${esc(c.rollNumber)} · ${esc(c.batch)}</div>
  <table>
    <tr><td>Login ID</td><td class="v">${esc(c.loginId)}</td></tr>
    <tr><td>Password</td><td class="v">${esc(c.password)}</td></tr>
  </table>
  <div class="url">Sign in at ${esc(loginUrl)}</div>
</div>`
    )
    .join('');
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return false;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Student login slips</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 16px; color: #111; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; }
  .slip { border: 1px dashed #999; padding: 14px 16px; break-inside: avoid; page-break-inside: avoid; }
  .name { font-weight: 700; font-size: 15px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 8px; }
  table { border-collapse: collapse; font-size: 13px; }
  td { padding: 2px 12px 2px 0; color: #555; }
  td.v { font-family: ui-monospace, Consolas, monospace; font-size: 15px; font-weight: 700; color: #111; letter-spacing: .05em; }
  .url { margin-top: 8px; font-size: 11px; color: #777; }
  @media print { body { margin: 0; } }
</style></head><body><div class="grid">${slips}</div>
<script>window.onload = () => window.print();</script></body></html>`);
  win.document.close();
  return true;
}
