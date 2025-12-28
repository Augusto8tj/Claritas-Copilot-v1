
'use server';

/**
 * @fileOverview An AI flow that generates a "council" of trading robots by providing executable rules, not just votes.
 * This version is optimized for a single, high-value API call to respect rate limits.
 * It now acts as a "Dynamic Calibrator", optimizing robot parameters for the given time horizon.
 * 
 * - getStrategyCouncil - The main flow function that orchestrates the phased assembly.
 */

import { ai } from '@/lib/genkit';
import { z } from 'zod';
import { StrategyCouncilInputSchema, StrategyCouncilOutputSchema, type StrategyCouncilInput, type StrategyCouncilOutput } from './strategy-council-flow.types';

// This new, single prompt builds the ENTIRE council at once and calibrates it for the time horizon.
const strategyCouncilArchitectPrompt = ai.definePrompt({
    name: 'strategyCouncilArchitectPrompt',
    input: { schema: StrategyCouncilInputSchema },
    output: { schema: StrategyCouncilOutputSchema }, // Expect the full council output
    system: `Você é um arquiteto-chefe de estratégias quantitativas. Sua missão é criar as REGRAS para um conselho completo de 10 robôs-analistas especialistas, cada um com uma filosofia de trading única, **calibrados para um horizonte de tempo específico.**

Você deve escolher 10 estratégias da lista disponível para montar o conselho mais diversificado e eficaz para o contexto. A lista de estratégias disponíveis é: 'RSI', 'STOCHASTIC', 'MACD_CROSS', 'MOVING_AVERAGE_CROSS', 'BOLLINGER_BANDS', 'ADX_TREND', 'ICHIMOKU_CLOUD', 'AWESOME_OSCILLATOR', 'PRICE_ACTION_PATTERN', 'VOLUME_PROFILE', 'KAMA', 'VWAP', 'Z_SCORE', 'STOCH_RSI', 'MFI', 'TRIX', 'ROC', 'DONCHIAN_CHANNELS'.

A sua resposta DEVE SER um único objeto JSON que valida contra o schema de saída, contendo uma chave "council" com um array de EXATAMENTE 10 objetos de robôs.

Para CADA robô, você deve:
1.  **Definir um ID único**: Ex: 'RSI_BOT_1'.
2.  **Calibrar Parâmetros e Limiares para o Horizonte de Tempo**: Com base no 'durationUnit' fornecido (ex: 't' para ticks, 'm' para minutos), ajuste os parâmetros. Para 'ticks', use períodos mais curtos e agressivos. Para 'minutos' ou 'horas', use períodos mais longos e conservadores. Defina DOIS níveis de limiar (FORTE e FRACO).
    - Exemplo para RSI em 'ticks': 'strongBuyThreshold': 25, 'weakBuyThreshold': 35. 'period': 10.
    - Exemplo para RSI em 'minutos': 'strongBuyThreshold': 20, 'weakBuyThreshold': 30. 'period': 14.
3.  **Definir Níveis de Confiança Numéricos**: 'strongConfidence' deve ser alto (ex: 90-100). 'weakConfidence' deve ser moderado (ex: 60-75).
4.  **Justificar a Calibração**: Forneça uma justificativa muito breve (1 frase) para a escolha dos parâmetros de cada robô, mencionando o horizonte de tempo ('{{{durationUnit}}}'). Ex: "Parâmetros de RSI mais longos (14) para filtrar o ruído em operações de minutos."
5.  **Gestão de Risco**:
    - Defina 'suggestedStake' como 1% da banca do dia ('balance').
    - Defina 'suggestedDuration' na unidade 'durationUnit' fornecida.`,
    prompt: `
Crie o conselho completo de 10 robôs-analistas para o ativo {{{symbol}}}, otimizados para operar em um horizonte de tempo de '{{{durationUnit}}}'.

Dados de Mercado (para análise de condição):
\'\'\'json
{{{historicalDataJson}}}
\'\'\'

Contexto do Trader:
- Banca do Dia (para gestão de risco): {{{balance}}} {{{currency}}}
`
});


// The main flow now orchestrates the single, powerful call.
const getStrategyCouncilFlow = ai.defineFlow(
  {
    name: 'getStrategyCouncilFlow',
    inputSchema: StrategyCouncilInputSchema,
    outputSchema: StrategyCouncilOutputSchema,
  },
  async (input) => {
    
    console.log(`[Council Flow] Iniciando a construção do conselho calibrado para '${input.durationUnit}'...`);

    // Correctly invoke the prompt as a function
    const { output } = await ai.generate({
        model: 'googleai/gemini-2.5-flash-lite',
        prompt: strategyCouncilArchitectPrompt.prompt,
        input: input,
        output: { schema: StrategyCouncilOutputSchema },
        config: {
            temperature: 0.8, // Aumenta a criatividade para a IA escolher e calibrar
        }
    });

    if (!output || !output.council || output.council.length < 10) {
        throw new Error(`A montagem do conselho falhou. A IA não retornou os 10 robôs esperados.`);
    }
    
    // Ensure minimum stake is respected for every robot in the council
    output.council.forEach(robot => {
        if (robot.suggestedStake < 0.35) {
            robot.suggestedStake = 0.35;
        }
    });

    console.log('[Council Flow] Conselho de 10 robôs calibrado e montado com sucesso!');
    return output;
  }
);

export async function getStrategyCouncil(input: StrategyCouncilInput): Promise<StrategyCouncilOutput> {
  return getStrategyCouncilFlow(input);
}
