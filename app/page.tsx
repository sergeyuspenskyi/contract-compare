'use client';
import { ArrowRight, Files, ShieldCheck, ScanText, GitCompareArrows, ListChecks, RotateCcw, AlertCircle } from 'lucide-react';
import ContractUpload from '@/components/ContractUpload';
import ComparisonSummary from '@/components/ComparisonSummary';
import ComparisonFilters from '@/components/ComparisonFilters';
import ClauseList from '@/components/ClauseList';
import ClauseDetails from '@/components/ClauseDetails';
import AnalysisProgress from '@/components/AnalysisProgress';
import { readComparisonStream } from '@/lib/readComparisonStream';
import type { Clause, ComparisonResult, Status } from '@/types/contract';
import { useEffect, useRef, useState } from 'react';
export default function Page() {
  const [company, setCompany] = useState<File | null>(null);
  const [client, setClient] = useState<File | null>(null);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('extracting');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Status | 'all'>('modified');
  const [selected, setSelected] = useState<Clause | null>(null);
  const abort = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { if (result) heading.current?.focus(); }, [result]);
  useEffect(() => {
    type Context = { registerTool: (tool: { name: string; description: string; inputSchema: object; annotations: object; execute: (input: unknown) => object }, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: Context }).modelContext;
    if (!context || !result) return;
    const lifecycle = new AbortController();
    try { void Promise.resolve(context.registerTool({ name: 'read_comparison_summary', description: 'Read the clause counts for the comparison currently visible. Contains no contract excerpts.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: input => { if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object.'); return { ...result.summary }; } }, { signal: lifecycle.signal })).catch(() => undefined); } catch { /* Optional browser API. */ }
    return () => lifecycle.abort();
  }, [result]);
  async function compare() {
    if (!company || !client || loading) return;
    setError(''); setLoading(true); setStage('extracting');
    const controller = new AbortController(); abort.current = controller;
    const timeout = setTimeout(() => controller.abort(new Error('timeout')), 285_000);
    try {
      const form = new FormData(); form.set('company', company); form.set('client', client);
      const response = await fetch('/api/compare', { method: 'POST', body: form, signal: controller.signal });
      const data = await readComparisonStream(response, setStage);
      if (!controller.signal.aborted) { setResult(data); setFilter('modified'); }
    } catch (e) {
      if (controller.signal.aborted) { if (controller.signal.reason?.message === 'timeout') setError('The comparison timed out. Please try again with shorter documents.'); }
      else setError(e instanceof TypeError ? 'The connection failed. Check your network and try again.' : e instanceof Error ? e.message : 'The comparison failed. Please try again.');
    } finally { clearTimeout(timeout); setLoading(false); abort.current = null; }
  }
  function reset() { setResult(null); setSelected(null); setCompany(null); setClient(null); setError(''); }
  return <><header className="site-header"><div className="brand"><span className="brand-icon"><Files size={22}/></span>Contract<span className="brand-light">Compare</span></div><span className="workspace-label">CONTRACT WORKSPACE</span><span className="header-note"><ShieldCheck size={15}/> Private by design</span></header><main>
    <div className="eyebrow">{result ? 'YOUR AGREEMENTS, SIDE BY SIDE' : 'A CLEARER VIEW OF EVERY AGREEMENT'}</div><div className="title-row"><h1 ref={heading} tabIndex={-1}>Contract Comparison</h1>{result && <button className="secondary new-comparison" onClick={reset}><RotateCcw size={14}/> New comparison</button>}</div><p className="subtitle">{result ? 'Review the meaning behind each change. Verify the wording before deciding.' : "Compare a client agreement against your company's standard contract."}</p>
    {!result && !loading && <><div className="workflow"><span className="current"><b>1</b> Upload contracts</span><i/><span><b>2</b> Analyze provisions</span><i/><span><b>3</b> Review differences</span></div><div className="upload-grid"><ContractUpload title="Company Template" description="Your standard terms. The baseline for comparison." number="01" file={company} onChange={setCompany}/><ContractUpload title="Client Contract" description="The agreement you would like to review." number="02" file={client} onChange={setClient}/></div>{error && <div className="error-banner" role="alert"><AlertCircle size={18}/>{error}</div>}<div className="compare-bar"><div><ShieldCheck size={20}/><p>Uploaded documents are processed for this request only.<br/><span>No contract history. No permanent file storage.</span></p></div><button className="primary" disabled={!company || !client} onClick={compare}>Compare Contracts <ArrowRight size={17}/></button></div><p className="processing-note">Extracted text is sent to OpenAI for analysis. Text-based PDFs only; scanned documents require OCR elsewhere.</p><section className="explanation"><div className="section-label">BEYOND A TEXT DIFF</div><h2>Different wording. Clear understanding.</h2><div className="feature-grid"><article><ScanText/><h3>Meaning over wording</h3><p>Compare legal and commercial positions, even when the language is different.</p></article><article><GitCompareArrows/><h3>Every change in context</h3><p>See what is aligned, modified, missing, or added across both agreements.</p></article><article><ListChecks/><h3>Made for human review</h3><p>Verify original excerpts and consider practical next steps for each clause.</p></article></div></section></>}
    {loading && <AnalysisProgress stage={stage} onCancel={() => abort.current?.abort()}/>}
    {result && <><div className="compared-files"><div><Files size={17}/><p><span>Company Template</span><strong>{company?.name}</strong></p></div><ArrowRight size={16}/><div><Files size={17}/><p><span>Client Contract</span><strong>{client?.name}</strong></p></div></div><ComparisonSummary summary={result.summary}/><div className="review-heading"><h2>Clause comparison</h2><span>{result.clauses.length} provisions identified</span></div><ComparisonFilters filter={filter} onChange={setFilter} summary={result.summary}/><ClauseList clauses={result.clauses.filter(c => filter === 'all' || c.status === filter)} onSelect={setSelected}/><p className="results-note">Confidence describes the certainty of matching and comparison. Review all findings against your original documents.</p></>}
    <footer><span>Contract Compare</span><p>AI-assisted comparison. Human judgment. Not legal advice.</p></footer></main>{selected && <ClauseDetails clause={selected} onClose={() => setSelected(null)}/>}</>;
}
