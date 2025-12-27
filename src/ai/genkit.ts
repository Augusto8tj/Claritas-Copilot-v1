import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Define model names for consistency. We'll use flash as the primary model.
export const flash = 'googleai/gemini-2.5-flash-lite';

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  // Set the default, fast model
  model: flash,
});
