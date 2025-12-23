
'use server';

/**
 * @fileOverview An AI flow for backtesting a trading strategy described by the user.
 * THIS FILE IS NO LONGER IN USE AND SHOULD BE DELETED.
 * The `getHistoricalDataTool` was removed, making this flow non-functional.
 * The logic should be reimplemented using the `useDerivApi` hook if needed.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { StrategyBacktestInputSchema, StrategyBacktestOutputSchema, type StrategyBacktestInput } from './strategy-backtest-flow.types';


const runStrategyBacktestFlow = ai.defineFlow(
  {
    name: 'runStrategyBacktestFlow',
    inputSchema: StrategyBacktestInputSchema,
    outputSchema: StrategyBacktestOutputSchema,
  },
  async ({ strategyDescription }) => {
    // This flow is deprecated because the tool it relied on was removed.
    return { summary: "Este recurso de backtesting foi desativado temporariamente para refatoração. A funcionalidade será restaurada em breve." };
  }
);

// Wrapper function to be called by server actions
export async function runStrategyBacktest(input: StrategyBacktestInput) {
    return runStrategyBacktestFlow(input);
}
