'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TokenMetrics } from '@/types/token'

export default function Home() {
  const [address, setAddress] = useState('')
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState({
    verdict: 'WAITING',
    score: 0,
    summary: 'Enter a contract address to begin deep-scan.',
    color: 'slate'
  })

  const fetchToken = async () => {
    if (!address) return;
    setLoading(true)
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`)
      const data = await res.json()
      if (!data.pairs?.length) return alert('Token not found')

      const p = data.pairs[0]
      const mc = p.marketCap || p.fdv
      
      const m: TokenMetrics = {
        price: Number(p.priceUsd),
        marketCap: mc,
        liquidity: p.liquidity.usd,
        volume24h: p.volume.h24,
        fdvRatio: p.fdv / mc,
        volMcRatio: p.volume.h24 / mc,
        buyPressure: p.txns.h1.buys / (p.txns.h1.sells || 1),
        volVelocity: p.volume.h1 / (p.volume.h24 / 24 || 1),
        priceChangeH1: p.priceChange.h1
      }

      setMetrics(m)
      const results = runAIEngine(m)
      setAnalysis(results)

      // Auto-save to Watchlist in Supabase
      await supabase.from('token_analysis').insert({
        token_address: address,
        score: results.score,
        verdict: results.verdict,
        price_at_scan: m.price
      })

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const runAIEngine = (m: TokenMetrics) => {
    let techScore = 0
    let safetyScore = 0
    let alerts: string[] = []

    // --- Technical Explosion Logic ---
    if (m.buyPressure > 2.0) techScore += 40
    if (m.volVelocity > 2.5) techScore += 40
    if (m.priceChangeH1 > 5 && m.priceChangeH1 < 30) techScore += 20

    // --- Safety / Rug-Check Logic ---
    const liqRatio = m.liquidity / m.marketCap
    if (liqRatio > 0.15) safetyScore += 50 
    else if (liqRatio < 0.05) alerts.push("⚠️ DANGEROUSLY LOW LIQUIDITY")
    
    if (m.fdvRatio < 1.1) safetyScore += 50
    else alerts.push("⚠️ HIGH FDV (DEVS MAY DUMP)")

    const finalScore = Math.round((techScore * 0.6) + (safetyScore * 0.4))
    
    let verdict = 'AVOID'
    let color = 'red'
    if (finalScore > 75) { verdict = '🚀 STRONG BUY'; color = 'green' }
    else if (finalScore > 45) { verdict = '👀 WATCHLIST'; color = 'yellow' }

    return {
      verdict,
      score: finalScore,
      summary: alerts.length > 0 ? alerts.join(' | ') : "Clean scan. Momentum signals are aligned for potential explosion.",
      color
    }
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-200 p-4 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter italic">MOON<span className="text-blue-500">BOLT</span></h1>
            <p className="text-slate-400 text-sm">Real-time Solana Alpha Scanner</p>
          </div>
          <div className="text-right hidden md:block">
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30 font-bold uppercase">System Live</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative group mb-10">
          <input 
            className="w-full bg-[#1e293b] border-2 border-slate-700 p-5 rounded-2xl outline-none focus:border-blue-500 transition-all text-white font-mono placeholder:text-slate-500"
            placeholder="Enter Solana Contract (CA)..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button 
            onClick={fetchToken}
            disabled={loading}
            className="absolute right-3 top-3 bottom-3 bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
          >
            {loading ? 'SCANNIG...' : 'ANALYZE'}
          </button>
        </div>

        {metrics && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-300">
            
            {/* Left Column: Result & Summary */}
            <div className="lg:col-span-2 space-y-6">
              <div className={`p-8 rounded-3xl border-2 transition-all ${
                analysis.color === 'green' ? 'bg-green-500/10 border-green-500/50' : 
                analysis.color === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-red-500/10 border-red-500/50'
              }`}>
                <div className="flex justify-between items-start mb-6">
                  <h2 className={`text-5xl font-black tracking-tighter ${
                    analysis.color === 'green' ? 'text-green-400' : 
                    analysis.color === 'yellow' ? 'text-yellow-400' : 'text-red-400'
                  }`}>{analysis.verdict}</h2>
                  <div className="text-right">
                    <p className="text-slate-400 text-xs font-bold uppercase">Signal Strength</p>
                    <p className="text-3xl font-mono font-black">{analysis.score}%</p>
                  </div>
                </div>
                
                {/* Risk Gauge */}
                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden mb-6">
                  <div 
                    className={`h-full transition-all duration-1000 ${
                      analysis.color === 'green' ? 'bg-green-500' : 
                      analysis.color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${analysis.score}%` }}
                  />
                </div>
                
                <p className="text-slate-300 italic text-lg leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
                  &ldquo;{analysis.summary}&rdquo;
                </p>
              </div>
            </div>

            {/* Right Column: Key Stats */}
            <div className="bg-[#1e293b] p-6 rounded-3xl border border-slate-700 flex flex-col justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">On-Chain Health</h3>
              <div className="space-y-4">
                <MetricRow label="Buy Pressure" value={`${metrics.buyPressure.toFixed(2)}x`} ideal="&gt; 1.8x" />
                <MetricRow label="Vol Velocity" value={`${metrics.volVelocity.toFixed(1)}x`} ideal="&gt; 2.0x" />
                <MetricRow label="Liquidity/MC" value={`${((metrics.liquidity/metrics.marketCap)*100).toFixed(1)}%`} ideal="&gt; 15%" />
                <MetricRow label="Price 1H" value={`${metrics.priceChangeH1}%`} ideal="5-25%" />
                <MetricRow label="FDV Ratio" value={metrics.fdvRatio.toFixed(2)} ideal="1.0 - 1.2" />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function MetricRow({ label, value, ideal }: { label: string, value: string, ideal: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-lg font-mono font-bold text-blue-400">{value}</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-slate-500 font-bold uppercase">Ideal</p>
        <p className="text-xs font-mono text-slate-300 italic" dangerouslySetInnerHTML={{ __html: ideal }} />
      </div>
    </div>
  )
}