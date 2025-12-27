import { z } from 'zod';
import type { DurationUnit } from '@/components/trading/deriv-trader-interface.types';

export const StrategyCouncilInputSchema = z.object({
  symbol: z.string().describe("The trading symbol for which to create the council."),
  balance: z.number().describe("The user's designated trading balance for the day for risk management."),
  currency: z.string().describe("The currency of the account balance."),
  historicalDataJson: z.string().describe("A JSON string of recent historical price data for market analysis."),
  durationUnit: z.string().describe("The unit for the trade duration (e.g., 't' for ticks, 's' for seconds, 'm' for minutes). The council's strategy should be optimized for this time horizon."),
});
export type StrategyCouncilInput = z.infer<typeof StrategyCouncilInputSchema>;

// Unified Schema with confidence levels
export const RobotStrategySchema = z.object({
  id: z.string().describe("A unique identifier for the robot (e.g., 'RSI_BOT_1')."),
  strategyType: z.enum([
      'RSI', 
      'STOCHASTIC', 
      'MOVING_AVERAGE_CROSS',
      'BOLLINGER_BANDS',
      'MACD_CROSS',
      'PRICE_ACTION_PATTERN',
      'ADX_TREND',
      'ICHIMOKU_CLOUD',
      'AWESOME_OSCILLATOR',
      'VOLUME_PROFILE'
  ]).describe("The type of strategy the robot uses."),
  justification: z.string().describe("A brief justification for why this robot and its parameters were chosen for the current market conditions."),
  suggestedStake: z.number().describe("The suggested stake for trades, calculated based on the provided daily balance."),
  suggestedDuration: z.number().describe("The suggested trade duration in the specified 'durationUnit'."),
  suggestedDurationUnit: z.custom<DurationUnit>().describe("The unit for the suggested trade duration, matching the input 'durationUnit'."),

  // --- Confidence Levels ---
  strongConfidence: z.number().min(0).max(100).describe("The confidence score (e.g., 90) for a strong signal."),
  weakConfidence: z.number().min(0).max(100).describe("The confidence score (e.g., 60) for a weak signal."),

  // --- RSI & STOCHASTIC ---
  strongBuyThreshold: z.number().optional().describe("The RSI/Stochastic value below which a STRONG 'RISE' vote is cast."),
  weakBuyThreshold: z.number().optional().describe("The RSI/Stochastic value below which a WEAK 'RISE' vote is cast."),
  strongSellThreshold: z.number().optional().describe("The RSI/Stochastic value above which a STRONG 'FALL' vote is cast."),
  weakSellThreshold: z.number().optional().describe("The RSI/Stochastic value above which a WEAK 'FALL' vote is cast."),

  // --- MOVING_AVERAGE_CROSS ---
  shortPeriod: z.number().optional().describe("The period for the short-term moving average."),
  longPeriod: z.number().optional().describe("The period for the long-term moving average."),

  // --- BOLLINGER_BANDS ---
  period: z.number().optional().describe("The period for the Bollinger Bands calculation."),
  stdDev: z.number().optional().describe("The number of standard deviations for the bands."),

  // --- MACD_CROSS ---
  fastPeriod: z.number().optional().describe("The period for the fast EMA."),
  slowPeriod: z.number().optional().describe("The period for the slow EMA."),
  signalPeriod: z.number().optional().describe("The period for the signal line EMA."),

  // --- PRICE_ACTION_PATTERN ---
  pattern: z.enum(['hammer', 'shooting_star']).optional().describe("The candlestick pattern to watch for ('hammer' for RISE, 'shooting_star' for FALL)."),

  // --- ADX_TREND ---
  trendStrengthThreshold: z.number().optional().describe("The ADX value above which a trend is considered strong enough to trade."),
  
  // --- VOLUME_PROFILE ---
  profileBars: z.number().optional().describe("Number of recent bars to use for calculating the volume profile Point of Control (POC).")

  // ICHIMOKU_CLOUD & AWESOME_OSCILLATOR have no extra parameters that need to be defined by the AI
});

export type RobotStrategy = z.infer<typeof RobotStrategySchema>;

export const StrategyCouncilOutputSchema = z.object({
  council: z.array(RobotStrategySchema).min(10, "Array must contain at least 10 element(s)"),
});
export type StrategyCouncilOutput = z.infer<typeof StrategyCouncilOutputSchema>;
