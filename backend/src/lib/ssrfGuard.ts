/**
 * SSRF protection for user-supplied outbound URLs (currently: the AI
 * proxy's "custom provider" base URL). Validates scheme, hostname
 * denylist, and every DNS-resolved address before the caller is allowed
 * to issue a request to it.
 */

import * as dns from 'dns';
import * as net from 'net';
import { APIError } from '../middleware/errorHandler';

/**
 * True if the given IP literal falls in a private, loopback, link-local,
 * or other non-public range — including IPv4-mapped IPv6 forms
 * (::ffff:127.0.0.1), which a plain string-prefix check on the hostname
 * would miss entirely.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const octets = ip.split('.').map(Number);
    const [a, b] = octets;
    return (
      a === 127 || // loopback
      a === 10 || // private
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      (a === 169 && b === 254) || // link-local / cloud metadata
      a === 0 || // "this network"
      a >= 224 // multicast/reserved
    );
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true; // loopback
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true; // link-local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local (ULA)
    // IPv4-mapped IPv6, e.g. ::ffff:127.0.0.1 — unwrap and recheck as IPv4
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateOrReservedIp(mapped[1]);
    return false;
  }
  // Not a parseable IP literal at all — treat as unsafe rather than let an
  // unexpected format slip through.
  return true;
}

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/,
  /\.internal$/,
  /\.local$/,
  /^metadata\.google\.internal$/,
];

/**
 * Validates a user-supplied base URL against SSRF targets: scheme,
 * hostname denylist, and — resolving past DNS entirely — every IP address
 * the hostname resolves to. Rejects if ANY resolved address is
 * private/reserved, not just the first. Throws APIError (400) on failure.
 *
 * Note: this is a pre-flight check, not a connection-time pin. A hostname
 * that resolves to a public IP now but is re-pointed at a private address
 * by the time the actual request connects (DNS rebinding) would not be
 * caught here; closing that gap needs a custom-lookup HTTP dispatcher.
 */
export async function assertSafeOutboundUrl(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new APIError('Base URL must use HTTP or HTTPS', 400, 'INVALID_BASE_URL');
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new APIError('Base URL points to a blocked/internal address', 400, 'BLOCKED_BASE_URL');
  }

  // If the hostname is itself a literal IP, dns.lookup just echoes it back.
  let addresses: string[];
  try {
    const results = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new APIError('Could not resolve base URL hostname', 400, 'DNS_RESOLUTION_FAILED');
  }

  if (addresses.length === 0 || addresses.some(isPrivateOrReservedIp)) {
    throw new APIError('Base URL points to a blocked/internal address', 400, 'BLOCKED_BASE_URL');
  }
}
