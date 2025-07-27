"use server";

import {
  financialChatbot,
  FinancialChatbotInput,
} from "@/ai/flows/financial-chatbot";
import {
  financialChatbotInsights,
  FinancialChatbotInsightsInput,
} from "@/ai/flows/financial-chatbot-insights";
import {
  goalProjection,
  GoalProjectionInput,
} from "@/ai/flows/goal-projection";
import { z } from "zod";
import { getFinancialSummary, getInsights } from "@/services/financial-data-service";
import { auth } from "@/lib/firebase";


const goalProjectionSchema = z.object({
  currentSavings: z.coerce.number().positive("Must be a positive number"),
  goalAmount: z.coerce.number().positive("Must be a positive number"),
  monthlyContribution: z.coerce.number().positive("Must be a positive number"),
  monthlyReturnRate: z.coerce
    .number()
    .min(0, "Cannot be negative")
    .max(100, "Cannot be over 100"),
});

export async function getGoalProjection(data: GoalProjectionInput) {
  const validatedData = goalProjectionSchema.safeParse(data);
  if (!validatedData.success) {
    return { error: validatedData.error.flatten().fieldErrors };
  }

  try {
    const result = await goalProjection({
      ...validatedData.data,
      monthlyReturnRate: validatedData.data.monthlyReturnRate / 100,
    });
    return { success: result.projectionSummary };
  } catch (e) {
    console.error(e);
    return { error: "An unexpected error occurred." };
  }
}

export async function getChatbotResponse(data: FinancialChatbotInput) {
  try {
    const result = await financialChatbot(data);
    return { success: result.response };
  } catch (e) {
    console.error(e);
    return { error: "Sorry, I couldn't process that. Please try again." };
  }
}

export async function getChatbotInsightsResponse(data: FinancialChatbotInsightsInput) {
  try {
    const result = await financialChatbotInsights(data);
    return { success: result.response };
  } catch (e) {
    console.error(e);
    return { error: "Desculpe, não consegui processar isso. Por favor, tente novamente." };
  }
}

export async function sendFinancialSummaryEmail() {
  try {
    // Em um app real, aqui você obteria o usuário da sessão
    const userEmail = auth.currentUser?.email || "usuariodemo@exemplo.com";
    
    // Obter os dados financeiros
    const summary = await getFinancialSummary();
    const insights = await getInsights();

    // Montar o conteúdo do email
    const emailSubject = "Seu Resumo Financeiro Semanal - Claritas Copilot";
    const emailBody = `
      Olá,

      Aqui está um resumo da sua situação financeira:

      - Renda Mensal: R$${summary.income.toFixed(2)}
      - Despesas Mensais: R$${summary.expenses.toFixed(2)}
      - Saldo: R$${summary.balance.toFixed(2)}

      Insights da IA para você:
      ${insights.map(i => `- ${i}`).join("\n")}

      Continue acompanhando suas finanças!

      Atenciosamente,
      Equipe Claritas Copilot
    `;

    // Simular o envio do email
    console.log("===================================");
    console.log("SIMULANDO ENVIO DE EMAIL");
    console.log(`Para: ${userEmail}`);
    console.log(`Assunto: ${emailSubject}`);
    console.log("Corpo:", emailBody);
    console.log("===================================");

    return { success: `Email de teste enviado para o console.` };
  } catch (error) {
    console.error("Falha ao enviar email de resumo:", error);
    return { error: "Não foi possível enviar o email de resumo." };
  }
}
