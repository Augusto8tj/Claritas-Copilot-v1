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
  system: `Você é um gestor de fundos quantitativos. Sua tarefa é criar um CONSELHO de 7 robôs-analistas de trading para o ativo solicitado. Cada robô deve ter uma estratégia simples e distinta, com parâmetros otimizados para as condições de mercado atuais (extraídas dos dados históricos).

As 7 estratégias disponíveis são:
1.  **RSI**: Baseada no Índice de Força Relativa.
2.  **STOCHASTIC**: Baseada no Oscilador Estocástico.
3.  **MOVING_AVERAGE_CROSS**: Baseada no cruzamento de duas médias móveis (uma curta e uma longa).
4.  **BOLLINGER_BANDS**: Baseada no preço tocando as bandas superior ou inferior de Bollinger.
5.  **MACD_CROSS**: Baseada no cruzamento da linha MACD com a sua linha de sinal.
6.  **PRICE_ACTION_PATTERN**: Baseada em padrões de candlestick (Martelo, Estrela Cadente).
7.  **ADX_TREND**: Baseada na força da tendência indicada pelo ADX.

Para cada robô, você deve:
1.  **Escolher UMA das 7 estratégias** (sem repetir).
2.  **Definir os Parâmetros**:
    - Para RSI e STOCHASTIC: defina os limiares de compra ('buyThreshold', e.g., 30) e venda ('sellThreshold', e.g., 70).
    - Para MOVING_AVERAGE_CROSS: defina os períodos da média curta ('shortPeriod') e longa ('longPeriod').
    - Para BOLLINGER_BANDS: defina o período ('period') e o desvio padrão ('stdDev').
    - Para MACD_CROSS: defina os períodos ('fastPeriod', 'slowPeriod', 'signalPeriod').
    - Para PRICE_ACTION_PATTERN: defina o padrão a ser observado ('pattern').
    - Para ADX_TREND: defina o limiar de força da tendência ('trendStrengthThreshold').
3.  **Justificar a Escolha**: Forneça uma justificativa muito breve (1 frase) para a escolha da estratégia e dos parâmetros, com base nos dados históricos.
4.  **Gestão de Risco**: Defina 'suggestedStake' como 1% da banca do dia ('balance') e 'suggestedDuration' como 5 ticks para todos os robôs.

A saída deve ser um array chamado 'council' contendo exatamente 7 objetos, um para cada robô, cobrindo todas as 7 estratégias.`,
  prompt: `
Crie um conselho de 7 robôs para o ativo {{{symbol}}}.

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
    if (!output || !output.council || output.council.length !== 7) {
        throw new Error("A IA não conseguiu gerar um conselho de robôs válido com 7 membros.");
    }

    // Ensure minimum stake is respected for every robot in the council
    output.council.forEach(robot => {
        if (robot.suggestedStake < 0.35) {
            robot.suggestedStake = 0.35;
        }
    });

    return output;
  }
);

export async function getStrategyCouncil(input: StrategyCouncilInput): Promise<StrategyCouncilOutput> {
  return getStrategyCouncilFlow(input);
}
