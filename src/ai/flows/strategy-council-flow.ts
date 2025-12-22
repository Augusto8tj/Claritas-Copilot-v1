'use server';

/**
 * @fileOverview An AI flow that generates a "council" of trading robots.
 * 
 * - getStrategyCouncil - The main flow function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { StrategyCouncilInputSchema, StrategyCouncilOutputSchema, RobotStrategySchema, type StrategyCouncilInput, type StrategyCouncilOutput, type RobotStrategy } from './strategy-council-flow.types';


const STRATEGY_TYPES: RobotStrategy['strategyType'][] = [
    'RSI', 
    'STOCHASTIC', 
    'MOVING_AVERAGE_CROSS',
    'BOLLINGER_BANDS',
    'MACD_CROSS',
    'PRICE_ACTION_PATTERN',
    'ADX_TREND',
    'ICHIMOKU_CLOUD',
    'AWESOME_OSCILLATOR',
    'VOLUME_PROFILE'
];


const RobotSpecialistInputSchema = StrategyCouncilInputSchema.extend({
    strategyType: RobotStrategySchema.shape.strategyType,
});

// This new prompt is an expert in creating ONE specific robot.
const robotSpecialistPrompt = ai.definePrompt({
    name: 'robotSpecialistPrompt',
    input: { schema: RobotSpecialistInputSchema },
    output: { schema: RobotStrategySchema },
    model: 'googleai/gemini-2.5-pro',
    system: `Você é um analista quantitativo sênior, especialista em criar UM robô-analista de trading para a estratégia específica solicitada.

A sua tarefa é criar UM robô para o ativo solicitado, otimizado para o horizonte de tempo ('durationUnit'), usando a estratégia: {{{strategyType}}}.

Estratégias Disponíveis:
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

Para o robô solicitado, você deve:
1.  **Definir os Parâmetros**: Preencha APENAS os parâmetros relevantes para a estratégia '{{{strategyType}}}'.
    - Para RSI e STOCHASTIC: defina 'buyThreshold' e 'sellThreshold'.
    - Para MOVING_AVERAGE_CROSS: defina 'shortPeriod' e 'longPeriod'.
    - Para BOLLINGER_BANDS: defina 'period' e 'stdDev'.
    - Para MACD_CROSS: defina 'fastPeriod', 'slowPeriod', 'signalPeriod'.
    - Para PRICE_ACTION_PATTERN: defina o 'pattern'.
    - Para ADX_TREND: defina 'trendStrengthThreshold'.
    - Para VOLUME_PROFILE: Defina 'profileBars'.
    - ICHIMOKU_CLOUD & AWESOME_OSCILLATOR não têm parâmetros extras.
2.  **Justificar a Escolha**: Forneça uma justificativa muito breve (1 frase) para a escolha dos parâmetros, com base nos dados históricos.
3.  **Gestão de Risco e Duração**:
    - Defina 'suggestedStake' como 1% da banca do dia ('balance').
    - Defina 'suggestedDuration' (na unidade 'durationUnit' fornecida). A duração deve ser adaptada ao horizonte de tempo:
        - Para 'ticks' ('t'): durações curtas, entre 5 e 10.
        - Para 'segundos' ('s'): durações entre 15 e 60.
        - Para 'minutos' ('m') ou mais: durações mais longas, entre 2 e 10.
        - A duração deve ser otimizada com base na volatilidade do mercado.`,
    prompt: `
Crie um robô especialista na estratégia {{{strategyType}}} para o ativo {{{symbol}}}, otimizado para operar com uma unidade de tempo de '{{{durationUnit}}}'.

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
    
    // "Divide and Conquer": Create a promise for each robot specialist.
    const robotPromises = STRATEGY_TYPES.map(strategyType => {
        const specialistInput = { ...input, strategyType };
        return robotSpecialistPrompt(specialistInput);
    });

    // Wait for all specialists to be created in parallel.
    const results = await Promise.all(robotPromises);

    const council: RobotStrategy[] = results.map(result => {
        if (!result.output) {
            // This is a safeguard, but with the new approach, it's less likely to happen.
            throw new Error(`A IA falhou em criar um dos robôs especialistas.`);
        }
        return result.output;
    });

    if (council.length !== 10) {
        throw new Error("O conselho não foi formado com os 10 membros necessários.");
    }
    
    // Ensure minimum stake is respected for every robot in the council
    council.forEach(robot => {
        if (robot.suggestedStake < 0.35) {
            robot.suggestedStake = 0.35;
        }
    });

    return { council };
  }
);

export async function getStrategyCouncil(input: StrategyCouncilInput): Promise<StrategyCouncilOutput> {
  return getStrategyCouncilFlow(input);
}
