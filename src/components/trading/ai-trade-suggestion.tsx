
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "../ui/button";
import { Loader2, Sparkles, TrendingUp, TrendingDown, HelpCircle, AlertTriangle, Timer } from "lucide-react";
import { getAssetAnalysisAction } from "@/app/actions/ai-actions";
import type { AssetAnalysisOutput } from "@/ai/flows/asset-analysis-flow.types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { cn } from "@/lib/utils";
import { useDerivApi } from "@/hooks/use-deriv-api";
import { getHistoricalData } from "@/services/deriv-api-service";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";

interface AITradeSuggestionProps {
  symbol: string;
  form: any; // Pass the form instance from the parent
}

export function AITradeSuggestion({ symbol, form }: AITradeSuggestionProps) {
  const [analysisResult, setAnalysisResult] = useState<AssetAnalysisOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);
  const [timeSinceAnalysis, setTimeSinceAnalysis] = useState<string>("");
  const [isAutoAnalysisOn, setIsAutoAnalysisOn] = useState(false);
  const { accountBalance, operationsLog } = useDerivApi();
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleAnalyze = async (isAuto: boolean = false) => {
    if (isAnalyzing && isAuto) return; // Prevent multiple auto analyses piling up

    setIsAnalyzing(true);
    if (!isAuto) {
        setAnalysisResult(null);
        setError(null);
    }
    
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
          setError(null); // Clear previous errors on success
      } else {
          setError(result.error || "Ocorreu um erro desconhecido.");
      }
    } catch (e: any) {
       setError(e.message || "Ocorreu um erro ao buscar dados para análise.");
    }

    setIsAnalyzing(false);
  };
  
  // Effect for automatic analysis
  useEffect(() => {
    // Clear any existing interval when settings change
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }

    if (isAutoAnalysisOn) {
      // Start analysis immediately when toggled on or symbol changes
      handleAnalyze(true);
      
      // Set up new interval
      analysisIntervalRef.current = setInterval(() => handleAnalyze(true), 60000);
    }

    // Cleanup on component unmount or settings change
    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, isAutoAnalysisOn, accountBalance.balance]);


  // Effect to update the "time since analysis" string
  useEffect(() => {
    if (!lastAnalysisTime) {
      setTimeSinceAnalysis("");
      return;
    }
    
    const timer = setInterval(() => {
        const seconds = Math.floor((new Date().getTime() - lastAnalysisTime.getTime()) / 1000);
        if (seconds < 60) {
            setTimeSinceAnalysis(`${seconds}s atrás`);
        } else {
            setTimeSinceAnalysis(`${Math.floor(seconds / 60)}m atrás`);
        }
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
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Copiloto de Trade
            </CardTitle>
            <CardDescription>
              Análise de IA baseada nos dados do mercado.
            </CardDescription>
          </div>
           <div className="flex items-center space-x-2">
              <Switch 
                id="auto-analysis-switch" 
                checked={isAutoAnalysisOn}
                onCheckedChange={setIsAutoAnalysisOn}
              />
              <Label htmlFor="auto-analysis-switch">Auto</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleAnalyze(false)}
          disabled={isAnalyzing || !accountBalance.balance}
        >
          {isAnalyzing && !isAutoAnalysisOn ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {isAnalyzing && !isAutoAnalysisOn ? 'Analisando...' : 'Analisar Agora'}
        </Button>
         {lastAnalysisTime && (
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
        {isAnalyzing && isAutoAnalysisOn && !analysisResult && !error && (
            <div className="flex items-center justify-center text-muted-foreground p-4">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Buscando primeira análise...</span>
            </div>
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
