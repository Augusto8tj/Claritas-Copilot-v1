'use server';

/**
 * @fileOverview An AI-powered chatbot that can use tools to access and modify financial data.
 *
 * - financialChatbotInsights - A function that handles the chatbot interaction.
 * - FinancialChatbotInsightsInput - The input type for the function.
 * - FinancialChatbotInsightsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getFinancialInsightsTool, getFinancialSummaryTool } from '../tools/financial-tools';

export const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

const FinancialChatbotInsightsInputSchema = z.object({
  history: z.array(MessageSchema).describe('The conversation history.'),
  query: z.string().describe('The user query about their finances.'),
});
export type FinancialChatbotInsightsInput = z.infer<typeof FinancialChatbotInsightsInputSchema>;

const FinancialChatbotInsightsOutputSchema = z.object({
  response: z.string().describe('The AI-generated response to the user query.'),
});
export type FinancialChatbotInsightsOutput = z.infer<typeof FinancialChatbotInsightsOutputSchema>;


const prompt = ai.definePrompt({
  name: 'financialChatbotInsightsPrompt',
  input: {schema: FinancialChatbotInsightsInputSchema},
  output: {schema: FinancialChatbotInsightsOutputSchema},
  tools: [getFinancialSummaryTool, getFinancialInsightsTool],
  system: `Você é a Claritas, uma assistente financeira de IA.
Sua função é fornecer insights financeiros e responder a perguntas para ajudar os usuários a gerenciar suas finanças.
Use as ferramentas disponíveis para obter dados financeiros e oferecer conselhos.
Seja sempre prestativa, clara e use o português do Brasil.`,
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

export async function financialChatbotInsights(input: FinancialChatbotInsightsInput): Promise<FinancialChatbotInsightsOutput> {
  return financialChatbotInsightsFlow(input);
}
