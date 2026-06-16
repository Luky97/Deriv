import { useStore } from '@store/index'

export const useConnection = () =>
  useStore(
    (state) =>
      state.accountInfo.websocketStatus === 'connected' &&
      state.accountInfo.loginStatus === 'connected'
  )

export const useTradingStats = () => {
  const strategy = useStore((state) => state.dCircleEvenOdd)
  return {
    totalTrades: strategy.totalTrades,
    wins: strategy.totalWins,
    losses: strategy.totalLosses,
    winRate: strategy.totalTrades ? ((strategy.totalWins / strategy.totalTrades) * 100).toFixed(2) : '0.00',
    totalProfit: strategy.sessionProfit,
  }
}
