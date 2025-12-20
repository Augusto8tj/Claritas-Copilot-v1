'use server';

/**
 * @fileOverview An AI flow that defines a simple, executable trading strategy for an autopilot system.
 * 
 * - getAutotraderStrategy - The main flow function.
 */

import { ai } from '@/ai/genkit';
import { AutoTraderStrategyInputSchema, AutoTraderStrategyOutputSchema, type AutoTraderStrategyInput, type AutoTraderStrategyOutput } from './auto-trader-strategy-flow.types';


const strategyPrompt = ai.definePrompt({
  name: 'autoTraderStrategyPrompt',
  input: { schema: AutoTraderStrategyInputSchema },
  output: { schema: AutoTraderStrategyOutputSchema },
  system: `Você é um analista quantitativo que cria estratégias de trading simples e automatizáveis.
Sua tarefa é analisar o contexto do trader e os dados de preço para definir UMA regra de negociação clara, incluindo gestão de risco.

Estratégias Disponíveis:
1.  **RSI_BASIC**: Negociar com base no Índice de Força Relativa (RSI).
    - Se a tendência geral for de alta, sugira comprar (RISE) quando o RSI cair abaixo de 30.
    - Se a tendência geral for de baixa, sugira vender (FALL) quando o RSI subir acima de 70.
2.  **STOCH_BASIC**: Negociar com base no Oscilador Estocástico.
    - Se a tendência geral for de alta, sugira comprar (RISE) quando o Estocástico cair abaixo de 20.
    - Se a tendência geral for de baixa, sugira vender (FALL) quando o Estocástico subir acima de 80.

Sua Análise:
1.  Determine a tendência principal dos dados de preço (alta, baixa, lateral).
2.  Escolha a estratégia mais apropriada (RSI ou Estocástica).
3.  Defina o limiar (threshold) e a direção (direction) da negociação.
4.  **Gestão de Risco (Obrigatório):**
    - **suggestedStake:** Calcule um valor de aposta seguro. Use 1% do saldo da conta como padrão. Se a tendência for muito clara e forte, pode aumentar para 2%. Se o mercado estiver lateral ou incerto, reduza para 0.5%.
    - **suggestedDuration:** Defina a duração em ticks. Para mercados voláteis, use uma duração mais curta (5 ticks). Para mercados com tendência clara, use uma duração mais longa (7-10 ticks).
5.  Forneça uma justificativa muito breve para a escolha da estratégia.`,
  prompt: `
Analise os seguintes dados de preço para o ativo {{{symbol}}} e defina uma estratégia de piloto automático completa.

Dados de Preço Recentes (JSON):
\'\'\'json
{{{historicalDataJson}}}
\'\'\'

Contexto do Trader:
- Saldo: {{{balance}}} {{{currency}}}
- Aposta Padrão (para referência, não usar): {{{stake}}}
- Duração Padrão (para referência, não usar): {{{duration}}} {{{durationUnit}}}
`
});


// Define the Flow
const getAutotraderStrategyFlow = ai.defineFlow(
  {
    name: 'getAutotraderStrategyFlow',
    inputSchema: AutoTraderStrategyInputSchema,
    outputSchema: AutoTraderStrategyOutputSchema,
  },
  async (input) => {
    
    const historicalDataJson = JSON.stringify(input.historicalData);
    const recentTradesJson = JSON.stringify(input.recentTrades);

    const promptInput = {
      ...input,
      historicalDataJson,
      recentTrades: recentTradesJson,
    };

    const { output } = await strategyPrompt(promptInput);
    if (!output) throw new Error("A IA não conseguiu definir uma estratégia para o piloto automático.");
    
    // Garante que o stake não seja menor que o mínimo permitido (0.35)
    if (output.suggestedStake < 0.35) {
      output.suggestedStake = 0.35;
    }
    
    return output;
  }
);

// Export a wrapper function
export async function getAutotraderStrategy(input: AutoTraderStrategyInput): Promise<AutoTraderStrategyOutput> {
    return getAutotraderStrategyFlow(input);
}
