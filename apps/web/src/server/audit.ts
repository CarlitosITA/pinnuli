import { newId } from './security';
import { schema, type Db } from './db/client';

/** Registro di tutte le modifiche (docs/07): chi, cosa, quando, prima e dopo. Non si modifica mai. */
export async function audit(
  db: Db,
  entry: {
    patientId?: string | null;
    actor: string;
    action: string;
    entity: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
  },
  now = Date.now(),
) {
  await db.insert(schema.auditLog).values({
    id: newId(),
    atMs: now,
    patientId: entry.patientId ?? null,
    actor: entry.actor,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
