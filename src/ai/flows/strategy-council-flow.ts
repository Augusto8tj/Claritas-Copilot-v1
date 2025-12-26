'use server';

/**
 * @fileOverview An AI flow that generates a "council" of trading robots in a single, powerful call.
 * 
 * - getStrategyCouncil - The main flow function.
 */

import { ai } from '@/ai/genkit';
import { StrategyCouncilInputSchema, StrategyCouncilOutputSchema, type StrategyCouncilInput, type StrategyCouncilOutput } from './strategy-council-flow.types';


// This new, powerful prompt acts as a "Chief Architect", designing the entire council at once.
const councilArchitectPrompt = ai.definePrompt({
    name: 'councilArchitectPrompt',
    input: { schema: StrategyCouncilInputSchema },
    output: { schema: StrategyCouncilOutputSchema },
    system: `Você é um arquiteto-chefe de estratégias quantitativas. Sua missão é montar um CONSELHO COMPLETO de 10 robôs-analistas especialistas.

Você deve criar um robô para CADA UMA das seguintes estratégias, otimizando seus parâmetros para o ativo solicitado ('{{{symbol}}}') e o horizonte de tempo ('{{{durationUnit}}}').

Estratégias Requeridas (Crie uma para cada):
- RSI, STOCHASTIC, MOVING_AVERAGE_CROSS, BOLLINGER_BANDS, MACD_CROSS, PRICE_ACTION_PATTERN, ADX_TREND, ICHIMOKU_CLOUD, AWESOME_OSCILLATOR, VOLUME_PROFILE

Para CADA robô, você deve:
1.  **Definir um ID único**: Ex: 'RSI_BOT_1'.
2.  **Definir Parâmetros e Múltiplos Limiares de Confiança**: Preencha os parâmetros relevantes (ex: períodos de médias móveis) e defina DOIS níveis de limiar: um para um sinal FORTE e um para um sinal FRACO.
    - Exemplo para RSI: 'strongBuyThreshold': 20 (RSI muito sobrevendido), 'weakBuyThreshold': 30 (RSI sobrevendido). Faça o análogo para venda.
    - Exemplo para Bandas de Bollinger: um toque na banda é um sinal FORTE, enquanto chegar perto (ex: a 0.5 desvios padrão) é um sinal FRACO.
    - Aplique esta lógica de duplo limiar para todas as estratégias aplicáveis.
3.  **Definir Níveis de Confiança Numéricos**: Atribua um valor numérico para a confiança. 'strongConfidence' deve ser alto (ex: 90-100). 'weakConfidence' deve ser moderado (ex: 60-75).
4.  **Justificar a Escolha**: Forneça uma justificativa muito breve (1 frase) para a escolha dos parâmetros de cada robô.
5.  **Gestão de Risco**:
    - Defina 'suggestedStake' como 1% da banca do dia ('balance').
    - Defina 'suggestedDuration' na unidade 'durationUnit' fornecida.`,
    prompt: `
Crie um conselho de 10 robôs-analistas para o ativo {{{symbol}}}, otimizados para operar em '{{{durationUnit}}}'.

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
    
    console.log(`[Council Architect] Designing the entire 10-robot council in a single call...`);
    
    // A single, powerful call to the architect prompt.
    const { output } = await councilArchitectPrompt(input);

    if (!output || !output.council || output.council.length < 10) {
        throw new Error("A IA falhou em criar o conselho de robôs completo. A resposta foi inválida ou incompleta.");
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

    