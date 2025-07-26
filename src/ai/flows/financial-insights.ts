'use server';

/**
 * @fileOverview Provides proactive, personalized insights about a user's finances.
 *
 * - getFinancialInsights - A function that generates personalized financial insights.
 * - FinancialInsightsInput - The input type for the getFinancialInsights function.
 * - FinancialInsightsOutput - The return type for the getFinancialInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FinancialInsightsInputSchema = z.object({
  financialData: z
    .string()
    .describe(
      'Aggregated financial data of the user, including income, expenses, investments, and debts.'
    ),
  userGoals: z
    .string()
    .describe('The financial goals of the user, e.g., saving for retirement, buying a house.'),
  pastInsights: z
    .string()
    .optional()
    .describe(
      'Past insights to avoid repetition. If empty, this is the first time we are generating insights.'
    ),
});
export type FinancialInsightsInput = z.infer<typeof FinancialInsightsInputSchema>;

const FinancialInsightsOutputSchema = z.object({
  insights: z.array(z.string()).describe('Array of personalized financial insights.'),
});
export type FinancialInsightsOutput = z.infer<typeof FinancialInsightsOutputSchema>;

export async function getFinancialInsights(input: FinancialInsightsInput): Promise<FinancialInsightsOutput> {
  return financialInsightsFlow(input);
}

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
    const {output} = await prompt(input);
    return output!;
  }
);
