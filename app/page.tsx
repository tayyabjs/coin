'use client'

import { useState } from 'react'
import { TokenMetrics } from '@/types/token'

export default function Home() {
  const [address, setAddress] = useState('')
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null)
  const [analysis, setAnalysis] = useState({ verdict: '', score: 0, summary: '' })
  const [loading, setLoading] = useState(false)

  const fetchToken = async () => {
    if (!address) return alert('Please enter an address')
    setLoading(true)
    
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`)
      const data = await res.json()
      
      if (!data.pairs || data.pairs.length === 0) {
        setLoading(false)
        return alert('Token not found on DexScreener')
      }

      const p = data.pairs[0]
      const mc = p.marketCap || p.fdv
      
      // Calculations for Signal logic
      const buys = p.txns.h1.buys
      const sells = p.txns.h1.sells || 1
      const buyPressure = buys / sells
      const volVelocity = p.volume.h1 / (p.volume.h24 / 24 || 1)

      const m: TokenMetrics = {
        price: Number(p.priceUsd),
        marketCap: mc,
        liquidity: p.liquidity.usd,
        volume24h: p.volume.h24,
        fdvRatio: p.fdv / mc,
        volMcRatio: p.volume.h24 / mc,
        buyPressure: buyPressure,
        volVelocity: volVelocity,
        priceChangeH1: p.priceChange.h1
      }

      setMetrics(m)
      generateSignal(m)
    } catch (err) {
      console.error(err)
      alert('Error fetching data')
    } finally {
      setLoading(false)
    }
  }

  const generateSignal = (m: TokenMetrics) => {
    let score = 0
    let reasons: string[] = []

    // 1. Fundamentals (Original Indicators)
    if (m.fdvRatio <= 1.2) { score += 15; reasons.push("low dilution (good FDV)") }
    if (m.liquidity >= m.marketCap * 0.1) { score += 15; reasons.push("stable liquidity") }

    // 2. Technicals (Signal Group Indicators)
    if (m.buyPressure > 1.8) { score += 25; reasons.push("aggressive buy pressure") }
    if (m.volVelocity > 2) { score += 25; reasons.push("surging volume") }
    if (m.priceChangeH1 > 3 && m.priceChangeH1 < 25) { score += 20; reasons.push("strong hourly momentum") }

    let finalVerdict = ''
    if (score >= 75) finalVerdict = '🚀 STRONG BUY SIGNAL'
    else if (score >= 45) finalVerdict = '👀 WATCHLIST'
    else finalVerdict = '❌ HIGH RISK / AVOID'

    const summary = reasons.length > 0 
      ? `Analysis detected ${reasons.join(', ')}. Technical alignment suggests a potential breakout.`
      : "No significant accumulation patterns detected. Price action is currently neutral or bearish."

    setAnalysis({ verdict: finalVerdict, score, summary })
  }

  return (
    <main className="max-w-2xl mx-auto p-6 bg-slate-50 min-h-screen font-sans">
      <div className="bg-white shadow-2xl rounded-3xl p-8 border border-slate-200">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic">
            SOL<span className="text-blue-600">COIN</span> PREDICTOR
          </h1>
          <p className="text-slate-500 text-sm">Advanced Technical Analysis for Solana Gems</p>
        </div>

        <div className="flex gap-3 mb-8">
          <input 
            className="flex-1 p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 text-black outline-none focus:border-blue-500 transition-all"
            placeholder="Paste Token Contract Address..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button 
            onClick={fetchToken} 
            disabled={loading}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Scan'}
          </button>
        </div>

        {metrics && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Signal Result Card */}
            <div className={`p-6 rounded-2xl border ${analysis.score >= 75 ? 'bg-green-50 border-green-200' : 'bg-slate-900 border-slate-700'}`}>
               <div className="flex justify-between items-center mb-4">
                 <span className={`text-xs font-black px-3 py-1 rounded-full ${analysis.score >= 75 ? 'bg-green-200 text-green-800' : 'bg-slate-700 text-slate-300'}`}>
                   CONFIDENCE: {analysis.score}%
                 </span>
                 <span className="text-blue-400 font-mono text-sm">${metrics.price.toFixed(8)}</span>
               </div>
               <h2 className={`text-4xl font-black mb-3 ${analysis.score >= 75 ? 'text-green-700' : 'text-white'}`}>
                 {analysis.verdict}
               </h2>
               <div className="bg-white/10 p-4 rounded-xl border border-white/5">
                 <p className={`${analysis.score >= 75 ? 'text-slate-700' : 'text-slate-300'} text-sm leading-relaxed italic`}>
                    &ldquo;{analysis.summary}&rdquo;
                 </p>
               </div>
            </div>

            {/* Detailed Metrics Table */}
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest">
                  <tr>
                    <th className="p-4">Technical Indicator</th>
                    <th className="p-4">Live Value</th>
                    <th className="p-4">Signal Threshold</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 divide-y divide-slate-100">
                  <tr>
                    <td className="p-4 font-medium">Buy/Sell Ratio (1h)</td>
                    <td className="p-4 font-mono text-blue-600">{metrics.buyPressure.toFixed(2)}x</td>
                    <td className="p-4 text-slate-400">&gt; 1.8x</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">Volume Velocity</td>
                    <td className="p-4 font-mono text-blue-600">{metrics.volVelocity.toFixed(1)}x</td>
                    <td className="p-4 text-slate-400">&gt; 2.0x</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">Liquidity/MC</td>
                    <td className="p-4 font-mono text-blue-600">{(metrics.volMcRatio * 100).toFixed(1)}%</td>
                    <td className="p-4 text-slate-400">&gt; 10%</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-medium">1H Momentum</td>
                    <td className="p-4 font-mono text-blue-600">{metrics.priceChangeH1}%</td>
                    <td className="p-4 text-slate-400">3% to 25%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}