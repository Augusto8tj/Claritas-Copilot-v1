"use server";

import { z } from "zod";
import {
  addTransaction as addTransactionToService,
} from "@/services/financial-data-service";
import { revalidatePath } from "next/cache";

const transactionSchema = z.object({
  description: z.string().min(1, "A descrição é obrigatória."),
  amount: z.coerce.number().positive("O valor deve ser positivo."),
  type: z.enum(["income", "expense"], {
    required_error: "O tipo é obrigatório.",
  }),
  category: z.string().min(1, "A categoria é obrigatória."),
  date: z.string().min(1, "A data é obrigatória."),
});

export async function addTransaction(data: {
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
}) {
  const validatedData = transactionSchema.safeParse(data);

  if (!validatedData.success) {
    return { error: validatedData.error.flatten().fieldErrors };
  }

  try {
    await addTransactionToService(validatedData.data);
    revalidatePath("/analysis");
    revalidatePath("/budget");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { error: "Ocorreu um erro inesperado." };
  }
}
