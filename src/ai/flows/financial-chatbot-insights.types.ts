import { z } from 'zod';

const MessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

export const FinancialChatbotInsightsInputSchema = z.object({
  history: z.array(MessageSchema).describe('The conversation history.'),
  query: z.string().describe('The user query about their finances.'),
});
export type FinancialChatbotInsightsInput = z.infer<typeof FinancialChatbotInsightsInputSchema>;

export const FinancialChatbotInsightsOutputSchema = z.object({
  response: z.string().describe('The AI-generated response to the user query.'),
});
export type FinancialChatbotInsightsOutput = z.infer<typeof FinancialChatbotInsightsOutputSchema>;
