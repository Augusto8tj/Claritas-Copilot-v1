import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Define model names for consistency
export const flash = 'googleai/gemini-flash-latest';

export const ai = genkit({
  plugins: [
    googleAI({
      // Defina a versão da API explicitamente para evitar avisos.
      apiVersion: 'v1beta',
    }),
  ],
  // Set the default, fast model
  model: flash,
});
