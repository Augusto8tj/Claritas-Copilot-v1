"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Operation, TickData } from "@/lib/types";

interface PendingOperationCounterProps {
  operation: Operation;
  onSell: () => void;
  isSelling: boolean;
  latestTick: TickData | null;
}

function getGradientStyle({
  entryPrice,
  currentPrice,
  direction,
  maxExpectedMove = 0.005, // 0.5%
}: {
  entryPrice: number;
  currentPrice: number;
  direction: "rise" | "fall";
  maxExpectedMove?: number;
}) {
  const diffPercent = (currentPrice - entryPrice) / entryPrice;

  const signedDiff =
    direction === "rise" ? diffPercent : -diffPercent;

  const normalized = Math.max(
    -1,
    Math.min(1, signedDiff / maxExpectedMove)
  );

  const hue = 120 * ((normalized + 1) / 2);

  return {
    background: `linear-gradient(135deg,
      hsl(${hue}, 85%, 48%),
      hsl(${hue}, 85%, 38%)
    )`,
    color: "#fff",
    boxShadow: `0 0 ${6 + Math.abs(normalized) * 12}px hsl(${hue}, 90%, 55%)`,
  };
}

export function PendingOperationCounter({
  operation,
  onSell,
  isSelling,
  latestTick,
}: PendingOperationCounterProps) {

  const buttonStyle =
    operation.entryPrice && latestTick
      ? getGradientStyle({
          entryPrice: operation.entryPrice,
          currentPrice: latestTick.price,
          direction: operation.direction,
        })
      : undefined;

  return (
    <Button
      onClick={onSell}
      disabled={isSelling}
      style={buttonStyle}
      className={cn(
        "h-7 px-3 text-xs font-semibold",
        "transition-all duration-200",
        "border border-black/10",
        isSelling && "opacity-70 cursor-not-allowed"
      )}
    >
      {isSelling ? "Encerrando..." : "Encerrar"}
    </Button>
  );
}
