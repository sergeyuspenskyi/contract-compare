import { extractDocument } from '@/lib/documents/extractDocument';
import { compareContracts } from '@/lib/contracts/compareContracts';
import { AppError, publicError } from '@/lib/errors';
import { readForm } from '@/lib/request';
import { fileProblem } from '@/lib/limits';
import type { ComparisonEvent } from '@/types/contract';
export const runtime = 'nodejs';
export const maxDuration = 300;
let active = 0;
export async function POST(request: Request) {
  let acquired = false;
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new AppError('This request is not allowed.', 403);
    if (active >= 2) throw new AppError('The server is processing other comparisons. Please try again shortly.', 429);
    active++; acquired = true;
    const form = await readForm(request);
    const company = form.get('company'); const client = form.get('client');
    if (!(company instanceof File) || !(client instanceof File)) throw new AppError('Please upload both a company template and a client contract.');
    if (form.getAll('company').length !== 1 || form.getAll('client').length !== 1) throw new AppError('Please upload exactly one document per side.');
    for (const file of [company, client]) { const error = fileProblem(file); if (error) throw new AppError(error); }
    const encoder = new TextEncoder();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 270_000);
    const signal = AbortSignal.any([request.signal, controller.signal]);
    const stream = new ReadableStream({
      async start(output) {
        const send = (event: ComparisonEvent) => { if (!signal.aborted) output.enqueue(encoder.encode(JSON.stringify(event) + '\n')); };
        try {
          send({ type: 'stage', stage: 'extracting' });
          const companyText = await extractDocument(company);
          const clientText = await extractDocument(client);
          signal.throwIfAborted();
          send({ type: 'stage', stage: 'identifying' });
          const result = await compareContracts(companyText, clientText, signal);
          send({ type: 'stage', stage: 'preparing' });
          send({ type: 'result', result });
        } catch (error) {
          if (!signal.aborted) send({ type: 'error', error: publicError(error).error });
        } finally {
          clearTimeout(timeout); active--;
          try { output.close(); } catch { /* The browser may already have cancelled. */ }
        }
      },
      cancel() { controller.abort(); },
    });
    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
  } catch (error) {
    if (acquired) active--;
    const safe = publicError(error);
    return Response.json({ error: safe.error }, { status: safe.status, headers: { 'Cache-Control': 'no-store' } });
  }
}
