'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TokenMetrics } from '@/types/token'

export default function Home() {
  const [address, setAddress] = useState('')
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null)
  const [verdict, setVerdict] = useState('')

  const fetchToken = async () => {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`
    )
    const data = await res.json()
    if (!data.pairs?.length) return alert('Token not found')

    const p = data.pairs[0]

    const mc = p.marketCap || p.fdv
    const fdvRatio = p.fdv / mc
    const volMcRatio = p.volume.h24 / mc

    const m: TokenMetrics = {
      price: Number(p.priceUsd),
      marketCap: mc,
      liquidity: p.liquidity.usd,
      volume24h: p.volume.h24,
      fdvRatio,
      volMcRatio
    }

    setMetrics(m)
    evaluate(m)
  }

  const evaluate = async (m: TokenMetrics) => {
    let score = 0

    if (m.fdvRatio <= 1.5) score += 2
    if (m.volMcRatio >= 0.01 && m.volMcRatio <= 0.1) score += 2
    if (m.liquidity >= m.marketCap * 0.1) score += 2

    const finalVerdict =
      score >= 6 ? 'STRONG BUY' : score >= 4 ? 'CAUTION' : 'AVOID'

    setVerdict(finalVerdict)

    await supabase.from('token_analysis').insert({
      token_address: address,
      price: m.price,
      market_cap: m.marketCap,
      liquidity: m.liquidity,
      volume_24h: m.volume24h,
      fdv_ratio: m.fdvRatio,
      vol_mc_ratio: m.volMcRatio,
      score,
      verdict: finalVerdict
    })
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        Solana Investment Selector (Jupiter)
      </h1>

      <input
        className="w-full p-2 border rounded"
        placeholder="SPL Token Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      <button
        onClick={fetchToken}
        className="mt-3 w-full bg-black text-white p-2 rounded"
      >
        Fetch Token
      </button>

      {metrics && (
        <div className="mt-4 text-sm space-y-1">
          <p>Price: ${metrics.price}</p>
          <p>Market Cap: ${metrics.marketCap.toLocaleString()}</p>
          <p>Liquidity: ${metrics.liquidity.toLocaleString()}</p>
          <p>FDV Ratio: {metrics.fdvRatio.toFixed(2)}</p>
          <p>Vol / MC: {(metrics.volMcRatio * 100).toFixed(2)}%</p>
        </div>
      )}

      {verdict && (
        <div className="mt-4 p-3 text-center font-bold bg-gray-900 text-white rounded">
          {verdict}
        </div>
      )}
    </main>
  )
}
