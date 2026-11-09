import { subscribe } from './hub';

/** Risposta SSE per un paziente: un messaggio ad ogni cambiamento, più un battito ogni 20 secondi. */
export async function sseResponse(req: Request, patientId: string): Promise<Response> {
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      send('hello', { t: Date.now() });
      const unsub = await subscribe(patientId, (m) => send('change', m));
      const beat = setInterval(() => send('ping', { t: Date.now() }), 20_000);
      cleanup = () => {
        clearInterval(beat);
        unsub();
        try {
          controller.close();
        } catch {
          /* già chiuso */
        }
      };
      req.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
