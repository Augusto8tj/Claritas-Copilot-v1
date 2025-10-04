'use server';

/**
 * @fileOverview An AI flow for analyzing MQL5 trading bot code and extracting its strategy.
 * 
 * - analyzeMqlCodeFlow - The main flow function.
 * - MqlAnalyzerInput - The input type for the flow.
 * - MqlAnalyzerOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const MqlAnalyzerInputSchema = z.object({
  mqlCode: z.string().describe('The MQL5 source code of a trading robot.'),
});
export type MqlAnalyzerInput = z.infer<typeof MqlAnalyzerInputSchema>;

export const MqlAnalyzerOutputSchema = z.object({
  strategyDescription: z.string().describe('A natural language description of the trading strategy extracted from the MQL5 code.'),
});
export type MqlAnalyzerOutput = z.infer<typeof MqlAnalyzerOutputSchema>;

const analyzerPrompt = ai.definePrompt({
  name: 'mqlAnalyzerPrompt',
  input: { schema: MqlAnalyzerInputSchema },
  output: { schema: MqlAnalyzerOutputSchema },
  system: `Você é um analista quantitativo sênior, especialista em traduzir código MQL5 para estratégias de trading em linguagem natural.
Sua tarefa é analisar o código MQL5 fornecido e descrever a lógica de negociação de forma clara e concisa para que possa ser usada em um sistema de backtesting.
Identifique os seguintes componentes no código:
1.  **Ativo(s) Alvo:** Qual(is) o(s) símbolo(s) o robô opera.
2.  **Capital Inicial:** Se mencionado, qual o capital inicial sugerido.
3.  **Indicadores Utilizados:** Liste todos os indicadores técnicos (ex: Médias Móveis, RSI, Bandas de Bollinger) e seus parâmetros.
4.  **Condições de Entrada (Compra):** Descreva as regras exatas que disparam uma ordem de compra.
5.  **Condições de Saída (Venda):** Descreva as regras exatas que disparam uma ordem de venda (tanto para Take Profit quanto para Stop Loss ou reversão).
Seja detalhado o suficiente para que outro sistema possa simular a estratégia com base na sua descrição.`,
  prompt: `
Analise o seguinte código de um robô de investimento em MQL5 e descreva sua estratégia em linguagem natural.

Código MQL5:
\`\`\`mql5
{{{mqlCode}}}
\`\`\`
`
});

export const analyzeMqlCodeFlow = ai.defineFlow(
  {
    name: 'analyzeMqlCodeFlow',
    inputSchema: MqlAnalyzerInputSchema,
    outputSchema: MqlAnalyzerOutputSchema,
  },
  async ({ mqlCode }) => {
    const { output } = await analyzerPrompt({ mqlCode });

    if (!output) {
      throw new Error("A IA não conseguiu analisar a estratégia do código MQL5.");
    }

    return output;
  }
);
