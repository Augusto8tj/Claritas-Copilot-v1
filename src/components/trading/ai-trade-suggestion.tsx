"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "../ui/button";
import { Loader2, Sparkles, TrendingUp, TrendingDown, HelpCircle, AlertTriangle } from "lucide-react";
import { getAssetAnalysisAction } from "@/app/actions/ai-actions";
import type { AssetAnalysisOutput } from "@/ai/flows/asset-analysis-flow.types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { cn } from "@/lib/utils";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { getHistoricalData } from "@/services/deriv-api-service";

interface AITradeSuggestionProps {
  symbol: string;
  form: any; // Pass the form instance from the parent
}

export function AITradeSuggestion({ symbol, form }: AITradeSuggestionProps) {
  const [analysisResult, setAnalysisResult] = useState<AssetAnalysisOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { accountBalance, operationsLog } = useDerivApi();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setError(null);
    
    try {
      // 1. Fetch historical data on the client
      const historicalData = await getHistoricalData(symbol, undefined, 120);
      if (!historicalData || historicalData.length === 0) {
        throw new Error(`Não foi possível obter dados históricos para ${symbol}.`);
      }

      // 2. Get form data
      const formData = form.getValues();

      // 3. Call the server action with all the required data
      const result = await getAssetAnalysisAction({
          symbol,
          balance: accountBalance.balance || 0,
          currency: accountBalance.currency || 'USD',
          stake: formData.stake,
          duration: formData.duration,
          durationUnit: formData.duration_unit,
          recentTrades: operationsLog.slice(0, 5),
          historicalData: historicalData 
      });

      if (result.success) {
          setAnalysisResult(result.success);
      } else {
          setError(result.error || "Ocorreu um erro desconhecido.");
      }
    } catch (e: any) {
       setError(e.message || "Ocorreu um erro ao buscar dados para análise.");
    }

    setIsAnalyzing(false);
  };
  
  const suggestionIcons = {
    RISE: <TrendingUp className="h-6 w-6 text-green-500" />,
    FALL: <TrendingDown className="h-6 w-6 text-red-500" />,
    HOLD: <HelpCircle className="h-6 w-6 text-yellow-500" />,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Copiloto de Trade
        </CardTitle>
        <CardDescription>
          Peça à IA uma sugestão de negociação baseada em análise técnica e na sua gestão de risco.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleAnalyze}
          disabled={isAnalyzing || !accountBalance.balance}
        >
          {isAnalyzing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Analisar {symbol}
        </Button>
        {isAnalyzing && (
            <div className="flex items-center justify-center text-muted-foreground p-4">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Analisando...</span>
            </div>
        )}
        {error && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro na Análise</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        {analysisResult && (
          <Alert className={cn(
            analysisResult.suggestion === "RISE" && "border-green-500/50 bg-green-500/10 text-green-700",
            analysisResult.suggestion === "FALL" && "border-red-500/50 bg-red-500/10 text-red-700",
            analysisResult.suggestion === "HOLD" && "border-yellow-500/50 bg-yellow-500/10 text-yellow-700",
          )}>
            <AlertTitle className={cn("flex items-center gap-2 font-bold",
                 analysisResult.suggestion === "RISE" && "text-green-800",
                 analysisResult.suggestion === "FALL" && "text-red-800",
                 analysisResult.suggestion === "HOLD" && "text-yellow-800",
            )}>
                {suggestionIcons[analysisResult.suggestion]}
                Sugestão: {analysisResult.suggestion}
            </AlertTitle>
            <AlertDescription className="pt-2">
              {analysisResult.justification}
            </AlertDescription>
             {(analysisResult.suggestedStake || analysisResult.suggestedDuration) && (
                <div className="mt-3 pt-2 border-t border-current/30 text-xs">
                    {analysisResult.suggestedStake && <p>Stake Sugerido: <strong>${analysisResult.suggestedStake.toFixed(2)}</strong></p>}
                    {analysisResult.suggestedDuration && <p>Duração Sugerida: <strong>{analysisResult.suggestedDuration} ticks</strong></p>}
                </div>
            )}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
