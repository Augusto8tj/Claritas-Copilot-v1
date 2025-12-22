

import type { RobotStrategy } from "@/ai/flows/strategy-council-flow.types";
import type { DurationUnit } from "./deriv-trader-interface.types";

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
  durationUnit: DurationUnit;
  initiator: OperationInitiator;
}

export interface RobotPerformance {
    id: string;
    strategy: RobotStrategy;
    wins: number;
    losses: number;
    totalProfit: number;
}
