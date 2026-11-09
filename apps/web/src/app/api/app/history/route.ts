import { json, withCaller } from '@/server/api';
import { buildHistory } from '@/server/caregiverState';
import { getDb } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export const GET = withCaller(async (caller) => json(await buildHistory(getDb(), caller.patientId)));
