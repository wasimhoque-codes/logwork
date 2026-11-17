import { createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as bootstrap } from '../app/api/bootstrap/route';
import { GET as backup } from '../app/api/backup/route';
import { POST as mutate } from '../app/api/mutations/route';
import { POST as restore } from '../app/api/imports/route';
import { GET as sessionStatus } from '../app/api/auth/session/route';
import { POST as logout } from '../app/api/auth/logout/route';
import { finishGitHub, startGitHub } from '../src/server/auth';

const { getCloudflareContext } = vi.hoisted(() => ({ getCloudflareContext: vi.fn() }));
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext }));

const origin = 'https://gym-hawk.example';
const ownerId = '123456';
const secret = 'local-test-session-signing-key-only';
const prepare = vi.fn();
const env = {
  APP_ORIGIN: origin,
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  GITHUB_OWNER_ID: ownerId,
  SESSION_SECRET: secret,
  DB: { prepare },
} as unknown as CloudflareEnv;

beforeEach(() => {
  vi.clearAllMocks();
  getCloudflareContext.mockReturnValue({ env });
});

function request(path: string, options?: RequestInit, base = origin) {
  return new Request(base + path, options);
}

function cookies(response: Response) {
  return response.headers.getSetCookie().map(value => value.split(';', 1)[0]);
}

async function begin() {
  const response = await startGitHub(request('/api/auth/github/start'), env);
  const url = new URL(response.headers.get('Location')!);
  const state = url.searchParams.get('state')!;
  return { response, url, state, pending: cookies(response)[0] };
}

function github(id: number, login = 'renamed-account') {
  return vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ access_token: 'test-github-token' }))
    .mockResolvedValueOnce(Response.json({ id, login }));
}

function callback(state: string, pending: string, send: typeof fetch) {
  return finishGitHub(request('/api/auth/github/callback?code=test&state=' + state, {
    headers: { Cookie: pending },
  }), env, send);
}

describe('GitHub OAuth', () => {
  it('binds the login to a short-lived state cookie and PKCE and authorizes by durable ID', async () => {
    const { response, url, state, pending } = await begin();
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('redirect_uri')).toBe(origin + '/api/auth/github/callback');
    expect(url.searchParams.get('scope')).toBe('');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(response.headers.getSetCookie()[0]).toMatch(/^__Host-.*; Path=\/; Max-Age=600; Secure; HttpOnly; SameSite=Lax$/);

    const send = github(Number(ownerId));
    const result = await callback(state, pending, send);
    expect(result.headers.get('Location')).toBe('/#settings');
    const body = send.mock.calls[0][1]!.body as URLSearchParams;
    expect(body.get('client_secret')).toBe(env.GITHUB_CLIENT_SECRET);
    expect(body.get('redirect_uri')).toBe(origin + '/api/auth/github/callback');
    expect(createHash('sha256').update(body.get('code_verifier')!).digest('base64url')).toBe(url.searchParams.get('code_challenge'));
    expect(send.mock.calls[1][0]).toBe('https://api.github.com/user');
    expect(new Headers(send.mock.calls[1][1]?.headers).get('Authorization')).toBe('Bearer test-github-token');
    expect(result.headers.getSetCookie()[1]).toMatch(/^__Host-.*; Path=\/; Max-Age=604800; Secure; HttpOnly; SameSite=Lax$/);
    expect(result.headers.getSetCookie().join()).not.toContain('test-github-token');

    const status = await sessionStatus(request('/api/auth/session', { headers: { Cookie: cookies(result)[1] } }));
    expect(await status.json()).toEqual({ signedIn: true, localDevelopment: false });
    expect(status.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it.each(['exchange', 'profile'] as const)('fails sign-in when GitHub redirects the %s request', async (step) => {
    const { state, pending } = await begin();
    const send = vi.fn<typeof fetch>();
    if (step === 'profile') send.mockResolvedValueOnce(Response.json({ access_token: 'test-github-token' }));
    send.mockResolvedValueOnce(Response.redirect('https://example.com/redirect'));
    const response = await callback(state, pending, send);
    expect(response.headers.get('Location')).toBe('/?cloud-signin=retry#settings');
    expect(send).toHaveBeenCalledTimes(step === 'profile' ? 2 : 1);
    expect(send.mock.calls.every(([, options]) => options?.redirect === 'manual')).toBe(true);
    expect(cookies(response)).toEqual(['__Host-gym-hawk-oauth=']);
  });

  it('rejects another account even if the username looks right', async () => {
    const { state, pending } = await begin();
    const response = await callback(state, pending, github(1, 'wasimhoque-codes'));
    expect(response.headers.get('Location')).toBe('/?cloud-signin=account#settings');
    expect(cookies(response)).toEqual(['__Host-gym-hawk-oauth=']);
  });

  it('never contacts GitHub for absent, mismatched, or expired state', async () => {
    const { state, pending } = await begin();
    const expired = await new SignJWT({ state, verifier: 'expired' }).setProtectedHeader({ alg: 'HS256' })
      .setIssuer(origin).setAudience('gym-hawk:oauth').setSubject(ownerId)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 601).setExpirationTime('-1s')
      .sign(new TextEncoder().encode(secret));
    const send = github(Number(ownerId));
    for (const [nonce, value] of [[state, ''], ['different', pending], [state, '__Host-gym-hawk-oauth=' + expired]]) {
      expect((await callback(nonce, value, send)).headers.get('Location')).toBe('/?cloud-signin=retry#settings');
    }
    expect(send).not.toHaveBeenCalled();
  });
});

describe('private API', () => {
  it('rejects signed-out requests to every data route before accessing D1', async () => {
    for (const [path, handler, method] of [
      ['/api/bootstrap', bootstrap, 'GET'], ['/api/backup', backup, 'GET'],
      ['/api/mutations', mutate, 'POST'], ['/api/imports', restore, 'POST'],
    ] as const) {
      const response = await handler(request(path, { method, headers: {
        Origin: origin, 'Cf-Access-Jwt-Assertion': 'legacy-assertion',
      } }));
      expect(response.status).toBe(401);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    }
    expect(prepare).not.toHaveBeenCalled();
  });

  it('rejects expired sessions, wrong origins, and OAuth cookies used as sessions', async () => {
    const { state, pending } = await begin();
    const success = await callback(state, pending, github(Number(ownerId)));
    const signed = cookies(success)[1];
    const expired = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' })
      .setIssuer(origin).setAudience('gym-hawk:session').setSubject(ownerId)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 604801).setExpirationTime('-1s')
      .sign(new TextEncoder().encode(secret));
    for (const value of [signed + 'tampered', '__Host-gym-hawk-session=' + expired, pending.replace('-oauth=', '-session=')]) {
      expect((await bootstrap(request('/api/bootstrap', { headers: { Cookie: value } }))).status).toBe(401);
    }
    expect((await bootstrap(request('/api/bootstrap', { headers: { Cookie: signed } }, 'https://other.example'))).status).toBe(503);
    for (const [path, handler] of [['/api/mutations', mutate], ['/api/imports', restore], ['/api/auth/logout', logout]] as const) {
      expect((await handler(request(path, { method: 'POST', headers: { Cookie: signed, Origin: 'https://other.example' } }))).status).toBe(403);
    }
    expect(prepare).not.toHaveBeenCalled();

    const signedOut = await logout(request('/api/auth/logout', { method: 'POST', headers: { Origin: origin, Cookie: signed } }));
    expect(signedOut.status).toBe(200);
    expect(signedOut.headers.getSetCookie().find(value => value.startsWith('__Host-gym-hawk-session='))).toContain('Max-Age=0');
  });

  it('only permits the opt-in bypass on HTTP loopback and fails closed when unconfigured', async () => {
    getCloudflareContext.mockReturnValue({ env: { LOCAL_DEV_AUTH: '1', DB: env.DB } });
    expect((await sessionStatus(request('/api/auth/session', {}, 'http://127.0.0.1:8787'))).status).toBe(200);
    for (const url of [origin, 'https://127.0.0.1:8787', 'http://192.168.0.2:8787']) {
      expect((await bootstrap(request('/api/bootstrap', {}, url))).status).toBe(503);
    }
    expect(prepare).not.toHaveBeenCalled();
  });
});
