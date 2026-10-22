import { isIP } from 'net';
import { networkInterfaces } from 'os';
import type { Request } from 'express';

/** Loopback / private / link-local — an address that says nothing about where the candidate is. */
const isNonRoutable = (ip: string): boolean =>
  ip === '::1' ||
  ip === '::' ||
  /^127\./.test(ip) ||
  /^10\./.test(ip) ||
  /^192\.168\./.test(ip) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
  /^169\.254\./.test(ip) ||
  /^f[cd][0-9a-f]{2}:/i.test(ip) ||
  /^fe80:/i.test(ip);

/** `::ffff:1.2.3.4` (IPv4-mapped IPv6, what Node reports on dual-stack sockets) → `1.2.3.4`. */
const normalise = (ip: string): string => ip.trim().replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, '$1');

/** This machine's own LAN address — what "the system IP" means when the candidate and the
 *  server are on the same box (local dev), where the socket only ever shows loopback. */
function machineIp(): string | undefined {
  const all = Object.values(networkInterfaces()).flat().filter((n): n is NonNullable<typeof n> => !!n && !n.internal);
  return (all.find((n) => n.family === 'IPv4') ?? all[0])?.address;
}

/**
 * The candidate's real IP for proctoring. The socket/proxy address wins when it's a public one;
 * when it isn't (localhost, a campus LAN, a dev proxy) the public IP the browser looked up for
 * itself (X-Client-Ip) is used instead, and failing that this machine's own network address —
 * never the meaningless `::1`.
 */
export function resolveClientIp(req: Request): string | undefined {
  const socketIp = req.ip ? normalise(req.ip) : undefined;
  if (socketIp && !isNonRoutable(socketIp)) return socketIp;

  const reported = normalise(req.get('x-client-ip') ?? '');
  if (reported && isIP(reported)) return reported;

  if (!socketIp || socketIp === '::1' || /^127\./.test(socketIp)) return machineIp() ?? socketIp;
  return socketIp;
}
