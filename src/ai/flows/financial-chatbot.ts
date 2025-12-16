'use server';

/**
 * @fileOverview An AI-powered chatbot for answering user questions and providing personalized financial advice.
 *
 * - financialChatbot - A function that handles the chatbot interaction.
 */

import {ai, flash, pro} from '@/ai/genkit';
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
    try {
      // First, try the fast model
      const { output } = await prompt(input, { model: flash });
      return output!;
    } catch (e) {
      console.warn(`[Flow] Model '${flash}' failed, trying '${pro}'. Error:`, e);
      // If it fails, fallback to the more robust model
      const { output } = await prompt(input, { model: pro });
      return output!;
    }
  }
);

export async function financialChatbot(input: FinancialChatbotInput) {
  return financialChatbotFlow(input);
}
