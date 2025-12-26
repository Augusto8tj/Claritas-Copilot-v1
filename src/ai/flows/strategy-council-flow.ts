
'use server';

/**
 * @fileOverview An AI flow that generates a "council" of trading robots by progressively building them in themed batches.
 * 
 * - getStrategyCouncil - The main flow function that orchestrates the phased assembly.
 */

import { ai, pro } from '@/ai/genkit';
import { z } from 'zod';
import { StrategyCouncilInputSchema, StrategyCouncilOutputSchema, RobotStrategySchema, type StrategyCouncilInput, type StrategyCouncilOutput, type RobotStrategy } from './strategy-council-flow.types';

// Schema for the smaller, focused prompt
const RobotAnalystGeneratorInputSchema = StrategyCouncilInputSchema.extend({
    strategiesToBuild: z.array(z.string()).describe("The specific list of strategy types to build in this batch.")
});

const RobotAnalystGeneratorOutputSchema = z.object({
    robots: z.array(RobotStrategySchema).describe("An array of the generated robot analysts for the requested strategies.")
});


// This new, more focused prompt builds a SUBSET of robots at a time.
const robotAnalystGeneratorPrompt = ai.definePrompt({
    name: 'robotAnalystGeneratorPrompt',
    input: { schema: RobotAnalystGeneratorInputSchema },
    output: { schema: RobotAnalystGeneratorOutputSchema },
    system: `Você é um arquiteto-chefe de estratégias quantitativas. Sua missão é montar um grupo de robôs-analistas especialistas.

Você deve criar um robô para CADA UMA das estratégias solicitadas em 'strategiesToBuild', otimizando seus parâmetros para o ativo ('{{{symbol}}}') e o horizonte de tempo ('{{{durationUnit}}}').

Para CADA robô, você deve:
1.  **Definir um ID único**: Ex: 'RSI_BOT_1'.
2.  **Definir Parâmetros e Múltiplos Limiares de Confiança**: Preencha os parâmetros relevantes (ex: períodos de médias móveis) e defina DOIS níveis de limiar: um para um sinal FORTE e um para um sinal FRACO.
    - Exemplo para RSI: 'strongBuyThreshold': 20 (RSI muito sobrevendido), 'weakBuyThreshold': 30 (RSI sobrevendido). Faça o análogo para venda.
    - Aplique esta lógica de duplo limiar para todas as estratégias aplicáveis.
3.  **Definir Níveis de Confiança Numéricos**: Atribua um valor numérico para a confiança. 'strongConfidence' deve ser alto (ex: 90-100). 'weakConfidence' deve ser moderado (ex: 60-75).
4.  **Justificar a Escolha**: Forneça uma justificativa muito breve (1 frase) para a escolha dos parâmetros de cada robô.
5.  **Gestão de Risco**:
    - Defina 'suggestedStake' como 1% da banca do dia ('balance').
    - Defina 'suggestedDuration' na unidade 'durationUnit' fornecida.`,
    prompt: `
Crie um grupo de robôs-analistas para o ativo {{{symbol}}}, otimizados para operar em '{{{durationUnit}}}'.

Estratégias para construir nesta etapa: {{json anystyle=true strategiesToBuild}}

Dados de Mercado (para análise de condição):
\'\'\'json
{{{historicalDataJson}}}
\'\'\'

Contexto do Trader:
- Banca do Dia (para gestão de risco): {{{balance}}} {{{currency}}}
`
});


// The main flow now orchestrates the progressive assembly of the council.
const getStrategyCouncilFlow = ai.defineFlow(
  {
    name: 'getStrategyCouncilFlow',
    inputSchema: StrategyCouncilInputSchema,
    outputSchema: StrategyCouncilOutputSchema,
  },
  async (input) => {
    
    console.log('[Council Flow] Iniciando a montagem progressiva do conselho...');
    const allRobots: RobotStrategy[] = [];

    // Define the batches of strategies to build
    const strategyBatches = [
        ['RSI', 'STOCHASTIC', 'MACD_CROSS'],
        ['MOVING_AVERAGE_CROSS', 'BOLLINGER_BANDS', 'ADX_TREND'],
        ['ICHIMOKU_CLOUD', 'AWESOME_OSCILLATOR', 'PRICE_ACTION_PATTERN', 'VOLUME_PROFILE']
    ];

    for (const batch of strategyBatches) {
        console.log(`[Council Flow] Construindo o lote de analistas: ${batch.join(', ')}`);
        
        const batchInput = { ...input, strategiesToBuild: batch };

        const { output } = await ai.generate({
            model: pro, // Use the powerful model for each focused task
            prompt: robotAnalystGeneratorPrompt,
            input: batchInput,
            output: { schema: RobotAnalystGeneratorOutputSchema },
        });

        if (!output || !output.robots || output.robots.length === 0) {
            throw new Error(`A IA falhou em gerar o lote de robôs: ${batch.join(', ')}.`);
        }
        
        allRobots.push(...output.robots);
        console.log(`[Council Flow] Lote concluído. Total de robôs montados: ${allRobots.length}`);
    }


    if (allRobots.length < 10) {
        throw new Error(`A montagem do conselho falhou. Apenas ${allRobots.length} de 10 robôs foram criados.`);
    }
    
    // Ensure minimum stake is respected for every robot in the council
    allRobots.forEach(robot => {
        if (robot.suggestedStake < 0.35) {
            robot.suggestedStake = 0.35;
        }
    });

    console.log('[Council Flow] Conselho de 10 robôs montado com sucesso!');
    return { council: allRobots };
  }
);

export async function getStrategyCouncil(input: StrategyCouncilInput): Promise<StrategyCouncilOutput> {
  return getStrategyCouncilFlow(input);
}
