

'use server';

import { getAssetAnalysis } from '@/ai/flows/asset-analysis-flow';
import { AssetAnalysisInputSchema, type AssetAnalysisInput, type AssetAnalysisOutput } from '@/ai/flows/asset-analysis-flow.types';


// The getStrategyCouncilAction has been removed as the council generation is now local and synchronous.
// The analyzeTradeLossAction and getAutotraderStrategyAction have been removed as the old autopilot system is obsolete.


export async function getAssetAnalysisAction(input: AssetAnalysisInput): Promise<{ success?: AssetAnalysisOutput; error?: string }> {
    const validatedInput = AssetAnalysisInputSchema.safeParse(input);
    if (!validatedInput.success) {
        console.error("[Action Validation Error] Invalid input for getAssetAnalysisAction:", validatedInput.error.format());
        return { error: `Dados de entrada inválidos: ${validatedInput.error.message}` };
    }

    try {
        const result = await getAssetAnalysis(validatedInput.data);
        return { success: result };
    } catch (e: any) {
        console.error("[Action] Erro ao obter análise de ativo:", e);
        return { error: e.message || "Ocorreu um erro inesperado ao analisar o ativo." };
    }
}
