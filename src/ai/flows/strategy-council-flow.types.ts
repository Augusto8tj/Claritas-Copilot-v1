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


const BaseRobotSchema = z.object({
  id: z.string().describe("A unique identifier for the robot (e.g., 'RSI_BOT_1')."),
  strategyType: z.string().describe("The type of strategy the robot uses."),
  justification: z.string().describe("A brief justification for why this robot and its parameters were chosen for the current market conditions."),
  suggestedStake: z.number().describe("The suggested stake for trades executed by this robot, calculated based on the provided daily balance."),
  suggestedDuration: z.number().describe("The suggested trade duration in the specified 'durationUnit'."),
  suggestedDurationUnit: z.custom<DurationUnit>().describe("The unit for the suggested trade duration, matching the input 'durationUnit'."),
});

const RsiRobotSchema = BaseRobotSchema.extend({
  strategyType: z.literal('RSI'),
  buyThreshold: z.number().describe("The RSI value below which a 'RISE' vote is cast."),
  sellThreshold: z.number().describe("The RSI value above which a 'FALL' vote is cast."),
});

const StochRobotSchema = BaseRobotSchema.extend({
    strategyType: z.literal('STOCHASTIC'),
    buyThreshold: z.number().describe("The Stochastic value below which a 'RISE' vote is cast."),
    sellThreshold: z.number().describe("The Stochastic value above which a 'FALL' vote is cast."),
});

const MACrossRobotSchema = BaseRobotSchema.extend({
    strategyType: z.literal('MOVING_AVERAGE_CROSS'),
    shortPeriod: z.number().describe("The period for the short-term moving average."),
    longPeriod: z.number().describe("The period for the long-term moving average."),
});

const BollingerBandsRobotSchema = BaseRobotSchema.extend({
    strategyType: z.literal('BOLLINGER_BANDS'),
    period: z.number().describe("The period for the Bollinger Bands calculation."),
    stdDev: z.number().describe("The number of standard deviations for the bands."),
});

const MacdCrossRobotSchema = BaseRobotSchema.extend({
    strategyType: z.literal('MACD_CROSS'),
    fastPeriod: z.number().describe("The period for the fast EMA."),
    slowPeriod: z.number().describe("The period for the slow EMA."),
    signalPeriod: z.number().describe("The period for the signal line EMA."),
});

const PriceActionRobotSchema = BaseRobotSchema.extend({
    strategyType: z.literal('PRICE_ACTION_PATTERN'),
    pattern: z.enum(['hammer', 'shooting_star']).describe("The candlestick pattern to watch for ('hammer' for RISE, 'shooting_star' for FALL)."),
});

const AdxTrendRobotSchema = BaseRobotSchema.extend({
    strategyType: z.literal('ADX_TREND'),
    trendStrengthThreshold: z.number().describe("The ADX value above which a trend is considered strong enough to trade."),
});

const IchimokuCloudRobotSchema = BaseRobotSchema.extend({
  strategyType: z.literal('ICHIMOKU_CLOUD'),
});

const AwesomeOscillatorRobotSchema = BaseRobotSchema.extend({
  strategyType: z.literal('AWESOME_OSCILLATOR'),
});

const VolumeProfileRobotSchema = BaseRobotSchema.extend({
  strategyType: z.literal('VOLUME_PROFILE'),
  profileBars: z.number().describe("Number of recent bars to use for calculating the volume profile Point of Control (POC).")
});


export const RobotStrategySchema = z.union([
    RsiRobotSchema, 
    StochRobotSchema, 
    MACrossRobotSchema,
    BollingerBandsRobotSchema,
    MacdCrossRobotSchema,
    PriceActionRobotSchema,
    AdxTrendRobotSchema,
    IchimokuCloudRobotSchema,
    AwesomeOscillatorRobotSchema,
    VolumeProfileRobotSchema
]);
export type RobotStrategy = z.infer<typeof RobotStrategySchema>;


export const StrategyCouncilOutputSchema = z.object({
  council: z.array(RobotStrategySchema).min(10).max(10).describe("An array of 10 distinct robot analyst strategies."),
});
export type StrategyCouncilOutput = z.infer<typeof StrategyCouncilOutputSchema>;
