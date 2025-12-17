import { z } from 'zod';

export const AssetAnalysisInputSchema = z.object({
  symbol: z.string().describe("The trading symbol of the asset to be analyzed."),
  historicalData: z.array(z.object({
    date: z.string(),
    price: z.number(),
  })).describe("An array of recent historical price data for the asset."),
});
export type AssetAnalysisInput = z.infer<typeof AssetAnalysisInputSchema>;

export const AssetAnalysisOutputSchema = z.object({
  suggestion: z.enum(['RISE', 'FALL', 'HOLD']).describe("The suggested trading direction: RISE for an expected price increase, FALL for an expected decrease, or HOLD if the direction is unclear."),
  justification: z.string().describe("A brief, clear justification for the trading suggestion based on the provided data."),
});
export type AssetAnalysisOutput = z.infer<typeof AssetAnalysisOutputSchema>;