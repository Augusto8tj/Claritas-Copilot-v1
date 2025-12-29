// /src/ai/flows/mql-analyzer-flow.types.ts
import { z } from 'zod';

export const MqlAnalyzerInputSchema = z.object({
  mqlCode: z.string().describe('The MQL5 source code of a trading robot.'),
});
export type MqlAnalyzerInput = z.infer<typeof MqlAnalyzerInputSchema>;

export const MqlAnalyzerOutputSchema = z.object({
  strategyDescription: z.string().describe('A natural language description of the trading strategy extracted from the MQL5 code.'),
});
export type MqlAnalyzerOutput = z.infer<typeof MqlAnalyzerOutputSchema>;
