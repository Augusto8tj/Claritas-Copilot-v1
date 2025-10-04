'use server';

/**
 * @fileOverview An AI flow for backtesting a trading strategy described by the user.
 * 
 * - runStrategyBacktestFlow - The main flow function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getHistoricalDataTool } from '../tools/trading-tools';
import { StrategyBacktestInputSchema, StrategyBacktestOutputSchema, type StrategyBacktestInput } from './strategy-backtest-flow.types';


const backtestPrompt = ai.definePrompt({
  name: 'strategyBacktestPrompt',
  input: { schema: z.object({ strategy: z.string(), historicalData: z.any() }) },
  output: { schema: StrategyBacktestOutputSchema },
  system: `Você é um analista quantitativo de ponta. Sua tarefa é realizar um backtest de uma estratégia de trading com base na descrição fornecida pelo usuário e nos dados históricos de preços.

1.  Analise a estratégia do usuário para extrair os principais parâmetros: ativo (symbol), capital inicial, e as regras de compra e venda.
2.  Use os dados históricos fornecidos para simular a execução dessa estratégia.
3.  Calcule o resultado final: balanço inicial, balanço final, lucro/prejuízo total (em valor e percentual) e o número de negociações realizadas.
4.  Forneça um resumo claro e conciso dos resultados em português.`,
  prompt: `
Estratégia para Testar:
{{{strategy}}}

Dados Históricos do Ativo:
{{jsonStringify historicalData}}
`
});


export const runStrategyBacktestFlow = ai.defineFlow(
  {
    name: 'runStrategyBacktestFlow',
    inputSchema: StrategyBacktestInputSchema,
    outputSchema: StrategyBacktestOutputSchema,
  },
  async ({ strategyDescription }) => {
    
    // A simple heuristic to extract the symbol and period. 
    // A more robust solution would use another LLM call to parse the user's text into structured data.
    const symbolMatch = strategyDescription.match(/\b([A-Z]{4}\d{1,2})\b/);
    const symbol = symbolMatch ? symbolMatch[0] : 'PETR4'; // Default to PETR4 if not found

    const periodMatch = strategyDescription.match(/(\d+\s+(ano|mes|anos|meses))/);
    const period = periodMatch ? periodMatch[0] : '1 ano'; // Default to 1 year

    // 1. Use a tool to get historical data for the relevant stock.
    const historicalData = await getHistoricalDataTool({ symbol, period });

    if (!historicalData || historicalData.length === 0) {
      return { summary: "Não foi possível obter dados históricos para o ativo solicitado. Tente novamente." };
    }

    // 2. Run the main prompt to perform the backtest simulation.
    const { output } = await backtestPrompt({
      strategy: strategyDescription,
      historicalData: historicalData,
    });

    if (!output) {
      throw new Error("A simulação de backtest não conseguiu gerar um resultado.");
    }

    return output;
  }
);

// Wrapper function to be called by server actions
export async function runStrategyBacktest(input: StrategyBacktestInput) {
    return runStrategyBacktestFlow(input);
}
