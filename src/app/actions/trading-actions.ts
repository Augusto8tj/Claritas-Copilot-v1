
'use server';

import {
  runStrategyBacktest,
} from '@/ai/flows/strategy-backtest-flow';
import { type StrategyBacktestInput, StrategyBacktestInputSchema } from '@/ai/flows/strategy-backtest-flow.types';


import {
  analyzeMqlCode,
} from '@/ai/flows/mql-analyzer-flow';
import { MqlAnalyzerInputSchema, type MqlAnalyzerInput } from '@/ai/flows/mql-analyzer-flow.types';
import { executeTrade as executeTradeService } from '@/services/deriv-api-service';
import type { TradeResult } from '@/services/deriv-api-service';


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

export async function executeTradeAction(
    apiToken: string,
    contractType: string,
    quantity: number,
    symbol: string
): Promise<TradeResult> {
    try {
        const result = await executeTradeService(apiToken, contractType, quantity, symbol);
        return result;
    } catch(e: any) {
        console.error("[Action] Erro ao executar a negociação:", e);
        return { success: false, message: e.message || "Um erro inesperado ocorreu na ação de negociação." };
    }
}
