import { create } from 'zustand'
import type {
  AccountInfo,
  ConnectionHealth,
  DCircleEvenOddState,
  DerivApiConfig,
  Tick,
} from '../types'
import {
  DEFAULT_DCIRCLE_CONFIG,
  RiskManager,
  SCAN_MARKETS,
  createEmptyMarketAnalysis,
  type DCircleTradeLog,
  type MarketAnalysis,
  type SetupLog,
} from '../strategies/dCircleEvenOddStrategy'

interface StoreState {
  accountInfo: AccountInfo
  setAccountInfo: (info: Partial<AccountInfo>) => void
  connectionHealth: ConnectionHealth
  setConnectionHealth: (partial: Partial<ConnectionHealth>) => void
  markMessageReceived: () => void
  markTickReceived: () => void

  derivConfig: DerivApiConfig | null
  setDerivConfig: (config: DerivApiConfig) => void

  ticks: Tick[]
  addTick: (tick: Tick) => void
  liveTick: Tick | null
  setLiveTick: (tick: Tick | null) => void
  currentMarket: string
  setCurrentMarket: (market: string) => void

  dCircleEvenOdd: DCircleEvenOddState
  updateDCircleEvenOdd: (partial: Partial<DCircleEvenOddState>) => void
  setDCircleAutoTrade: (enabled: boolean) => void
  updateDCircleServerTime: (epoch: number) => void
  updateMarketAnalysis: (symbol: string, analysis: MarketAnalysis) => void
  toggleScanMarket: (symbol: string) => void
  addSetupLog: (log: SetupLog) => void
  manualStopDCircle: () => void
  resetSelectedMarketAnalysis: (symbol: string) => void
  resetAllMarketAnalysis: () => void
  resetDCircleTradeHistory: () => void
  markDCircleTradeOpen: (contractId: string, contractType: DCircleTradeLog['contractType'], symbol: string) => void
  applyDCircleTradeResult: (trade: DCircleTradeLog) => void
  resetDCircleSessionProfit: () => void

  showWelcomeScreen: boolean
  setShowWelcomeScreen: (show: boolean) => void
  reset: () => void
}

const initialAccountInfo: AccountInfo = {
  balance: 0,
  currency: 'USD',
  accountType: 'DEMO',
  loginStatus: 'disconnected',
  websocketStatus: 'disconnected',
  loginId: '',
}

const initialConnectionHealth: ConnectionHealth = {
  websocketStatus: 'disconnected',
  lastMessageTime: null,
  lastTickTime: null,
  reconnectCount: 0,
  isStale: false,
  staleReason: null,
}

const formatServerTime = (epoch: number) =>
  new Date(epoch * 1000).toISOString().slice(11, 19)

const createInitialMarkets = () =>
  SCAN_MARKETS.reduce<Record<string, MarketAnalysis>>((markets, symbol) => {
    markets[symbol] = createEmptyMarketAnalysis(symbol)
    return markets
  }, {})

const createInitialDCircleState = (): DCircleEvenOddState => ({
  analysisEnabled: true,
  autoTradeEnabled: false,
  manualStop: false,
  botState: 'SCANNING',
  phase: 'SCANNING',
  selectedMarkets: [...SCAN_MARKETS],
  markets: createInitialMarkets(),
  bestMarket: null,
  bestMarketScore: -5,
  bestSetup: null,
  currentDigit: null,
  serverTime: '--:--:--',
  serverEpoch: null,
  globalTradeOpen: false,
  hasOpenContract: false,
  placingTrade: false,
  openContractId: null,
  lastContractType: null,
  lastTradeResult: null,
  initialStake: 1,
  currentStake: 1,
  martingaleEnabled: true,
  martingaleMultiplier: 2,
  martingaleStep: 0,
  maxMartingaleSteps: 5,
  takeProfit: 10,
  stopLoss: 10,
  contractDuration: 1,
  sessionProfit: 0,
  totalProfit: 0,
  totalWins: 0,
  totalLosses: 0,
  totalTrades: 0,
  consecutiveWins: 0,
  consecutiveLosses: 0,
  stopAfterConsecutiveWins: 3,
  stopAfterConsecutiveLosses: 3,
  currentSetupDetected: false,
  status: 'ANALYSIS RUNNING - AUTO TRADE OFF',
  stopReason: null,
  config: DEFAULT_DCIRCLE_CONFIG,
  setupLogs: [],
  tradeLogs: [],
})

export const useStore = create<StoreState>((set) => ({
  accountInfo: initialAccountInfo,
  setAccountInfo: (info) => set((state) => ({ accountInfo: { ...state.accountInfo, ...info } })),
  connectionHealth: initialConnectionHealth,
  setConnectionHealth: (partial) => set((state) => ({ connectionHealth: { ...state.connectionHealth, ...partial } })),
  markMessageReceived: () =>
    set((state) => ({
      connectionHealth: { ...state.connectionHealth, lastMessageTime: Date.now() },
    })),
  markTickReceived: () =>
    set((state) => ({
      connectionHealth: {
        ...state.connectionHealth,
        lastTickTime: Date.now(),
        isStale: false,
        staleReason: null,
      },
    })),

  derivConfig: null,
  setDerivConfig: (config) => set({ derivConfig: config }),

  ticks: [],
  addTick: (tick) =>
    set((state) => ({
      ticks: tick.symbol === state.currentMarket ? [tick, ...state.ticks].slice(0, 100) : state.ticks,
    })),
  liveTick: null,
  setLiveTick: (tick) => set({ liveTick: tick }),
  currentMarket: '1HZ100V',
  setCurrentMarket: (market) => set({ currentMarket: market, ticks: [], liveTick: null }),

  dCircleEvenOdd: createInitialDCircleState(),
  updateDCircleEvenOdd: (partial) =>
    set((state) => ({
      dCircleEvenOdd: {
        ...state.dCircleEvenOdd,
        ...partial,
      },
    })),
  setDCircleAutoTrade: (enabled) =>
    set((state) => ({
      dCircleEvenOdd: {
        ...state.dCircleEvenOdd,
        autoTradeEnabled: enabled,
        manualStop: enabled ? false : state.dCircleEvenOdd.manualStop,
        botState: enabled ? 'SCANNING' : state.dCircleEvenOdd.botState,
        stopReason: enabled ? null : state.dCircleEvenOdd.stopReason,
        phase: enabled ? 'SCANNING' : state.dCircleEvenOdd.phase,
        status: enabled ? 'AUTO TRADE ON - WAITING FOR D-CIRCLE SETUP' : 'ANALYSIS RUNNING - AUTO TRADE OFF',
      },
    })),
  updateDCircleServerTime: (epoch) =>
    set((state) => ({
      dCircleEvenOdd: {
        ...state.dCircleEvenOdd,
        serverEpoch: epoch,
        serverTime: formatServerTime(epoch),
      },
    })),
  updateMarketAnalysis: (symbol, analysis) =>
    set((state) => ({
      dCircleEvenOdd: {
        ...state.dCircleEvenOdd,
        markets: {
          ...state.dCircleEvenOdd.markets,
          [symbol]: analysis,
        },
        currentDigit: analysis.lastDigit,
      },
    })),
  toggleScanMarket: (symbol) =>
    set((state) => {
      const selected = state.dCircleEvenOdd.selectedMarkets.includes(symbol)
        ? state.dCircleEvenOdd.selectedMarkets.filter((item) => item !== symbol)
        : [...state.dCircleEvenOdd.selectedMarkets, symbol]
      return {
        dCircleEvenOdd: {
          ...state.dCircleEvenOdd,
          selectedMarkets: selected,
          markets: {
            ...state.dCircleEvenOdd.markets,
            [symbol]: {
              ...(state.dCircleEvenOdd.markets[symbol] ?? createEmptyMarketAnalysis(symbol)),
              enabled: selected.includes(symbol),
            },
          },
        },
      }
    }),
  addSetupLog: (log) =>
    set((state) => ({
      dCircleEvenOdd: {
        ...state.dCircleEvenOdd,
        setupLogs: [log, ...state.dCircleEvenOdd.setupLogs].slice(0, 500),
      },
    })),
  manualStopDCircle: () =>
    set((state) => {
      console.log('D-CIRCLE MANUAL STOP')
      return {
        dCircleEvenOdd: {
          ...state.dCircleEvenOdd,
          autoTradeEnabled: false,
          manualStop: true,
          botState: 'MANUAL_STOPPED',
          status: 'MANUAL_STOPPED',
          stopReason: 'Manual Stop',
          placingTrade: false,
        },
      }
    }),
  resetSelectedMarketAnalysis: (symbol) =>
    set((state) => {
      console.log('D-CIRCLE RESET MARKET:', symbol)
      const markets = {
        ...state.dCircleEvenOdd.markets,
        [symbol]: createEmptyMarketAnalysis(symbol),
      }
      return {
        ticks: symbol === state.currentMarket ? [] : state.ticks,
        liveTick: symbol === state.currentMarket ? null : state.liveTick,
        dCircleEvenOdd: {
          ...state.dCircleEvenOdd,
          phase: 'SCANNING',
          botState: state.dCircleEvenOdd.autoTradeEnabled ? 'SCANNING' : state.dCircleEvenOdd.botState,
          markets,
          bestMarket: state.dCircleEvenOdd.bestMarket === symbol ? null : state.dCircleEvenOdd.bestMarket,
          bestSetup: state.dCircleEvenOdd.bestSetup?.symbol === symbol ? null : state.dCircleEvenOdd.bestSetup,
          bestMarketScore: state.dCircleEvenOdd.bestMarket === symbol ? -5 : state.dCircleEvenOdd.bestMarketScore,
          status: `RESET MARKET ${symbol} - COLLECTING FRESH TICKS`,
        },
      }
    }),
  resetAllMarketAnalysis: () =>
    set((state) => {
      console.log('D-CIRCLE RESET ALL MARKETS')
      return {
        ticks: [],
        liveTick: null,
        dCircleEvenOdd: {
          ...state.dCircleEvenOdd,
          phase: 'SCANNING',
          botState: state.dCircleEvenOdd.autoTradeEnabled ? 'SCANNING' : state.dCircleEvenOdd.botState,
          markets: createInitialMarkets(),
          bestMarket: null,
          bestMarketScore: -5,
          bestSetup: null,
          currentDigit: null,
          currentSetupDetected: false,
          status: 'RESET ALL MARKETS - COLLECTING FRESH 1000 TICKS',
        },
      }
    }),
  resetDCircleTradeHistory: () =>
    set((state) => {
      console.log('D-CIRCLE TRADE HISTORY RESET')
      return {
        dCircleEvenOdd: {
          ...state.dCircleEvenOdd,
          totalTrades: 0,
          totalWins: 0,
          totalLosses: 0,
          consecutiveWins: 0,
          consecutiveLosses: 0,
          lastTradeResult: null,
          tradeLogs: [],
          status: 'TRADE HISTORY RESET - ANALYSIS CONTINUES',
        },
      }
    }),
  markDCircleTradeOpen: (contractId, contractType, symbol) =>
    set((state) => ({
      dCircleEvenOdd: {
        ...state.dCircleEvenOdd,
        placingTrade: false,
        hasOpenContract: true,
        globalTradeOpen: true,
        openContractId: contractId,
        lastContractType: contractType,
        bestMarket: symbol,
        botState: 'TRADING',
        status: `CONTRACT OPEN ${contractType} ${symbol}`,
      },
    })),
  applyDCircleTradeResult: (trade) =>
    set((state) => {
      const previous = state.dCircleEvenOdd
      const isWin = trade.result === 'WIN'
      const isLoss = trade.result === 'LOSS'
      const sessionProfit = Number((previous.sessionProfit + trade.profit).toFixed(2))
      const consecutiveWins = isWin ? previous.consecutiveWins + 1 : 0
      const consecutiveLosses = isLoss ? previous.consecutiveLosses + 1 : 0
      const takeProfitReached = sessionProfit >= previous.takeProfit
      const stopLossReached = sessionProfit <= -Math.abs(previous.stopLoss)
      const consecutiveLossesReached =
        previous.stopAfterConsecutiveLosses > 0 &&
        consecutiveLosses >= previous.stopAfterConsecutiveLosses
      const consecutiveWinsReached =
        previous.stopAfterConsecutiveWins > 0 &&
        consecutiveWins >= previous.stopAfterConsecutiveWins
      const maxStepsReached = isLoss && previous.martingaleStep >= previous.maxMartingaleSteps
      const nextStake = isWin
        ? previous.initialStake
        : isLoss && previous.martingaleEnabled && !maxStepsReached
          ? RiskManager.nextStake(
              previous.currentStake,
              previous.initialStake,
              previous.martingaleMultiplier,
              previous.martingaleEnabled
            )
          : previous.initialStake
      const nextPhase = isLoss ? previous.phase : 'RUN_BOT_ON_EVEN'
      const shouldStop =
        previous.manualStop ||
        stopLossReached ||
        takeProfitReached ||
        consecutiveLossesReached ||
        consecutiveWinsReached
      const stopState = previous.manualStop
        ? 'MANUAL_STOPPED'
        : stopLossReached
          ? 'STOPPED_BY_STOP_LOSS'
          : takeProfitReached
            ? 'STOPPED_BY_TAKE_PROFIT'
            : consecutiveLossesReached
              ? 'STOPPED_BY_THREE_CONSECUTIVE_LOSSES'
              : consecutiveWinsReached
                ? 'STOPPED_BY_THREE_CONSECUTIVE_WINS'
                : null
      const stopReason = previous.manualStop
        ? 'Manual Stop'
        : stopLossReached
          ? 'Stop Loss reached'
          : takeProfitReached
            ? 'Take Profit reached'
            : consecutiveLossesReached
              ? 'Auto Trade stopped after 3 consecutive losses.'
              : consecutiveWinsReached
                ? 'Auto Trade stopped after 3 consecutive wins.'
                : null
      const status = stopReason ?? (previous.autoTradeEnabled ? `CONTINUING AUTO TRADE - PHASE ${nextPhase}` : 'ANALYSIS RUNNING - AUTO TRADE OFF')

      return {
        dCircleEvenOdd: {
          ...previous,
          autoTradeEnabled: shouldStop ? false : previous.autoTradeEnabled,
          botState: stopState ?? (previous.autoTradeEnabled ? 'SCANNING' : previous.botState),
          phase: shouldStop ? 'STOPPED' : nextPhase,
          hasOpenContract: false,
          globalTradeOpen: false,
          placingTrade: false,
          openContractId: null,
          sessionProfit,
          totalProfit: Number((previous.totalProfit + trade.profit).toFixed(2)),
          totalTrades: previous.totalTrades + 1,
          totalWins: previous.totalWins + (isWin ? 1 : 0),
          totalLosses: previous.totalLosses + (isLoss ? 1 : 0),
          consecutiveWins,
          consecutiveLosses,
          martingaleStep: isLoss && previous.martingaleEnabled && !maxStepsReached ? previous.martingaleStep + 1 : 0,
          currentStake: nextStake,
          lastTradeResult: trade.result,
          stopReason,
          status,
          tradeLogs: [trade, ...previous.tradeLogs].slice(0, 500),
        },
      }
    }),
  resetDCircleSessionProfit: () =>
    set((state) => {
      console.log('D-CIRCLE SESSION P/L RESET')
      return {
        dCircleEvenOdd: {
          ...state.dCircleEvenOdd,
          currentStake: state.dCircleEvenOdd.initialStake,
          martingaleStep: 0,
          sessionProfit: 0,
          totalProfit: 0,
          stopReason: null,
          status: state.dCircleEvenOdd.autoTradeEnabled
            ? 'AUTO TRADE ON - WAITING FOR D-CIRCLE SETUP'
            : 'ANALYSIS RUNNING - AUTO TRADE OFF',
        },
      }
    }),

  showWelcomeScreen: true,
  setShowWelcomeScreen: (show) => set({ showWelcomeScreen: show }),
  reset: () =>
    set({
      accountInfo: initialAccountInfo,
      connectionHealth: initialConnectionHealth,
      derivConfig: null,
      ticks: [],
      liveTick: null,
      currentMarket: '1HZ100V',
      dCircleEvenOdd: createInitialDCircleState(),
      showWelcomeScreen: true,
    }),
}))
