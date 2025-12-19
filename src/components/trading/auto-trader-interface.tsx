"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Bot, Info, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { getAutotraderStrategyAction } from '@/app/actions/ai-actions';
import { useDerivApi } from '@/hooks/use-deriv-api';
import type { AutoTraderStrategyOutput } from '@/ai/flows/auto-trader-strategy-flow.types';
import { getHistoricalData } from '@/services/deriv-api-service';
import type { TradeResult } from '@/services/deriv-api-service';
import type { RiseFallFormValues } from './deriv-trader-interface.types';

// --- RSI Calculation Logic ---
function calculateRSI(prices: number[], period = 14): number | null {
  if (prices.length < period) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  // Calculate initial average gains and losses
  for (let i = 1; i <= period; i++) {
    const difference = prices[i] - prices[i - 1];
    if (difference >= 0) {
      gains += difference;
    } else {
      losses -= difference;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate subsequent RSI values
  for (let i = period + 1; i < prices.length; i++) {
    const difference = prices[i] - prices[i - 1];
    let currentGain = 0;
    let currentLoss = 0;

    if (difference >= 0) {
      currentGain = difference;
    } else {
      currentLoss = -difference;
    }

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
  }

  if (avgLoss === 0) {
    return 100; // Prevent division by zero
  }

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// --- Component ---
interface AutoTraderInterfaceProps {
    symbol: string;
    onTradeSuccess: (result: TradeResult) => void;
}

export function AutoTraderInterface({ symbol, onTradeSuccess }: AutoTraderInterfaceProps) {
    const [isAutopilotOn, setIsAutopilotOn] = useState(false);
    const [status, setStatus] = useState<'idle' | 'fetching_strategy' | 'running' | 'error' | 'executing'>('idle');
    const [strategy, setStrategy] = useState<AutoTraderStrategyOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentRSI, setCurrentRSI] = useState<number | null>(null);
    
    const form = useFormContext<RiseFallFormValues>();

    const { 
        isConnected, 
        activeToken, 
        accountBalance, 
        operationsLog, 
        executeTrade,
        priceTicks
    } = useDerivApi();
    
    const pricesRef = useRef<number[]>(priceTicks.map(t => t.price));
    const lastTradeTimestampRef = useRef<number>(0);
    const strategyIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        pricesRef.current = priceTicks.map(t => t.price);
    }, [priceTicks]);

    const fetchStrategy = useCallback(async () => {
        setStatus('fetching_strategy');
        setError(null);
        console.log("[AutoTrader] Fetching new strategy...");

        try {
            const historicalData = await getHistoricalData(symbol, undefined, 200);
            if (!historicalData || historicalData.length === 0) {
                throw new Error("Não foi possível obter dados históricos para definir a estratégia.");
            }
            
            const result = await getAutotraderStrategyAction({
                symbol,
                historicalData,
                balance: accountBalance.balance || 0,
                currency: accountBalance.currency || 'USD',
                stake: form.getValues('stake'),
                duration: form.getValues('duration'),
                durationUnit: form.getValues('duration_unit'),
                recentTrades: operationsLog.slice(0, 5),
            });

            if (result.success) {
                setStrategy(result.success);
                setStatus('running');
                console.log("[AutoTrader] New strategy received:", result.success);
            } else {
                throw new Error(result.error || "Erro desconhecido ao obter estratégia.");
            }
        } catch (e: any) {
            setError(e.message);
            setStatus('error');
            setIsAutopilotOn(false); // Turn off if strategy fails
        }
    }, [symbol, accountBalance, operationsLog, form]);

    const stopAutopilot = () => {
        if (strategyIntervalRef.current) {
            clearInterval(strategyIntervalRef.current);
            strategyIntervalRef.current = null;
        }
        setStatus('idle');
        setStrategy(null);
        setError(null);
        console.log("[AutoTrader] Stopped.");
    };

    const startAutopilot = useCallback(() => {
        if (!isConnected || !activeToken) {
            setError("A conexão com a corretora não está ativa.");
            setStatus('error');
            setIsAutopilotOn(false);
            return;
        }
        
        fetchStrategy(); // Fetch initial strategy immediately
        
        // Then set an interval to refetch it periodically
        strategyIntervalRef.current = setInterval(fetchStrategy, 5 * 60 * 1000); // every 5 minutes
    }, [isConnected, activeToken, fetchStrategy]);

    const handleToggleAutopilot = (isOn: boolean) => {
        setIsAutopilotOn(isOn);
        if (isOn) {
            startAutopilot();
        } else {
            stopAutopilot();
        }
    };
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (strategyIntervalRef.current) {
                clearInterval(strategyIntervalRef.current);
            }
        };
    }, []);

    const checkAndExecute = useCallback(async () => {
        if (status !== 'running' || !strategy) return;
        
        const now = Date.now();
        if (now - lastTradeTimestampRef.current < 15000) {
            return;
        }

        const prices = pricesRef.current;
        if (prices.length < 15) return;

        if (strategy.strategyName === 'RSI_BASIC' && strategy.rsiThreshold) {
            const rsi = calculateRSI(prices);
            setCurrentRSI(rsi);
            
            if (rsi === null) return;
            
            const conditionMet = (strategy.direction === 'RISE' && rsi <= strategy.rsiThreshold) ||
                                 (strategy.direction === 'FALL' && rsi >= strategy.rsiThreshold);

            if (conditionMet) {
                setStatus('executing');
                lastTradeTimestampRef.current = now;
                console.log(`[AutoTrader] Condition met (RSI: ${rsi.toFixed(2)}). Executing ${strategy.direction}...`);

                const { stake, duration, duration_unit } = form.getValues();
                const contractType = strategy.direction === 'RISE' ? 'CALL' : 'PUT';

                const result = await executeTrade(contractType, stake, symbol, strategy.direction.toLowerCase() as 'rise' | 'fall', duration, duration_unit);
                onTradeSuccess(result);
                
                setTimeout(() => setStatus('running'), 5000); 
            }
        }
    }, [status, strategy, executeTrade, onTradeSuccess, symbol, form]);

    useEffect(() => {
        if (isAutopilotOn && status === 'running') {
            checkAndExecute();
        }
    }, [priceTicks, isAutopilotOn, status, checkAndExecute]);

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="font-headline flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary" />
                            Piloto Automático
                        </CardTitle>
                        <CardDescription>
                            Deixe a IA negociar por você.
                        </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="autopilot-switch"
                            checked={isAutopilotOn}
                            onCheckedChange={handleToggleAutopilot}
                            disabled={status === 'fetching_strategy' || status === 'executing'}
                        />
                        <Label htmlFor="autopilot-switch">Ativar</Label>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {status === 'idle' && (
                    <Alert variant="default" className="bg-primary/5 border-primary/20">
                        <Info className="h-4 w-4 text-primary" />
                        <AlertTitle className="text-primary font-headline">Como funciona?</AlertTitle>
                        <AlertDescription className="text-primary/90">
                           Ao ativar, a IA definirá uma estratégia com base nos seus parâmetros de negociação. O sistema executará ordens automaticamente quando as condições forem atendidas, reavaliando a estratégia a cada 5 minutos.
                        </AlertDescription>
                    </Alert>
                )}
                {status === 'fetching_strategy' && (
                    <div className="flex items-center justify-center text-muted-foreground p-4">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span>A IA está a definir a estratégia...</span>
                    </div>
                )}
                {status === 'error' && (
                     <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Erro no Piloto Automático</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {strategy && (status === 'running' || status === 'executing') && (
                    <Alert variant="default" className="bg-green-500/10 border-green-500/50">
                        <Sparkles className="h-4 w-4 text-green-700"/>
                        <AlertTitle className="text-green-800">Estratégia Ativa: {strategy.strategyName}</AlertTitle>
                        <AlertDescription className="text-green-700 space-y-1 text-xs">
                           <p>{strategy.justification}</p>
                           <p className="font-semibold">
                                Condição: {strategy.direction === 'RISE' ? 'Comprar' : 'Vender'} se RSI {strategy.direction === 'RISE' ? '<=' : '>='} {strategy.rsiThreshold}.
                           </p>
                            <p className="pt-2">
                                RSI Atual: {currentRSI ? currentRSI.toFixed(2) : 'Calculando...'}
                            </p>
                             {status === 'executing' && <p className="font-bold pt-1">EXECUTANDO ORDEM...</p>}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
