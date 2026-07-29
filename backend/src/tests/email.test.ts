/**
 * Email Service Tests
 *
 * fetch is mocked — no real calls to the Resend API.
 */

import {
  sendEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../services/email';

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.FRONTEND_URL;
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

describe('sendEmail', () => {
  test('dev fallback: logs instead of sending when RESEND_API_KEY is missing', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
      text: 'hi',
    });

    expect(result).toEqual({ sent: false, devFallback: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  test('posts to the Resend API with auth header and payload', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'Synthesis <noreply@example.com>';

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>body</p>',
      text: 'body',
    });

    expect(result).toEqual({ sent: true, devFallback: false });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer re_test_key');

    const body = JSON.parse(init.body as string);
    expect(body.from).toBe('Synthesis <noreply@example.com>');
    expect(body.to).toEqual(['user@example.com']);
    expect(body.subject).toBe('Subject');
    expect(body.html).toBe('<p>body</p>');
    expect(body.text).toBe('body');
  });

  test('throws on Resend API error', async () => {
    process.env.RESEND_API_KEY = 're_test_key';

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'invalid recipient',
    } as unknown as Response);

    await expect(
      sendEmail({ to: 'bad', subject: 's', html: 'h', text: 't' })
    ).rejects.toThrow('Resend API error (422)');
  });
});

describe('transactional templates', () => {
  test('password reset email contains the reset link with the plaintext token', async () => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await sendPasswordResetEmail('user@example.com', 'secret-token');

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('https://app.example.com/reset-password?token=secret-token');
  });

  test('verification email contains the verify link with the plaintext token', async () => {
    process.env.FRONTEND_URL = 'https://app.example.com';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await sendVerificationEmail('user@example.com', 'verify-token');

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('https://app.example.com/verify-email?token=verify-token');
  });
});
