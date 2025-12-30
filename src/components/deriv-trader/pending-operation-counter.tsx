// /src/components/deriv-trader/pending-operation-counter.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Loader2, XSquare } from 'lucide-react';
import type { DurationUnit, Operation } from "@/lib/types";
import { useDerivApi } from '@/hooks/use-deriv-api';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface PendingOperationCounterProps {
  operation: Operation;
  onSell: () => void;
  isSelling: boolean;
  currentStatus: 'winning' | 'losing' | 'even';
}

const SELL_WINDOW_SECONDS = 15; // Janela em segundos para permitir a venda

const formatTime = (ms: number): string => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export function PendingOperationCounter({ operation, onSell, isSelling, currentStatus }: PendingOperationCounterProps) {
  const { priceTicks } = useDerivApi();
  const [ticksSinceEntry, setTicksSinceEntry] = useState(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const { duration, durationUnit, timestamp: entryTimeISO, isSellable } = operation;
  const entryTime = useMemo(() => new Date(entryTimeISO).getTime(), [entryTimeISO]);

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

  // Lógica de ativação corrigida: ativo se o tempo restante for MAIOR que 15s.
  const isSellableNow = isSellable && remainingMs !== null && remainingMs > (SELL_WINDOW_SECONDS * 1000);
  
  const renderCounter = () => {
    if (durationUnit === 't') {
      const ticksRemaining = Math.max(0, duration - ticksSinceEntry);
      return (
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{ticksRemaining} Ticks</span>
        </div>
      );
    }

    if (remainingMs === null) {
      return (
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Calculando...</span>
        </div>
      );
    }

    if (remainingMs <= 0) {
        return (
             <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Aguardando...</span>
            </div>
        )
    }

    return (
       <div className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{formatTime(remainingMs)}</span>
       </div>
    );
  };
  
  return (
    <div className="flex items-center gap-2">
      {renderCounter()}
      {isSellable && (
        <Button 
            variant="outline"
            size="sm" 
            className={cn("h-7 w-20",
                currentStatus === 'winning' && 'bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20 hover:text-green-700',
                currentStatus === 'losing' && 'bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20 hover:text-red-700',
            )}
            onClick={onSell}
            disabled={!isSellableNow || isSelling}
        >
          {isSelling ? <Loader2 className="h-4 w-4 animate-spin"/> : <><XSquare className="h-4 w-4 mr-1"/> Encerrar</>}
        </Button>
      )}
    </div>
  );
}
