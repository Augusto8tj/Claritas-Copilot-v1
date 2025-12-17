'use server';

import { getAssetAnalysis, type AssetAnalysisOutput } from '@/ai/flows/asset-analysis-flow';
import { AssetAnalysisInputSchema, type AssetAnalysisInput } from '@/ai/flows/asset-analysis-flow.types';


export async function getAssetAnalysisAction(input: AssetAnalysisInput): Promise<{ success?: AssetAnalysisOutput; error?: string }> {
  
  // The historicalData is now passed directly from the client, so we validate it here.
  const validatedInput = AssetAnalysisInputSchema.safeParse(input);
  if (!validatedInput.success) {
    return { error: `Dados de entrada inválidos: ${validatedInput.error.message}` };
  }

  // The historical data is already included in validatedInput.data, so no need to fetch it again.
  
  try {
    const result = await getAssetAnalysis(validatedInput.data);
    return { success: result };
  } catch (e: any) {
    console.error("[Action] Erro ao obter análise do ativo:", e);
    return { error: e.message || "Ocorreu um erro inesperado durante a análise da IA." };
  }
}
