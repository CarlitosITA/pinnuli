import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from './env';
import { getDb, schema } from './db/client';
import { sha256, signSession, verifySession } from './security';

export const SESSION_COOKIE = 'pn_session';
export const DEVICE_COOKIE = 'pn_device';
const SESSION_DAYS = 30;

export interface Caller {
  user: typeof schema.users.$inferSelect;
  circleId: string;
  role: string;
  patientId: string;
}

export function sessionCookieOptions(maxAgeSec = SESSION_DAYS * 86400) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: env.secure, path: '/', maxAge: maxAgeSec };
}

export function newSessionValue(userId: string, now = Date.now()) {
  return signSession({ uid: userId, exp: now + SESSION_DAYS * 86400_000 });
}

/** Il familiare collegato, con il suo cerchio e il primo paziente (MVP: un paziente per cerchio). */
export async function getCaller(): Promise<Caller | null> {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return loadCaller(session.uid);
}

export async function loadCaller(userId: string): Promise<Caller | null> {
  const db = getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) return null;
  const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, userId));
  if (!m) return null;
  const [patient] = await db.select({ id: schema.patients.id }).from(schema.patients).where(eq(schema.patients.circleId, m.circleId));
  if (!patient) return null;
  return { user, circleId: m.circleId, role: m.role, patientId: patient.id };
}

export async function requireCaller(): Promise<Caller> {
  const c = await getCaller();
  if (!c) redirect('/login');
  return c;
}

/** Per i route handler: restituisce il chiamante oppure null (si risponde 401). */
export async function apiCaller(): Promise<Caller | null> {
  return getCaller();
}

export interface DeviceCaller {
  device: typeof schema.devices.$inferSelect;
  patientId: string;
}

/** Autenticazione dei dispositivi: token in cookie HttpOnly oppure `Authorization: Bearer`. */
export async function deviceFromRequest(req: Request, touch = true, now = Date.now()): Promise<DeviceCaller | null> {
  const header = req.headers.get('authorization');
  let token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    const raw = req.headers.get('cookie') ?? '';
    const m = raw.split(/;\s*/).find((c) => c.startsWith(`${DEVICE_COOKIE}=`));
    token = m ? decodeURIComponent(m.slice(DEVICE_COOKIE.length + 1)) : undefined;
  }
  if (!token) return null;
  const db = getDb();
  const [device] = await db
    .select()
    .from(schema.devices)
    .where(and(eq(schema.devices.tokenHash, sha256(token)), eq(schema.devices.status, 'active')));
  if (!device || !device.patientId) return null;
  if (touch) await db.update(schema.devices).set({ lastSeenMs: now }).where(eq(schema.devices.id, device.id));
  return { device, patientId: device.patientId };
}

export function deviceCookie(token: string) {
  return `${DEVICE_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365 * 5}${env.secure ? '; Secure' : ''}`;
}
