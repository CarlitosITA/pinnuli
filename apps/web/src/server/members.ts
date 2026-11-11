import { and, asc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { asGender, type Gender } from '@pinnuli/core';
import { env } from './env';
import { CommandError } from './commands';
import { getDb, schema, type Db } from './db/client';
import { hashPassword, newId, newToken, sha256 } from './security';

const { invites, memberships, users, circles } = schema;

export const INVITE_DAYS = 7;
export const MIN_PASSWORD = 8;

export interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  gender: Gender;
  telegram: boolean;
  me: boolean;
}
export interface InviteRow {
  id: string;
  label: string;
  expiresAtMs: number;
}

export async function listMembers(db: Db, circleId: string, meUserId: string, now = Date.now()) {
  const rows = await db
    .select({ userId: users.id, name: users.name, email: users.email, role: memberships.role, gender: users.gender, tg: memberships.telegramChatId })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.circleId, circleId))
    .orderBy(asc(memberships.chainPosition));
  const pending = await db
    .select({ id: invites.id, label: invites.label, expiresAtMs: invites.expiresAtMs })
    .from(invites)
    .where(and(eq(invites.circleId, circleId), isNull(invites.usedAtMs), gt(invites.expiresAtMs, now)))
    .orderBy(asc(invites.createdAtMs));
  return {
    members: rows.map((r): MemberRow => ({ userId: r.userId, name: r.name, email: r.email, role: r.role, gender: asGender(r.gender), telegram: !!r.tg, me: r.userId === meUserId })),
    invites: pending as InviteRow[],
  };
}

function requireAdmin(role: string) {
  if (role !== 'admin') throw new CommandError('Solo chi ha creato il gruppo può gestire i familiari', 403);
}

/** Crea un invito e restituisce il link: compare una sola volta, poi se ne può solo creare un altro. */
export async function createInvite(db: Db, caller: { circleId: string; role: string; userId: string }, label: string, gender: Gender = 'x', now = Date.now()) {
  requireAdmin(caller.role);
  const token = newToken();
  const expiresAtMs = now + INVITE_DAYS * 86400_000;
  await db.insert(invites).values({
    id: newId(),
    circleId: caller.circleId,
    tokenHash: sha256(token),
    label,
    gender,
    createdBy: caller.userId,
    createdAtMs: now,
    expiresAtMs,
  });
  return { url: `${env.appUrl}/invito/${token}`, expiresAtMs };
}

export async function cancelInvite(db: Db, caller: { circleId: string; role: string }, id: string) {
  requireAdmin(caller.role);
  await db.delete(invites).where(and(eq(invites.id, id), eq(invites.circleId, caller.circleId)));
}

/** Chi sta per accettare: serve alla pagina dell'invito per salutare e per dire se il link è scaduto. */
export async function inviteInfo(db: Db, token: string, now = Date.now()) {
  const [inv] = await db.select().from(invites).where(eq(invites.tokenHash, sha256(token)));
  if (!inv || inv.usedAtMs || inv.expiresAtMs <= now) return null;
  const [circle] = await db.select({ name: circles.name }).from(circles).where(eq(circles.id, inv.circleId));
  const [patient] = await db.select({ name: schema.patients.name }).from(schema.patients).where(eq(schema.patients.circleId, inv.circleId));
  const [inviter] = await db.select({ name: users.name }).from(users).where(eq(users.id, inv.createdBy));
  return { label: inv.label, gender: asGender(inv.gender), patient: patient?.name ?? circle?.name ?? '', inviter: inviter?.name ?? '' };
}

/** Il nuovo familiare sceglie nome, email e password: la password non passa mai da chi invita. */
export async function acceptInvite(db: Db, token: string, input: { name: string; email: string; password: string; gender?: Gender }, now = Date.now()) {
  if (input.password.length < MIN_PASSWORD) throw new CommandError(`La password deve avere almeno ${MIN_PASSWORD} caratteri`, 400);
  return db.transaction(async (tx) => {
    // Il blocco della riga evita che due persone usino lo stesso link insieme.
    const [inv] = await tx.select().from(invites).where(eq(invites.tokenHash, sha256(token))).for('update');
    if (!inv || inv.usedAtMs || inv.expiresAtMs <= now) throw new CommandError('Questo invito non è più valido. Chiedi un nuovo link.', 410);
    const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (taken) throw new CommandError('Esiste già un account con questa email. Accedi con quello.', 409);
    const userId = newId();
    const [last] = await tx
      .select({ pos: sql<number>`coalesce(max(${memberships.chainPosition}), -1)` })
      .from(memberships)
      .where(eq(memberships.circleId, inv.circleId));
    await tx.insert(users).values({ id: userId, email: input.email, name: input.name, gender: input.gender ?? asGender(inv.gender), passwordHash: await hashPassword(input.password) });
    await tx.insert(memberships).values({ userId, circleId: inv.circleId, role: 'caregiver', chainPosition: Number(last?.pos ?? -1) + 1 });
    await tx.update(invites).set({ usedAtMs: now }).where(eq(invites.id, inv.id));
    return { userId };
  });
}

/** Ognuno può cambiare il proprio genere; l'amministratore anche quello degli altri. */
export async function setMemberGender(db: Db, caller: { circleId: string; role: string; userId: string }, userId: string, gender: Gender) {
  if (userId !== caller.userId) requireAdmin(caller.role);
  const [m] = await db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.circleId, caller.circleId), eq(memberships.userId, userId)));
  if (!m) throw new CommandError('Familiare non trovato', 404);
  await db.update(users).set({ gender }).where(eq(users.id, userId));
}

/** Toglie un familiare dal gruppo (non sé stessi, e mai l'ultimo amministratore). */
export async function removeMember(db: Db, caller: { circleId: string; role: string; userId: string }, userId: string) {
  requireAdmin(caller.role);
  if (userId === caller.userId) throw new CommandError('Non puoi togliere te stesso', 400);
  const gone = await db
    .delete(memberships)
    .where(and(eq(memberships.circleId, caller.circleId), eq(memberships.userId, userId), ne(memberships.role, 'admin')))
    .returning({ userId: memberships.userId });
  if (!gone.length) throw new CommandError('Familiare non trovato', 404);
  await db.delete(users).where(eq(users.id, userId));
}

export { getDb };
