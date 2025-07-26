"use server";

import {
  financialChatbot,
  FinancialChatbotInput,
} from "@/ai/flows/financial-chatbot";
import {
  goalProjection,
  GoalProjectionInput,
} from "@/ai/flows/goal-projection";
import { z } from "zod";

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
