import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { comparisonSchema, validateComparison } from './comparisonSchema';
import { comparisonPrompt } from './comparisonPrompt';
import { AppError } from '../errors';
export async function compareContracts(company: string, client: string, signal?: AbortSignal) {
  if (!process.env.OPENAI_API_KEY) throw new AppError('Comparison is not configured yet. Ask the administrator to set OPENAI_API_KEY on the server.', 503);
  const api = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 0 });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await api.responses.parse({
        model: process.env.OPENAI_MODEL || 'gpt-4.1',
        store: false,
        instructions: comparisonPrompt + (attempt ? '\nPrevious output failed validation. Ensure every source excerpt is an exact contiguous quotation, absent-side fields are null, and IDs are unique.' : ''),
        input: [{ role: 'user', content: JSON.stringify({ companyTemplate: company, clientContract: client }) }],
        text: { format: zodTextFormat(comparisonSchema, 'contract_comparison') },
        max_output_tokens: 24000,
      }, { signal });
      if (response.status !== 'completed' || !response.output_parsed) throw new Error('Invalid model response');
      return validateComparison(response.output_parsed, company, client);
    } catch (error) {
      if (signal?.aborted) throw new AppError('Comparison cancelled.', 499);
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) throw new AppError('The comparison service is busy or its quota has been reached. Please try again later.', 503);
        throw new AppError('The AI comparison service is unavailable. Please try again or contact your administrator.', 502);
      }
      if (attempt === 1) throw new AppError('The AI response could not be verified. Please try the comparison again.', 502);
    }
  }
  throw new AppError('Unable to complete comparison.', 502);
}
