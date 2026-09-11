import { z } from 'zod';

export const statuses = [
  'aligned',
  'modified',
  'missing',
  'added',
] as const;

export const clauseSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(statuses),

  companySection: z.string().nullable(),
  clientSection: z.string().nullable(),

  companyPosition: z.string().nullable(),
  clientPosition: z.string().nullable(),

  companySourceText: z.string().nullable(),
  clientSourceText: z.string().nullable(),

  difference: z.string(),

  suggestedAction: z.string().nullable(),

  confidence: z.enum([
    'high',
    'medium',
    'low',
  ]),
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

export type ComparisonResult =
  z.infer<typeof comparisonSchema>;

export type Clause =
  z.infer<typeof clauseSchema>;

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

function sourceIsSupported(
  documentText: string,
  sourceText: string,
): boolean {
  const document = normalizeText(documentText);
  const source = normalizeText(sourceText);

  if (!source) {
    return false;
  }

  // Best case: normalized excerpt exists directly
  // in the extracted document.
  if (document.includes(source)) {
    return true;
  }

  /*
   * PDF extraction can slightly change spaces,
   * punctuation and line breaks.
   *
   * Therefore use word overlap as a fallback
   * rather than rejecting the entire AI result.
   */
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

  const matches = sourceWords.filter(
    (word) => documentWords.has(word),
  ).length;

  return matches / sourceWords.length >= 0.85;
}

export function validateComparison(
  data: unknown,
  company: string,
  client: string,
): ComparisonResult {
  const parsed =
    comparisonSchema.safeParse(data);

  if (!parsed.success) {
    console.error(
      'AI comparison schema validation failed:',
      parsed.error.flatten(),
    );

    throw new Error(
      'Invalid AI response structure',
    );
  }

  const result = parsed.data;

  if (
    !result.clauses.length ||
    result.clauses.length > 150
  ) {
    throw new Error(
      'Invalid clause count',
    );
  }

  const ids = new Set<string>();

  const counts = {
    aligned: 0,
    modified: 0,
    missing: 0,
    added: 0,
  };

  for (const clause of result.clauses) {
    if (
      !clause.id.trim() ||
      ids.has(clause.id) ||
      !clause.name.trim() ||
      !clause.difference.trim()
    ) {
      throw new Error(
        'Invalid clause',
      );
    }

    ids.add(clause.id);

    const companyPresent =
      clause.status !== 'added';

    const clientPresent =
      clause.status !== 'missing';

    /*
     * Validate the company side.
     */
    if (companyPresent) {
      if (
        !clause.companyPosition?.trim()
      ) {
        throw new Error(
          `Company position missing for ${clause.name}`,
        );
      }

      if (
        clause.companySourceText?.trim() &&
        !sourceIsSupported(
          company,
          clause.companySourceText,
        )
      ) {
        /*
         * Important:
         * do NOT reject the entire comparison just
         * because PDF extraction changed spacing,
         * punctuation or line wrapping.
         */
        console.warn(
          `Company source excerpt could not be verified exactly for: ${clause.name}`,
        );
      }
    } else {
      if (
        clause.companySourceText !== null ||
        clause.companyPosition !== null ||
        clause.companySection !== null
      ) {
        throw new Error(
          `Company side must be null for added clause: ${clause.name}`,
        );
      }
    }

    /*
     * Validate the client side.
     */
    if (clientPresent) {
      if (
        !clause.clientPosition?.trim()
      ) {
        throw new Error(
          `Client position missing for ${clause.name}`,
        );
      }

      if (
        clause.clientSourceText?.trim() &&
        !sourceIsSupported(
          client,
          clause.clientSourceText,
        )
      ) {
        console.warn(
          `Client source excerpt could not be verified exactly for: ${clause.name}`,
        );
      }
    } else {
      if (
        clause.clientSourceText !== null ||
        clause.clientPosition !== null ||
        clause.clientSection !== null
      ) {
        throw new Error(
          `Client side must be null for missing clause: ${clause.name}`,
        );
      }
    }

    counts[clause.status]++;
  }

  /*
   * Never trust the model's arithmetic.
   * Recalculate summary based on validated clauses.
   */
  return {
    ...result,
    summary: counts,
  };
}
