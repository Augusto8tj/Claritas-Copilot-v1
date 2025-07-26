'use server';

/**
 * @fileOverview An AI-powered chatbot for answering user questions and providing personalized financial advice.
 *
 * - financialChatbot - A function that handles the chatbot interaction.
 * - FinancialChatbotInput - The input type for the financialChatbot function.
 * - FinancialChatbotOutput - The return type for the financialChatbot function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FinancialChatbotInputSchema = z.object({
  query: z.string().describe('The user query about their finances.'),
});
export type FinancialChatbotInput = z.infer<typeof FinancialChatbotInputSchema>;

const FinancialChatbotOutputSchema = z.object({
  response: z.string().describe('The AI-generated response to the user query.'),
});
export type FinancialChatbotOutput = z.infer<typeof FinancialChatbotOutputSchema>;

export async function financialChatbot(input: FinancialChatbotInput): Promise<FinancialChatbotOutput> {
  return financialChatbotFlow(input);
}

const prompt = ai.definePrompt({
  name: 'financialChatbotPrompt',
  input: {schema: FinancialChatbotInputSchema},
  output: {schema: FinancialChatbotOutputSchema},
  prompt: `You are a helpful AI-powered financial advisor chatbot.

  Your goal is to answer user questions about their finances and provide personalized advice.
  Use your knowledge of financial planning, budgeting, and investment to provide informative and helpful responses.

  User Query: {{{query}}}
  `,
});

const financialChatbotFlow = ai.defineFlow(
  {
    name: 'financialChatbotFlow',
    inputSchema: FinancialChatbotInputSchema,
    outputSchema: FinancialChatbotOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
