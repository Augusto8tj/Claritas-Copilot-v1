import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

/**
 * @fileoverview This file is responsible for creating and exporting the singleton `ai` instance.
 * It should not import any flows that depend on it to avoid circular dependencies.
 */

export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    }),
  ],
});
