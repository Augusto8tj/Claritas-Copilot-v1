import { z } from 'zod';
import { AssetAnalysisInputSchema } from './asset-analysis-flow.types';

// The input is the same as the asset analysis, as it needs the same context.
// We add an optional field for the feedback from the loss analyzer.
export const AutoTraderStrategyInputSchema = AssetAnalysisInputSchema.extend({
    lastLossAnalysisSuggestion: z.string().optional().describe('The suggestion from the last trade loss analysis, to be used for adjusting the strategy.'),
});
export type AutoTraderStrategyInput = z.infer<typeof AutoTraderStrategyInputSchema>;


// The output is a structured trading strategy
export const AutoTraderStrategyOutputSchema = z.object({
  strategyName: z.enum(['RSI_BASIC', 'STOCH_BASIC']).describe("The name of the simple strategy chosen by the AI."),
  rsiThreshold: z.number().optional().describe("The RSI threshold for the 'RSI_BASIC' strategy (e.g., 30 for oversold, 70 for overbought)."),
  stochThreshold: z.number().optional().describe("The Stochastic Oscillator threshold (e.g., 20 for oversold, 80 for overbought)."),
  direction: z.enum(['RISE', 'FALL']).describe("The direction to trade when the condition is met."),
  justification: z.string().describe("A brief explanation of why this strategy was chosen."),
  suggestedStake: z.number().describe("The suggested stake amount for this trade, based on risk analysis. Should be a percentage of the balance, e.g., 1-2%."),
  suggestedDuration: z.number().describe("The suggested contract duration in ticks, based on market volatility."),
});

export type AutoTraderStrategyOutput = z.infer<typeof AutoTraderStrategyOutputSchema>;
