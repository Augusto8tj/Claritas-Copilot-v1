'use client';

import React from "react";
import { TradingDesk } from "@/components/trading/trading-desk";


export default function TradingDeskPage() {

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
       <div className="flex items-center justify-between space-y-2">
            <h1 className="text-3xl font-bold tracking-tight font-headline">
                Mesa de Operações
            </h1>
        </div>
        <p className="text-muted-foreground">
            Acompanhe o desempenho em tempo real de cada um dos 22 robôs analistas na Arena Virtual.
        </p>
      <TradingDesk />
    </div>
  );
}
