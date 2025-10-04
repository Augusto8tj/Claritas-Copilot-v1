import { z } from 'zod';

export const FinancialInsightsInputSchema = z.object({
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

export const FinancialInsightsOutputSchema = z.object({
  insights: z.array(z.string()).describe('Array of personalized financial insights.'),
});
export type FinancialInsightsOutput = z.infer<typeof FinancialInsightsOutputSchema>;
