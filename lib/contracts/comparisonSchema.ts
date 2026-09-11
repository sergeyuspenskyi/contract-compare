import { z } from 'zod';

export const statuses = [
  'aligned',
  'modified',
  'missing',
  'added',
] as const;

const confidenceLevels = [
  'high',
  'medium',
  'low',
] as const;

export const clauseSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  status: z.enum(statuses),

  companySection: z.string().nullable().optional(),
  clientSection: z.string().nullable().optional(),

  companyPosition: z.string().nullable().optional(),
  clientPosition: z.string().nullable().optional(),

  companySourceText: z.string().nullable().optional(),
  clientSourceText: z.string().nullable().optional(),

  difference: z.string(),

  suggestedAction: z.string().nullable().optional(),

  confidence: z.enum(confidenceLevels).default('medium'),
});

export const comparisonSchema = z.object({
  summary: z.object({
    aligned: z.number().int().nonnegative(),
    modified: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    added: z.number().int().nonnegative(),
  }),

  clauses: z.array(clauseSchema),
});

export type ComparisonResult = {
  summary: {
    aligned: number;
    modified: number;
    missing: number;
    added: number;
  };
  clauses: Clause[];
};

export type Clause = {
  id: string;
  name: string;
  status: typeof statuses[number];

  companySection: string | null;
  clientSection: string | null;

  companyPosition: string | null;
  clientPosition: string | null;

  companySourceText: string | null;
  clientSourceText: string | null;

  difference: string;
  suggestedAction: string | null;

  confidence: typeof confidenceLevels[number];
};

export type Status = Clause['status'];

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[‐-‒–—―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

/**
 * Checks whether a source excerpt is reasonably supported
 * by the extracted document text.
 *
 * We first attempt normalized substring matching.
 * If PDF extraction changed punctuation/spacing slightly,
 * we allow strong token overlap.
 */
function sourceIsSupported(
  documentText: string,
  sourceText: string,
): boolean {
  const document = normalizeText(documentText);
  const source = normalizeText(sourceText);

  if (!source) return false;

  if (document.includes(source)) {
    return true;
  }

  const sourceWords = source
    .split(/\s+/)
    .filter((word) => word.length > 2);

  if (sourceWords.length < 4) {
    return false;
  }

  const documentWords = new Set(
    document
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );

  const matchedWords = sourceWords.filter(
    (word) => documentWords.has(word),
  ).length;

  return matchedWords / sourceWords.length >= 0.85;
}

export function validateComparison(
  data: unknown,
  company: string,
  client: string,
): ComparisonResult {
  const parsed = comparisonSchema.safeParse(data);

  if (!parsed.success) {
    console.error(
      'AI comparison schema validation failed:',
      parsed.error.flatten(),
    );

    throw new Error('Invalid AI response structure');
  }

  const result = parsed.data;

  if (!result.clauses.length || result.clauses.length > 150) {
    throw new Error('Invalid clause count');
  }

  const ids = new Set<string>();

  const counts = {
    aligned: 0,
    modified: 0,
    missing: 0,
    added: 0,
  };

  const validatedClauses: Clause[] = result.clauses.map(
    (rawClause, index) => {
      const name = rawClause.name.trim();
      const difference = rawClause.difference.trim();

      if (!name || !difference) {
        throw new Error(
          `Invalid clause at index ${index}`,
        );
      }

      let id =
        rawClause.id?.trim() ||
        slugify(name) ||
        `clause-${index + 1}`;

      if (ids.has(id)) {
        id = `${id}-${index + 1}`;
      }

      ids.add(id);

      const companyPresent =
        rawClause.status !== 'added';

      const clientPresent =
        rawClause.status !== 'missing';

      const companySource =
        rawClause.companySourceText?.trim() || null;

      const clientSource =
        rawClause.clientSourceText?.trim() || null;

      const companyPosition =
        rawClause.companyPosition?.trim() || null;

      const clientPosition =
        rawClause.clientPosition?.trim() || null;

      const companySection =
        rawClause.companySection?.trim() || null;

      const clientSection =
        rawClause.clientSection?.trim() || null;

      /*
       * Missing/added sides must not contain fabricated
       * source evidence.
       */
      if (!companyPresent && companySource) {
        throw new Error(
          `Unexpected company source for added clause: ${name}`,
        );
      }

      if (!clientPresent && clientSource) {
        throw new Error(
          `Unexpected client source for missing clause: ${name}`,
        );
      }

      /*
       * For sides that exist, require a meaningful position.
       */
      if (companyPresent && !companyPosition) {
        throw new Error(
          `Company position missing for: ${name}`,
        );
      }

      if (clientPresent && !clientPosition) {
        throw new Error(
          `Client position missing for: ${name}`,
        );
      }

      /*
       * Verify source excerpts when the model supplied them.
       *
       * Do not reject an otherwise valid comparison merely
       * because the model omitted an excerpt.
       */
      if (
        companyPresent &&
        companySource &&
        !sourceIsSupported(company, companySource)
      ) {
        console.warn(
          `Could not verify company source text for clause: ${name}`,
        );
      }

      if (
        clientPresent &&
        clientSource &&
        !sourceIsSupported(client, clientSource)
      ) {
        console.warn(
          `Could not verify client source text for clause: ${name}`,
        );
      }

      counts[rawClause.status]++;

      return {
        id,
        name,
        status: rawClause.status,

        companySection,
        clientSection,

        companyPosition,
        clientPosition,

        companySourceText: companySource,
        clientSourceText: clientSource,

        difference,

        suggestedAction:
          rawClause.suggestedAction?.trim() || null,

        confidence: rawClause.confidence,
      };
    },
  );

  return {
    summary: counts,
    clauses: validatedClauses,
  };
}
