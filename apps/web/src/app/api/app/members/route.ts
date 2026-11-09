import { json, withCaller } from '@/server/api';
import { getDb } from '@/server/db/client';
import { listMembers } from '@/server/members';

export const dynamic = 'force-dynamic';

export const GET = withCaller(async (caller) => json({ ...(await listMembers(getDb(), caller.circleId, caller.user.id)), admin: caller.role === 'admin' }));
