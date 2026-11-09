import { eq } from 'drizzle-orm';
import {
  DEFAULT_SETTINGS,
  SEED_MEDICATIONS,
  SEED_ROUTINE,
  SEED_RULES,
  addDays,
  patientDay,
} from '@pinnuli/core';
import { audit } from '../audit';
import { hashPassword, newId } from '../security';
import { syncDoses } from '../therapy';
import { getDb, getPool, schema, type Db } from './client';

/**
 * Terapia attuale della prima paziente (docs/02 § 2.9) come dati di partenza modificabili dal familiare.
 * Orari dei pasti e quantità sono ipotesi da confermare.
 */
export async function seedTherapy(db: Db, patientId: string, startDay: string) {
  const ids = new Map<string, string>();
  for (const m of SEED_MEDICATIONS) {
    const { slug, ...rest } = m;
    const id = newId();
    ids.set(slug, id);
    await db.insert(schema.medications).values({
      id,
      patientId,
      name: rest.name,
      distinguishing: rest.distinguishing ?? null,
      form: rest.form,
      strength: rest.strength ?? null,
      color: rest.color,
      critical: rest.critical,
      ifForgotten: rest.ifForgotten,
      status: rest.status,
      instructions: rest.instructions,
    });
  }
  for (const r of SEED_RULES) {
    await db.insert(schema.rules).values({
      id: newId(),
      patientId,
      medicationId: ids.get(r.med)!,
      quantity: r.quantity,
      timing: r.timing,
      days: { kind: 'daily' },
      startDate: startDay,
      endDate: r.durationDays ? addDays(startDay, r.durationDays - 1) : null,
      note: r.note ?? null,
      active: true,
    });
  }
}

export async function seed(db: Db = getDb(), now = Date.now()) {
  const email = (process.env.ADMIN_EMAIL ?? 'giovanni@example.com').toLowerCase();
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing) {
    console.log(`Il familiare ${email} esiste già: nessuna modifica.`);
    return;
  }
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) throw new Error('Imposta ADMIN_PASSWORD (almeno 8 caratteri)');

  const circleId = newId();
  const userId = newId();
  const patientId = newId();
  const name = process.env.PATIENT_NAME ?? 'Mamma';

  await db.insert(schema.circles).values({ id: circleId, name: 'Famiglia' });
  await db.insert(schema.users).values({
    id: userId,
    email,
    name: process.env.ADMIN_NAME ?? 'Giovanni',
    passwordHash: await hashPassword(password),
  });
  await db.insert(schema.memberships).values({ userId, circleId, role: 'admin', chainPosition: 0 });
  await db.insert(schema.patients).values({
    id: patientId,
    circleId,
    name,
    tz: 'Europe/Rome',
    routine: SEED_ROUTINE,
    settings: DEFAULT_SETTINGS,
  });
  const today = patientDay(now, 'Europe/Rome');
  // SEED_THERAPY=0 crea solo utente e paziente, senza la terapia di esempio (usato dai test end-to-end).
  if (process.env.SEED_THERAPY !== '0') await seedTherapy(db, patientId, today);
  await syncDoses(db, patientId, now);
  await audit(db, { patientId, actor: 'system', action: 'seed', entity: 'patient', entityId: patientId });
  console.log(`Creati: familiare ${email}, paziente "${name}", ${process.env.SEED_THERAPY === '0' ? "nessuna terapia" : "terapia di partenza"}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => getPool().end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
