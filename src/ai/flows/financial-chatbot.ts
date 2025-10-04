'use server';

/**
 * @fileOverview An AI-powered chatbot for answering user questions and providing personalized financial advice.
 *
 * - financialChatbot - A function that handles the chatbot interaction.
 */

import {ai} from '@/ai/genkit';
import { FinancialChatbotInputSchema, FinancialChatbotOutputSchema, type FinancialChatbotInput } from './financial-chatbot.types';

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

export async function financialChatbot(input: FinancialChatbotInput) {
  return financialChatbotFlow(input);
}
