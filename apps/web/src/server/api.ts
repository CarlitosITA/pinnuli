import { ZodError, type ZodTypeAny, type z } from 'zod';
import { apiCaller, type Caller } from './auth';
import { CommandError } from './commands';

export const noStore = { 'Cache-Control': 'no-store' };

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { ...noStore, ...(init.headers ?? {}) } });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, { status });
}

/** Messaggio leggibile dal primo errore di validazione, in italiano semplice. */
function firstIssue(e: ZodError): string {
  const i = e.issues[0];
  if (!i) return 'Dati non validi';
  return i.message && i.message !== 'Required' ? i.message : `Campo mancante o non valido: ${i.path.join('.')}`;
}

export async function parse<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new CommandError('Richiesta non valida', 400);
  }
  const res = schema.safeParse(raw);
  if (!res.success) throw new CommandError(firstIssue(res.error), 400);
  return res.data;
}

type Handler<A extends unknown[]> = (...args: A) => Promise<Response>;

/** Trasforma errori di comando e di validazione in risposte JSON; gli altri errori diventano 500 senza dettagli. */
export function safe<A extends unknown[]>(fn: Handler<A>): Handler<A> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof CommandError) return fail(e.message, e.status);
      if (e instanceof ZodError) return fail(firstIssue(e), 400);
      console.error('[api]', e);
      return fail('Qualcosa non ha funzionato. Riprova.', 500);
    }
  };
}

/** Handler per i familiari: 401 se non c'è una sessione valida. */
export function withCaller<A extends unknown[]>(fn: (caller: Caller, ...args: A) => Promise<Response>): Handler<A> {
  return safe(async (...args: A) => {
    const caller = await apiCaller();
    if (!caller) return fail('Accedi per continuare', 401);
    return fn(caller, ...args);
  });
}

export const actorOf = (c: Caller) => `user:${c.user.id}`;
