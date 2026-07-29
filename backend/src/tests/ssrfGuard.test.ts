import { isPrivateOrReservedIp, assertSafeOutboundUrl } from '../lib/ssrfGuard';

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
});
