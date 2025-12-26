

'use server';

import { getStrategyCouncil, type StrategyCouncilOutput } from '@/ai/flows/strategy-council-flow';
import { StrategyCouncilInputSchema, type StrategyCouncilInput } from '@/ai/flows/strategy-council-flow.types';


export async function getStrategyCouncilAction(input: StrategyCouncilInput): Promise<{ success?: StrategyCouncilOutput; error?: string }> {
    const validatedInput = StrategyCouncilInputSchema.safeParse(input);
    if (!validatedInput.success) {
        // Log the detailed validation error for debugging
        console.error("[Action Validation Error] Invalid input for getStrategyCouncilAction:", validatedInput.error.format());
        return { error: `Dados de entrada inválidos para o conselho: ${validatedInput.error.message}` };
    }

    try {
        const result = await getStrategyCouncil(validatedInput.data);
        return { success: result };
    } catch (e: any) {
        console.error("[Action] Erro ao gerar o conselho de robôs:", e);
        return { error: e.message || "Ocorreu um erro inesperado ao gerar o conselho." };
    }
}
