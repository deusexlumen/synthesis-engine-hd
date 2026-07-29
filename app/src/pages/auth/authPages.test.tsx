/**
 * Render tests for the password-reset and email-verification views.
 *
 * No @testing-library in this project — components are mounted with
 * react-dom/client into happy-dom and flushed with React's act().
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import ResetPasswordPage from './ResetPasswordPage';
import VerifyEmailPage from './VerifyEmailPage';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function renderAt(route: string, element: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>);
  });
  return container;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
});

describe('ResetPasswordPage', () => {
  it('renders the new-password form when a token is present', async () => {
    const c = await renderAt('/reset-password?token=abc123', <ResetPasswordPage />);

    expect(c.textContent).toContain('Neues Passwort');
    expect(c.querySelector('#password')).toBeTruthy();
    expect(c.querySelector('#confirmPassword')).toBeTruthy();
  });

  it('shows an invalid-link message without a token', async () => {
    const c = await renderAt('/reset-password', <ResetPasswordPage />);

    expect(c.textContent).toContain('Ungültiger Link');
    expect(c.querySelector('#password')).toBeNull();
  });

  it('shows a client-side error when passwords do not match', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const c = await renderAt('/reset-password?token=abc123', <ResetPasswordPage />);

    const password = c.querySelector<HTMLInputElement>('#password')!;
    const confirm = c.querySelector<HTMLInputElement>('#confirmPassword')!;
    const form = c.querySelector('form')!;

    await act(async () => {
      setNativeValue(password, 'geheim123');
      setNativeValue(confirm, 'anders456');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(c.textContent).toContain('Die Passwörter stimmen nicht überein.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// React controlled inputs ignore plain .value assignment — go through the
// native setter so the change event reaches React's onChange.
function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('VerifyEmailPage', () => {
  it('confirms the token from the URL and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const c = await renderAt('/verify-email?token=verify-me', <VerifyEmailPage />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/auth/verify-email');
    expect(JSON.parse(init.body as string)).toEqual({ token: 'verify-me' });
    expect(c.textContent).toContain('E-Mail bestätigt');
  });

  it('shows an error when the backend rejects the token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ success: false, error: 'Invalid or expired verification token' }),
      })
    );

    const c = await renderAt('/verify-email?token=bad', <VerifyEmailPage />);

    expect(c.textContent).toContain('Bestätigung fehlgeschlagen');
    expect(c.textContent).toContain('Invalid or expired verification token');
  });

  it('shows an error immediately when no token is in the URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const c = await renderAt('/verify-email', <VerifyEmailPage />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(c.textContent).toContain('Bestätigung fehlgeschlagen');
  });
});
