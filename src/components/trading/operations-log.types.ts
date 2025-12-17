
export type OperationStatus = 'pending' | 'won' | 'lost';

export interface Operation {
  id: number;
  asset: string;
  direction: 'rise' | 'fall';
  stake: number;
  status: OperationStatus;
  result?: number; // Profit or loss amount
  timestamp: string; // Changed to string (ISO format)
}
