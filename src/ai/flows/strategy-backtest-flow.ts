'use server';

/**
 * @fileOverview An AI flow for backtesting a trading strategy described by the user.
 * 
 * - runStrategyBacktest - The main flow function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getHistoricalDataTool } from '../tools/trading-tools';
import { StrategyBacktestInputSchema, StrategyBacktestOutputSchema, type StrategyBacktestInput } from './strategy-backtest-flow.types';


// 1. Novo prompt focado em extrair parâmetros da estratégia
const strategyParsingPrompt = ai.definePrompt({
  name: 'strategyParsingPrompt',
  input: { schema: z.object({ strategyDescription: z.string() }) },
  output: {
    schema: z.object({
      initialCapital: z.number().describe("O capital inicial para a simulação. Padrão: 10000 se não especificado."),
      buyConditions: z.string().describe("Descrição clara e simples das condições de compra."),
      sellConditions: z.string().describe("Descrição clara e simples das condições de venda (take profit ou stop loss)."),
    }),
  },
  system: `Você é um analista quantitativo especialista em traduzir estratégias de trading de linguagem natural para parâmetros estruturados. Analise a descrição do usuário e extraia o capital inicial, as condições de compra e as condições de venda. Seja conciso e direto.`,
  prompt: `Analise a seguinte estratégia: {{{strategyDescription}}}`,
});

// 2. O prompt principal agora recebe os dados e a estratégia JÁ ESTRUTURADA
const backtestAnalysisPrompt = ai.definePrompt({
  name: 'backtestAnalysisPrompt',
  input: {
    schema: z.object({
      simulationResult: z.object({
        initialBalance: z.number(),
        finalBalance: z.number(),
        totalProfitLoss: z.number(),
        totalProfitLossPercent: z.number(),
        trades: z.number(),
      }),
      strategy: z.any(),
    }),
  },
  output: { schema: StrategyBacktestOutputSchema },
  system: `Você é um analista financeiro sênior. Sua tarefa é analisar os resultados de um backtest e fornecer um resumo claro e conciso em português. Destaque os pontos mais importantes como lucro/prejuízo e número de negociações.`,
  prompt: `
Análise da Estratégia:
- Condições de Compra: {{{strategy.buyConditions}}}
- Condições de Venda: {{{strategy.sellConditions}}}

Resultados da Simulação:
- Balanço Inicial: {{{simulationResult.initialBalance}}}
- Balanço Final: {{{simulationResult.finalBalance}}}
- Lucro/Prejuízo Total: {{{simulationResult.totalProfitLoss}}} ({{simulationResult.totalProfitLossPercent}}%)
- Número de Negociações: {{{simulationResult.trades}}}

Com base nisso, forneça um resumo analítico dos resultados.
`
});


// 3. Lógica de simulação movida para o código
function runSimulation(
    historicalData: any[],
    strategyParams: { initialCapital: number; buyConditions: string; sellConditions: string }
) {
    let balance = strategyParams.initialCapital;
    let trades = 0;
    let position = 0; // Quantidade de ativos em posse
    let buyPrice = 0;

    // Simulação de lógica de cruzamento de médias móveis (exemplo simplificado)
    const usesMovingAverageCrossover = strategyParams.buyConditions.toLowerCase().includes('média móvel');

    if (usesMovingAverageCrossover) {
        // Simplesmente simulamos algumas negociações para fins de demonstração
        for (let i = 20; i < historicalData.length; i += 40) { // Compra a cada ~2 meses
            if (balance > historicalData[i].price) {
                const quantityToBuy = Math.floor(balance / historicalData[i].price);
                position = quantityToBuy;
                buyPrice = historicalData[i].price;
                balance -= quantityToBuy * buyPrice;
                trades++;
                
                // Vende ~1 mês depois
                const sellIndex = i + 20;
                if(sellIndex < historicalData.length) {
                    balance += position * historicalData[sellIndex].price;
                    position = 0;
                    trades++;
                }
            }
        }
    }
    // Se a posição ainda estiver aberta no final, liquida pelo último preço
    if (position > 0) {
        balance += position * historicalData[historicalData.length - 1].price;
    }

    const totalProfitLoss = balance - strategyParams.initialCapital;
    const totalProfitLossPercent = (totalProfitLoss / strategyParams.initialCapital) * 100;

    return {
        initialBalance: strategyParams.initialCapital,
        finalBalance: parseFloat(balance.toFixed(2)),
        totalProfitLoss: parseFloat(totalProfitLoss.toFixed(2)),
        totalProfitLossPercent: parseFloat(totalProfitLossPercent.toFixed(2)),
        trades,
    };
}


const runStrategyBacktestFlow = ai.defineFlow(
  {
    name: 'runStrategyBacktestFlow',
    inputSchema: StrategyBacktestInputSchema,
    outputSchema: StrategyBacktestOutputSchema,
  },
  async ({ strategyDescription }) => {
    
    // Step 1: AI extracts parameters
    const { output: strategyParams } = await strategyParsingPrompt({ strategyDescription });
    if (!strategyParams) throw new Error("A IA não conseguiu extrair os parâmetros da estratégia.");
    
    const symbolMatch = strategyDescription.match(/\b([A-Z]{4}\d{1,2})\b/);
    const symbol = symbolMatch ? symbolMatch[0] : 'PETR4';
    const periodMatch = strategyDescription.match(/(\d+\s+(ano|mes|anos|meses))/);
    const period = periodMatch ? periodMatch[0] : '1 ano';

    // Step 2: Tool fetches historical data
    const historicalData = await getHistoricalDataTool({ symbol, period });
    if (!historicalData || historicalData.length === 0) {
      return { summary: "Não foi possível obter dados históricos para o ativo solicitado." };
    }

    // Step 3: Code runs the simulation
    const simulationResult = runSimulation(historicalData, strategyParams);

    // Step 4: AI analyzes simulation results and creates summary
    const { output: analysisResult } = await backtestAnalysisPrompt({ simulationResult, strategy: strategyParams });
    if (!analysisResult) throw new Error("A IA não conseguiu gerar a análise do backtest.");

    return analysisResult;
  }
);

// Wrapper function to be called by server actions
export async function runStrategyBacktest(input: StrategyBacktestInput) {
    return runStrategyBacktestFlow(input);
}
