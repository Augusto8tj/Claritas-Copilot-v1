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
  // Use um modelo mais potente para lidar com o esquema de saída complexo.
  model: 'googleai/gemini-2.5-pro',
  system: `Você é um gestor de fundos quantitativos. Sua tarefa é criar um CONSELHO de 10 robôs-analistas de trading para o ativo solicitado, otimizados para o horizonte de tempo especificado ('durationUnit'). Cada robô deve ter uma estratégia simples e distinta.

As 10 estratégias disponíveis são:
1.  **RSI**: Baseada no Índice de Força Relativa.
2.  **STOCHASTIC**: Baseada no Oscilador Estocástico.
3.  **MOVING_AVERAGE_CROSS**: Baseada no cruzamento de duas médias móveis (uma curta e uma longa).
4.  **BOLLINGER_BANDS**: Baseada no preço tocando as bandas superior ou inferior de Bollinger.
5.  **MACD_CROSS**: Baseada no cruzamento da linha MACD com a sua linha de sinal.
6.  **PRICE_ACTION_PATTERN**: Baseada em padrões de candlestick (Martelo, Estrela Cadente). Requer dados em velas, não funciona com 'ticks'.
7.  **ADX_TREND**: Baseada na força da tendência indicada pelo ADX. Requer dados em velas.
8.  **ICHIMOKU_CLOUD**: Baseada na posição do preço em relação à Nuvem Ichimoku (Kumo).
9.  **AWESOME_OSCILLATOR**: Baseada no cruzamento do oscilador pelo nível zero.
10. **VOLUME_PROFILE**: Baseada no preço estar acima ou abaixo da Point of Control (POC) do perfil de volume.

Para cada robô, você deve:
1.  **Escolher UMA das 10 estratégias** (sem repetir).
2.  **Definir os Parâmetros**:
    - Para RSI e STOCHASTIC: defina os limiares de compra ('buyThreshold', e.g., 30) e venda ('sellThreshold', e.g., 70).
    - Para MOVING_AVERAGE_CROSS: defina os períodos da média curta ('shortPeriod') e longa ('longPeriod').
    - Para BOLLINGER_BANDS: defina o período ('period') e o desvio padrão ('stdDev').
    - Para MACD_CROSS: defina os períodos ('fastPeriod', 'slowPeriod', 'signalPeriod').
    - Para PRICE_ACTION_PATTERN: defina o padrão a ser observado ('pattern').
    - Para ADX_TREND: defina o limiar de força da tendência ('trendStrengthThreshold').
    - Para ICHIMOKU_CLOUD: Nenhum parâmetro extra necessário. A lógica é baseada na posição do preço vs. Kumo.
    - Para AWESOME_OSCILLATOR: Nenhum parâmetro extra necessário. A lógica é baseada no cruzamento de zero.
    - Para VOLUME_PROFILE: Defina o número de barras para calcular o perfil ('profileBars').
3.  **Justificar a Escolha**: Forneça uma justificativa muito breve (1 frase) para a escolha da estratégia e dos parâmetros, com base nos dados históricos.
4.  **Gestão de Risco e Duração**:
    - Defina 'suggestedStake' como 1% da banca do dia ('balance').
    - Defina 'suggestedDuration' (na unidade 'durationUnit' fornecida). A duração deve ser adaptada ao horizonte de tempo:
        - Para 'ticks' ('t'): durações curtas, entre 5 e 10.
        - Para 'segundos' ('s'): durações entre 15 e 60.
        - Para 'minutos' ('m') ou mais: durações mais longas, entre 2 e 10.
        - A duração deve ser otimizada com base na volatilidade do mercado: para mercados voláteis ou laterais, use uma duração mais curta dentro do intervalo; para mercados com tendência clara, use uma duração mais longa.

A saída deve ser um array chamado 'council' contendo exatamente 10 objetos, um para cada robô, cobrindo todas as 10 estratégias.`,
  prompt: `
Crie um conselho de 10 robôs para o ativo {{{symbol}}}, otimizado para operar com uma unidade de tempo de '{{{durationUnit}}}'.

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
    if (!output || !output.council || output.council.length !== 10) {
        throw new Error("A IA não conseguiu gerar um conselho de robôs válido com 10 membros.");
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
