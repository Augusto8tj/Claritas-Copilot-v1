'use server';

/**
 * @fileOverview An AI-powered chatbot that can use tools to access and modify financial data.
 *
 * - financialChatbotInsights - A function that handles the chatbot interaction.
 */

import {ai} from '@/ai/genkit';
// Ferramentas para acessar dados internos do aplicativo (orçamento, transações, etc.)
import { getFinancialInsightsTool, getFinancialSummaryTool, addTransactionTool, addGoalTool, getBudgetStatusTool } from '../tools/financial-tools';
// Ferramentas para acessar dados externos do mercado financeiro (cotações de ações, etc.)
import { getMarketDataTool } from '../tools/trading-tools';
import { FinancialChatbotInsightsInputSchema, FinancialChatbotInsightsOutputSchema, type FinancialChatbotInsightsInput } from './financial-chatbot-insights.types';


const prompt = ai.definePrompt({
  name: 'financialChatbotInsightsPrompt',
  input: {schema: FinancialChatbotInsightsInputSchema},
  output: {schema: FinancialChatbotInsightsOutputSchema},
  // A IA decide qual ferramenta usar com base na pergunta do usuário.
  tools: [
    // Ferramentas para dados internos:
    getFinancialSummaryTool, 
    getFinancialInsightsTool, 
    addTransactionTool, 
    addGoalTool, 
    getBudgetStatusTool, 
    // Ferramenta para dados externos:
    getMarketDataTool
  ],
  system: `Você é a Claritas, uma assistente financeira de IA.
Sua função é fornecer insights financeiros e responder a perguntas para ajudar os usuários a gerenciar suas finanças.
Use as ferramentas disponíveis para obter dados financeiros, de orçamento, de metas e de mercado, e ofereça conselhos com base nos resultados.
Você também pode adicionar transações ou metas a pedido do usuário.
Seja sempre prestativa, clara e use o português do Brasil. Ao fornecer dados de mercado, sempre inclua o ticker (se aplicável) e o valor formatado como moeda (R$).`,
  prompt: `Histórico da Conversa:
{{#each history}}
- {{role}}: {{content}}
{{/each}}

Nova Pergunta do Usuário: {{{query}}}
`,
});

const financialChatbotInsightsFlow = ai.defineFlow(
  {
    name: 'financialChatbotInsightsFlow',
    inputSchema: FinancialChatbotInsightsInputSchema,
    outputSchema: FinancialChatbotInsightsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);

export async function financialChatbotInsights(input: FinancialChatbotInsightsInput) {
  return financialChatbotInsightsFlow(input);
}
