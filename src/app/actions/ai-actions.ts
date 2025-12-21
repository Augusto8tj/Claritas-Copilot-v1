
'use server';

import { getAssetAnalysis, type AssetAnalysisOutput } from '@/ai/flows/asset-analysis-flow';
import { AssetAnalysisInputSchema, type AssetAnalysisInput } from '@/ai/flows/asset-analysis-flow.types';
import { getAutotraderStrategy } from '@/ai/flows/auto-trader-strategy-flow';
import { AutoTraderStrategyInputSchema, type AutoTraderStrategyInput, type AutoTraderStrategyOutput } from '@/ai/flows/auto-trader-strategy-flow.types';
import { analyzeTradeLoss } from '@/ai/flows/trade-loss-analyzer-flow';
import { TradeLossAnalyzerInputSchema, type TradeLossAnalyzerInput, type TradeLossAnalyzerOutput } from '@/ai/flows/trade-loss-analyzer-flow.types';


export async function getAssetAnalysisAction(input: AssetAnalysisInput): Promise<{ success?: AssetAnalysisOutput; error?: string }> {
  
  // The historicalData is now passed directly from the client, so we validate it here.
  const validatedInput = AssetAnalysisInputSchema.safeParse(input);
  if (!validatedInput.success) {
    return { error: `Dados de entrada inválidos: ${validatedInput.error.message}` };
  }
  
  try {
    const result = await getAssetAnalysis(validatedInput.data);
    return { success: result };
  } catch (e: any) {
    console.error("[Action] Erro ao obter análise do ativo:", e);
    return { error: e.message || "Ocorreu um erro inesperado durante a análise da IA." };
  }
}

export async function getAutotraderStrategyAction(input: AutoTraderStrategyInput): Promise<{ success?: AutoTraderStrategyOutput; error?: string }> {
    const validatedInput = AutoTraderStrategyInputSchema.safeParse(input);
    if (!validatedInput.success) {
        return { error: `Dados de entrada inválidos para a estratégia: ${validatedInput.error.message}` };
    }

    try {
        const result = await getAutotraderStrategy(validatedInput.data);
        return { success: result };
    } catch (e: any) {
        console.error("[Action] Erro ao definir estratégia do piloto automático:", e);
        return { error: e.message || "Ocorreu um erro inesperado ao definir a estratégia." };
    }
}

export async function analyzeTradeLossAction(input: TradeLossAnalyzerInput): Promise<{ success?: TradeLossAnalyzerOutput; error?: string }> {
    const validatedInput = TradeLossAnalyzerInputSchema.safeParse(input);
    if (!validatedInput.success) {
        return { error: `Dados de entrada inválidos para a análise de perda: ${validatedInput.error.message}` };
    }

    try {
        const result = await analyzeTradeLoss(validatedInput.data);
        return { success: result };
    } catch (e: any) {
        console.error("[Action] Erro ao analisar a operação com perda:", e);
        return { error: e.message || "Ocorreu um erro inesperado durante a análise da perda." };
    }
}
