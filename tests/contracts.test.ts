import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { extractDocument } from '../lib/documents/extractDocument';
import { fileProblem, MAX_FILE_BYTES } from '../lib/limits';
import { validateComparison } from '../lib/contracts/comparisonSchema';
import { compareContracts } from '../lib/contracts/compareContracts';
import { readComparisonStream } from '../lib/readComparisonStream';
import { POST } from '../app/api/compare/route';
import { companyText, clientText, fixture, docx, pdf, upload } from './fixtures';

test('DOCX preserves paragraphs and PDF returns readable source text', async () => {
  assert.equal(await extractDocument(upload(docx('Payment Terms\n' + companyText))), 'Payment Terms\n\n' + companyText);
  assert.match(await extractDocument(upload(pdf(companyText), 'contract.pdf')), /fifteen calendar days/);
});
test('rejects empty, corrupt, nontext PDF, mismatched MIME and oversized documents', async () => {
  assert.match(fileProblem({ name: 'x.exe', size: 1, type: '' })!, /Unsupported/);
  assert.match(fileProblem({ name: 'x.pdf', size: 0, type: '' })!, /empty/);
  assert.match(fileProblem({ name: 'x.pdf', size: 1, type: 'image/png' })!, /type/);
  assert.match(fileProblem({ name: 'x.pdf', size: MAX_FILE_BYTES + 1, type: '' })!, /too large/);
  await assert.rejects(extractDocument(upload(Buffer.from('not docx'))), /corrupted/);
  await assert.rejects(extractDocument(upload(docx(''))), /no readable text/);
  await assert.rejects(extractDocument(upload(pdf(), 'scan.pdf')), /OCR is not supported/);
  await assert.rejects(extractDocument(upload(docx('a'.repeat(100_001)))), /100,000/);
});
test('evidence validation rejects fabricated excerpts and duplicates; derives totals', () => {
  const value = structuredClone(fixture); value.summary.modified = 99;
  assert.equal(validateComparison(value, companyText, clientText).summary.modified, 1);
  value.clauses[0].companySourceText = 'Payment is due in 2 days.';
  assert.throws(() => validateComparison(value, companyText, clientText), /unverifiable/);
  const duplicate = structuredClone(fixture); duplicate.clauses.push(duplicate.clauses[0]);
  assert.throws(() => validateComparison(duplicate, companyText, clientText), /Invalid clause/);
});
test('missing and added clauses require evidence on the correct side only', () => {
  for (const status of ['missing', 'added'] as const) {
    const value = structuredClone(fixture); const c = value.clauses[0]; c.status = status;
    if (status === 'missing') { c.clientSourceText = null; c.clientPosition = null; }
    else { c.companySourceText = null; c.companyPosition = null; }
    assert.equal(validateComparison(value, companyText, clientText).summary[status], 1);
  }
});
test('stream decoder handles split chunks and interrupted responses', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ type: 'stage', stage: 'identifying' }) + '\n' + JSON.stringify({ type: 'result', result: fixture }) + '\n');
  const stream = new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 24)); c.enqueue(bytes.slice(24)); c.close(); } });
  const stages: string[] = [];
  assert.deepEqual(await readComparisonStream(new Response(stream), s => stages.push(s)), fixture);
  assert.deepEqual(stages, ['identifying']);
  await assert.rejects(readComparisonStream(new Response(''), () => {}), /connection ended/);
});
test('server rejects foreign origins, missing files, and oversized declared requests', async () => {
  assert.equal((await POST(new Request('http://localhost/api/compare', { method: 'POST', headers: { origin: 'https://foreign.test' } }))).status, 403);
  assert.equal((await POST(new Request('http://localhost/api/compare', { method: 'POST', body: new FormData() }))).status, 400);
  assert.equal((await POST(new Request('http://localhost/api/compare', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': '99999999' }, body: 'x' }))).status, 413);
});
test('full upload → extraction → OpenAI protocol mock → verified streamed result; malformed retry and safe errors', async () => {
  let calls = 0; let mode = 'valid'; let captured: Record<string, unknown> = {};
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    captured = JSON.parse(body); calls++;
    res.setHeader('content-type', 'application/json');
    if (mode === 'api-error') { res.statusCode = 429; res.end(JSON.stringify({ error: { message: 'secret provider error' } })); return; }
    const value = structuredClone(fixture);
    if (mode === 'invalid' || (mode === 'retry' && calls === 1)) value.clauses[0].companySourceText = 'Invented quotation';
    res.end(JSON.stringify({ id: 'resp_test', object: 'response', status: 'completed', output: [{ type: 'message', id: 'msg_test', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] }] }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const previousKey = process.env.OPENAI_API_KEY; const previousUrl = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_API_KEY = 'test-only'; process.env.OPENAI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  try {
    const form = new FormData(); form.set('company', upload(docx(companyText))); form.set('client', upload(pdf(clientText), 'client.pdf'));
    const response = await POST(new Request('http://localhost/api/compare', { method: 'POST', body: form }));
    assert.deepEqual(await readComparisonStream(response, () => {}), fixture);
    assert.equal(captured.store, false);
    assert.match(JSON.stringify(captured.input), /fifteen calendar days/);
    mode = 'retry'; calls = 0;
    assert.deepEqual(await compareContracts(companyText, clientText), fixture); assert.equal(calls, 2);
    mode = 'invalid'; calls = 0;
    await assert.rejects(compareContracts(companyText, clientText), /could not be verified/); assert.equal(calls, 2);
    mode = 'api-error'; await assert.rejects(compareContracts(companyText, clientText), /quota/);
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(compareContracts(companyText, clientText), /not configured/);
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = previousUrl;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
