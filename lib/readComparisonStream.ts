import { comparisonSchema } from './contracts/comparisonSchema';
import type { ComparisonResult } from '@/types/contract';
export async function readComparisonStream(response: Response, onStage: (s: string) => void): Promise<ComparisonResult> {
  if (!response.ok) {
    let error = response.status === 413 ? 'Upload too large for this server. Please use smaller documents.' : 'The server could not process the request. Please try again.';
    try { const data = await response.json(); if (typeof data.error === 'string') error = data.error; } catch { /* A hosting proxy may return HTML. */ }
    throw new Error(error);
  }
  if (!response.body) throw new Error('The server returned an empty response. Please try again.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split('\n'); pending = lines.pop() || '';
      if (done && pending.trim()) { lines.push(pending); pending = ''; }
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === 'error') throw new Error(typeof event.error === 'string' ? event.error : 'Comparison failed. Please try again.');
        if (event.type === 'stage' && ['extracting', 'identifying', 'preparing'].includes(event.stage)) onStage(event.stage);
        if (event.type === 'result') return comparisonSchema.parse(event.result);
      }
      if (done) break;
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  throw new Error('The connection ended before the comparison completed. Please try again.');
}
