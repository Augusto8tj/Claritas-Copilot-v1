// GoalProjectionFlow
'use server';
/**
 * @fileOverview A goal projection AI agent.
 *
 * - goalProjection - A function that handles the goal projection process.
 * - GoalProjectionInput - The input type for the goalProjection function.
 * - GoalProjectionOutput - The return type for the goalProjection function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GoalProjectionInputSchema = z.object({
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

const GoalProjectionOutputSchema = z.object({
  projectionSummary: z.string().describe('A summary of the goal projection.'),
});
export type GoalProjectionOutput = z.infer<typeof GoalProjectionOutputSchema>;

export async function goalProjection(input: GoalProjectionInput): Promise<GoalProjectionOutput> {
  return goalProjectionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'goalProjectionPrompt',
  input: {schema: GoalProjectionInputSchema},
  output: {schema: GoalProjectionOutputSchema},
  prompt: `Você é um consultor financeiro ajudando um usuário a entender quando ele alcançará sua meta financeira.

  Com base nas seguintes informações, calcule quantos meses levará para o usuário atingir sua meta e forneça um resumo. Seja conciso.

  Economias Atuais: {{{currentSavings}}}
  Valor da Meta: {{{goalAmount}}}
  Contribuição Mensal: {{{monthlyContribution}}}
  Taxa de Retorno Mensal: {{{monthlyReturnRate}}}
  `,
});

const goalProjectionFlow = ai.defineFlow(
  {
    name: 'goalProjectionFlow',
    inputSchema: GoalProjectionInputSchema,
    outputSchema: GoalProjectionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
