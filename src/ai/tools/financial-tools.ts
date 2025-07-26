'use server';
/**
 * @fileOverview Defines the tools available to the financial AI chatbot.
 */

import { ai } from '@/ai/genkit';
import { getFinancialSummary, getInsights } from '@/services/financial-data-service';
import { z } from 'zod';

export const getFinancialSummaryTool = ai.defineTool(
  {
    name: 'getFinancialSummaryTool',
    description: 'Obtém um resumo dos dados financeiros do usuário, incluindo renda, despesas e economias.',
    inputSchema: z.object({}),
    outputSchema: z.string().describe('Um resumo em formato de string dos dados financeiros.'),
  },
  async () => {
    console.log('getFinancialSummaryTool foi chamada');
    return getFinancialSummary();
  }
);

const FinancialInsightsOutputSchema = z.object({
  insights: z.array(z.string()).describe('Array of personalized financial insights.'),
});

const insightsPrompt = ai.definePrompt({
  name: 'financialInsightsToolPrompt',
  input: { schema: z.object({ financialData: z.string() }) },
  output: { schema: FinancialInsightsOutputSchema },
  prompt: `Você é um consultor financeiro de IA. Analise os seguintes dados financeiros e forneça 3 sugestões práticas e perspicazes para melhorar o bem-estar financeiro do usuário. Cada sugestão deve ter no máximo duas frases.

Dados Financeiros: {{{financialData}}}
`,
});

export const getFinancialInsightsTool = ai.defineTool(
  {
    name: 'getFinancialInsightsTool',
    description: 'Gera e retorna insights e conselhos financeiros acionáveis com base nos dados do usuário.',
    inputSchema: z.object({}),
    outputSchema: z.string().describe('Uma string contendo os insights financeiros, separados por quebras de linha.'),
  },
  async () => {
    console.log('getFinancialInsightsTool foi chamada');
    const financialData = getFinancialSummary();
    const { output } = await insightsPrompt({ financialData });
    if (!output) {
      return 'Não foi possível gerar insights no momento.';
    }
    return output.insights.join('\n');
  }
);
