
"use server";

import { z } from "zod";
import { updateBudgetLimit as updateBudgetLimitInService } from "@/services/financial-data-service";
import { revalidatePath } from "next/cache";
import type { BudgetCategory } from "@/lib/types";

const updateBudgetSchema = z.object({
  userId: z.string(),
  name: z.string().min(1, "O nome da categoria é obrigatório."),
  budgeted: z.coerce.number().min(0, "O valor do orçamento não pode ser negativo."),
});

export async function updateBudget(data: { userId: string; name: string; budgeted: number }): Promise<{ success?: BudgetCategory, error?: any }> {
  const validatedData = updateBudgetSchema.safeParse(data);
  if (!validatedData.success) {
    return { error: validatedData.error.flatten().fieldErrors };
  }

  try {
    const updatedBudget = await updateBudgetLimitInService(validatedData.data.userId, validatedData.data.name, validatedData.data.budgeted);
    if (!updatedBudget) {
      return { error: "Categoria de orçamento não encontrada." };
    }
    revalidatePath("/budget");
    return { success: updatedBudget };
  } catch (e) {
    console.error(e);
    return { error: "Ocorreu um erro inesperado." };
  }
}
