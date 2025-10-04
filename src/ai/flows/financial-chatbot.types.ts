import { z } from 'zod';

export const FinancialChatbotInputSchema = z.object({
  query: z.string().describe('The user query about their finances.'),
});
export type FinancialChatbotInput = z.infer<typeof FinancialChatbotInputSchema>;

export const FinancialChatbotOutputSchema = z.object({
  response: z.string().describe('The AI-generated response to the user query.'),
});
export type FinancialChatbotOutput = z.infer<typeof FinancialChatbotOutputSchema>;
