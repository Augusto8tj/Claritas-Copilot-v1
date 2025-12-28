
'use server';

/**
 * @fileOverview An AI flow that generates a "council" of trading robots by providing executable rules, not just votes.
 * This version is optimized for a single, high-value API call to respect rate limits.
 * 
 * - getStrategyCouncil - The main flow function that orchestrates the phased assembly.
 */

import { ai } from '@/lib/genkit';
import { z } from 'zod';
import { StrategyCouncilInputSchema, StrategyCouncilOutputSchema, type StrategyCouncilInput, type StrategyCouncilOutput } from './strategy-council-flow.types';

// This new, single prompt builds the ENTIRE council at once.
const strategyCouncilArchitectPrompt = ai.definePrompt({
    name: 'strategyCouncilArchitectPrompt',
    model: 'googleai/gemini-2.5-flash-lite', // Use the model with a higher RPM limit.
    input: { schema: StrategyCouncilInputSchema },
    output: { schema: StrategyCouncilOutputSchema }, // Expect the full council output
    system: `Você é um arquiteto-chefe de estratégias quantitativas. Sua missão é criar as REGRAS para um conselho completo de 10 robôs-analistas especialistas, cada um com uma filosofia de trading única.

Você deve criar um robô para CADA UMA das 10 estratégias a seguir: 'RSI', 'STOCHASTIC', 'MACD_CROSS', 'MOVING_AVERAGE_CROSS', 'BOLLINGER_BANDS', 'ADX_TREND', 'ICHIMOKU_CLOUD', 'AWESOME_OSCILLATOR', 'PRICE_ACTION_PATTERN', 'VOLUME_PROFILE'.

A sua resposta DEVE SER um único objeto JSON que valida contra o schema de saída, contendo uma chave "council" com um array de EXATAMENTE 10 objetos de robôs.

Para CADA robô, você deve:
1.  **Definir um ID único**: Ex: 'RSI_BOT_1'.
2.  **Definir Parâmetros e Múltiplos Limiares de Confiança**: Preencha os parâmetros relevantes (ex: períodos de médias móveis) e defina DOIS níveis de limiar para compra e venda: um para um sinal FORTE e um para um sinal FRACO.
    - Exemplo para RSI: 'strongBuyThreshold': 20 (RSI muito sobrevendido), 'weakBuyThreshold': 30 (RSI sobrevendido). 'strongSellThreshold': 80, 'weakSellThreshold': 70.
    - Aplique esta lógica de duplo limiar para todas as estratégias aplicáveis. É OBRIGATÓRIO fornecer estes 4 valores para RSI e Stochastic.
3.  **Definir Níveis de Confiança Numéricos**: Atribua um valor numérico para a confiança. 'strongConfidence' deve ser alto (ex: 90-100). 'weakConfidence' deve ser moderado (ex: 60-75).
4.  **Justificar a Escolha**: Forneça uma justificativa muito breve (1 frase) para a escolha dos parâmetros de cada robô, considerando o ativo ('{{{symbol}}}') e o horizonte de tempo ('{{{durationUnit}}}').
5.  **Gestão de Risco**:
    - Defina 'suggestedStake' como 1% da banca do dia ('balance').
    - Defina 'suggestedDuration' na unidade 'durationUnit' fornecida.`,
    prompt: `
Crie o conselho completo de 10 robôs-analistas para o ativo {{{symbol}}}, otimizados para operar em '{{{durationUnit}}}'.

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
    
    console.log('[Council Flow] Iniciando a construção do conselho com um único pedido à IA...');

    // Correctly invoke the prompt as a function
    const { output } = await strategyCouncilArchitectPrompt(input);

    if (!output || !output.council || output.council.length < 10) {
        throw new Error(`A montagem do conselho falhou. A IA não retornou os 10 robôs esperados.`);
    }
    
    // Ensure minimum stake is respected for every robot in the council
    output.council.forEach(robot => {
        if (robot.suggestedStake < 0.35) {
            robot.suggestedStake = 0.35;
        }
    });

    console.log('[Council Flow] Conselho de 10 robôs montado com sucesso numa única chamada!');
    return output;
  }
);

export async function getStrategyCouncil(input: StrategyCouncilInput): Promise<StrategyCouncilOutput> {
  return getStrategyCouncilFlow(input);
}
