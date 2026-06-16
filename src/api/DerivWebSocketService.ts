import { useStore } from '@store/index'
import type { Tick } from '../types'
import { extractLastDigit } from '../utils/formatting'
import {
  DCircleDetector,
  DerivWebSocketClient,
  MarketScanner,
  RiskManager,
  SCAN_MARKETS,
  TradeManager,
  isMarketStableForEntry,
  updateMarketAnalysis,
  type DCircleContractType,
  type DCirclePhase,
  type DCircleTradeLog,
  type MarketAnalysis,
  type SetupLog,
} from '../strategies/dCircleEvenOddStrategy'

type MessageHandler = (data: any) => boolean | void

class DerivWebSocketService {
  private ws: WebSocket | null = null
  private reqId = 1
  private appId: string
  private apiToken: string
  private reconnectAttempts = 0
  private isConnecting = false
  private reconnectLock = false
  private manualDisconnect = false
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private watchdogTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private activeMarkets = new Set<string>()
  private tickCallback: ((tick: Tick) => void) | null = null
  private messageHandlers = new Map<number, MessageHandler>()
  private lastErrorMessage = ''

  constructor(appId: string, apiToken: string) {
    this.appId = appId
    this.apiToken = apiToken
  }

  getLastErrorMessage() {
    return this.lastErrorMessage
  }

  async connect(): Promise<boolean> {
    if (this.isConnecting) return false
    if (this.ws?.readyState === WebSocket.OPEN) return true

    this.lastErrorMessage = ''
    this.isConnecting = true
    this.manualDisconnect = false
    useStore.getState().setConnectionHealth({
      websocketStatus: this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting',
    })

    return new Promise((resolve) => {
      this.ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`)

      this.ws.onopen = async () => {
        this.reconnectAttempts = 0
        useStore.getState().setConnectionHealth({
          websocketStatus: 'connected',
          reconnectCount: 0,
          isStale: false,
          staleReason: null,
        })
        useStore.getState().setAccountInfo({
          websocketStatus: 'connected',
          loginStatus: 'connecting',
        })

        this.startHeartbeat()
        this.startWatchdog()

        const authorized = await this.authorize()
        this.isConnecting = false

        if (!authorized) {
          this.lastErrorMessage ||= 'Authorization failed. Check your Deriv App ID and API token trade permission.'
          this.disconnect()
          resolve(false)
          return
        }

        this.subscribeAnalysisMarkets()
        resolve(true)
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data))
      }

      this.ws.onclose = () => {
        this.stopHeartbeat()
        this.stopWatchdog()
        this.isConnecting = false
        const store = useStore.getState()
        store.setAccountInfo({ websocketStatus: 'disconnected', loginStatus: 'disconnected' })
        store.setConnectionHealth({ websocketStatus: 'disconnected', staleReason: 'socket_closed' })
        if (this.manualDisconnect) {
          store.setDCircleAutoTrade(false)
          store.updateDCircleEvenOdd({
            status: 'WEBSOCKET DISCONNECTED',
            botState: 'STOPPED',
            phase: 'STOPPED',
            stopReason: 'Connection failure',
          })
          return
        }

        store.updateDCircleEvenOdd({
          status: 'WEBSOCKET DISCONNECTED - RECONNECTING',
          stopReason: null,
        })
        this.attemptReconnect('socket_closed')
      }

      this.ws.onerror = () => {
        this.lastErrorMessage = 'WebSocket connection failed. Check your internet connection and Deriv App ID.'
        this.isConnecting = false
        useStore.getState().setDCircleAutoTrade(false)
        useStore.getState().updateDCircleEvenOdd({
          status: this.lastErrorMessage,
          botState: 'STOPPED',
          phase: 'STOPPED',
          stopReason: 'Connection failure',
        })
        useStore.getState().setAccountInfo({ websocketStatus: 'error', loginStatus: 'disconnected' })
        useStore.getState().setConnectionHealth({ websocketStatus: 'error', staleReason: 'socket_error' })
        resolve(false)
      }
    })
  }

  private authorize(): Promise<boolean> {
    return new Promise((resolve) => {
      this.send({ authorize: this.apiToken }, (data) => {
        if (data.error || !data.authorize) {
          this.lastErrorMessage = data.error?.message ?? 'Authorization failed'
          resolve(false)
          return
        }

        const auth = data.authorize
        useStore.getState().setAccountInfo({
          loginStatus: 'connected',
          websocketStatus: 'connected',
          balance: Number(auth.balance ?? 0),
          currency: auth.currency ?? 'USD',
          accountType: auth.loginid?.startsWith('CR') ? 'REAL' : 'DEMO',
          loginId: auth.loginid ?? '',
        })
        this.subscribeBalance()
        resolve(true)
      })
    })
  }

  private subscribeBalance() {
    this.send({ balance: 1, subscribe: 1 }, (data) => {
      if (data.balance) {
        useStore.getState().setAccountInfo({
          balance: Number(data.balance.balance ?? 0),
          currency: data.balance.currency ?? useStore.getState().accountInfo.currency,
        })
      }
      return true
    })
  }

  subscribeTicks(_market?: string, callback?: (tick: Tick) => void) {
    if (callback) this.tickCallback = callback
    this.subscribeAnalysisMarkets()
  }

  subscribeAnalysisMarkets(callback?: (tick: Tick) => void) {
    if (callback) this.tickCallback = callback
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const selectedMarkets = useStore.getState().dCircleEvenOdd.selectedMarkets
    const markets = selectedMarkets.length > 0 ? selectedMarkets : SCAN_MARKETS
    this.send({ forget_all: 'ticks' })
    this.activeMarkets.clear()

    for (const market of markets) {
      this.send({ ticks: market, subscribe: 1 })
      this.activeMarkets.add(market)
    }

    console.log('D-CIRCLE ANALYSIS SUBSCRIBED MARKETS:', Array.from(this.activeMarkets))
  }

  private handleLiveTick(tickData: any) {
    const symbol = String(tickData.symbol ?? '')
    if (!symbol || !this.activeMarkets.has(symbol)) return

    const pipSize = typeof tickData.pip_size === 'number' ? tickData.pip_size : 2
    const livePriceText =
      typeof tickData.display_value === 'string'
        ? tickData.display_value
        : Number(tickData.quote).toFixed(pipSize)
    const lastDigit = extractLastDigit(livePriceText)
    if (lastDigit === null || lastDigit === undefined) return

    const epoch = Number(tickData.epoch)
    if (!Number.isFinite(epoch)) return

    const store = useStore.getState()
    store.markTickReceived()
    store.updateDCircleServerTime(epoch)

    const tick: Tick = {
      id: epoch,
      price: livePriceText,
      lastDigit,
      timestamp: new Date(epoch * 1000),
      epochTime: epoch,
      symbol,
    }

    if (symbol === store.currentMarket) {
      store.setLiveTick(tick)
      store.addTick(tick)
    }

    console.log('D-CIRCLE TICK:', {
      strategy: DerivWebSocketClient.strategyName,
      symbol,
      quote: tickData.quote,
      display_value: tickData.display_value,
      livePriceText,
      lastDigit,
    })

    this.tickCallback?.(tick)
    this.handleTickForDCircleEvenOddStrategy(tick)
  }

  private handleTickForDCircleEvenOddStrategy(tick: Tick) {
    const store = useStore.getState()
    const strategy = store.dCircleEvenOdd
    if (!strategy.analysisEnabled) return

    const previous = strategy.markets[tick.symbol]
    const analysis = this.applyStabilityWatch(
      updateMarketAnalysis(previous, tick.symbol, tick.lastDigit, false, strategy.config),
      tick.epochTime
    )
    const nextMarkets = {
      ...strategy.markets,
      [tick.symbol]: analysis,
    }
    const best = MarketScanner.chooseBest(nextMarkets, strategy.config)

    store.updateMarketAnalysis(tick.symbol, analysis)
    store.updateDCircleEvenOdd({
      bestMarket: best?.symbol ?? null,
      bestMarketScore: best?.score ?? -5,
      bestSetup: best,
      currentSetupDetected: Boolean(best?.setupDetected),
      currentDigit: tick.lastDigit,
      botState: this.getDisplayBotState(best),
      status: this.getDisplayStatus(strategy.phase, best),
    })

    if (best?.setupDetected && best.symbol === tick.symbol) {
      this.logSetup(best, strategy.phase, 'SETUP_DETECTED')
    }

    this.advancePhaseAndMaybeTrade(best, analysis)
  }

  private applyStabilityWatch(analysis: MarketAnalysis, epoch: number) {
    const config = useStore.getState().dCircleEvenOdd.config
    const setupValid =
      analysis.setupDetected &&
      DCircleDetector.hasClearEntryImbalance(analysis, config) &&
      analysis.score >= config.minimumSetupScore

    if (analysis.tickCount < config.tickWindow || !setupValid) {
      if (analysis.stabilityWatchStartEpoch !== null) {
        console.log('D-CIRCLE STABILITY WATCH RESET:', analysis.symbol)
      }
      return {
        ...analysis,
        stabilityWatchStartEpoch: null,
        stabilityWatchElapsedSeconds: 0,
        stabilityWatchComplete: false,
        status: analysis.tickCount < config.tickWindow
          ? `COLLECTING ${analysis.tickCount}/${config.tickWindow}`
          : 'ANALYZING',
      }
    }

    const startEpoch = analysis.stabilityWatchStartEpoch ?? epoch
    const elapsedSeconds = Math.max(0, epoch - startEpoch)
    const requiredSeconds = Math.max(5, Math.min(config.stabilityWatchMinutes, config.maximumWatchMinutes)) * 60
    const complete = elapsedSeconds >= requiredSeconds

    return {
      ...analysis,
      stabilityWatchStartEpoch: startEpoch,
      stabilityWatchElapsedSeconds: elapsedSeconds,
      stabilityWatchComplete: complete,
      status: complete
        ? analysis.redOrYellowTouch
          ? 'STABLE_ENTRY_READY'
          : 'WAITING_FOR_RED_OR_YELLOW_TOUCH'
        : 'WATCHING_MARKET_STABILITY',
    }
  }

  private getDisplayBotState(best: MarketAnalysis | null) {
    const strategy = useStore.getState().dCircleEvenOdd
    if (strategy.manualStop) return 'MANUAL_STOPPED'
    if (strategy.hasOpenContract || strategy.placingTrade) return 'TRADING'
    if (!strategy.autoTradeEnabled) return strategy.botState
    if (!best) return 'WAITING_FOR_1000_TICKS'
    if (best?.setupDetected && !best.stabilityWatchComplete) return 'WATCHING_MARKET_STABILITY'
    if (best?.setupDetected && best.stabilityWatchComplete && !best.redOrYellowTouch) return 'SCANNING'
    return 'SCANNING'
  }

  private getDisplayStatus(phase: DCirclePhase, best: MarketAnalysis | null) {
    const strategy = useStore.getState().dCircleEvenOdd
    if (strategy.manualStop) return 'MANUAL_STOPPED - SCANNING DISPLAY ONLY'
    if (!strategy.autoTradeEnabled) return 'ANALYSIS RUNNING - AUTO TRADE OFF'
    if (!best) return 'AUTO TRADE ON - COLLECTING 1000 TICKS'
    if (best.setupDetected && !best.stabilityWatchComplete) {
      return `WATCHING_MARKET_STABILITY ${best.symbol} ${best.stabilityWatchElapsedSeconds}s`
    }
    if (best.setupDetected && best.stabilityWatchComplete && !best.redOrYellowTouch) {
      return `WAITING FOR RED OR YELLOW TOUCH ${best.symbol}`
    }
    return `AUTO TRADE ON - ${phase} - BEST ${best.symbol} SCORE ${best.score}`
  }

  private advancePhaseAndMaybeTrade(_best: MarketAnalysis | null, latest: MarketAnalysis) {
    const store = useStore.getState()
    const strategy = store.dCircleEvenOdd
    const stopGate = this.getStopGate()
    if (stopGate) {
      store.updateDCircleEvenOdd({
        autoTradeEnabled: false,
        botState: stopGate.botState,
        phase: 'STOPPED',
        status: stopGate.status,
        stopReason: stopGate.reason,
        placingTrade: false,
      })
      return
    }
    if (!strategy.autoTradeEnabled) return
    if (!TradeManager.canOpenTrade(strategy.hasOpenContract, strategy.placingTrade, strategy.config.maxOpenTrades)) return
    if (!RiskManager.canPlaceStake(strategy.sessionProfit, strategy.stopLoss, strategy.currentStake)) {
      store.updateDCircleEvenOdd({
        autoTradeEnabled: false,
        botState: 'STOPPED_BY_STOP_LOSS',
        phase: 'STOPPED',
        status: 'NEXT STAKE WOULD EXCEED STOP LOSS RISK',
        stopReason: 'Next stake would exceed Stop Loss risk',
      })
      return
    }

    const stableBest = this.getBestStableMarket()
    if (!stableBest) return

    if ((strategy.phase === 'SCANNING' || strategy.phase === 'RUN_BOT_ON_EVEN') && stableBest.setupDetected) {
      store.updateDCircleEvenOdd({
        phase: 'ENTER_EVEN',
        bestMarket: stableBest.symbol,
        bestSetup: stableBest,
        status: `ENTER_EVEN READY ${stableBest.symbol}`,
      })
      this.logSetup(stableBest, 'ENTER_EVEN', 'ENTER_EVEN')
      if (stableBest.redBarTiming) this.placeDCircleTrade(stableBest, 'DIGITEVEN')
      return
    }

    const currentMarket = strategy.bestMarket ?? stableBest.symbol ?? latest.symbol
    const market = latest.symbol === currentMarket ? latest : useStore.getState().dCircleEvenOdd.markets[currentMarket]
    if (!market || market.tickCount < strategy.config.tickWindow) return

    const stableMarket = isMarketStableForEntry(market, strategy) ? market : stableBest

    if (strategy.phase === 'ENTER_EVEN' && DCircleDetector.redBarTimingConfirmed(stableMarket, strategy.config)) {
      this.placeDCircleTrade(stableMarket, 'DIGITEVEN')
      return
    }

    if (strategy.phase === 'RUN_BOT_ON_EVEN' && DCircleDetector.redBarTimingConfirmed(stableMarket, strategy.config)) {
      this.placeDCircleTrade(stableMarket, 'DIGITEVEN')
    }
  }

  private getStopGate() {
    const strategy = useStore.getState().dCircleEvenOdd
    if (strategy.manualStop) {
      return { botState: 'MANUAL_STOPPED' as const, status: 'MANUAL_STOPPED', reason: 'Manual Stop' }
    }
    if (strategy.sessionProfit <= -Math.abs(strategy.stopLoss)) {
      return { botState: 'STOPPED_BY_STOP_LOSS' as const, status: 'STOP LOSS REACHED', reason: 'Stop Loss reached' }
    }
    if (strategy.sessionProfit >= strategy.takeProfit) {
      return { botState: 'STOPPED_BY_TAKE_PROFIT' as const, status: 'TAKE PROFIT REACHED', reason: 'Take Profit reached' }
    }
    if (
      strategy.stopAfterConsecutiveLosses > 0 &&
      strategy.consecutiveLosses >= strategy.stopAfterConsecutiveLosses
    ) {
      return {
        botState: 'STOPPED_BY_THREE_CONSECUTIVE_LOSSES' as const,
        status: 'Auto Trade stopped after 3 consecutive losses.',
        reason: '3 consecutive losses reached',
      }
    }
    if (
      strategy.stopAfterConsecutiveWins > 0 &&
      strategy.consecutiveWins >= strategy.stopAfterConsecutiveWins
    ) {
      return {
        botState: 'STOPPED_BY_THREE_CONSECUTIVE_WINS' as const,
        status: 'Auto Trade stopped after 3 consecutive wins.',
        reason: '3 consecutive wins reached',
      }
    }
    return null
  }

  private getBestStableMarket() {
    const strategy = useStore.getState().dCircleEvenOdd
    const stableMarkets = Object.fromEntries(
      Object.entries(strategy.markets).filter(([, market]) => isMarketStableForEntry(market, strategy))
    )
    return MarketScanner.chooseBest(stableMarkets, strategy.config)
  }

  private placeDCircleTrade(market: MarketAnalysis, contractType: DCircleContractType) {
    const store = useStore.getState()
    const strategy = store.dCircleEvenOdd
    const stopGate = this.getStopGate()
    if (stopGate) return
    if (!strategy.autoTradeEnabled || strategy.placingTrade || strategy.hasOpenContract) return
    if (!isMarketStableForEntry(market, strategy)) return
    if (!RiskManager.canPlaceStake(strategy.sessionProfit, strategy.stopLoss, strategy.currentStake)) return

    store.updateDCircleEvenOdd({
      placingTrade: true,
      botState: 'PLACING_TRADE',
      bestMarket: market.symbol,
      bestSetup: market,
      lastContractType: contractType,
      status: `REQUESTING ${contractType} PROPOSAL ${market.symbol}`,
    })

    console.log('D-CIRCLE TRADE REQUEST:', {
      market: market.symbol,
      contractType,
      phase: strategy.phase,
      stake: strategy.currentStake,
      evenTotal: market.evenTotal,
      oddTotal: market.oddTotal,
      greenDigit: market.greenDigit,
      redDigit: market.redDigit,
    })

    this.send(
      {
        proposal: 1,
        amount: strategy.currentStake,
        basis: 'stake',
        contract_type: contractType,
        currency: store.accountInfo.currency || 'USD',
        duration: strategy.contractDuration,
        duration_unit: 't',
        symbol: market.symbol,
      },
      (proposalData) => {
        const proposal = proposalData.proposal
        const proposalState = useStore.getState().dCircleEvenOdd
        if (proposalState.manualStop || !proposalState.autoTradeEnabled) {
          useStore.getState().updateDCircleEvenOdd({
            placingTrade: false,
            status: proposalState.manualStop ? 'MANUAL_STOPPED - PROPOSAL CANCELLED' : 'AUTO TRADE OFF - PROPOSAL CANCELLED',
          })
          return
        }
        if (proposalData.error || !proposal?.id) {
          useStore.getState().updateDCircleEvenOdd({
            placingTrade: false,
            status: proposalData.error?.message ?? 'PROPOSAL FAILED',
          })
          return
        }

        this.send({ buy: proposal.id, price: proposal.ask_price }, (buyData) => {
          const buyState = useStore.getState().dCircleEvenOdd
          if (buyState.manualStop || !buyState.autoTradeEnabled) {
            useStore.getState().updateDCircleEvenOdd({
              placingTrade: false,
              status: buyState.manualStop ? 'MANUAL_STOPPED - BUY CANCELLED' : 'AUTO TRADE OFF - BUY CANCELLED',
            })
            return
          }
          const buy = buyData.buy
          if (buyData.error || !buy?.contract_id) {
            useStore.getState().updateDCircleEvenOdd({
              placingTrade: false,
              status: buyData.error?.message ?? 'BUY FAILED',
            })
            return
          }

          const contractId = String(buy.contract_id)
          useStore.getState().markDCircleTradeOpen(contractId, contractType, market.symbol)
          console.log('D-CIRCLE BUY CONFIRMED:', { contractId, market: market.symbol, contractType })
          this.subscribeContractResult(Number(buy.contract_id), market, contractType, strategy.phase, strategy.currentStake)
        })
      }
    )
  }

  private subscribeContractResult(
    contractId: number,
    market: MarketAnalysis,
    contractType: DCircleContractType,
    phase: DCirclePhase,
    stake: number
  ) {
    this.send(
      {
        proposal_open_contract: 1,
        contract_id: contractId,
        subscribe: 1,
      },
      (data) => {
        const contract = data.proposal_open_contract
        if (!contract) return true
        if (contract.is_sold !== 1) return true

        if (data.subscription?.id) this.send({ forget: data.subscription.id })

        const profit = Number(contract.profit ?? 0)
        const result = profit > 0 ? 'WIN' : profit < 0 ? 'LOSS' : 'BREAK_EVEN'
        const trade: DCircleTradeLog = {
          id: `${contractId}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          market: market.symbol,
          phase,
          contractType,
          stake,
          result,
          profit,
          contractId: String(contractId),
          greenDigit: market.greenDigit,
          blueDigit: market.blueDigit,
          redDigit: market.redDigit,
          yellowDigit: market.yellowDigit,
          percentages: [...market.percentages],
        }

        console.log('D-CIRCLE TRADE RESULT:', trade)
        useStore.getState().applyDCircleTradeResult(trade)
        return false
      }
    )
  }

  private logSetup(market: MarketAnalysis, phase: DCirclePhase, action: string) {
    const setupLog: SetupLog = {
      id: `${market.symbol}-${action}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      market: market.symbol,
      phase,
      greenDigit: market.greenDigit,
      blueDigit: market.blueDigit,
      redDigit: market.redDigit,
      yellowDigit: market.yellowDigit,
      percentages: [...market.percentages],
      evenTotal: market.evenTotal,
      oddTotal: market.oddTotal,
      score: market.score,
      action,
    }
    useStore.getState().addSetupLog(setupLog)
  }

  private handleMessage(data: any) {
    useStore.getState().markMessageReceived()

    if (data.req_id && this.messageHandlers.has(data.req_id)) {
      const keepHandler = this.messageHandlers.get(data.req_id)?.(data) === true
      if (!keepHandler || data.error) this.messageHandlers.delete(data.req_id)
      return
    }

    if (data.error) {
      this.lastErrorMessage = data.error.message ?? data.error.code ?? 'Deriv API error'
      useStore.getState().updateDCircleEvenOdd({ status: this.lastErrorMessage })
      return
    }

    if (data.msg_type === 'tick' && data.tick) {
      this.handleLiveTick(data.tick)
    }
  }

  private send(request: any, handler?: MessageHandler) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const reqId = this.reqId++
    request.req_id = reqId
    if (handler) this.messageHandlers.set(reqId, handler)
    this.ws.send(JSON.stringify(request))
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => this.send({ ping: 1 }), 20000)
  }

  private stopHeartbeat() {
    if (!this.heartbeatTimer) return
    clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
  }

  private startWatchdog() {
    this.stopWatchdog()
    this.watchdogTimer = setInterval(() => {
      const lastTickTime = useStore.getState().connectionHealth.lastTickTime
      if (!lastTickTime || Date.now() - lastTickTime <= 30000) return
      this.forceReconnect('stale_ticks')
    }, 10000)
  }

  private stopWatchdog() {
    if (!this.watchdogTimer) return
    clearInterval(this.watchdogTimer)
    this.watchdogTimer = null
  }

  async forceReconnect(reason: string) {
    if (this.reconnectLock) return
    this.reconnectLock = true
    this.stopHeartbeat()
    this.stopWatchdog()
    useStore.getState().updateDCircleEvenOdd({ status: 'RECONNECTING - AUTO TRADE WILL RESUME IF CONNECTION RECOVERS' })
    useStore.getState().setConnectionHealth({
      websocketStatus: 'reconnecting',
      isStale: true,
      staleReason: reason,
    })

    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectLock = false
      await this.connect()
    }, 2000)
  }

  private attemptReconnect(reason: string) {
    if (this.manualDisconnect || this.reconnectTimer) return
    this.reconnectAttempts += 1
    useStore.getState().setConnectionHealth({
      websocketStatus: 'reconnecting',
      reconnectCount: this.reconnectAttempts,
      staleReason: reason,
    })
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 3000)
  }

  disconnect() {
    this.manualDisconnect = true
    this.stopHeartbeat()
    this.stopWatchdog()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    this.ws?.close()
    this.ws = null
    this.messageHandlers.clear()
    this.activeMarkets.clear()
    this.tickCallback = null
    this.isConnecting = false
    this.reconnectLock = false
  }
}

export default DerivWebSocketService
