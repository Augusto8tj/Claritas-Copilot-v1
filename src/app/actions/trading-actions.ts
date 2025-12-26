
'use server';

import {
  analyzeMqlCode,
} from '@/ai/flows/mql-analyzer-flow';
import { MqlAnalyzerInputSchema, type MqlAnalyzerInput } from '@/ai/flows/mql-analyzer-flow.types';
import type { TradeResult } from '@/services/deriv-api-service';
import { analyzeOperations } from '@/ai/flows/operation-analysis-flow';
import { OperationAnalysisInputSchema, type OperationAnalysisInput } from '@/ai/flows/operation-analysis-flow.types';


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

// This function is no longer needed here as it's part of the useDerivApi hook logic
// It's kept for compatibility with the AI tool `executeTradeTool` which is not yet refactored
export async function executeTradeAction(
    apiToken: string,
    contractType: string,
    quantity: number,
    symbol: string
): Promise<TradeResult> {
    try {
        // This is a placeholder call, in a real scenario you would connect to the service
        // const result = await executeTradeService(apiToken, contractType, quantity, symbol);
        // return result;
        console.warn("executeTradeAction is a placeholder and does not execute real trades.");
        return { success: false, message: "A execução de trades por esta ação foi desativada. Use o hook useDerivApi." };
    } catch(e: any) {
        console.error("[Action] Erro ao executar a negociação:", e);
        return { success: false, message: e.message || "Um erro inesperado ocorreu na ação de negociação." };
    }
}

export async function analyzeOperationsAction(data: OperationAnalysisInput): Promise<{ success?: string; error?: string }> {
    const validatedData = OperationAnalysisInputSchema.safeParse(data);
    if (!validatedData.success) {
        return { error: "Dados de operações inválidos." };
    }
     if (validatedData.data.operations.length === 0) {
        return { error: "Não há operações para analisar." };
    }

    try {
        const result = await analyzeOperations(validatedData.data);
        return { success: result.analysis };
    } catch (e: any) {
        console.error("Erro ao analisar operações:", e);
        return { error: e.message || "Ocorreu um erro inesperado durante a análise." };
    }
}
