import React from 'react'
import { useStore } from '@store/index'
import { formatBalance } from '@utils/formatting'
import { WifiOff, Wifi } from 'lucide-react'
import { SUPPORTED_MARKETS } from '../utils/strategy'

interface HeaderProps {
  onMarketChange: (market: string) => void | Promise<void>
}

export const Header: React.FC<HeaderProps> = ({ onMarketChange }) => {
  const accountInfo = useStore((state) => state.accountInfo)
  const connectionHealth = useStore((state) => state.connectionHealth)
  const currentMarket = useStore((state) => state.currentMarket)
  const serverTime = useStore((state) => state.dCircleEvenOdd.serverTime)
  const tradeLocked = useStore(
    (state) => state.dCircleEvenOdd.hasOpenContract || state.dCircleEvenOdd.placingTrade
  )

  const handleMarketChange = (market: string) => {
    onMarketChange(market)
  }

  const isConnected = connectionHealth.websocketStatus === 'connected' && accountInfo.loginStatus === 'connected'
  const lastTickAge =
    connectionHealth.lastTickTime === null
      ? null
      : Math.max(0, Math.round((Date.now() - connectionHealth.lastTickTime) / 1000))
  const healthLabel = isConnected
    ? `ONLINE - last tick ${lastTickAge ?? '-'}s ago`
    : connectionHealth.websocketStatus === 'reconnecting'
    ? 'RECONNECTING'
    : connectionHealth.websocketStatus === 'connecting'
    ? 'CONNECTING'
    : 'OFFLINE'

  return (
    <div className="glass-glow rounded-2xl p-6 border border-neon-blue/20 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Account Balance */}
        <div className="p-4 rounded-xl bg-space-700/50 border border-neon-cyan/20">
          <p className="text-neon-cyan text-xs mb-1 tracking-wider">BALANCE</p>
          <p className="text-2xl font-bold neon-text-cyan">
            ${formatBalance(accountInfo.balance)}
          </p>
          <p className="text-gray-400 text-xs mt-1">{accountInfo.currency || 'USD'}</p>
        </div>

        {/* Account Type */}
        <div className="p-4 rounded-xl bg-space-700/50 border border-neon-purple/20">
          <p className="text-neon-purple text-xs mb-1 tracking-wider">ACCOUNT: {accountInfo.loginId}</p>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                accountInfo.accountType === 'DEMO' ? 'bg-neon-orange' : 'bg-neon-red'
              }`}
            ></div>
            <p className="text-xl font-bold text-neon-purple">{accountInfo.accountType}</p>
          </div>
        </div>

        {/* Connection Status */}
        <div className="p-4 rounded-xl bg-space-700/50 border border-neon-green/20">
          <p className="text-neon-green text-xs mb-1 tracking-wider">CONNECTION</p>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="text-neon-green animate-pulse" size={20} />
                <p className="text-xl font-bold text-neon-green">{healthLabel}</p>
              </>
            ) : (
              <>
                <WifiOff className="text-neon-red" size={20} />
                <p className="text-xl font-bold text-neon-red">{healthLabel}</p>
              </>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Reconnects: {connectionHealth.reconnectCount}
            {connectionHealth.staleReason ? ` - ${connectionHealth.staleReason}` : ''}
          </p>
        </div>

        {/* Deriv Server Time */}
        <div className="p-4 rounded-xl bg-space-700/50 border border-neon-blue/20">
          <p className="text-neon-blue text-xs mb-1 tracking-wider">DERIV SERVER TIME UTC</p>
          <p className="text-2xl font-bold neon-text font-mono">{serverTime}</p>
        </div>
      </div>

      {/* Market Selector */}
      <div className="mt-6 pt-6 border-t border-neon-blue/10">
        <p className="text-neon-cyan text-xs mb-3 tracking-wider">SELECT MARKET</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {SUPPORTED_MARKETS.map((market) => (
            <button
              key={market.symbol}
              onClick={() => handleMarketChange(market.symbol)}
              disabled={tradeLocked}
              className={`py-3 px-4 rounded-lg font-bold transition ${
                currentMarket === market.symbol
                  ? 'bg-gradient-to-r from-neon-blue to-neon-cyan text-space-900 shadow-neon-blue'
                  : 'bg-space-700/50 border border-neon-blue/20 text-neon-blue hover:border-neon-blue/50'
              } ${tradeLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {market.symbol}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
