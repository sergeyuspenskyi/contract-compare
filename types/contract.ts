export type { ComparisonResult, Clause, Status } from '@/lib/contracts/comparisonSchema';
export type ComparisonEvent = { type: 'stage'; stage: 'extracting' | 'identifying' | 'preparing' } | { type: 'result'; result: import('./contract').ComparisonResult } | { type: 'error'; error: string };
