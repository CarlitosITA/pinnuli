import { withCaller } from '@/server/api';
import { sseResponse } from '@/server/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withCaller(async (caller, req: Request) => sseResponse(req, caller.patientId));
