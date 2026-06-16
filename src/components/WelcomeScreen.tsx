import { useState } from 'react'
import { AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { useStore } from '@store/index'
import DerivWebSocketService from '@api/DerivWebSocketService'

interface WelcomeScreenProps {
  onConnect: (service: DerivWebSocketService) => void
}

export const WelcomeScreen = ({ onConnect }: WelcomeScreenProps) => {
  const [appId, setAppId] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setDerivConfig = useStore((state) => state.setDerivConfig)
  const setShowWelcomeScreen = useStore((state) => state.setShowWelcomeScreen)

  const handleConnect = async () => {
    const cleanAppId = appId.trim()
    const cleanToken = apiToken.trim()
    if (!cleanAppId || !cleanToken) {
      setError('Enter both Deriv App ID and API token.')
      return
    }

    setLoading(true)
    setError('')

    const service = new DerivWebSocketService(cleanAppId, cleanToken)
    const connected = await service.connect()

    if (connected) {
      setDerivConfig({ appId: cleanAppId, apiToken: cleanToken })
      setShowWelcomeScreen(false)
      onConnect(service)
    } else {
      setError(service.getLastErrorMessage() || 'Failed to connect to Deriv.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-space-900 via-space-800 to-space-700 px-4">
      <div className="w-full max-w-md">
        <div className="glass-glow rounded-2xl p-8 border-2 border-neon-blue/30">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 neon-text">DERIV DIGIT</h1>
            <p className="text-neon-cyan text-sm tracking-widest">STRONG TIME POSITION</p>
          </div>

          <div className="space-y-4 mb-6">
            <label className="block">
              <span className="block text-neon-cyan text-xs mb-2 tracking-wider">DERIV APP ID</span>
              <input
                type="text"
                value={appId}
                onChange={(event) => setAppId(event.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg bg-space-700/50 border border-neon-blue/30 text-white"
              />
            </label>
            <label className="block">
              <span className="block text-neon-cyan text-xs mb-2 tracking-wider">API TOKEN</span>
              <input
                type="password"
                value={apiToken}
                onChange={(event) => setApiToken(event.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg bg-space-700/50 border border-neon-blue/30 text-white"
              />
            </label>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-neon-red/10 border border-neon-red/30 flex items-start gap-3">
              <AlertCircle className="text-neon-red mt-0.5 flex-shrink-0" size={18} />
              <span className="text-neon-red text-sm">{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleConnect}
            disabled={loading || !appId.trim() || !apiToken.trim()}
            className="w-full py-3 px-6 rounded-lg font-bold text-space-900 bg-gradient-to-r from-neon-blue to-neon-cyan disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                CONNECTING...
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                CONNECT TO DERIV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
