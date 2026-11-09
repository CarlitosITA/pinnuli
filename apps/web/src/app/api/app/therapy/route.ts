import { json, withCaller } from '@/server/api';
import { buildTherapyView } from '@/server/caregiverState';
import { getDb } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export const GET = withCaller(async (caller) => json(await buildTherapyView(getDb(), caller.patientId)));
