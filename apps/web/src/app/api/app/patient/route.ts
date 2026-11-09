import { actorOf, json, parse, withCaller } from '@/server/api';
import { patientPatch, updatePatient } from '@/server/commands';
import { getDb } from '@/server/db/client';

export const PATCH = withCaller(async (caller, req: Request) => {
  await updatePatient(getDb(), caller.patientId, actorOf(caller), await parse(req, patientPatch));
  return json({ ok: true });
});
