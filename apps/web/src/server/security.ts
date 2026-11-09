import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { env } from './env';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [kind, saltB64, keyB64] = stored.split('$');
  if (kind !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const newId = () => crypto.randomUUID();

/** Codice di collegamento a 6 cifre, senza zeri iniziali. */
export function newPairingCode(): string {
  return String(randomInt(100000, 1000000));
}

function sign(data: string): string {
  return createHmac('sha256', env.sessionSecret).update(data).digest('base64url');
}

export function signSession(payload: { uid: string; exp: number }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifySession(value: string | undefined | null, now = Date.now()): { uid: string } | null {
  if (!value) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as { uid: string; exp: number };
    return p.exp > now ? { uid: p.uid } : null;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
