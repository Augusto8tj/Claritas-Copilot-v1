
'use server';

import {
  runStrategyBacktest,
} from '@/ai/flows/strategy-backtest-flow';
import { type StrategyBacktestInput, StrategyBacktestInputSchema } from '@/ai/flows/strategy-backtest-flow.types';


import {
  analyzeMqlCode,
} from '@/ai/flows/mql-analyzer-flow';
import { MqlAnalyzerInputSchema, type MqlAnalyzerInput } from '@/ai/flows/mql-analyzer-flow.types';
import { executeTrade as executeTradeInService } from '@/services/deriv-api-service';
import { z } from 'zod';
import type { TradeResult } from '@/services/deriv-api-service';

const executeTradeSchema = z.object({
  symbol: z.string(),
  tradeDirection: z.enum(['rise', 'fall']),
  quantity: z.coerce.number(),
  allowEquals: z.boolean().optional(),
  contractType: z.string(), // This will be calculated in the component now
});
type ExecuteTradeInput = z.infer<typeof executeTradeSchema>;


export async function runStrategyBacktestAction(data: StrategyBacktestInput): Promise<{ success?: string; error?: string }> {
  const validatedData = StrategyBacktestInputSchema.safeParse(data);
  if (!validatedData.success) {
    const fieldErrors = validatedData.error.flatten().fieldErrors;
    const errorMessage = Object.values(fieldErrors).flat().join(', ');
    return { error: errorMessage || "Dados de entrada inválidos." };
  }

  try {
    const result = await runStrategyBacktest(validatedData.data);
    return { success: result.summary };
  } catch (e: any) {
    console.error("Erro ao executar o backtest:", e);
    return { error: e.message || "Ocorreu um erro inesperado durante a simulação." };
  }
}

export async function analyzeMqlCodeAction(data: MqlAnalyzerInput): Promise<{ success?: string; error?: string }> {
  const validatedData = MqlAnalyzerInputSchema.safeParse(data);
  if (!validatedData.success) {
    const fieldErrors = validatedData.error.flatten().fieldErrors;
    const errorMessage = Object.values(fieldErrors).flat().join(', ');
    return { error: errorMessage || "Código MQL5 inválido." };
  }

  try {
    const result = await analyzeMqlCode(validatedData.data);
    return { success: result.strategyDescription };
  } catch (e: any) {
    console.error("Erro ao analisar o código MQL5:", e);
    return { error: e.message || "Ocorreu um erro inesperado durante a análise do código." };
  }
}


export async function executeTradeAction(data: ExecuteTradeInput): Promise<{ success?: TradeResult; error?: string }> {
  const validatedData = executeTradeSchema.safeParse(data);
  if (!validatedData.success) {
    const fieldErrors = validatedData.error.flatten().fieldErrors;
    const errorMessage = Object.values(fieldErrors).flat().join(', ');
    return { error: errorMessage || "Dados de entrada para a negociação inválidos." };
  }

  try {
    // This is a server action, it can't use hooks.
    // We need to pass the token from the client.
    // For now, let's assume the token is in an environment variable for simplicity.
    const apiToken = process.env.DERIV_API_TOKEN;
    if (!apiToken) {
      return { error: "O token da API da Deriv não está configurado no servidor (.env)." };
    }

    const { symbol, contractType, quantity } = validatedData.data;
    const result = await executeTradeInService(apiToken, symbol, contractType, quantity);

    if(result.success) {
      return { success: result };
    } else {
      return { error: result.message };
    }
  } catch (e: any) {
    console.error("Erro ao executar a negociação:", e);
    return { error: e.message || "Ocorreu um erro inesperado durante a negociação." };
  }
}
