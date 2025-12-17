'use server';

/**
 * @fileOverview An AI flow for analyzing a trading asset and suggesting a trade direction.
 * 
 * - getAssetAnalysis - The main flow function.
 */

import { ai, flash, pro } from '@/ai/genkit';
import { z } from 'zod';
import { AssetAnalysisInputSchema, AssetAnalysisOutputSchema, type AssetAnalysisInput, type AssetAnalysisOutput } from './asset-analysis-flow.types';


// 1. Create the Prompt
const analysisPrompt = ai.definePrompt({
  name: 'assetAnalysisPrompt',
  input: { schema: z.object({ historicalDataJson: z.string(), symbol: z.string() }) },
  output: { schema: AssetAnalysisOutputSchema },
  system: `Você é um analista técnico de mercado financeiro. Sua tarefa é analisar os dados de preços recentes de um ativo e fornecer uma sugestão de negociação (RISE, FALL, ou HOLD) com uma justificativa curta e direta.
- Identifique a tendência principal nos dados (alta, baixa ou lateral).
- Baseie sua sugestão na tendência mais recente.
- Se a tendência não for clara, sugira 'HOLD'.
- A justificativa deve ter no máximo uma frase. Ex: "O ativo mostra uma clara tendência de alta nos últimos pontos de dados."`,
  prompt: `
Analise os seguintes dados de preço para o ativo {{{symbol}}} e forneça uma sugestão de negociação.

Dados de Preço Recentes (JSON):
\'\'\'json
{{{historicalDataJson}}}
\'\'\'
`
});


// 2. Define the Flow
const getAssetAnalysisFlow = ai.defineFlow(
  {
    name: 'getAssetAnalysisFlow',
    inputSchema: AssetAnalysisInputSchema,
    outputSchema: AssetAnalysisOutputSchema,
  },
  async ({ symbol, historicalData }) => {
    
    // Convert historical data to a JSON string to pass to the prompt
    const historicalDataJson = JSON.stringify(historicalData); 

    try {
      // Use the fast model for this kind of analysis
      const { output } = await analysisPrompt({ historicalDataJson, symbol }, { model: flash });
      if (!output) throw new Error("A análise com o modelo Flash retornou uma saída vazia.");
      return output;
    } catch (e) {
      console.warn(`[Flow] Model '${flash}' failed for asset analysis, trying '${pro}'. Error:`, e);
      // Fallback to the more robust model if needed
      const { output } = await analysisPrompt({ historicalDataJson, symbol }, { model: pro });
      if (!output) throw new Error("A IA não conseguiu analisar o ativo.");
      return output;
    }
  }
);

// 3. Export a wrapper function
export async function getAssetAnalysis(input: AssetAnalysisInput): Promise<AssetAnalysisOutput> {
    return getAssetAnalysisFlow(input);
}
