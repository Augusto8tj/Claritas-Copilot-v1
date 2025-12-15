'use server';

/**
 * @fileOverview Defines AI tools for interacting with a brokerage API.
 */
import { ai } from '@/ai/genkit';
import { getAccountBalance, getMarketData, executeTrade, getHistoricalData } from '@/services/deriv-api-service';
import { z } from 'zod';

// For simplicity, we assume the user's API token is available.
// In a real app, this would be securely retrieved for the logged-in user.
// It will use the environment variable if available.
const API_TOKEN = process.env.DERIV_API_TOKEN || "valid-token-for-testing";

export const getAccountBalanceTool = ai.defineTool(
  {
    name: 'getAccountBalanceTool',
    description: 'Obtém o saldo atual da conta da corretora.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      balance: z.number(),
      currency: z.string(),
    }),
  },
  async () => {
    if (!API_TOKEN) throw new Error("O token da API da Deriv não está configurado.");
    return getAccountBalance(API_TOKEN);
  }
);

export const getMarketDataTool = ai.defineTool(
  {
    name: 'getMarketDataTool',
    description: 'Obtém dados de mercado em tempo real para um ativo específico (ex: preço).',
    inputSchema: z.object({
      symbol: z.string().describe('O ticker do ativo. Ex: "PETR4", "BTCUSD".'),
    }),
    outputSchema: z.object({
      symbol: z.string(),
      price: z.number(),
      changePercent: z.number(),
    }),
  },
  async ({ symbol }) => {
    return getMarketData(symbol);
  }
);

export const executeTradeTool = ai.defineTool(
  {
    name: 'executeTradeTool',
    description: 'Executa uma ordem de compra ou venda de um ativo na corretora. Use apenas quando o usuário explicitamente confirmar a ordem.',
    inputSchema: z.object({
      symbol: z.string().describe('O ticker do ativo a ser negociado.'),
      tradeDirection: z.enum(['rise', 'fall']).describe('A direção da negociação para opções: "rise" para prever uma subida, "fall" para prever uma queda.'),
      quantity: z.number().describe('O valor do investimento (stake) para a negociação.'),
      tradeType: z.enum(['Digital', 'Accumulators', 'Vanilla', 'Turbo', 'Multipliers']).optional().describe('O tipo de opção de negociação, se aplicável.'),
      digitalOptionType: z.enum([
        'RiseFall', 'HigherLower', 'EndBetweens', 'StaysBetween', 
        'Lookbacks', 'TouchNoTouch', 'OnlyUpsDowns', 'HighestLowest', 
        'ResetCall', 'AsianUpDown', 'Digit:Matches/Differs', 
        'Digit:Even/Odd', 'Digit:Over/Under'
      ]).optional().describe('O tipo específico de Opção Digital a ser negociada.'),
       allowEquals: z.boolean().optional().describe('Para Rise/Fall, define se ganhará o prêmio se o preço de saída for igual ao de entrada. Padrão é falso.')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  async ({ symbol, tradeDirection, quantity, tradeType, digitalOptionType, allowEquals }) => {
    if (!API_TOKEN) throw new Error("O token da API da Deriv não está configurado.");
    
    console.log(`[Trade Tool] Executing trade with tradeType: ${tradeType}, digitalOptionType: ${digitalOptionType}, allowEquals: ${allowEquals}`);

    // A função de serviço agora lida com os novos parâmetros
    return executeTrade(API_TOKEN, symbol, tradeDirection, quantity, { allowEquals });
  }
);


export const getHistoricalDataTool = ai.defineTool(
  {
    name: 'getHistoricalDataTool',
    description: 'Obtém dados de preços históricos para um ativo, para fins de backtesting.',
    inputSchema: z.object({
        symbol: z.string().describe("O ticker do ativo para o qual obter dados históricos."),
        period: z.string().describe("O período para os dados históricos, ex: '1 ano', '6 meses'."),
    }),
    outputSchema: z.array(z.object({
        date: z.string(),
        price: z.number(),
    })),
  },
  async ({ symbol, period }) => {
    return getHistoricalData(symbol, period);
  }
);
