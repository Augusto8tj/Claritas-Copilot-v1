'use server';

/**
 * @fileOverview An AI flow for analyzing a losing trade and suggesting strategy adjustments.
 * 
 * - analyzeTradeLoss - The main flow function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// 1. Define Input and Output Schemas
export const TradeLossAnalyzerInputSchema = z.object({
  operation: z.string().describe("A JSON string representing the details of the losing trade (asset, direction, stake, etc.)."),
  historicalDataJson: z.string().describe("A JSON string of the historical price data immediately before and during the trade."),
  activeStrategyJson: z.string().optional().describe("An optional JSON string of the autopilot strategy that was active during the trade."),
});
export type TradeLossAnalyzerInput = z.infer<typeof TradeLossAnalyzerInputSchema>;

export const TradeLossAnalyzerOutputSchema = z.object({
  analysis: z.string().describe("A concise, one-sentence analysis of why the trade likely failed (e.g., market reversal, high volatility)."),
  suggestion: z.string().describe("A short, actionable suggestion to improve the strategy (e.g., 'Consider increasing the RSI threshold to 35' or 'Avoid trading during news events.')."),
});
export type TradeLossAnalyzerOutput = z.infer<typeof TradeLossAnalyzerOutputSchema>;


// 2. Create the Prompt
const analysisPrompt = ai.definePrompt({
  name: 'tradeLossAnalyzerPrompt',
  input: { schema: TradeLossAnalyzerInputSchema },
  output: { schema: TradeLossAnalyzerOutputSchema },
  system: `Você é um analista de risco e performance de trading. Sua tarefa é realizar uma análise post-mortem de uma operação com prejuízo e fornecer uma explicação e uma sugestão para melhorar.

Instruções:
1.  **Analise a Causa:** Com base nos dados de mercado e na operação, identifique a razão mais provável para a perda. Foi uma reversão súbita? A volatilidade aumentou? A entrada foi tardia?
2.  **Seja Conciso:** Forneça uma análise de UMA frase. Ex: "O mercado reverteu a tendência logo após a sua entrada."
3.  **Dê uma Sugestão Acionável:** Forneça UMA sugestão curta e prática. Se a estratégia do piloto automático foi usada, a sugestão deve ser para ajustar essa estratégia. Ex: "Sugiro aumentar o limiar do RSI para 35 para evitar sinais falsos." ou "Considere aumentar a duração do contrato para 7 ticks para resistir a pequenas flutuações."`,
  prompt: `
Analise a seguinte operação com prejuízo:

**Operação:**
\'\'\'json
{{{operation}}}
\'\'\'

**Estratégia Ativa (se houver):**
\'\'\'json
{{{activeStrategyJson}}}
\'\'\'

**Dados de Mercado no Momento da Operação:**
\'\'\'json
{{{historicalDataJson}}}
\'\'\'
`
});


// 3. Define the Flow
const analyzeTradeLossFlow = ai.defineFlow(
  {
    name: 'analyzeTradeLossFlow',
    inputSchema: TradeLossAnalyzerInputSchema,
    outputSchema: TradeLossAnalyzerOutputSchema,
  },
  async (input) => {
    const { output } = await analysisPrompt(input);
    if (!output) throw new Error("A IA não conseguiu analisar a operação.");
    return output;
  }
);

// 4. Export a wrapper function
export async function analyzeTradeLoss(input: TradeLossAnalyzerInput): Promise<TradeLossAnalyzerOutput> {
    return analyzeTradeLossFlow(input);
}
