'use server';

/**
 * @fileOverview An AI flow for analyzing a trading asset and suggesting a trade.
 * 
 * - getAssetAnalysis - The main flow function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { AssetAnalysisInputSchema, AssetAnalysisOutputSchema, type AssetAnalysisInput, type AssetAnalysisOutput } from './asset-analysis-flow.types';


// 1. Create the Prompt
const analysisPrompt = ai.definePrompt({
  name: 'assetAnalysisPrompt',
  input: { schema: AssetAnalysisInputSchema },
  output: { schema: AssetAnalysisOutputSchema },
  system: `Você é um copiloto de negociação e gestor de risco. Sua tarefa é analisar os dados do ativo, o contexto do trader e fornecer uma sugestão de negociação inteligente e segura.

Contexto do Trader:
- Saldo da Conta: {{{balance}}} {{{currency}}}
- Aposta Atual (Stake): {{{stake}}} {{{currency}}}
- Duração da Operação: {{{duration}}} {{{durationUnit}}}
- Trades Recentes: {{{recentTrades}}}

Sua Análise deve seguir estes passos:
1.  **Análise Técnica:** Analise os dados de preço recentes para identificar a tendência principal (alta, baixa ou lateral). Esta é sua principal fonte para a direção.
2.  **Gestão de Risco:**
    - Compare o valor da aposta (stake) com o saldo total. Se a aposta for superior a 5% do saldo, considere-a de alto risco.
    - Analise os trades recentes. Se houver uma sequência de 3 ou mais perdas, o trader pode estar a operar emocionalmente.
3.  **Formular a Sugestão:**
    - **Direção (suggestion):** Baseie-se na tendência dos dados de preço. Se a tendência não for clara, sugira 'HOLD'.
    - **Stake Sugerido (suggestedStake):** Se a aposta atual for de alto risco, sugira um valor mais seguro (ex: 2% do saldo). Caso contrário, mantenha a aposta atual.
    - **Duração Sugerida (suggestedDuration):** Mantenha a duração atual, a menos que a análise dos dados sugira uma mudança iminente que justifique uma operação mais curta ou mais longa.
    - **Justificativa (justification):** Forneça uma justificativa clara, concisa (máximo 2 frases) que combine a análise técnica com a gestão de risco. Ex: "A tendência de curto prazo é de alta, mas sua aposta é arriscada. Sugiro reduzir para manter a gestão de risco." ou "Tendência de queda clara nos últimos minutos. A configuração atual parece boa."`,
  prompt: `
Analise os seguintes dados de preço para o ativo {{{symbol}}} e forneça uma sugestão de negociação considerando o contexto do trader.

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
  async (input) => {
    
    const historicalDataJson = JSON.stringify(input.historicalData);
    const recentTradesJson = JSON.stringify(input.recentTrades);

    const promptInput = {
      ...input,
      historicalDataJson,
      recentTrades: recentTradesJson,
    };

    const { output } = await analysisPrompt(promptInput);
    if (!output) throw new Error("A IA não conseguiu analisar o ativo.");
    return output;
  }
);

// 3. Export a wrapper function
export async function getAssetAnalysis(input: AssetAnalysisInput): Promise<AssetAnalysisOutput> {
    return getAssetAnalysisFlow(input);
}
