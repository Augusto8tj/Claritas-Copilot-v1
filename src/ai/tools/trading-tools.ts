
'use server';

/**
 * @fileOverview Defines AI tools for interacting with a brokerage API.
 * This file is now simplified, as most logic has been moved to the central use-deriv-api hook.
 * The getHistoricalDataTool is removed from here as it's no longer a separate tool but part of the main hook.
 */
import { ai } from '@/ai/genkit';
import { executeTradeAction } from '@/app/actions/trading-actions';
import { z } from 'zod';
import type { AccountType } from '@/hooks/use-deriv-api';


// This file no longer needs to manage its own API tokens or connections.
// It defines tools that will be called by AI flows. These tools, in turn,
// will call Server Actions that use the centralized useDerivApi hook.

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
    const { output } = await marketDataPrompt({ query });
    if (!output) throw new Error("Não foi possível gerar um resumo do mercado.");
    return output;
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
    const apiToken = process.env.DERIV_API_TOKEN || "invalid-token";
    if (!apiToken) throw new Error("O token da API da Deriv não está configurado.");
    
    let contractType;
    if (tradeDirection === 'rise') {
      contractType = allowEquals ? 'PUTE' : 'PUT';
    } else { // fall
      contractType = allowEquals ? 'CALLE' : 'CALL';
    }
    
    // NOTE: This now calls a Server Action which should internally use the useDerivApi hook.
    // This indirection is necessary to bridge AI tools (server-side) with React hooks (client-side context).
    // For this to work, executeTradeAction must be refactored to not require an apiToken argument
    // and instead get it from the useDerivApi context if called from a component, or handle it differently for tool calls.
    // For now, we pass the token from environment variables.
    return executeTradeAction(apiToken, contractType, quantity, symbol);
  }
);
