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

// This new prompt is an expert in creating ONE specific robot, now with confidence levels.
const robotSpecialistPrompt = ai.definePrompt({
    name: 'robotSpecialistPrompt',
    input: { schema: RobotSpecialistInputSchema },
    output: { schema: RobotStrategySchema },
    system: `Você é um analista quantitativo sênior, especialista em criar UM robô-analista de trading para a estratégia específica solicitada, com múltiplos níveis de confiança.

A sua tarefa é criar UM robô para o ativo solicitado, otimizado para o horizonte de tempo ('durationUnit'), usando a estratégia: {{{strategyType}}}.

Para o robô solicitado, você deve:
1.  **Definir Parâmetros e Limiares de Confiança**: Preencha os parâmetros relevantes para a estratégia '{{{strategyType}}}' e defina dois níveis de limiar: um para um sinal FORTE e um para um sinal FRACO.
    - Para RSI/STOCHASTIC: defina 'strongBuyThreshold' (ex: RSI < 20) e 'weakBuyThreshold' (ex: RSI < 30). Faça o mesmo para os limiares de venda ('strongSellThreshold' e 'weakSellThreshold').
    - Para MOVING_AVERAGE_CROSS: Um cruzamento é um sinal FORTE. Um sinal FRACO pode ser o preço cruzando acima/abaixo da média longa.
    - Para BOLLINGER_BANDS: Tocar a banda é um sinal FORTE. Aproximar-se dela (ex: dentro de 0.5 desvios padrão) é um sinal FRACO.
    - Para MACD_CROSS: O cruzamento da linha MACD com a linha de sinal é um sinal FORTE. Apenas a linha MACD cruzar o nível zero é um sinal FRACO.
    - ...e assim por diante para as outras estratégias.
2.  **Definir Níveis de Confiança**: Atribua um valor numérico para a confiança. 'strongConfidence' deve ser alto (ex: 90-100). 'weakConfidence' deve ser moderado (ex: 60-75).
3.  **Justificar a Escolha**: Forneça uma justificativa muito breve (1 frase) para a escolha dos parâmetros.
4.  **Gestão de Risco e Duração**:
    - Defina 'suggestedStake' como 1% da banca do dia ('balance').
    - Defina 'suggestedDuration' (na unidade 'durationUnit' fornecida).`,
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
    
    const council: RobotStrategy[] = [];

    // Create robots sequentially to avoid hitting API rate limits.
    for (const strategyType of STRATEGY_TYPES) {
        console.log(`[Council] Creating specialist: ${strategyType}...`);
        const specialistInput = { ...input, strategyType };
        const result = await robotSpecialistPrompt(specialistInput);

        if (!result.output) {
            throw new Error(`A IA falhou em criar o robô especialista: ${strategyType}.`);
        }
        council.push(result.output);
    }
    
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
