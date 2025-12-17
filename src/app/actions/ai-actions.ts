'use server';

import { getHistoricalDataTool } from '@/ai/tools/trading-tools';
import { getAssetAnalysis, type AssetAnalysisOutput } from '@/ai/flows/asset-analysis-flow';


export async function getAssetAnalysisAction(symbol: string): Promise<{ success?: AssetAnalysisOutput; error?: string }> {
  if (!symbol) {
    return { error: "O símbolo do ativo é obrigatório." };
  }

  try {
    // 1. Fetch historical data using the existing tool
    const historicalData = await getHistoricalDataTool({ symbol, period: '5 dias' }); // Fetch recent data
    
    if (!historicalData || historicalData.length === 0) {
      return { error: `Não foi possível obter dados históricos para ${symbol}.` };
    }

    // 2. Run the analysis flow with the fetched data
    const result = await getAssetAnalysis({ symbol, historicalData });
    
    return { success: result };
  } catch (e: any) {
    console.error("[Action] Erro ao obter análise do ativo:", e);
    return { error: e.message || "Ocorreu um erro inesperado durante a análise da IA." };
  }
}
