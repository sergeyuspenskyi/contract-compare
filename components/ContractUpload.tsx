'use client';
import { useRef, useState } from 'react';
import { FileText, Upload, Check, X } from 'lucide-react';
import { fileProblem } from '@/lib/limits';
export default function ContractUpload({ title, description, number, file, onChange }: { title: string; description: string; number: string; file: File | null; onChange: (file: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  function select(files: FileList | null) { if (!files?.length) return; if (files.length > 1) { setError('Please select one document at a time.'); return; } const problem = fileProblem(files[0]); setError(problem || ''); if (!problem) onChange(files[0]); }
  return <section className="upload-card"><div className="card-heading"><span className="step-number">{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>
    <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label={title} accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => { select(e.target.files); e.target.value = ''; }} />
    <div className={`drop-zone ${drag ? 'dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); select(e.dataTransfer.files); }}>
      <span className="document-icon">{file ? <FileText size={28}/> : <Upload size={25}/>}</span>
      {file ? <><h3 className="filename">{file.name}</h3><p>{(file.size / 1024).toFixed(0)} KB <span className="ready"><Check size={12}/> Ready to compare</span></p><div className="file-actions"><button className="secondary" onClick={() => input.current?.click()}>Replace file</button><button className="text-button" aria-label={`Remove ${title}`} onClick={() => { onChange(null); setError(''); }}><X size={15}/> Remove</button></div></> : <><h3>Drag and drop your document</h3><p>or select a file from your computer</p><button className="secondary" onClick={() => input.current?.click()}>Choose file</button><span className="file-limit">PDF or DOCX · Up to 10 MB</span></>}
    </div>{error && <p className="error" role="alert">{error}</p>}
  </section>;
}
