import { createHash, randomBytes } from 'node:crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = 'se7en_session';
export const SESSION_COOKIE_MAX_AGE_MS = SESSION_TTL_MS;

interface AuthSession {
  userId: number;
  expiresAt: number;
}

// The current backend is a single-process JSON-backed prototype. Keep only
// hashes in memory so a database read or log cannot reveal bearer credentials.
const sessions = new Map<string, AuthSession>();

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createAuthSession(userId: number): string {
  const now = Date.now();
  for (const [hash, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(hash);
  }

  const token = randomBytes(32).toString('base64url');
  sessions.set(hashToken(token), { userId, expiresAt: now + SESSION_TTL_MS });
  return token;
}

export function getAuthSession(token: string): number | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = hashToken(token);
  const session = sessions.get(hash);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(hash);
    return null;
  }
  return session.userId;
}

export function readSessionCookie(cookieHeader = ''): string | null {
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function revokeAuthSession(token: string): void {
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) sessions.delete(hashToken(token));
}

export function revokeUserSessions(userId: number): void {
  for (const [hash, session] of sessions) {
    if (session.userId === userId) sessions.delete(hash);
  }
}
