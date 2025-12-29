// /src/lib/genkit.ts
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  // Set the default, fast model
  model: 'googleai/gemini-2.5-flash',
});
