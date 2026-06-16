import { useEffect, useRef } from 'react'
import { useStore } from '@store/index'
import {
  DCircleEvenOddStrategy,
  ErrorBoundary,
  Header,
  LiveTickStream,
  WelcomeScreen,
} from '@components/index'
import DerivWebSocketService from '@api/DerivWebSocketService'

function App() {
  const showWelcomeScreen = useStore((state) => state.showWelcomeScreen)
  const setCurrentMarket = useStore((state) => state.setCurrentMarket)
  const serviceRef = useRef<DerivWebSocketService | null>(null)

  const handleConnect = (service: DerivWebSocketService) => {
    serviceRef.current = service
  }

  const handleMarketChange = (market: string) => {
    const strategy = useStore.getState().dCircleEvenOdd
    if (strategy.hasOpenContract || strategy.placingTrade) return
    setCurrentMarket(market)
  }

  useEffect(() => {
    const handleOffline = () => {
      useStore.getState().setDCircleAutoTrade(false)
      useStore.getState().setConnectionHealth({
        websocketStatus: 'disconnected',
        isStale: true,
        staleReason: 'browser_offline',
      })
    }

    const handleOnline = () => {
      serviceRef.current?.forceReconnect('browser_online')
    }

    const handleBeforeUnload = () => {
      serviceRef.current?.disconnect()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      serviceRef.current?.disconnect()
    }
  }, [])

  if (showWelcomeScreen) {
    return (
      <ErrorBoundary>
        <WelcomeScreen onConnect={handleConnect} />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-space-900 via-space-800 to-space-700 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Header onMarketChange={handleMarketChange} />
          <LiveTickStream />
          <DCircleEvenOddStrategy />
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App
