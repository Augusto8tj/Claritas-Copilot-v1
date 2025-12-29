// /src/ai/flows/operation-analysis-flow.types.ts
import { z } from 'zod';

const OperationStatusSchema = z.enum(['pending', 'won', 'lost']);

export const OperationSchema = z.object({
  id: z.number(),
  asset: z.string(),
  direction: z.enum(['rise', 'fall']),
  stake: z.number(),
  status: OperationStatusSchema,
  result: z.number().optional(),
  timestamp: z.string().datetime().describe("The ISO 8601 timestamp of when the operation was created."),
});
export type Operation = z.infer<typeof OperationSchema>;

export const OperationAnalysisInputSchema = z.object({
  operations: z.array(OperationSchema).describe('An array of trading operations from the current session.'),
});
export type OperationAnalysisInput = z.infer<typeof OperationAnalysisInputSchema>;

export const OperationAnalysisOutputSchema = z.object({
  analysis: z.string().describe('A natural language summary of the trading performance analysis, including key metrics.'),
});
export type OperationAnalysisOutput = z.infer<typeof OperationAnalysisOutputSchema>;
