'use server';
/**
 * @fileOverview A goal projection AI agent.
 *
 * - goalProjection - A function that handles the goal projection process.
 */

import {ai} from '@/ai/genkit';
import { GoalProjectionInputSchema, GoalProjectionOutputSchema, type GoalProjectionInput } from './goal-projection.types';


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
    const { output } = await prompt(input);
    if (!output) throw new Error("Could not generate goal projection.");
    return output;
  }
);

export async function goalProjection(input: GoalProjectionInput) {
  return goalProjectionFlow(input);
}
