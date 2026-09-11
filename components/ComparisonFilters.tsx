import type { ComparisonResult, Status } from '@/types/contract';
export default function ComparisonFilters({ filter, onChange, summary }: { filter: Status | 'all'; onChange: (s: Status | 'all') => void; summary: ComparisonResult['summary'] }) {
  const filters = ['all', 'modified', 'missing', 'added', 'aligned'] as const;
  return <div className="filters" role="group" aria-label="Filter clauses by status">{filters.map(s => <button aria-pressed={filter === s} className={filter === s ? 'selected' : ''} key={s} onClick={() => onChange(s)}><span className="capitalize">{s}</span><span className="filter-count">{s === 'all' ? Object.values(summary).reduce((a, b) => a + b, 0) : summary[s]}</span></button>)}</div>;
}
