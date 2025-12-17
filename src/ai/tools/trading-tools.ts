
'use server';

/**
 * @fileOverview Defines AI tools for interacting with a brokerage API.
 */
import { ai, flash, pro } from '@/ai/genkit';
import { getAccountBalance, getMarketData, getHistoricalData } from '@/services/deriv-api-service';
import { executeTradeAction } from '@/app/actions/trading-actions';
import { z } from 'zod';
import type { AccountType } from '@/hooks/use-deriv-api';


// For simplicity, we assume the user's API token is available.
// In a real app, this would be securely retrieved for the logged-in user.
// It will use the environment variable if available.
const API_TOKEN = process.env.DERIV_API_TOKEN || "invalid-token";

export const getAccountBalanceTool = ai.defineTool(
  {
    name: 'getAccountBalanceTool',
    description: 'Obtém o saldo atual da conta da corretora. Requer especificar o tipo de conta.',
    inputSchema: z.object({
      accountType: z.enum(['demo', 'real']).describe("O tipo de conta: 'demo' ou 'real'."),
    }),
    outputSchema: z.object({
      balance: z.number(),
      currency: z.string(),
    }),
  },
  async ({ accountType }) => {
    // Este é um exemplo. Em um app real, você buscaria o token apropriado para o tipo de conta.
    if (!API_TOKEN) throw new Error("O token da API da Deriv não está configurado.");
    return getAccountBalance(API_TOKEN, accountType as AccountType);
  }
);


const marketDataPrompt = ai.definePrompt({
    name: 'marketDataPrompt',
    input: { schema: z.object({ query: z.string() }) },
    output: { schema: z.object({ summary: z.string() }) },
    prompt: `Você é um analista financeiro. Com base na pergunta do usuário, forneça um resumo conciso do estado atual do mercado financeiro ou do ativo específico mencionado. Inclua índices importantes como IBOVESPA, se relevante.

Pergunta: {{{query}}}
`,
});

export const getMarketDataTool = ai.defineTool(
  {
    name: 'getMarketDataTool',
    description: 'Obtém um resumo do mercado financeiro ou dados de um ativo específico (ex: preço). Use para perguntas como "como está o mercado hoje?" ou "qual a cotação de PETR4?".',
    inputSchema: z.object({
      query: z.string().describe('A pergunta do usuário sobre o mercado financeiro ou um ativo.'),
    }),
    outputSchema: z.object({
        summary: z.string(),
    }),
  },
  async ({ query }) => {
    console.log(`[getMarketDataTool] Gerando resumo para a consulta: "${query}"`);
    try {
        // First, try the fast model
        const { output } = await marketDataPrompt({ query }, { model: flash });
        if (!output) throw new Error("Market data summary generation with Flash model returned empty.");
        return output;
    } catch (e) {
        console.warn(`[Tool] Model '${flash}' failed for market data summary, trying '${pro}'. Error:`, e);
        // If it fails, fallback to the more robust model
        const { output } = await marketDataPrompt({ query }, { model: pro });
        if (!output) throw new Error("Não foi possível gerar um resumo do mercado.");
        return output;
    }
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
      allowEquals: z.boolean().optional().describe('Para Rise/Fall, define se ganhará o prêmio se o preço de saída for igual ao de entrada. Padrão é falso.')
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  async ({ symbol, tradeDirection, quantity, allowEquals }) => {
    if (!API_TOKEN) throw new Error("O token da API da Deriv não está configurado.");
    
    let contractType;
    if (tradeDirection === 'rise') {
      contractType = allowEquals ? 'PUTE' : 'PUT';
    } else { // fall
      contractType = allowEquals ? 'CALLE' : 'CALL';
    }
    
    return executeTradeAction(API_TOKEN, contractType, quantity, symbol);
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
