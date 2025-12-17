'use server';

import { getHistoricalDataTool } from '@/ai/tools/trading-tools';
import { getAssetAnalysis, type AssetAnalysisOutput } from '@/ai/flows/asset-analysis-flow';
import { AssetAnalysisInputSchema, type AssetAnalysisInput } from '@/ai/flows/asset-analysis-flow.types';


export async function getAssetAnalysisAction(input: AssetAnalysisInput): Promise<{ success?: AssetAnalysisOutput; error?: string }> {
  
  const validatedInput = AssetAnalysisInputSchema.safeParse(input);
  if (!validatedInput.success) {
    return { error: `Dados de entrada inválidos: ${validatedInput.error.message}` };
  }
  
  const { symbol } = validatedInput.data;

  try {
    const historicalData = await getHistoricalDataTool({ symbol, count: 120 });
    
    if (!historicalData || historicalData.length === 0) {
      return { error: `Não foi possível obter dados históricos para ${symbol}.` };
    }

    const result = await getAssetAnalysis({ 
        ...validatedInput.data,
        historicalData 
    });
    
    return { success: result };
  } catch (e: any) {
    console.error("[Action] Erro ao obter análise do ativo:", e);
    return { error: e.message || "Ocorreu um erro inesperado durante a análise da IA." };
  }
}
