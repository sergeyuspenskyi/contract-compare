import type { ComparisonResult } from '@/types/contract';
import { Check, GitCompareArrows, Minus, Plus } from 'lucide-react';
export default function ComparisonSummary({ summary }: Pick<ComparisonResult, 'summary'>) {
  const items = [{ key: 'aligned', label: 'Aligned', text: 'Substantially equivalent', icon: Check }, { key: 'modified', label: 'Modified', text: 'Contractual position changed', icon: GitCompareArrows }, { key: 'missing', label: 'Missing', text: 'Not found in client contract', icon: Minus }, { key: 'added', label: 'Added', text: 'New in client contract', icon: Plus }] as const;
  return <div className="summary-grid">{items.map(({ key, label, text, icon: Icon }) => <div className="summary-card" key={key}><div><span className={`status-dot ${key}`}><Icon size={16}/></span><span>{label}</span></div><strong>{summary[key]}</strong><p>{text}</p></div>)}</div>;
}
