import { z } from 'zod';

// We'll create a more focused input schema, removing fields not relevant for the autotrader strategy definition
export const AutoTraderStrategyInputSchema = z.object({
  symbol: z.string().describe("The trading symbol of the asset to be analyzed."),
  historicalData: z.array(z.object({
    date: z.string(),
    price: z.number(),
  })).describe("An array of recent historical price data for the asset."),
  balance: z.number().describe("The user's designated trading balance for the day. THIS IS THE VALUE TO BE USED FOR RISK MANAGEMENT."),
  currency: z.string().describe("The currency of the account balance."),
  stake: z.number().describe("The user's default stake amount (for reference only)."),
  duration: z.number().describe("The user's default trade duration (for reference only)."),
  durationUnit: z.string().describe("The unit for the default trade duration."),
  recentTrades: z.array(z.any()).describe("A list of the user's most recent trades in the current session."), // Using z.any() to avoid circular dependency
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
