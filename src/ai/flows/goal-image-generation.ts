'use server';

/**
 * @fileOverview Generates an image for a financial goal using AI.
 *
 * - generateGoalImage - A function that generates an image based on a goal name.
 */

import { ai } from '@/ai/genkit';
import { GenerateGoalImageInputSchema, GenerateGoalImageOutputSchema, type GenerateGoalImageInput } from './goal-image-generation.types';


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

export async function generateGoalImage(input: GenerateGoalImageInput) {
  return generateGoalImageFlow(input);
}
