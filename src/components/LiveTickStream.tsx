import { useStore } from '@store/index'

export const LiveTickStream = () => {
  const liveTick = useStore((state) => state.liveTick)
  const currentMarket = useStore((state) => state.currentMarket)

  return (
    <div className="glass-glow rounded-2xl p-8 border border-neon-blue/20 mb-6">
      <p className="text-neon-cyan text-xs mb-4 tracking-wider">LIVE PRICE - {currentMarket}</p>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <p className="text-5xl md:text-6xl font-bold font-mono neon-text">
          {liveTick?.price ?? '0.0000'}
        </p>
        <div>
          <p className="text-neon-cyan text-sm">LAST DIGIT</p>
          <p className="text-4xl font-bold text-neon-green">{liveTick?.lastDigit ?? '-'}</p>
        </div>
      </div>
    </div>
  )
}
