import { z } from 'zod';
import type { DurationUnit } from '@/components/trading/deriv-trader-interface.types';

export const StrategyCouncilInputSchema = z.object({
  symbol: z.string().describe("The trading symbol for which to create the council."),
  balance: z.number().describe("The user's designated trading balance for the day for risk management."),
  currency: z.string().describe("The currency of the account balance."),
  historicalDataJson: z.string().describe("A JSON string of recent historical price data for market analysis."),
  durationUnit: z.string().describe("The unit for the trade duration (e.g., 't' for ticks, 'm' for minutes). The council's strategy MUST be calibrated and optimized for this time horizon."),
});
export type StrategyCouncilInput = z.infer<typeof StrategyCouncilInputSchema>;

// Unified Schema with confidence levels
export const RobotStrategySchema = z.object({
  id: z.string().describe("A unique identifier for the robot (e.g., 'RSI_BOT_1')."),
  strategyType: z.enum([
      // Momentum & Trend
      'RSI', 
      'STOCHASTIC', 
      'MOVING_AVERAGE_CROSS',
      'MACD_CROSS',
      'ADX_TREND',
      'AWESOME_OSCILLATOR',
      'TRIX', // Advanced
      'ROC', // Advanced
      'RVI', // Advanced
      'PARABOLIC_SAR', // Advanced
      // Volatility & Structure
      'BOLLINGER_BANDS',
      'ICHIMOKU_CLOUD',
      'KAMA', // Advanced
      'DONCHIAN_CHANNELS', // Advanced
      'CHANDELIER_EXIT', // Advanced
      // Volume & Order Flow
      'VOLUME_PROFILE',
      'VWAP', // Advanced
      'MFI', // Advanced
      'OBV', // Advanced
      // Statistical & Mean Reversion
      'Z_SCORE', // Advanced
      'STOCH_RSI', // Advanced
      // Patterns
      'PRICE_ACTION_PATTERN',
  ]).describe("The type of strategy the robot uses."),
  justification: z.string().describe("A brief justification for why this robot and its parameters were chosen, explicitly mentioning the time horizon calibration."),
  suggestedStake: z.number().describe("The suggested stake for trades, calculated based on the provided daily balance."),
  suggestedDuration: z.number().describe("The suggested trade duration in the specified 'durationUnit'."),
  suggestedDurationUnit: z.custom<DurationUnit>().describe("The unit for the suggested trade duration, matching the input 'durationUnit'."),

  // --- Confidence Levels ---
  strongConfidence: z.number().min(0).max(100).describe("The confidence score (e.g., 90) for a strong signal."),
  weakConfidence: z.number().min(0).max(100).describe("The confidence score (e.g., 60) for a weak signal."),

  // --- RSI, STOCHASTIC, STOCH_RSI, RVI, MFI ---
  period: z.number().optional().describe("The period for RSI, Stochastic or other oscillators, calibrated for the time horizon."),
  strongBuyThreshold: z.number().optional().describe("The oscillator value below which a STRONG 'RISE' vote is cast."),
  weakBuyThreshold: z.number().optional().describe("The oscillator value below which a WEAK 'RISE' vote is cast."),
  strongSellThreshold: z.number().optional().describe("The oscillator value above which a STRONG 'FALL' vote is cast."),
  weakSellThreshold: z.number().optional().describe("The oscillator value above which a WEAK 'FALL' vote is cast."),

  // --- MOVING_AVERAGE_CROSS, GMMA ---
  shortPeriod: z.number().optional().describe("The period for the short-term moving average."),
  longPeriod: z.number().optional().describe("The period for the long-term moving average."),

  // --- BOLLINGER_BANDS & DONCHIAN_CHANNELS ---
  // Period is already defined above, can be reused
  stdDev: z.number().optional().describe("The number of standard deviations for the Bollinger bands."),

  // --- MACD_CROSS & TRIX ---
  fastPeriod: z.number().optional().describe("The period for the fast EMA."),
  slowPeriod: z.number().optional().describe("The period for the slow EMA."),
  signalPeriod: z.number().optional().describe("The period for the signal line EMA."),

  // --- KAMA ---
  fastEnd: z.number().optional().describe("The fastest EMA constant for KAMA (e.g., 2)."),
  slowEnd: z.number().optional().describe("The slowest EMA constant for KAMA (e.g., 30)."),

  // --- PRICE_ACTION_PATTERN ---
  pattern: z.enum(['hammer', 'shooting_star']).optional().describe("The candlestick pattern to watch for ('hammer' for RISE, 'shooting_star' for FALL)."),

  // --- ADX_TREND ---
  // Period is already defined above, can be reused
  trendStrengthThreshold: z.number().optional().describe("The ADX value above which a trend is considered strong enough to trade."),
  
  // --- VOLUME_PROFILE & VWAP ---
  profileBars: z.number().optional().describe("Number of recent bars to use for calculating the volume profile Point of Control (POC)."),

  // --- Z_SCORE ---
  zScoreThreshold: z.number().optional().describe("The Z-Score value (positive or negative) to trigger a mean reversion trade."),

  // --- PARABOLIC SAR & CHANDELIER_EXIT ---
  acceleration: z.number().optional().describe("The acceleration factor for Parabolic SAR."),
  maxAcceleration: z.number().optional().describe("The maximum acceleration factor."),
  multiplier: z.number().optional().describe("The ATR multiplier for Chandelier Exit.")
  
  // ICHIMOKU_CLOUD, AWESOME_OSCILLATOR, OBV, ROC have no extra parameters that need to be defined by the AI
});

export type RobotStrategy = z.infer<typeof RobotStrategySchema>;

export const StrategyCouncilOutputSchema = z.object({
  council: z.array(RobotStrategySchema).min(22, "O conselho deve conter no mínimo 22 robôs."),
});
export type StrategyCouncilOutput = z.infer<typeof StrategyCouncilOutputSchema>;
