'use server';

import {
  runStrategyBacktestFlow,
  StrategyBacktestInputSchema,
  type StrategyBacktestInput
} from '@/ai/flows/strategy-backtest-flow';

export async function runStrategyBacktest(data: StrategyBacktestInput): Promise<{ success?: string; error?: string }> {
  const validatedData = StrategyBacktestInputSchema.safeParse(data);
  if (!validatedData.success) {
    const fieldErrors = validatedData.error.flatten().fieldErrors;
    const errorMessage = Object.values(fieldErrors).flat().join(', ');
    return { error: errorMessage || "Dados de entrada inválidos." };
  }

  try {
    const result = await runStrategyBacktestFlow(validatedData.data);
    return { success: result.summary };
  } catch (e: any) {
    console.error("Erro ao executar o backtest:", e);
    return { error: e.message || "Ocorreu um erro inesperado durante a simulação." };
  }
}
