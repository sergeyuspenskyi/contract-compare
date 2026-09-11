import { z } from 'zod';
export const statuses = ['aligned', 'modified', 'missing', 'added'] as const;
export const clauseSchema = z.object({
  id: z.string(), name: z.string(), status: z.enum(statuses),
  companySection: z.string().nullable(), clientSection: z.string().nullable(),
  companyPosition: z.string().nullable(), clientPosition: z.string().nullable(),
  companySourceText: z.string().nullable(), clientSourceText: z.string().nullable(),
  difference: z.string(), suggestedAction: z.string().nullable(), confidence: z.enum(['high', 'medium', 'low']),
}).strict();
export const comparisonSchema = z.object({ summary: z.object({ aligned: z.number().int().nonnegative(), modified: z.number().int().nonnegative(), missing: z.number().int().nonnegative(), added: z.number().int().nonnegative() }).strict(), clauses: z.array(clauseSchema) }).strict();
export type ComparisonResult = z.infer<typeof comparisonSchema>;
export type Clause = z.infer<typeof clauseSchema>;
export type Status = Clause['status'];
export function validateComparison(data: unknown, company: string, client: string): ComparisonResult {
  const result = comparisonSchema.parse(data);
  if (!result.clauses.length || result.clauses.length > 150) throw new Error('Invalid clause count');
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
  const texts = [normalize(company), normalize(client)];
  const ids = new Set<string>();
  const counts = { aligned: 0, modified: 0, missing: 0, added: 0 };
  for (const c of result.clauses) {
    if (!c.id.trim() || ids.has(c.id) || !c.name.trim() || !c.difference.trim()) throw new Error('Invalid clause');
    ids.add(c.id);
    const present = [c.status !== 'added', c.status !== 'missing'];
    const sources = [c.companySourceText, c.clientSourceText];
    const positions = [c.companyPosition, c.clientPosition];
    const sections = [c.companySection, c.clientSection];
    for (let i = 0; i < 2; i++) {
      if (present[i]) {
        if (!sources[i]?.trim() || !positions[i]?.trim() || !texts[i].includes(normalize(sources[i]!))) throw new Error('Source evidence is missing or unverifiable');
      } else if (sources[i] !== null || positions[i] !== null || sections[i] !== null) throw new Error('Absent side must be null');
    }
    counts[c.status]++;
  }
  // Counts are derived from validated rows, never trusted from model arithmetic.
  return { ...result, summary: counts };
}
