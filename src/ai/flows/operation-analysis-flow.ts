'use server';

/**
 * @fileOverview An AI flow for analyzing a user's trading operations history.
 *
 * - analyzeOperations - The main flow function.
 */

import { ai, flash, pro } from '@/ai/genkit';
import { z } from 'zod';
import { OperationAnalysisInputSchema, OperationAnalysisOutputSchema, type OperationAnalysisInput } from './operation-analysis-flow.types';

const analyzerPrompt = ai.definePrompt({
  name: 'operationAnalyzerPrompt',
  input: { schema: OperationAnalysisInputSchema },
  output: { schema: OperationAnalysisOutputSchema },
  system: `Você é um analista de performance e risco, especialista em mercado financeiro. Sua tarefa é analisar um histórico de operações de trading e fornecer um resumo estatístico e insights valiosos em português.
Seja conciso e direto.

Calcule e apresente os seguintes pontos:
1.  **Resumo Geral:** Total de operações, total de ganhos (won), total de perdas (lost).
2.  **Taxa de Acerto (Win Rate):** A porcentagem de operações vencedoras.
3.  **Resultado Financeiro:** O lucro ou prejuízo líquido total.
4.  **Payoff Ratio:** A razão entre o lucro médio das operações vencedoras e o prejuízo médio das operações perdedoras.
5.  **Conclusão:** Uma ou duas frases com um insight ou conselho prático com base nos dados (ex: "Sua taxa de acerto é boa, mas suas perdas são maiores que seus ganhos, sugerindo que você pode precisar gerenciar melhor seus stops." ou "Seu desempenho é positivo, continue assim!").

Se não houver operações concluídas, informe que não há dados suficientes para a análise.`,
  prompt: `
Por favor, analise o seguinte histórico de operações de trading da sessão atual:

\'\'\'json
{{{jsonStringify operations}}}
\'\'\'
`
});

const analyzeOperationsFlow = ai.defineFlow(
  {
    name: 'analyzeOperationsFlow',
    inputSchema: OperationAnalysisInputSchema,
    outputSchema: OperationAnalysisOutputSchema,
  },
  async ({ operations }) => {
    try {
      // Use the fast model for this kind of analysis
      const { output } = await analyzerPrompt({ operations }, { model: flash });
      if (!output) throw new Error("A análise com o modelo Flash retornou uma saída vazia.");
      return output;
    } catch (e) {
      console.warn(`[Flow] Model '${flash}' failed for operation analysis, trying '${pro}'. Error:`, e);
      // Fallback to the more robust model if needed
      const { output } = await analyzerPrompt({ operations }, { model: pro });
      if (!output) throw new Error("A IA não conseguiu analisar o histórico de operações.");
      return output;
    }
  }
);

export async function analyzeOperations(input: OperationAnalysisInput) {
    return analyzeOperationsFlow(input);
}
