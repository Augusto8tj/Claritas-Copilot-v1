// /src/app/actions/financial-data-actions.ts
"use server";

import { z } from "zod";
import { addGoal as addGoalToService, getGoals as getGoalsFromService, deleteGoal as deleteGoalFromService } from "@/features/financials/services/financial-data-service";
import type { Goal } from "@/lib/types";
import { revalidatePath } from "next/cache";

const addGoalSchema = z.object({
  userId: z.string(),
  name: z.string().min(1, "O nome da meta é obrigatório."),
  targetAmount: z.coerce.number().positive("O valor da meta deve ser positivo."),
});

export async function addGoal(data: { userId: string, name: string; targetAmount: number }): Promise<{ success?: Goal, error?: any }> {
  const validatedData = addGoalSchema.safeParse(data);
  if (!validatedData.success) {
    return { error: validatedData.error.flatten().fieldErrors };
  }

  try {
    const newGoal = await addGoalToService(validatedData.data.userId, validatedData.data.name, validatedData.data.targetAmount);
    revalidatePath("/goals");
    return { success: newGoal };
  } catch (e) {
    console.error(e);
    return { error: "Ocorreu um erro inesperado." };
  }
}

export async function getGoals(userId: string): Promise<Goal[]> {
    return getGoalsFromService(userId);
}

export async function deleteGoal(userId: string, goalId: string): Promise<{ success: boolean; error?: string }> {
    if(!goalId) {
        return { success: false, error: "ID da meta é obrigatório." };
    }
    try {
        const result = await deleteGoalFromService(userId, goalId);
        if(result.success) {
            revalidatePath("/goals");
            return { success: true };
        }
        return { success: false, error: "Meta não encontrada." };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Ocorreu um erro inesperado ao deletar a meta." };
    }
}
