'use server';
/**
 * @fileOverview Defines the tools available to the financial AI chatbot.
 */

import { ai } from '@/ai/genkit';
import { addGoal, addTransaction, getFinancialSummary, getBudgetData } from '@/services/financial-data-service';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const FinancialSummarySchema = z.object({
  income: z.number().describe('Renda mensal total do usuário.'),
  expenses: z.number().describe('Despesas mensais totais do usuário.'),
  balance: z.number().describe('O saldo mensal (renda - despesas).'),
});

export const getFinancialSummaryTool = ai.defineTool(
  {
    name: 'getFinancialSummaryTool',
    description: 'Obtém um resumo estruturado dos dados financeiros do usuário, incluindo renda, despesas e saldo.',
    inputSchema: z.object({}),
    outputSchema: FinancialSummarySchema,
  },
  async () => {
    console.log('getFinancialSummaryTool foi chamada');
    // A função getFinancialSummary foi modificada para retornar um objeto
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
    const financialData = await getFinancialSummary();
    const financialDataString = `Renda: ${financialData.income}, Despesas: ${financialData.expenses}, Saldo: ${financialData.balance}`;
    const { output } = await insightsPrompt({ financialData: financialDataString });
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
    // Em uma implementação real, a categoria seria inferida ou solicitada.
    // Para simplificar, estamos usando 'Outros' e a data atual.
    const transactionData = {
        description,
        amount,
        type,
        category: 'Outros',
        date: new Date().toISOString()
    };
    const result = await addTransaction(transactionData);
    
    // Revalidate paths to reflect the new transaction
    revalidatePath("/analysis");
    revalidatePath("/budget");

    return result;
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
    const newGoal = await addGoal(name, targetAmount);
    revalidatePath('/goals');
    revalidatePath('/'); // Revalidate dashboard to show new goal in carousel
    return `Meta "${newGoal.name}" adicionada com sucesso.`;
  }
);

const BudgetStatusSchema = z.array(
    z.object({
        name: z.string().describe("O nome da categoria do orçamento."),
        budgeted: z.number().describe("O valor total orçado para a categoria."),
        spent: z.number().describe("O valor gasto até agora na categoria."),
    })
);

export const getBudgetStatusTool = ai.defineTool(
    {
        name: 'getBudgetStatusTool',
        description: 'Obtém o status atual do orçamento, mostrando os valores orçados e gastos para cada categoria.',
        inputSchema: z.object({}),
        outputSchema: BudgetStatusSchema,
    },
    async () => {
        console.log('getBudgetStatusTool foi chamada');
        return getBudgetData();
    }
);
