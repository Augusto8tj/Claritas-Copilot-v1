import { z } from 'zod';

// Define Input and Output Schemas
export const TradeLossAnalyzerInputSchema = z.object({
  operation: z.string().describe("A JSON string representing the details of the losing trade (asset, direction, stake, etc.)."),
  historicalDataJson: z.string().describe("A JSON string of the historical price data immediately before and during the trade."),
  activeStrategyJson: z.string().optional().describe("An optional JSON string of the autopilot strategy that was active during the trade."),
});
export type TradeLossAnalyzerInput = z.infer<typeof TradeLossAnalyzerInputSchema>;

export const TradeLossAnalyzerOutputSchema = z.object({
  analysis: z.string().describe("A concise, one-sentence analysis of why the trade likely failed (e.g., market reversal, high volatility)."),
  suggestion: z.string().describe("A short, actionable suggestion to improve the strategy (e.g., 'Consider increasing the RSI threshold to 35' or 'Avoid trading during news events.')."),
});
export type TradeLossAnalyzerOutput = z.infer<typeof TradeLossAnalyzerOutputSchema>;
