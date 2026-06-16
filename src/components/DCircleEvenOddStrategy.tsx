import { useMemo } from 'react'
import { useStore } from '@store/index'
import { SCAN_MARKETS } from '../strategies/dCircleEvenOddStrategy'

type StrategyNumberKey =
  | 'initialStake'
  | 'martingaleMultiplier'
  | 'maxMartingaleSteps'
  | 'takeProfit'
  | 'stopLoss'
  | 'contractDuration'
  | 'stopAfterConsecutiveWins'
  | 'stopAfterConsecutiveLosses'

type ConfigNumberKey =
  | 'tickWindow'
  | 'minEvenDominanceGap'
  | 'minGreenPercentage'
  | 'maxRedPercentage'
  | 'balanceGapThreshold'
  | 'shiftWaitTicks'
  | 'stabilityWatchMinutes'
  | 'maximumWatchMinutes'
  | 'minimumSetupScore'

const digitColor = (digit: number, green: number | null, blue: number | null, red: number | null, yellow: number | null) => {
  if (digit === green) return 'bg-neon-green text-space-900'
  if (digit === blue) return 'bg-neon-blue text-space-900'
  if (digit === red) return 'bg-neon-red text-space-900'
  if (digit === yellow) return 'bg-neon-orange text-space-900'
  return 'bg-space-700/70 text-white'
}

export const DCircleEvenOddStrategy = () => {
  const strategy = useStore((state) => state.dCircleEvenOdd)
  const currentMarket = useStore((state) => state.currentMarket)
  const setAutoTrade = useStore((state) => state.setDCircleAutoTrade)
  const updateStrategy = useStore((state) => state.updateDCircleEvenOdd)
  const manualStop = useStore((state) => state.manualStopDCircle)
  const resetSelectedMarket = useStore((state) => state.resetSelectedMarketAnalysis)
  const resetAllMarkets = useStore((state) => state.resetAllMarketAnalysis)
  const resetTradeHistory = useStore((state) => state.resetDCircleTradeHistory)
  const resetSessionProfit = useStore((state) => state.resetDCircleSessionProfit)

  const visibleMarket = strategy.bestSetup ?? strategy.markets[currentMarket]
  const winRate = strategy.totalTrades ? ((strategy.totalWins / strategy.totalTrades) * 100).toFixed(1) : '0.0'
  const marketRows = useMemo(
    () => SCAN_MARKETS.map((symbol) => strategy.markets[symbol]).filter(Boolean),
    [strategy.markets]
  )

  const updateNumber = (key: StrategyNumberKey, value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) return
    updateStrategy({
      [key]: parsed,
      ...(key === 'initialStake' && strategy.currentStake === strategy.initialStake ? { currentStake: parsed } : {}),
    })
  }

  const updateConfigNumber = (key: ConfigNumberKey, value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) return
    const nextValue =
      key === 'stabilityWatchMinutes' || key === 'maximumWatchMinutes'
        ? Math.max(5, Math.min(10, parsed))
        : key === 'tickWindow'
          ? Math.max(1, Math.floor(parsed))
          : parsed
    updateStrategy({
      config: {
        ...strategy.config,
        [key]: nextValue,
      },
    })
  }

  const handleStartAutoTrade = () => {
    const confirmed = window.confirm(
      'Start real EVEN auto-trading after 1000 ticks, stability watch, and red/yellow odd touch confirmation?'
    )
    if (confirmed) setAutoTrade(true)
  }

  const handleManualStop = () => {
    const confirmed = window.confirm('Manual Stop will block new trades and keep scanning only. Continue?')
    if (!confirmed) return
    manualStop()
  }

  const handleResetSelectedMarket = () => {
    if (strategy.hasOpenContract || strategy.placingTrade) {
      alert('Cannot reset market while trade is running.')
      return
    }
    const confirmed = window.confirm(`Reset analysis buffer for ${currentMarket}?`)
    if (!confirmed) return
    resetSelectedMarket(currentMarket)
  }

  const handleResetAllMarkets = () => {
    if (strategy.hasOpenContract || strategy.placingTrade) {
      alert('Cannot reset all markets while trade is running.')
      return
    }
    const confirmed = window.confirm('Reset analysis buffers for all markets?')
    if (!confirmed) return
    resetAllMarkets()
  }

  const handleResetTradeHistory = () => {
    const confirmed = window.confirm('Are you sure you want to reset trade history?')
    if (!confirmed) return
    resetTradeHistory()
  }

  const handleResetSessionProfit = () => {
    if (strategy.hasOpenContract || strategy.placingTrade) {
      alert('Cannot reset session P/L while trade is running.')
      return
    }
    const confirmed = window.confirm('Reset session profit/loss, current stake, and martingale step?')
    if (!confirmed) return
    resetSessionProfit()
  }

  const exportReport = () => {
    const report = {
      exportedAt: new Date().toISOString(),
      phase: strategy.phase,
      bestMarket: strategy.bestMarket,
      sessionProfit: strategy.sessionProfit,
      markets: strategy.markets,
      setupLogs: strategy.setupLogs,
      tradeLogs: strategy.tradeLogs,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dcircle-even-odd-report-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <section className="glass-glow rounded-2xl p-6 border border-neon-green/20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <p className="text-neon-cyan text-xs tracking-wider">ONLY ACTIVE STRATEGY</p>
            <h2 className="text-2xl font-bold text-neon-green mt-2">D-Circles EVEN Red/Yellow Entry</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleStartAutoTrade}
              disabled={strategy.autoTradeEnabled || strategy.hasOpenContract || strategy.placingTrade}
              className="px-5 py-3 rounded-lg font-bold bg-neon-green text-space-900 disabled:opacity-50"
            >
              Start Auto Trade
            </button>
            <button
              type="button"
              onClick={handleManualStop}
              disabled={!strategy.autoTradeEnabled && !strategy.placingTrade}
              className="px-5 py-3 rounded-lg font-bold bg-neon-red text-space-900 disabled:opacity-50"
            >
              Manual Stop
            </button>
            <button
              type="button"
              onClick={exportReport}
              className="px-5 py-3 rounded-lg font-bold bg-space-700/70 border border-neon-blue/30 text-neon-blue"
            >
              Export Report
            </button>
            <button
              type="button"
              onClick={handleResetSelectedMarket}
              disabled={strategy.hasOpenContract || strategy.placingTrade}
              className="px-5 py-3 rounded-lg font-bold bg-space-700/70 border border-neon-orange/30 text-neon-orange disabled:opacity-50"
            >
              Reset Selected Market
            </button>
            <button
              type="button"
              onClick={handleResetAllMarkets}
              disabled={strategy.hasOpenContract || strategy.placingTrade}
              className="px-5 py-3 rounded-lg font-bold bg-space-700/70 border border-neon-red/30 text-neon-red disabled:opacity-50"
            >
              Reset All Markets
            </button>
            <button
              type="button"
              onClick={handleResetTradeHistory}
              className="px-5 py-3 rounded-lg font-bold bg-space-700/70 border border-neon-purple/30 text-neon-purple"
            >
              Reset Trade History
            </button>
            <button
              type="button"
              onClick={handleResetSessionProfit}
              disabled={strategy.hasOpenContract || strategy.placingTrade}
              className="px-5 py-3 rounded-lg font-bold bg-space-700/70 border border-neon-blue/30 text-neon-blue disabled:opacity-50"
            >
              Reset Session P/L
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 text-sm">
          {[
            ['Analysis', strategy.analysisEnabled ? 'ALWAYS ON' : 'OFF'],
            ['Bot State', strategy.botState],
            ['Manual Stop', strategy.manualStop ? 'YES' : 'NO'],
            ['Phase', strategy.phase],
            ['Status', strategy.status],
            ['Entry Status', visibleMarket?.entryStatus ?? '-'],
            ['Stop Reason', strategy.stopReason ?? '-'],
            ['Best Market', strategy.bestMarket ?? '-'],
            ['Best Score', strategy.bestMarketScore],
            ['Current Digit', strategy.currentDigit ?? '-'],
            ['Red/Yellow Touch', visibleMarket?.redOrYellowTouch ? 'YES' : 'NO'],
            ['Open Contract', strategy.hasOpenContract ? 'YES' : 'NO'],
            ['Current Stake', strategy.currentStake.toFixed(2)],
            ['Session P/L', strategy.sessionProfit.toFixed(2)],
            ['Wins / Losses', `${strategy.totalWins}/${strategy.totalLosses}`],
            ['Consecutive W/L', `${strategy.consecutiveWins}/${strategy.consecutiveLosses}`],
            ['Watch Timer', visibleMarket ? `${visibleMarket.stabilityWatchElapsedSeconds}s` : '-'],
            ['Win Rate', `${winRate}%`],
            ['Last Result', strategy.lastTradeResult ?? '-'],
          ].map(([label, value]) => (
            <div key={label} className="p-4 rounded-lg bg-space-700/50 border border-neon-green/20">
              <p className="text-gray-400 text-xs mb-1">{label}</p>
              <p className="text-lg font-bold text-neon-green break-words">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-glow rounded-2xl p-6 border border-neon-blue/20">
        <p className="text-neon-cyan text-xs tracking-wider mb-4">RISK CONTROLS</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {([
            ['initialStake', 'Initial Stake', '0.01'],
            ['martingaleMultiplier', 'Martingale Multiplier', '0.1'],
            ['maxMartingaleSteps', 'Max Steps', '1'],
            ['takeProfit', 'Take Profit', '0.01'],
            ['stopLoss', 'Stop Loss', '0.01'],
            ['contractDuration', 'Duration Ticks', '1'],
            ['stopAfterConsecutiveWins', 'Stop After Wins', '1'],
            ['stopAfterConsecutiveLosses', 'Stop After Losses', '1'],
          ] as const).map(([key, label, step]) => (
            <label key={key}>
              <span className="block text-gray-400 text-xs mb-2">{label}</span>
              <input
                type="number"
                min="0"
                step={step}
                value={strategy[key]}
                onChange={(event) => updateNumber(key, event.target.value)}
                disabled={strategy.hasOpenContract || strategy.placingTrade}
                className="w-full px-3 py-3 rounded-lg bg-space-700/50 border border-neon-blue/30 text-white"
              />
            </label>
          ))}
          <label className="flex items-center gap-3 pt-7">
            <input
              type="checkbox"
              checked={strategy.martingaleEnabled}
              onChange={(event) => updateStrategy({ martingaleEnabled: event.target.checked })}
              disabled={strategy.hasOpenContract || strategy.placingTrade}
              className="h-5 w-5"
            />
            <span className="text-white text-sm">Martingale</span>
          </label>
        </div>
      </section>

      <section className="glass-glow rounded-2xl p-6 border border-neon-purple/20">
        <p className="text-neon-cyan text-xs tracking-wider mb-4">D-CIRCLE DETECTION SETTINGS</p>
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-8 gap-4">
          {([
            ['tickWindow', 'Tick Window', '1'],
            ['minEvenDominanceGap', 'Even Gap', '0.1'],
            ['minGreenPercentage', 'Min Green %', '0.1'],
            ['maxRedPercentage', 'Max Red %', '0.1'],
            ['balanceGapThreshold', 'Balance Gap', '0.1'],
            ['shiftWaitTicks', 'Shift Wait Ticks', '1'],
            ['stabilityWatchMinutes', 'Watch Minutes', '1'],
            ['maximumWatchMinutes', 'Max Watch Minutes', '1'],
            ['minimumSetupScore', 'Min Setup Score', '1'],
          ] as const).map(([key, label, step]) => (
            <label key={key}>
              <span className="block text-gray-400 text-xs mb-2">{label}</span>
              <input
                type="number"
                min="0"
                max={key === 'stabilityWatchMinutes' || key === 'maximumWatchMinutes' ? 10 : undefined}
                step={step}
                value={strategy.config[key]}
                onChange={(event) => updateConfigNumber(key, event.target.value)}
                disabled={strategy.hasOpenContract || strategy.placingTrade}
                className="w-full px-3 py-3 rounded-lg bg-space-700/50 border border-neon-purple/30 text-white"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="glass-glow rounded-2xl p-6 border border-neon-green/20">
        <div className="flex items-center justify-between gap-4 mb-4">
          <p className="text-neon-cyan text-xs tracking-wider">
            DIGIT DISTRIBUTION - {visibleMarket?.symbol ?? currentMarket}
          </p>
          <p className="text-gray-300 text-sm">
            {visibleMarket?.tickCount ?? 0}/{strategy.config.tickWindow} ticks
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
          {Array.from({ length: 10 }, (_, digit) => {
            const percentage = visibleMarket?.percentages[digit] ?? 0
            const count = visibleMarket?.counts[digit] ?? 0
            return (
              <div key={digit} className="p-3 rounded-lg bg-space-700/50 border border-neon-green/10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-3 ${digitColor(
                    digit,
                    visibleMarket?.greenDigit ?? null,
                    visibleMarket?.blueDigit ?? null,
                    visibleMarket?.redDigit ?? null,
                    visibleMarket?.yellowDigit ?? null
                  )}`}
                >
                  {digit}
                </div>
                <p className="text-white font-bold">{percentage.toFixed(1)}%</p>
                <p className="text-gray-400 text-xs">{count} ticks</p>
                <div className="h-2 rounded bg-space-900 mt-2 overflow-hidden">
                  <div className="h-full bg-neon-cyan" style={{ width: `${Math.min(100, percentage * 5)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
          {[
            ['Green', visibleMarket?.greenDigit ?? '-'],
            ['Blue', visibleMarket?.blueDigit ?? '-'],
            ['Red', visibleMarket?.redDigit ?? '-'],
            ['Yellow', visibleMarket?.yellowDigit ?? '-'],
            ['Entry Status', visibleMarket?.entryStatus ?? '-'],
            ['EVEN Total', `${(visibleMarket?.evenTotal ?? 0).toFixed(1)}%`],
            ['ODD Total', `${(visibleMarket?.oddTotal ?? 0).toFixed(1)}%`],
            ['Watch', `${visibleMarket?.stabilityWatchElapsedSeconds ?? 0}s`],
            ['Stable', visibleMarket?.stabilityWatchComplete ? 'YES' : 'NO'],
          ].map(([label, value]) => (
            <div key={label} className="p-4 rounded-lg bg-space-700/50 border border-neon-green/10">
              <p className="text-gray-400 text-xs mb-1">{label}</p>
              <p className="text-white font-bold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-glow rounded-2xl p-6 border border-neon-blue/20 overflow-x-auto">
        <p className="text-neon-cyan text-xs tracking-wider mb-4">MULTI-MARKET SCANNER</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neon-blue/20">
              {['Market', 'Ticks', 'Last', 'Green', 'Blue', 'Red', 'Yellow', 'Touch', 'Even %', 'Odd %', 'Score', 'Watch', 'Stable', 'Entry', 'Status'].map((heading) => (
                <th key={heading} className="text-left py-3 px-3 text-neon-cyan whitespace-nowrap">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {marketRows.map((market) => (
              <tr key={market.symbol} className="border-b border-neon-blue/5">
                <td className="py-3 px-3 text-white font-bold">{market.symbol}</td>
                <td className="py-3 px-3 text-white">{market.tickCount}/{strategy.config.tickWindow}</td>
                <td className="py-3 px-3 text-neon-green">{market.lastDigit ?? '-'}</td>
                <td className="py-3 px-3 text-neon-green">{market.greenDigit ?? '-'}</td>
                <td className="py-3 px-3 text-neon-blue">{market.blueDigit ?? '-'}</td>
                <td className="py-3 px-3 text-neon-red">{market.redDigit ?? '-'}</td>
                <td className="py-3 px-3 text-neon-orange">{market.yellowDigit ?? '-'}</td>
                <td className="py-3 px-3 text-white">{market.redOrYellowTouch ? 'YES' : 'NO'}</td>
                <td className="py-3 px-3 text-white">{market.evenTotal.toFixed(1)}</td>
                <td className="py-3 px-3 text-white">{market.oddTotal.toFixed(1)}</td>
                <td className="py-3 px-3 text-neon-cyan">{market.score}</td>
                <td className="py-3 px-3 text-white">{market.stabilityWatchElapsedSeconds}s</td>
                <td className="py-3 px-3 text-white">{market.stabilityWatchComplete ? 'YES' : 'NO'}</td>
                <td className="py-3 px-3 text-neon-cyan">{market.entryStatus}</td>
                <td className="py-3 px-3 text-gray-300">{market.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="glass-glow rounded-2xl p-6 border border-neon-purple/20 overflow-x-auto">
        <p className="text-neon-cyan text-xs tracking-wider mb-4">TRADE HISTORY</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neon-purple/20">
              {['Time', 'Market', 'Phase', 'Contract', 'Stake', 'Profit', 'Result', 'Green', 'Red', 'Contract ID'].map((heading) => (
                <th key={heading} className="text-left py-3 px-3 text-neon-cyan whitespace-nowrap">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strategy.tradeLogs.map((trade) => (
              <tr key={trade.id} className="border-b border-neon-purple/5">
                <td className="py-3 px-3 text-white">{trade.timestamp.slice(11, 19)}</td>
                <td className="py-3 px-3 text-white">{trade.market}</td>
                <td className="py-3 px-3 text-neon-blue">{trade.phase}</td>
                <td className="py-3 px-3 text-neon-cyan">{trade.contractType}</td>
                <td className="py-3 px-3 text-white">{trade.stake.toFixed(2)}</td>
                <td className={`py-3 px-3 font-bold ${trade.profit >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                  {trade.profit.toFixed(2)}
                </td>
                <td className="py-3 px-3 text-white">{trade.result}</td>
                <td className="py-3 px-3 text-neon-green">{trade.greenDigit ?? '-'}</td>
                <td className="py-3 px-3 text-neon-red">{trade.redDigit ?? '-'}</td>
                <td className="py-3 px-3 text-gray-400">{trade.contractId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
