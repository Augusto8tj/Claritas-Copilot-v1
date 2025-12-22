'use server';

/**
 * @fileOverview An AI flow that generates a "council" of trading robots.
 * 
 * - getStrategyCouncil - The main flow function.
 */

import { ai } from '@/ai/genkit';
import { StrategyCouncilInputSchema, StrategyCouncilOutputSchema, type StrategyCouncilInput, type StrategyCouncilOutput } from './strategy-council-flow.types';

const councilPrompt = ai.definePrompt({
  name: 'strategyCouncilPrompt',
  input: { schema: StrategyCouncilInputSchema },
  output: { schema: StrategyCouncilOutputSchema },
  system: `Você é um gestor de fundos quantitativos. Sua tarefa é criar um CONSELHO de 3 robôs-analistas de trading para o ativo solicitado. Cada robô deve ter uma estratégia simples e distinta, com parâmetros otimizados para as condições de mercado atuais (extraídas dos dados históricos).

As estratégias disponíveis são:
1.  **RSI**: Baseada no Índice de Força Relativa.
2.  **STOCHASTIC**: Baseada no Oscilador Estocástico.
3.  **MOVING_AVERAGE_CROSS**: Baseada no cruzamento de duas médias móveis (uma curta e uma longa).

Para cada robô, você deve:
1.  **Escolher UMA das estratégias** (sem repetir).
2.  **Definir os Parâmetros**:
    - Para RSI e STOCHASTIC: defina os limiares de compra ('buyThreshold', e.g., 30) e venda ('sellThreshold', e.g., 70).
    - Para MOVING_AVERAGE_CROSS: defina os períodos da média curta ('shortPeriod', e.g., 5) e da longa ('longPeriod', e.g., 20).
3.  **Justificar a Escolha**: Forneça uma justificativa muito breve para a escolha da estratégia e dos parâmetros, com base nos dados históricos (ex: "Mercado volátil, RSI com limiares mais amplos é ideal.").
4.  **Gestão de Risco**: Defina 'suggestedStake' como 1% da banca do dia ('balance') e 'suggestedDuration' como 5 ticks.

A saída deve ser um array chamado 'council' contendo exatamente 3 objetos, um para cada robô (RSI, STOCHASTIC, e MOVING_AVERAGE_CROSS).`,
  prompt: `
Crie um conselho de robôs para o ativo {{{symbol}}}.

Dados de Mercado (para análise de condição):
\'\'\'json
{{{historicalDataJson}}}
\'\'\'

Contexto do Trader:
- Banca do Dia (para gestão de risco): {{{balance}}} {{{currency}}}
`
});

const getStrategyCouncilFlow = ai.defineFlow(
  {
    name: 'getStrategyCouncilFlow',
    inputSchema: StrategyCouncilInputSchema,
    outputSchema: StrategyCouncilOutputSchema,
  },
  async (input) => {
    const { output } = await councilPrompt(input);
    if (!output || !output.council || output.council.length !== 3) {
        throw new Error("A IA não conseguiu gerar um conselho de robôs válido.");
    }
    return output;
  }
);

export async function getStrategyCouncil(input: StrategyCouncilInput): Promise<StrategyCouncilOutput> {
  return getStrategyCouncilFlow(input);
}
