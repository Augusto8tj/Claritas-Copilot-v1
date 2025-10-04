import { z } from 'zod';

export const StrategyBacktestInputSchema = z.object({
  strategyDescription: z.string().describe('A user-provided description of the trading strategy to be tested, written in natural language.'),
});
export type StrategyBacktestInput = z.infer<typeof StrategyBacktestInputSchema>;

export const StrategyBacktestOutputSchema = z.object({
  summary: z.string().describe('A detailed summary of the backtest results, including initial and final balance, total profit/loss, and number of trades.'),
});
export type StrategyBacktestOutput = z.infer<typeof StrategyBacktestOutputSchema>;
