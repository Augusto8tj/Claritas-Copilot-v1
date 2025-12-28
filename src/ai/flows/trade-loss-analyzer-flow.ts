'use server';

/**
 * @fileOverview An AI flow for analyzing a losing trade and suggesting strategy adjustments.
 * 
 * - analyzeTradeLoss - The main flow function.
 */

import { ai } from '@/lib/genkit';
import { TradeLossAnalyzerInputSchema, TradeLossAnalyzerOutputSchema, type TradeLossAnalyzerInput, type TradeLossAnalyzerOutput } from './trade-loss-analyzer-flow.types';


// 2. Create the Prompt
const analysisPrompt = ai.definePrompt({
  name: 'tradeLossAnalyzerPrompt',
  input: { schema: TradeLossAnalyzerInputSchema },
  output: { schema: TradeLossAnalyzerOutputSchema },
  system: `Você é um analista de risco e performance de trading. Sua tarefa é realizar uma análise post-mortem de uma operação com prejuízo e fornecer uma explicação e uma sugestão para melhorar.

Instruções:
1.  **Analise a Causa:** Com base nos dados de mercado e na operação, identifique a razão mais provável para a perda. Foi uma reversão súbita? A volatilidade aumentou? A entrada foi tardia? A duração do contrato foi muito curta ou muito longa para a condição de mercado?
2.  **Seja Conciso:** Forneça uma análise de UMA frase. Ex: "O mercado reverteu a tendência logo após a sua entrada."
3.  **Dê uma Sugestão Acionável:** Forneça UMA sugestão curta e prática. A sugestão pode ser sobre o indicador, o stake ou a duração.
    - **Ajuste de Indicador:** "Sugiro aumentar o limiar do RSI para 35 para evitar sinais falsos."
    - **Ajuste de Duração:** "Considere aumentar a duração do contrato para 7 ticks para resistir a pequenas flutuações."
    - **Ajuste de Risco:** "Em condições de alta volatilidade, considere reduzir o stake pela metade."`,
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
