// /src/components/trading/operations-log.types.ts
import type { RobotStrategy } from "@/ai/flows/strategy-council-flow.types";

export type OperationStatus = 'pending' | 'won' | 'lost';
export type OperationInitiator = 'Manual' | 'Piloto' | 'Conselho';

export interface Operation {
  id: number;
  asset: string;
  direction: 'rise' | 'fall';
  stake: number;
  status: OperationStatus;
  result?: number; // Profit or loss amount
  timestamp: string; // Changed to string (ISO format)
  duration: number;
  durationUnit: 't' | 's' | 'm' | 'h' | 'd';
  initiator: OperationInitiator;
  entryPrice?: number;
  exitPrice?: number;
}

export interface RobotPerformance {
    id: string;
    strategyType: RobotStrategy['strategyType'];
    strategy: RobotStrategy;
    wins: number;
    losses: number;
    totalProfit: number;
}
