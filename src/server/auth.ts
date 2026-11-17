import { base64url, jwtVerify, SignJWT } from 'jose';
import { HttpError, jsonResponse, privateHeaders } from './responses';

const callbackPath = '/api/auth/github/callback';
const stateCookie = '__Host-gym-hawk-oauth';
const sessionCookie = '__Host-gym-hawk-session';
const stateAge = 10 * 60;
const sessionAge = 7 * 24 * 60 * 60;
const stateAudience = 'gym-hawk:oauth';
const sessionAudience = 'gym-hawk:session';
const encoder = new TextEncoder();

export const isLoopback = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

function isLocalAuth(request: Request, env: CloudflareEnv) {
  const url = new URL(request.url);
  return env.LOCAL_DEV_AUTH === '1' && url.protocol === 'http:' && isLoopback(url.hostname);
}

function authConfig(request: Request, env: CloudflareEnv) {
  const { APP_ORIGIN: origin, GITHUB_CLIENT_ID: clientId, GITHUB_CLIENT_SECRET: clientSecret,
    GITHUB_OWNER_ID: ownerId, SESSION_SECRET: secret } = env;
  if (!origin || !origin.startsWith('https://') || new URL(request.url).origin !== origin ||
      !clientId || !clientSecret || !ownerId || !/^[1-9]\d*$/.test(ownerId) ||
      !secret || encoder.encode(secret).length < 32) {
    throw new HttpError(503, 'GitHub sign-in is unavailable. Your local records are safe.');
  }
  return { origin, clientId, clientSecret, ownerId, key: encoder.encode(secret) };
}

type AuthConfig = ReturnType<typeof authConfig>;

function readCookie(request: Request, name: string) {
  const matches = request.headers.get('cookie')?.split(';').map(part => part.trim())
    .filter(part => part.startsWith(name + '='));
  return matches?.length === 1 ? matches[0].slice(name.length + 1) : undefined;
}

function cookie(name: string, value: string, age: number) {
  return `${name}=${value}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Lax`;
}

function sign(config: AuthConfig, audience: string, age: number, payload: Record<string, string>) {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' })
    .setIssuer(config.origin).setAudience(audience).setSubject(config.ownerId)
    .setIssuedAt().setExpirationTime(`${age}s`).sign(config.key);
}

async function verify(token: string | undefined, config: AuthConfig, audience: string, age: number) {
  if (!token || token.length > 4096) return null;
  try {
    return (await jwtVerify(token, config.key, {
      algorithms: ['HS256'], issuer: config.origin, subject: config.ownerId, audience,
      requiredClaims: ['exp', 'iat'], maxTokenAge: age,
    })).payload;
  } catch {
    return null;
  }
}

function redirect(location: string, ...cookies: string[]) {
  const headers = new Headers({ ...privateHeaders, Location: location, 'Referrer-Policy': 'no-referrer' });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers });
}

export async function session(request: Request, env: CloudflareEnv) {
  if (isLocalAuth(request, env)) return { signedIn: true, localDevelopment: true };
  const config = authConfig(request, env);
  const signedIn = !!await verify(readCookie(request, sessionCookie), config, sessionAudience, sessionAge);
  return { signedIn, localDevelopment: false };
}

export async function startGitHub(request: Request, env: CloudflareEnv) {
  const config = authConfig(request, env);
  const state = base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url.encode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
  const url = new URL('https://github.com/login/oauth/authorize');
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.origin + callbackPath, scope: '',
    state, code_challenge: challenge, code_challenge_method: 'S256',
  }).toString();
  const pending = await sign(config, stateAudience, stateAge, { state, verifier });
  return redirect(url.href, cookie(stateCookie, pending, stateAge));
}

export async function finishGitHub(request: Request, env: CloudflareEnv, send = fetch) {
  const config = authConfig(request, env);
  const params = new URL(request.url).searchParams;
  const pending = await verify(readCookie(request, stateCookie), config, stateAudience, stateAge);
  const clearState = cookie(stateCookie, '', 0);
  const fail = (reason: 'retry' | 'account') => redirect('/?cloud-signin=' + reason + '#settings', clearState);
  const code = params.get('code');
  if (!code || code.length > 512 || params.has('error') ||
      params.getAll('code').length !== 1 || params.getAll('state').length !== 1 ||
      !pending || typeof pending.state !== 'string' || typeof pending.verifier !== 'string' ||
      pending.state !== params.get('state')) return fail('retry');

  // Workers supports manual redirect handling. Reject non-2xx responses without forwarding credentials.
  try {
    const exchange = await send('https://github.com/login/oauth/access_token', {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId, client_secret: config.clientSecret,
        redirect_uri: config.origin + callbackPath, code, code_verifier: pending.verifier,
      }),
    });
    if (!exchange.ok) return fail('retry');
    const token = await exchange.json() as { access_token?: unknown; error?: unknown };
    if (token.error || typeof token.access_token !== 'string' || !token.access_token) return fail('retry');

    const profile = await send('https://api.github.com/user', {
      redirect: 'manual', signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token.access_token,
        'User-Agent': 'Gym-Hawk' },
    });
    if (!profile.ok) return fail('retry');
    const user = await profile.json() as { id?: unknown };
    if (typeof user.id !== 'number' || !Number.isSafeInteger(user.id)) return fail('retry');
    if (String(user.id) !== config.ownerId) return fail('account');

    const signed = await sign(config, sessionAudience, sessionAge, {});
    return redirect('/#settings', clearState, cookie(sessionCookie, signed, sessionAge));
  } catch {
    return fail('retry');
  }
}

export function clearGitHubSession() {
  const response = jsonResponse({ signedIn: false });
  response.headers.append('Set-Cookie', cookie(stateCookie, '', 0));
  response.headers.append('Set-Cookie', cookie(sessionCookie, '', 0));
  return response;
}
