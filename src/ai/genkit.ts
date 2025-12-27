import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Define model names for consistency
export const flash = 'googleai/gemini-2.5-flash';
export const pro = 'googleai/gemini-3-pro-preview';


export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  // Set the default, fast model
  model: flash,
});
