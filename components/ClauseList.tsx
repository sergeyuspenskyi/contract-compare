import type { Clause } from '@/types/contract';
import { ArrowUpRight, SearchCheck } from 'lucide-react';
export default function ClauseList({ clauses, onSelect }: { clauses: Clause[]; onSelect: (c: Clause) => void }) {
  if (!clauses.length) return <div className="empty-state"><SearchCheck size={30}/><h3>No clauses in this view</h3><p>Choose another status to explore the comparison.</p></div>;
  return <div className="clause-list">{clauses.map((c, i) => <article className="clause-row" key={c.id}><span className="row-number">{String(i + 1).padStart(2, '0')}</span><div className="clause-content"><div className="clause-title"><h3>{c.name}</h3><span className={`badge ${c.status}`}>{c.status}</span></div><p>{c.difference}</p><span className="confidence">Matching confidence: <span className="capitalize">{c.confidence}</span></span></div><button className="details-button" onClick={() => onSelect(c)} aria-label={`View details for ${c.name}`}>View details <ArrowUpRight size={14}/></button></article>)}</div>;
}
