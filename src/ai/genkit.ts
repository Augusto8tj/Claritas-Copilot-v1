import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Define model names for consistency
export const flash = 'googleai/gemini-flash-latest';
export const pro = 'googleai/gemini-pro-latest';

export const ai = genkit({
  plugins: [googleAI()],
  // Set the default, fast model
  model: flash,
});
