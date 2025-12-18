
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "../ui/button";
import { Loader2, Sparkles, TrendingUp, TrendingDown, HelpCircle, AlertTriangle, Timer, Zap } from "lucide-react";
import { getAssetAnalysisAction } from "@/app/actions/ai-actions";
import type { AssetAnalysisOutput } from "@/ai/flows/asset-analysis-flow.types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { cn } from "@/lib/utils";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { getHistoricalData } from "@/services/deriv-api-service";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";

interface AITradeSuggestionProps {
  symbol: string;
  form: any;
  onExecuteTrade: (tradeDirection: 'rise' | 'fall') => void;
}

export function AITradeSuggestion({ symbol, form, onExecuteTrade }: AITradeSuggestionProps) {
  const [analysisResult, setAnalysisResult] = useState<AssetAnalysisOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);
  const [timeSinceAnalysis, setTimeSinceAnalysis] = useState<string>("");
  const { accountBalance, operationsLog } = useDerivApi();
  const { toast } = useToast();
  const [autoExecute, setAutoExecute] = useState(false);

  const CONFIDENCE_THRESHOLD = 80;

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setError(null);
    
    try {
      const historicalData = await getHistoricalData(symbol, undefined, 120);
      if (!historicalData || historicalData.length === 0) {
        throw new Error(`Não foi possível obter dados históricos para ${symbol}.`);
      }

      const formData = form.getValues();

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
          setLastAnalysisTime(new Date());
          setError(null);
          
          // Auto-execute logic
          if (autoExecute && result.success.confidenceScore >= CONFIDENCE_THRESHOLD && (result.success.suggestion === 'RISE' || result.success.suggestion === 'FALL')) {
              toast({ title: "Auto-Execução Ativada!", description: `Confiança de ${result.success.confidenceScore.toFixed(0)}% é alta. Executando ordem de ${result.success.suggestion}...` });
              handleExecute(result.success.suggestion.toLowerCase() as 'rise' | 'fall');
          }

      } else {
          setError(result.error || "Ocorreu um erro desconhecido.");
      }
    } catch (e: any) {
       setError(e.message || "Ocorreu um erro ao buscar dados para análise.");
    }

    setIsAnalyzing(false);
  }, [symbol, form, accountBalance, operationsLog, autoExecute]);
  
  const handleExecute = async (direction: 'rise' | 'fall') => {
    setIsExecuting(true);
    await onExecuteTrade(direction);
    
    // Give feedback and then reset
    setTimeout(() => {
        setAnalysisResult(null); 
        setIsExecuting(false);
    }, 1000);
  }

  useEffect(() => {
    if (!lastAnalysisTime) {
      setTimeSinceAnalysis("");
      return;
    }
    const timer = setInterval(() => {
        const seconds = Math.floor((new Date().getTime() - lastAnalysisTime.getTime()) / 1000);
        setTimeSinceAnalysis(seconds < 60 ? `${seconds}s atrás` : `${Math.floor(seconds / 60)}m atrás`);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastAnalysisTime]);

  const suggestionIcons = {
    RISE: <TrendingUp className="h-6 w-6 text-green-500" />,
    FALL: <TrendingDown className="h-6 w-6 text-red-500" />,
    HOLD: <HelpCircle className="h-6 w-6 text-yellow-500" />,
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle className="font-headline flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Copiloto de Trade
            </CardTitle>
            <div className="flex items-center space-x-2">
                <Switch id="auto-execute-switch" checked={autoExecute} onCheckedChange={setAutoExecute} />
                <Label htmlFor="auto-execute-switch" className="text-xs">Auto-Executar</Label>
            </div>
        </div>
        <CardDescription>
          Análise de IA baseada nos dados de mercado e no seu perfil de risco.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleAnalyze}
          disabled={isAnalyzing || !accountBalance.balance}
        >
          {isAnalyzing ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Sparkles className="mr-2 h-4 w-4" /> )}
          {isAnalyzing ? 'Analisando...' : 'Analisar Agora'}
        </Button>
         {lastAnalysisTime && !isAnalyzing && (
            <div className="flex items-center justify-center text-xs text-muted-foreground">
                <Timer className="h-3 w-3 mr-1.5"/>
                Última análise: {timeSinceAnalysis}
            </div>
         )}
        {error && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro na Análise</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        {isAnalyzing && (
            <div className="flex items-center justify-center text-muted-foreground p-4">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Buscando análise...</span>
            </div>
        )}
        {analysisResult && !isAnalyzing && (
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
              <p>{analysisResult.justification}</p>
              <p className="font-semibold mt-2">Confiança da IA: {analysisResult.confidenceScore.toFixed(0)}%</p>
            </AlertDescription>
             {(analysisResult.suggestedStake || analysisResult.suggestedDuration) && (
                <div className="mt-3 pt-2 border-t border-current/30 text-xs">
                    {analysisResult.suggestedStake && <p>Stake Sugerido: <strong>${analysisResult.suggestedStake.toFixed(2)}</strong></p>}
                    {analysisResult.suggestedDuration && <p>Duração Sugerida: <strong>{analysisResult.suggestedDuration} ticks</strong></p>}
                </div>
            )}
             {analysisResult.suggestion !== 'HOLD' && analysisResult.confidenceScore >= CONFIDENCE_THRESHOLD && (
                <Button
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => handleExecute(analysisResult.suggestion.toLowerCase() as 'rise' | 'fall')}
                    disabled={isExecuting}
                >
                    {isExecuting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                    {isExecuting ? 'Executando...' : `Executar ${analysisResult.suggestion} Agora`}
                </Button>
            )}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
