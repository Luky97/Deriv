import type {
  DCircleConfig,
  DCircleBotState,
  DCircleContractType,
  DCirclePhase,
  DCircleTradeLog,
  MarketAnalysis,
  SetupLog,
} from '../strategies/dCircleEvenOddStrategy'

export type AccountMode = 'DEMO' | 'REAL'

export interface SupportedMarket {
  name: string
  symbol: string
}

export interface Tick {
  id: number
  price: number | string
  lastDigit: number
  timestamp: Date
  epochTime: number
  symbol: string
}

export interface AccountInfo {
  balance: number | string | null | undefined
  currency: string
  accountType: AccountMode
  loginId?: string
  loginStatus: 'connected' | 'disconnected' | 'connecting'
  websocketStatus: 'connected' | 'disconnected' | 'error'
}

export interface DerivApiConfig {
  appId: string
  apiToken: string
}

export interface ConnectionHealth {
  websocketStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'
  lastMessageTime: number | null
  lastTickTime: number | null
  reconnectCount: number
  isStale: boolean
  staleReason: string | null
}

export interface DCircleEvenOddState {
  analysisEnabled: boolean
  autoTradeEnabled: boolean
  manualStop: boolean
  botState: DCircleBotState
  phase: DCirclePhase
  selectedMarkets: string[]
  markets: Record<string, MarketAnalysis>
  bestMarket: string | null
  bestMarketScore: number
  bestSetup: MarketAnalysis | null
  currentDigit: number | null
  serverTime: string
  serverEpoch: number | null
  globalTradeOpen: boolean
  hasOpenContract: boolean
  placingTrade: boolean
  openContractId: string | null
  lastContractType: DCircleContractType | null
  lastTradeResult: DCircleTradeLog['result'] | null
  initialStake: number
  currentStake: number
  martingaleEnabled: boolean
  martingaleMultiplier: number
  martingaleStep: number
  maxMartingaleSteps: number
  takeProfit: number
  stopLoss: number
  contractDuration: number
  sessionProfit: number
  totalProfit: number
  totalWins: number
  totalLosses: number
  totalTrades: number
  consecutiveWins: number
  consecutiveLosses: number
  stopAfterConsecutiveWins: number
  stopAfterConsecutiveLosses: number
  currentSetupDetected: boolean
  status: string
  stopReason: string | null
  config: DCircleConfig
  setupLogs: SetupLog[]
  tradeLogs: DCircleTradeLog[]
}
