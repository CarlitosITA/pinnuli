import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/server/auth';
import { json } from '@/server/api';

export const POST = async () => {
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
};
