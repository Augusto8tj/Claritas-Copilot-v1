// /src/components/deriv-trader/pending-operation-counter.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { DurationUnit } from "@/lib/types";
import { useDerivApi } from '@/features/trading/hooks/use-deriv-api';

interface PendingOperationCounterProps {
  duration: number;
  durationUnit: DurationUnit;
  entryTime: number;
}

const formatTime = (ms: number): string => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export function PendingOperationCounter({ duration, durationUnit, entryTime }: PendingOperationCounterProps) {
  const { priceTicks } = useDerivApi();
  const [ticksSinceEntry, setTicksSinceEntry] = useState(0);
  const [countdown, setCountdown] = useState<string | null>(null);

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
    
    // Contar ticks que ocorreram APÓS o tempo de entrada da operação
    const relevantTicks = priceTicks.filter(tick => tick.epoch * 1000 > entryTime);
    setTicksSinceEntry(relevantTicks.length);

  }, [priceTicks, entryTime, durationUnit]);
  
   useEffect(() => {
    if (durationUnit === 't' || !endTime) return;

    const interval = setInterval(() => {
        const remainingMs = endTime - Date.now();
        if (remainingMs > 0) {
            setCountdown(formatTime(remainingMs));
        } else {
            setCountdown("Aguardando resultado...");
            clearInterval(interval);
        }
    }, 1000);

    // Set initial value immediately
    setCountdown(formatTime(endTime - Date.now()));

    return () => clearInterval(interval);

  }, [endTime, durationUnit]);


  if (durationUnit === 't') {
    const ticksRemaining = Math.max(0, duration - ticksSinceEntry);
    return (
      <>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{ticksRemaining} Ticks</span>
      </>
    );
  }

  // Fallback para durações baseadas em tempo (s, m, h, d)
  return (
    <>
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>{countdown || 'Calculando...'}</span>
    </>
  );
}
