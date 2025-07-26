"use server";

import { z } from "zod";
import { addGoal as addGoalToService, getGoals as getGoalsFromService } from "@/services/financial-data-service";
import type { Goal } from "@/lib/types";

const addGoalSchema = z.object({
  name: z.string().min(1, "O nome da meta é obrigatório."),
  targetAmount: z.coerce.number().positive("O valor da meta deve ser positivo."),
});

export async function addGoal(data: { name: string; targetAmount: number }): Promise<{ success?: Goal, error?: any }> {
  const validatedData = addGoalSchema.safeParse(data);
  if (!validatedData.success) {
    return { error: validatedData.error.flatten().fieldErrors };
  }

  try {
    const newGoal = await addGoalToService(validatedData.data.name, validatedData.data.targetAmount);
    return { success: newGoal };
  } catch (e) {
    console.error(e);
    return { error: "Ocorreu um erro inesperado." };
  }
}

export async function getGoals(): Promise<Goal[]> {
    return getGoalsFromService();
}
