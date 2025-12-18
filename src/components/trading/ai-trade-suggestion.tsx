
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "../ui/button";
import { Loader2, Sparkles, TrendingUp, TrendingDown, HelpCircle, AlertTriangle, Timer, Zap, Hourglass } from "lucide-react";
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

type AwaitingEntryState = {
    direction: 'rise' | 'fall';
    startTime: number;
    initialPrices: number[];
};

export function AITradeSuggestion({ symbol, form, onExecuteTrade }: AITradeSuggestionProps) {
  const [analysisResult, setAnalysisResult] = useState<AssetAnalysisOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);
  const [timeSinceAnalysis, setTimeSinceAnalysis] = useState<string>("");
  const { accountBalance, operationsLog, priceTicks } = useDerivApi();
  const { toast } = useToast();
  const [autoExecute, setAutoExecute] = useState(false);
  const [isAwaitingEntry, setIsAwaitingEntry] = useState<AwaitingEntryState | null>(null);

  const CONFIDENCE_THRESHOLD = 80;
  const AWAIT_TIMEOUT = 10000; // 10 seconds to wait for an entry point

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setError(null);
    setIsAwaitingEntry(null);
    
    try {
      const formData = form.getValues();
      
      // Determine the amount of historical data to fetch based on duration unit
      let dataCount;
      switch (formData.duration_unit) {
        case 't': // ticks
        case 's': // seconds
          dataCount = 200;
          break;
        case 'm': // minutes
        case 'h': // hours
        case 'd': // days
          dataCount = 1000;
          break;
        default:
          dataCount = 200;
      }

      const historicalData = await getHistoricalData(symbol, undefined, dataCount);
      if (!historicalData || historicalData.length === 0) {
        throw new Error(`Não foi possível obter dados históricos para ${symbol}.`);
      }


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
          
          if (autoExecute && result.success.confidenceScore >= CONFIDENCE_THRESHOLD && (result.success.suggestion === 'RISE' || result.success.suggestion === 'FALL')) {
              toast({ title: "Análise de Alta Confiança!", description: `Aguardando ponto de entrada para ${result.success.suggestion}...` });
              setIsAwaitingEntry({
                  direction: result.success.suggestion.toLowerCase() as 'rise' | 'fall',
                  startTime: Date.now(),
                  initialPrices: priceTicks.slice(-5).map(p => p.price), // Store last 5 prices
              });
          }

      } else {
          setError(result.error || "Ocorreu um erro desconhecido.");
      }
    } catch (e: any) {
       setError(e.message || "Ocorreu um erro ao buscar dados para análise.");
    }

    setIsAnalyzing(false);
  }, [symbol, form, accountBalance, operationsLog, autoExecute, priceTicks, toast]);
  
  const handleExecute = async (direction: 'rise' | 'fall') => {
    setIsExecuting(true);
    await onExecuteTrade(direction);
    
    setTimeout(() => {
        setAnalysisResult(null); 
        setIsExecuting(false);
        setIsAwaitingEntry(null);
    }, 1000);
  }

  // Effect to handle the "awaiting entry" logic
  useEffect(() => {
    if (!isAwaitingEntry || priceTicks.length < 2) return;

    // Timeout check
    if (Date.now() - isAwaitingEntry.startTime > AWAIT_TIMEOUT) {
        toast({
            variant: "destructive",
            title: "Entrada Expirada",
            description: "Não foi encontrado um ponto de entrada ideal a tempo.",
        });
        setIsAwaitingEntry(null);
        return;
    }

    const currentPrice = priceTicks[priceTicks.length - 1].price;
    const prevPrice = priceTicks[priceTicks.length - 2].price;

    let entryConditionMet = false;
    if (isAwaitingEntry.direction === 'rise' && currentPrice < prevPrice) {
        // Suggested RISE, wait for a dip
        entryConditionMet = true;
    } else if (isAwaitingEntry.direction === 'fall' && currentPrice > prevPrice) {
        // Suggested FALL, wait for a spike
        entryConditionMet = true;
    }

    if (entryConditionMet) {
        toast({
            title: "Ponto de Entrada Encontrado!",
            description: `Executando ordem de ${isAwaitingEntry.direction.toUpperCase()}.`,
        });
        handleExecute(isAwaitingEntry.direction);
        setIsAwaitingEntry(null); // Stop awaiting
    }

  }, [priceTicks, isAwaitingEntry, toast]);


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
        {isAwaitingEntry && (
             <div className="flex items-center justify-center text-primary p-4">
                <Hourglass className="mr-2 h-4 w-4 animate-spin" />
                <span>Aguardando entrada ideal...</span>
            </div>
        )}
        {analysisResult && !isAnalyzing && !isAwaitingEntry && (
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
              <div className="space-y-1 mt-2">
                <p className="font-semibold">Confiança da IA: {analysisResult.confidenceScore.toFixed(0)}%</p>
                {analysisResult.analysisDataPointsCount && (
                  <p className="text-xs italic">Análise baseada nos últimos {analysisResult.analysisDataPointsCount} preços.</p>
                )}
              </div>
            </AlertDescription>
             {(analysisResult.suggestedStake || analysisResult.suggestedDuration) && (
                <div className="mt-3 pt-2 border-t border-current/30 text-xs">
                    {analysisResult.suggestedStake && <p>Stake Sugerido: <strong>${analysisResult.suggestedStake.toFixed(2)}</strong></p>}
                    {analysisResult.suggestedDuration && <p>Duração Sugerida: <strong>{analysisResult.suggestedDuration} ticks</strong></p>}
                </div>
            )}
             {analysisResult.suggestion !== 'HOLD' && (
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

    