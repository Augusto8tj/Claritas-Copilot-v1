'use server';

/**
 * @fileOverview Generates an image for a financial goal using AI.
 *
 * - generateGoalImage - A function that generates an image based on a goal name.
 * - GenerateGoalImageInput - The input type for the function.
 * - GenerateGoalImageOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateGoalImageInputSchema = z.object({
  goalName: z.string().describe('The name of the financial goal.'),
});
export type GenerateGoalImageInput = z.infer<typeof GenerateGoalImageInputSchema>;

const GenerateGoalImageOutputSchema = z.object({
  imageUrl: z.string().describe('The data URI of the generated image.'),
});
export type GenerateGoalImageOutput = z.infer<typeof GenerateGoalImageOutputSchema>;

export async function generateGoalImage(input: GenerateGoalImageInput): Promise<GenerateGoalImageOutput> {
  return generateGoalImageFlow(input);
}

const generateGoalImageFlow = ai.defineFlow(
  {
    name: 'generateGoalImageFlow',
    inputSchema: GenerateGoalImageInputSchema,
    outputSchema: GenerateGoalImageOutputSchema,
  },
  async ({ goalName }) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: `Generate a photorealistic, inspiring image for a financial goal titled "${goalName}". The image should be visually appealing and motivational.`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error('Image generation failed.');
    }

    return { imageUrl: media.url };
  }
);
