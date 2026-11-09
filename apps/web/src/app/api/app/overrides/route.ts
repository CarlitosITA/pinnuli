import { actorOf, json, parse, withCaller } from '@/server/api';
import { createOverride, overrideInput } from '@/server/commands';
import { getDb } from '@/server/db/client';

export const POST = withCaller(async (caller, req: Request) => {
  const id = await createOverride(getDb(), caller.patientId, actorOf(caller), await parse(req, overrideInput));
  return json({ id }, { status: 201 });
});
