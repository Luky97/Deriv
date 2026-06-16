export type DCirclePhase = 'SCANNING' | 'ENTER_EVEN' | 'RUN_BOT_ON_EVEN' | 'STOPPED'
export type DCircleBotState =
  | 'SCANNING'
  | 'WAITING_FOR_1000_TICKS'
  | 'WATCHING_MARKET_STABILITY'
  | 'PLACING_TRADE'
  | 'TRADING'
  | 'MANUAL_STOPPED'
  | 'STOPPED_BY_STOP_LOSS'
  | 'STOPPED_BY_TAKE_PROFIT'
  | 'STOPPED_BY_THREE_CONSECUTIVE_LOSSES'
  | 'STOPPED_BY_THREE_CONSECUTIVE_WINS'
  | 'STOPPED'
export type DigitParity = 'EVEN' | 'ODD'
export type DCircleContractType = 'DIGITEVEN'

export interface DCircleConfig {
  tickWindow: number
  minEvenDominanceGap: number
  minGreenPercentage: number
  maxRedPercentage: number
  balanceGapThreshold: number
  shiftWaitTicks: number
  stabilityWatchMinutes: number
  maximumWatchMinutes: number
  minimumSetupScore: number
  contractDuration: number
  maxOpenTrades: number
}

export const DEFAULT_DCIRCLE_CONFIG: DCircleConfig = {
  tickWindow: 1000,
  minEvenDominanceGap: 1.0,
  minGreenPercentage: 10.5,
  maxRedPercentage: 9.5,
  balanceGapThreshold: 0.5,
  shiftWaitTicks: 100,
  stabilityWatchMinutes: 5,
  maximumWatchMinutes: 10,
  minimumSetupScore: 7,
  contractDuration: 1,
  maxOpenTrades: 1,
}

export const SCAN_MARKETS = [
  'R_10',
  'R_25',
  'R_50',
  'R_75',
  'R_100',
  '1HZ10V',
  '1HZ25V',
  '1HZ50V',
  '1HZ75V',
  '1HZ100V',
]

export interface DigitDistribution {
  counts: number[]
  percentages: number[]
  greenDigit: number | null
  blueDigit: number | null
  redDigit: number | null
  yellowDigit: number | null
  evenTotal: number
  oddTotal: number
}

export interface MarketAnalysis extends DigitDistribution {
  symbol: string
  enabled: boolean
  buffer: number[]
  tickCount: number
  lastDigit: number | null
  score: number
  setupDetected: boolean
  redBarTiming: boolean
  balanceConfirmed: boolean
  stabilityWatchStartEpoch: number | null
  stabilityWatchElapsedSeconds: number
  stabilityWatchComplete: boolean
  redOrYellowTouch: boolean
  entryStatus: string
  status: string
  previousOddTotal: number
  previousEvenTotal: number
  previousRedDigit: number | null
  previousRedPercentage: number
  ticksSincePhaseChange: number
}

export interface SetupLog {
  id: string
  timestamp: string
  market: string
  phase: DCirclePhase
  greenDigit: number | null
  blueDigit: number | null
  redDigit: number | null
  yellowDigit: number | null
  percentages: number[]
  evenTotal: number
  oddTotal: number
  score: number
  action: string
}

export interface DCircleTradeLog {
  id: string
  timestamp: string
  market: string
  phase: DCirclePhase
  contractType: DCircleContractType
  stake: number
  result: 'WIN' | 'LOSS' | 'BREAK_EVEN'
  profit: number
  contractId: string
  greenDigit: number | null
  blueDigit: number | null
  redDigit: number | null
  yellowDigit: number | null
  percentages: number[]
}

export const isEvenDigit = (digit: number | null | undefined) => [0, 2, 4, 6, 8].includes(Number(digit))
export const isOddDigit = (digit: number | null | undefined) => [1, 3, 5, 7, 9].includes(Number(digit))
export const getParity = (digit: number): DigitParity => (isEvenDigit(digit) ? 'EVEN' : 'ODD')

export class TickBuffer {
  static update(buffer: number[], digit: number, maxSize = DEFAULT_DCIRCLE_CONFIG.tickWindow) {
    const next = [...buffer, digit]
    while (next.length > maxSize) next.shift()
    return next
  }
}

export class DigitDistributionAnalyzer {
  static analyze(buffer: number[]): DigitDistribution {
    const counts = Array(10).fill(0)

    for (const digit of buffer) {
      if (!Number.isInteger(digit) || digit < 0 || digit > 9) continue
      counts[digit] += 1
    }

    const total = buffer.length || 1
    const percentages = counts.map((count) => Number(((count / total) * 100).toFixed(1)))
    const rankedDesc = Array.from({ length: 10 }, (_, digit) => digit).sort((a, b) => {
      if (percentages[b] !== percentages[a]) return percentages[b] - percentages[a]
      return a - b
    })
    const rankedAsc = Array.from({ length: 10 }, (_, digit) => digit).sort((a, b) => {
      if (percentages[a] !== percentages[b]) return percentages[a] - percentages[b]
      return a - b
    })

    return {
      counts,
      percentages,
      greenDigit: rankedDesc[0] ?? null,
      blueDigit: rankedDesc[1] ?? null,
      redDigit: rankedAsc[0] ?? null,
      yellowDigit: rankedAsc[1] ?? null,
      evenTotal: [0, 2, 4, 6, 8].reduce((sum, digit) => sum + percentages[digit], 0),
      oddTotal: [1, 3, 5, 7, 9].reduce((sum, digit) => sum + percentages[digit], 0),
    }
  }
}

export class DCircleDetector {
  static hasEvenDominance(analysis: Pick<MarketAnalysis, 'evenTotal' | 'oddTotal'>, config = DEFAULT_DCIRCLE_CONFIG) {
    return analysis.evenTotal - analysis.oddTotal >= config.minEvenDominanceGap
  }

  static isFlat(analysis: Pick<MarketAnalysis, 'evenTotal' | 'oddTotal'>, config = DEFAULT_DCIRCLE_CONFIG) {
    return Math.abs(analysis.evenTotal - analysis.oddTotal) < config.balanceGapThreshold
  }

  static detectSetup(analysis: MarketAnalysis, config = DEFAULT_DCIRCLE_CONFIG) {
    if (analysis.tickCount < config.tickWindow) return false
    if (
      analysis.greenDigit === null ||
      analysis.blueDigit === null ||
      analysis.redDigit === null ||
      analysis.yellowDigit === null
    ) return false

    return (
      isEvenDigit(analysis.greenDigit) &&
      isEvenDigit(analysis.blueDigit) &&
      isOddDigit(analysis.redDigit) &&
      isOddDigit(analysis.yellowDigit) &&
      this.hasEvenDominance(analysis, config) &&
      !this.isFlat(analysis, config) &&
      analysis.percentages[analysis.greenDigit] >= config.minGreenPercentage &&
      analysis.percentages[analysis.redDigit] <= config.maxRedPercentage
    )
  }

  static hasClearEntryImbalance(analysis: MarketAnalysis, config = DEFAULT_DCIRCLE_CONFIG) {
    return this.hasEvenDominance(analysis, config) && !this.isFlat(analysis, config)
  }

  static redBarTimingConfirmed(analysis: MarketAnalysis, config = DEFAULT_DCIRCLE_CONFIG) {
    if (!this.detectSetup(analysis, config)) return false
    return this.currentTickTouchesWeakOddBar(analysis)
  }

  static currentTickTouchesWeakOddBar(analysis: MarketAnalysis) {
    if (analysis.lastDigit === null || analysis.redDigit === null || analysis.yellowDigit === null) return false
    if (!isOddDigit(analysis.redDigit) || !isOddDigit(analysis.yellowDigit)) return false
    return analysis.lastDigit === analysis.redDigit || analysis.lastDigit === analysis.yellowDigit
  }

  static balanceConfirmed(analysis: MarketAnalysis, config = DEFAULT_DCIRCLE_CONFIG) {
    if (analysis.tickCount < config.tickWindow) return false
    return this.isFlat(analysis, config) || analysis.ticksSincePhaseChange >= config.shiftWaitTicks
  }
}

export class MarketScanner {
  static score(analysis: MarketAnalysis, config = DEFAULT_DCIRCLE_CONFIG) {
    if (analysis.tickCount < config.tickWindow) return -5

    let score = 0
    if (isEvenDigit(analysis.greenDigit)) score += 3
    if (isEvenDigit(analysis.blueDigit)) score += 3
    if (isOddDigit(analysis.redDigit)) score += 2
    if (isOddDigit(analysis.yellowDigit)) score += 2
    if (analysis.evenTotal > analysis.oddTotal) score += 2
    if (analysis.redOrYellowTouch) score += 2
    if (analysis.redDigit !== null && analysis.percentages[analysis.redDigit] <= config.maxRedPercentage) score += 1
    if (analysis.greenDigit !== null && analysis.percentages[analysis.greenDigit] >= config.minGreenPercentage) score += 1
    if (Math.abs(analysis.evenTotal - analysis.oddTotal) < config.balanceGapThreshold) score -= 3
    return score
  }

  static chooseBest(markets: Record<string, MarketAnalysis>, config = DEFAULT_DCIRCLE_CONFIG) {
    return Object.values(markets)
      .filter((market) => market.enabled && market.tickCount >= config.tickWindow)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return b.evenTotal - a.evenTotal
      })[0] ?? null
  }
}

export class RiskManager {
  static canPlaceStake(sessionProfit: number, stopLoss: number, stake: number) {
    return sessionProfit - stake > -Math.abs(stopLoss)
  }

  static nextStake(previousStake: number, initialStake: number, multiplier: number, martingaleEnabled: boolean) {
    return martingaleEnabled ? Number((previousStake * multiplier).toFixed(2)) : initialStake
  }
}

export class TradeManager {
  static canOpenTrade(hasOpenContract: boolean, placingTrade: boolean, maxOpenTrades = DEFAULT_DCIRCLE_CONFIG.maxOpenTrades) {
    return maxOpenTrades > 0 && !hasOpenContract && !placingTrade
  }
}

export class DerivWebSocketClient {
  static readonly strategyName = 'DCircleEvenOddStrategy'
}

export interface MarketEntryContext {
  autoTradeEnabled: boolean
  manualStop: boolean
  sessionProfit: number
  takeProfit: number
  stopLoss: number
  consecutiveWins: number
  consecutiveLosses: number
  stopAfterConsecutiveWins: number
  stopAfterConsecutiveLosses: number
  hasOpenContract: boolean
  placingTrade: boolean
  config: DCircleConfig
}

export function isMarketStableForEntry(market: MarketAnalysis, context: MarketEntryContext) {
  const config = context.config
  if (market.tickCount < config.tickWindow) return false
  if (!market.stabilityWatchComplete) return false
  if (!DCircleDetector.detectSetup(market, config)) return false
  if (!DCircleDetector.hasClearEntryImbalance(market, config)) return false
  if (!DCircleDetector.currentTickTouchesWeakOddBar(market)) return false
  if (market.score < config.minimumSetupScore) return false
  if (context.hasOpenContract || context.placingTrade) return false
  if (!context.autoTradeEnabled || context.manualStop) return false
  if (context.sessionProfit <= -Math.abs(context.stopLoss)) return false
  if (context.sessionProfit >= context.takeProfit) return false
  if (
    context.stopAfterConsecutiveLosses > 0 &&
    context.consecutiveLosses >= context.stopAfterConsecutiveLosses
  ) return false
  if (
    context.stopAfterConsecutiveWins > 0 &&
    context.consecutiveWins >= context.stopAfterConsecutiveWins
  ) return false
  return true
}

export const createEmptyMarketAnalysis = (symbol: string): MarketAnalysis => ({
  symbol,
  enabled: true,
  buffer: [],
  tickCount: 0,
  lastDigit: null,
  counts: Array(10).fill(0),
  percentages: Array(10).fill(0),
  greenDigit: null,
  blueDigit: null,
  redDigit: null,
  yellowDigit: null,
  evenTotal: 0,
  oddTotal: 0,
  score: -5,
  setupDetected: false,
  redBarTiming: false,
  balanceConfirmed: false,
  stabilityWatchStartEpoch: null,
  stabilityWatchElapsedSeconds: 0,
  stabilityWatchComplete: false,
  redOrYellowTouch: false,
  entryStatus: 'WAITING_FOR_1000_TICKS',
  status: 'COLLECTING_TICKS',
  previousOddTotal: 0,
  previousEvenTotal: 0,
  previousRedDigit: null,
  previousRedPercentage: 0,
  ticksSincePhaseChange: 0,
})

export function updateMarketAnalysis(
  previous: MarketAnalysis | undefined,
  symbol: string,
  digit: number,
  phaseChanged = false,
  config = DEFAULT_DCIRCLE_CONFIG
): MarketAnalysis {
  const base = previous ?? createEmptyMarketAnalysis(symbol)
  const buffer = TickBuffer.update(base.buffer, digit, config.tickWindow)
  const distribution = DigitDistributionAnalyzer.analyze(buffer)
  const draft: MarketAnalysis = {
    ...base,
    ...distribution,
    buffer,
    tickCount: buffer.length,
    lastDigit: digit,
    previousOddTotal: base.oddTotal,
    previousEvenTotal: base.evenTotal,
    previousRedDigit: base.redDigit,
    previousRedPercentage: base.redDigit === null ? 0 : base.percentages[base.redDigit] ?? 0,
    ticksSincePhaseChange: phaseChanged ? 0 : base.ticksSincePhaseChange + 1,
  }
  const setupDetected = DCircleDetector.detectSetup(draft, config)
  const redOrYellowTouch = DCircleDetector.currentTickTouchesWeakOddBar(draft)
  const redBarTiming = DCircleDetector.redBarTimingConfirmed(draft, config)
  const balanceConfirmed = DCircleDetector.balanceConfirmed(draft, config)
  const score = MarketScanner.score({ ...draft, redOrYellowTouch }, config)

  return {
    ...draft,
    score,
    setupDetected,
    redOrYellowTouch,
    redBarTiming,
    balanceConfirmed,
    entryStatus: draft.tickCount < config.tickWindow
      ? 'WAITING_FOR_1000_TICKS'
      : !setupDetected
        ? 'WAITING'
        : redOrYellowTouch
          ? 'SETUP_FOUND'
          : 'WAITING_FOR_RED_OR_YELLOW_TOUCH',
    status: draft.tickCount < config.tickWindow ? `COLLECTING ${draft.tickCount}/${config.tickWindow}` : setupDetected ? 'SETUP_READY' : 'ANALYZING',
  }
}
