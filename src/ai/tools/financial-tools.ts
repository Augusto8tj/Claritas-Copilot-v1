'use server';
/**
 * @fileOverview Defines the tools available to the financial AI chatbot.
 */

import { ai } from '@/ai/genkit';
import { addGoal, addTransaction, getFinancialSummary } from '@/services/financial-data-service';
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

export const addTransactionTool = ai.defineTool(
  {
    name: 'addTransactionTool',
    description: 'Adiciona uma nova transação (receita ou despesa) aos registros financeiros.',
    inputSchema: z.object({
      description: z.string().describe('A descrição da transação.'),
      amount: z.number().describe('O valor da transação.'),
      type: z.enum(['income', 'expense']).describe('O tipo da transação: "income" para receita, "expense" para despesa.'),
    }),
    outputSchema: z.string(),
  },
  async ({ description, amount, type }) => {
    return addTransaction(description, amount, type);
  }
);

export const addGoalTool = ai.defineTool(
  {
    name: 'addGoalTool',
    description: 'Adiciona uma nova meta financeira.',
    inputSchema: z.object({
      name: z.string().describe('O nome da meta.'),
      targetAmount: z.number().describe('O valor alvo da meta.'),
    }),
    outputSchema: z.string(),
  },
  async ({ name, targetAmount }) => {
    return addGoal(name, targetAmount);
  }
);