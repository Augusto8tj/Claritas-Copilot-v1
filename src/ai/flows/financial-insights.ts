'use server';

/**
 * @fileOverview Provides proactive, personalized insights about a user's finances.
 *
 * - getFinancialInsights - A function that generates personalized financial insights.
 */

import {ai, flash, pro} from '@/ai/genkit';
import { FinancialInsightsInputSchema, FinancialInsightsOutputSchema, type FinancialInsightsInput } from './financial-insights.types';


const prompt = ai.definePrompt({
  name: 'financialInsightsPrompt',
  input: {schema: FinancialInsightsInputSchema},
  output: {schema: FinancialInsightsOutputSchema},
  prompt: `You are an AI financial advisor providing personalized insights to users based on their financial data and goals.

  Financial Data: {{{financialData}}}
  User Goals: {{{userGoals}}}
  Past Insights: {{{pastInsights}}}

  Provide 3 actionable and insightful suggestions to improve the user's financial well-being, tailored to their data and goals.
  Each suggestion should be no more than two sentences.
`,
});

const financialInsightsFlow = ai.defineFlow(
  {
    name: 'financialInsightsFlow',
    inputSchema: FinancialInsightsInputSchema,
    outputSchema: FinancialInsightsOutputSchema,
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

export async function getFinancialInsights(input: FinancialInsightsInput) {
  return financialInsightsFlow(input);
}
