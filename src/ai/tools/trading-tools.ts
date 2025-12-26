

'use server';

/**
 * @fileOverview Defines AI tools for interacting with a brokerage API.
 * This file is now simplified, as most logic has been moved to the central use-deriv-api hook.
 * The getHistoricalDataTool is removed from here as it's no longer a separate tool but part of the main hook.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';


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
