import { z } from 'zod';

export const GoalProjectionInputSchema = z.object({
  currentSavings: z
    .number()
    .describe('The current amount of savings towards the goal.'),
  goalAmount: z.number().describe('The total amount needed to reach the goal.'),
  monthlyContribution: z
    .number()
    .describe('The amount the user contributes monthly towards the goal.'),
  monthlyReturnRate: z
    .number()
    .describe(
      'The monthly percentage return rate of the savings, as a decimal (e.g., 0.05 for 5%).'
    ),
});
export type GoalProjectionInput = z.infer<typeof GoalProjectionInputSchema>;

export const GoalProjectionOutputSchema = z.object({
  projectionSummary: z.string().describe('A summary of the goal projection.'),
});
export type GoalProjectionOutput = z.infer<typeof GoalProjectionOutputSchema>;
