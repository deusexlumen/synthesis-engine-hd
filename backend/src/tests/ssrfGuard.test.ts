/**
 * SSRF guard tests.
 *
 * The `dns` module is mocked at the boundary: by default lookup delegates
 * to the real resolver (literal IPs echo back without network, so the
 * pre-existing cases stay hermetic), while the "DNS resolution" describe
 * overrides it to drive the resolve-and-check path in
 * assertSafeOutboundUrl (ssrfGuard.ts:79-89) deterministically.
 */

jest.mock('dns', () => {
  const actual = jest.requireActual<typeof import('dns')>('dns');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      lookup: jest.fn((...args: any[]) => (actual.promises.lookup as any)(...args)),
    },
  };
});

import * as dns from 'dns';
import { isPrivateOrReservedIp, assertSafeOutboundUrl } from '../lib/ssrfGuard';

const mockLookup = dns.promises.lookup as jest.Mock;
const realLookup = jest.requireActual<typeof import('dns')>('dns').promises.lookup;

describe('isPrivateOrReservedIp', () => {
  test('flags standard private/loopback/link-local IPv4 ranges', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.31.255.255')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true); // cloud metadata
  });

  test('allows public IPv4 addresses', () => {
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIp('172.32.0.1')).toBe(false); // just outside the 172.16-31 private range
  });

  test('flags IPv6 loopback, link-local, and unique-local', () => {
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
    expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
    expect(isPrivateOrReservedIp('fd12:3456::1')).toBe(true);
  });

  test('unwraps IPv4-mapped IPv6 addresses before checking (the string-prefix-only bug this replaces)', () => {
    // A hostname-prefix check like /^127\./ never sees this form at all —
    // it only ever looks at .hostname, never a resolved, normalized address.
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:8.8.8.8')).toBe(false);
  });

  test('treats unparseable input as unsafe', () => {
    expect(isPrivateOrReservedIp('not-an-ip')).toBe(true);
  });
});

describe('assertSafeOutboundUrl', () => {
  test('rejects non-http(s) schemes', async () => {
    await expect(assertSafeOutboundUrl('ftp://example.com')).rejects.toThrow();
  });

  test('rejects denylisted hostnames without needing DNS', async () => {
    await expect(assertSafeOutboundUrl('http://localhost:8080')).rejects.toThrow();
    await expect(assertSafeOutboundUrl('http://metadata.google.internal')).rejects.toThrow();
    await expect(assertSafeOutboundUrl('http://foo.internal')).rejects.toThrow();
  });

  test('rejects a literal private IP as the hostname', async () => {
    await expect(assertSafeOutboundUrl('http://127.0.0.1:11434')).rejects.toThrow();
    await expect(assertSafeOutboundUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow();
  });

  test('accepts a literal public IP', async () => {
    await expect(assertSafeOutboundUrl('https://8.8.8.8')).resolves.toBeUndefined();
  });

  describe('DNS resolution path (mocked resolver)', () => {
    afterEach(() => {
      // Restore the pass-through to the real resolver for the other cases.
      mockLookup.mockImplementation((...args: any[]) => (realLookup as any)(...args));
    });

    test('rejects a hostname that resolves to a private address', async () => {
      mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

      await expect(assertSafeOutboundUrl('https://evil.example.com')).rejects.toMatchObject({
        statusCode: 400,
        code: 'BLOCKED_BASE_URL',
      });
    });

    test('rejects when ANY resolved address is private (round-robin DNS)', async () => {
      mockLookup.mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: '192.168.1.10', family: 4 },
      ]);

      await expect(assertSafeOutboundUrl('https://dualhomed.example.com')).rejects.toMatchObject({
        statusCode: 400,
        code: 'BLOCKED_BASE_URL',
      });
    });

    test('rejects a hostname resolving to the cloud metadata address', async () => {
      mockLookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);

      await expect(assertSafeOutboundUrl('http://metadata.example.com/latest/meta-data')).rejects.toMatchObject({
        statusCode: 400,
        code: 'BLOCKED_BASE_URL',
      });
    });

    test('allows a hostname that resolves only to public addresses', async () => {
      mockLookup.mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      ]);

      await expect(assertSafeOutboundUrl('https://example.com')).resolves.toBeUndefined();
      expect(mockLookup).toHaveBeenCalledWith('example.com', { all: true, verbatim: true });
    });

    test('rejects with DNS_RESOLUTION_FAILED when lookup throws', async () => {
      mockLookup.mockRejectedValue(new Error('getaddrinfo ENOTFOUND dead.example.com'));

      await expect(assertSafeOutboundUrl('https://dead.example.com')).rejects.toMatchObject({
        statusCode: 400,
        code: 'DNS_RESOLUTION_FAILED',
      });
    });

    test('rejects when lookup returns no addresses', async () => {
      mockLookup.mockResolvedValue([]);

      await expect(assertSafeOutboundUrl('https://empty.example.com')).rejects.toMatchObject({
        statusCode: 400,
        code: 'BLOCKED_BASE_URL',
      });
    });
  });
});
