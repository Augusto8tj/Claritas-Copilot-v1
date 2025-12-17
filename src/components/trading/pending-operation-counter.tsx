
"use client";

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { DurationUnit } from './deriv-trader-interface';
import { useDerivApi } from '@/hooks/use-deriv-api';

interface PendingOperationCounterProps {
  duration: number;
  durationUnit: DurationUnit;
  entryTime: number;
}

export function PendingOperationCounter({ duration, durationUnit, entryTime }: PendingOperationCounterProps) {
  const { priceTicks } = useDerivApi();
  const [ticksSinceEntry, setTicksSinceEntry] = useState(0);

  useEffect(() => {
    if (durationUnit !== 't') {
      return;
    }
    
    // Contar ticks que ocorreram APÓS o tempo de entrada da operação
    const relevantTicks = priceTicks.filter(tick => tick.epoch * 1000 > entryTime);
    setTicksSinceEntry(relevantTicks.length);

  }, [priceTicks, entryTime, durationUnit]);


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
  // Esta parte pode ser melhorada com um contador de tempo real se necessário
  return (
    <>
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Em Andamento</span>
    </>
  );
}
