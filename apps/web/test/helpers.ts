import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { getDb, getPool, schema } from '../src/server/db/client';
import { seed } from '../src/server/db/seed';
import { hashPassword, newId } from '../src/server/security';

export const db = getDb();
/** Lunedì 9 novembre 2026, 06:00 ora locale (05:00 UTC). */
export const MORNING = Date.UTC(2026, 10, 9, 5, 0);
export const at = (hhmm: string, day = '2026-11-09') => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const [y, mo, d] = day.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, mo - 1, d, h - 1, m); // novembre: CET = UTC+1
};

export async function resetDb() {
  await getPool().query(`TRUNCATE ${['audit_log', 'alerts', 'devices', 'dose_events', 'doses', 'wake_events', 'routine_overrides', 'rule_overrides', 'rules', 'medications', 'patients', 'memberships', 'users', 'circles'].join(', ')} CASCADE`);
}

/** Crea famiglia, paziente e terapia reale; restituisce gli id. */
export async function seedWorld(now = MORNING) {
  await resetDb();
  process.env.ADMIN_EMAIL = 'giovanni@example.com';
  await seed(db, now);
  const [user] = await db.select().from(schema.users);
  const [patient] = await db.select().from(schema.patients);
  const [member] = await db.select().from(schema.memberships);
  return { user: user!, patient: patient!, member: member! };
}

export async function addCaregiver(circleId: string, name: string, position: number, chatId: string | null) {
  const id = newId();
  await db.insert(schema.users).values({ id, email: `${name.toLowerCase()}@example.com`, name, passwordHash: await hashPassword('x'.repeat(10)) });
  await db.insert(schema.memberships).values({ userId: id, circleId, role: 'caregiver', chainPosition: position, telegramChatId: chatId });
  return id;
}

export async function doseAt(patientId: string, hhmm: string, medName?: string, day = '2026-11-09') {
  const rows = await db.select().from(schema.doses).where(eq(schema.doses.patientId, patientId));
  const meds = await db.select().from(schema.medications).where(eq(schema.medications.patientId, patientId));
  const name = new Map(meds.map((m) => [m.id, m.name]));
  const hit = rows.find((d) => d.day === day && d.localTime === hhmm && (!medName || name.get(d.medicationId) === medName));
  if (!hit) throw new Error(`Nessuna dose ${hhmm} ${medName ?? ''} il ${day}`);
  return hit;
}

export { sql, schema };
