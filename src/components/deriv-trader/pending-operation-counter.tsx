// /src/components/deriv-trader/pending-operation-counter.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Loader2, XSquare } from 'lucide-react';
import type { Operation } from "@/lib/types";
import { useDerivApi } from '@/hooks/use-deriv-api';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { getGradientStyle } from './utils/get-gradient-style';

interface PendingOperationCounterProps {
  operation: Operation;
  onSell: () => void;
  isSelling: boolean;
}

const SELL_WINDOW_SECONDS = 15; // Janela em segundos ANTES do fim para desativar a venda

const formatTime = (ms: number): string => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export function PendingOperationCounter({ operation, onSell, isSelling }: PendingOperationCounterProps) {
  const { priceTicks } = useDerivApi();
  const [ticksSinceEntry, setTicksSinceEntry] = useState(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const { duration, durationUnit, timestamp: entryTimeISO, isSellable, entryPrice, direction } = operation;
  const entryTime = useMemo(() => new Date(entryTimeISO).getTime(), [entryTimeISO]);

  const latestTick = useMemo(() => {
    return priceTicks.length > 0 ? priceTicks[priceTicks.length - 1] : null;
  }, [priceTicks]);

  const currentStatus = useMemo(() => {
    if (!latestTick || !entryPrice) return 'even';
    if (latestTick.price > entryPrice) return direction === 'rise' ? 'winning' : 'losing';
    if (latestTick.price < entryPrice) return direction === 'fall' ? 'winning' : 'losing';
    return 'even';
  }, [latestTick, entryPrice, direction]);

  const buttonStyle = useMemo(() => {
    if (entryPrice && latestTick) {
      return getGradientStyle({
        entryPrice: entryPrice,
        currentPrice: latestTick.price,
        direction: direction,
      });
    }
    return undefined;
  }, [entryPrice, latestTick, direction]);

  const endTime = useMemo(() => {
    if (durationUnit === 't') return null;
    let durationMs = 0;
    switch (durationUnit) {
        case 's': durationMs = duration * 1000; break;
        case 'm': durationMs = duration * 60 * 1000; break;
        case 'h': durationMs = duration * 3600 * 1000; break;
        case 'd': durationMs = duration * 86400 * 1000; break;
    }
    return entryTime + durationMs;
  }, [duration, durationUnit, entryTime]);

  useEffect(() => {
    if (durationUnit !== 't' || !priceTicks) return;
    const relevantTicks = priceTicks.filter(tick => tick.epoch * 1000 > entryTime);
    setTicksSinceEntry(relevantTicks.length);
  }, [priceTicks, entryTime, durationUnit]);
  
  useEffect(() => {
    if (durationUnit === 't' || !endTime) return;
    const interval = setInterval(() => {
        const newRemainingMs = endTime - Date.now();
        setRemainingMs(newRemainingMs);
        if (newRemainingMs <= 0) {
            clearInterval(interval);
        }
    }, 1000);
    setRemainingMs(endTime - Date.now());
    return () => clearInterval(interval);
  }, [endTime, durationUnit]);

  // A venda só é permitida se o contrato for vendável E se o tempo restante for maior que a janela de segurança
  const isSellableNow = isSellable && remainingMs !== null && remainingMs > (SELL_WINDOW_SECONDS * 1000);
  
  const renderCounter = () => {
    if (durationUnit === 't') {
      const ticksRemaining = Math.max(0, duration - ticksSinceEntry);
      return (
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="font-mono text-xs">{ticksRemaining} Ticks</span>
        </div>
      );
    }

    if (remainingMs === null) {
      return (
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-xs">Calculando...</span>
        </div>
      );
    }

    if (remainingMs <= 0) {
        return (
             <div className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Aguardando...</span>
            </div>
        )
    }

    return (
       <div className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="font-mono text-xs font-medium">{formatTime(remainingMs)}</span>
       </div>
    );
  };
  
  return (
    <div className="flex items-center gap-2">
      {renderCounter()}
      {isSellable && (
        <Button 
            style={buttonStyle}
            variant="outline"
            size="sm" 
            className={cn(
                "h-7 px-2.5 transition-all text-white border border-black/10", // Cor do texto branca para contraste com gradiente
                (!isSellableNow || isSelling) && 'opacity-50 cursor-not-allowed'
            )}
            onClick={onSell}
            disabled={!isSellableNow || isSelling}
        >
          {isSelling ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <XSquare className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs font-semibold">Encerrar</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}