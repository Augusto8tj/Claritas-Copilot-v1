import { z } from 'zod';

export const GenerateGoalImageInputSchema = z.object({
  goalName: z.string().describe('The name of the financial goal.'),
});
export type GenerateGoalImageInput = z.infer<typeof GenerateGoalImageInputSchema>;

export const GenerateGoalImageOutputSchema = z.object({
  imageUrl: z.string().describe('The data URI of the generated image.'),
});
export type GenerateGoalImageOutput = z.infer<typeof GenerateGoalImageOutputSchema>;
