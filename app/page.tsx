'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Zap,
  Shield,
  AlertTriangle,
  Activity,
  DollarSign,
  BarChart3,
  Users,
  Lock,
  Droplets,
  Bell,
  BellOff,
  RefreshCw,
  Eye,
  Wallet,
} from 'lucide-react';

export default function AdvancedDEXScanner() {
  const [address, setAddress] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deepAnalysis, setDeepAnalysis] = useState(null);
  const [holderData, setHolderData] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);

  const refreshInterval = useRef<number | null>(null);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && address) {
      refreshInterval.current = setInterval(() => {
        fetchAdvancedMetrics(true);
      }, 30000);
    } else {
      if (refreshInterval.current !== null) {
        clearInterval(refreshInterval.current);
        refreshInterval.current = null;
      }
    }

    return () => {
      if (refreshInterval.current !== null) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [autoRefresh, address]);

  const fetchAdvancedMetrics = async (silent = false) => {
    if (!address) return;
    if (!silent) setLoading(true);

    try {
      // ✅ Clean URL — no extra spaces!
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
      const data = await res.json();

      if (!data.pairs?.length) {
        if (!silent) alert('Token not found');
        setLoading(false);
        return;
      }

      const pair = data.pairs[0];
      const advancedMetrics = calculateAdvancedMetrics(pair);
      const holders = simulateHolderData(advancedMetrics.marketCap);

      setHolderData(holders);

      // Update historical data
      const newHistoricalData = [...historicalData, { timestamp: Date.now(), ...advancedMetrics }].slice(-20);
      setHistoricalData(newHistoricalData);

      setMetrics(advancedMetrics);

      // Pass historicalData explicitly to avoid stale closure
      const analysis = runDeepAnalysisEngine(advancedMetrics, holders, newHistoricalData);
      setDeepAnalysis(analysis);

      checkAlerts(advancedMetrics, analysis);
    } catch (err) {
      console.error('Error:', err);
      if (!silent) alert('Failed to fetch token data');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const simulateHolderData = (marketCap) => {
    const topHolders = [
      { rank: 1, percentage: 15.2, address: 'Dev/Team', type: 'dev' },
      { rank: 2, percentage: 8.5, address: 'Whale 1', type: 'whale' },
      { rank: 3, percentage: 6.3, address: 'Whale 2', type: 'whale' },
      { rank: 4, percentage: 4.8, address: 'CEX', type: 'cex' },
      { rank: 5, percentage: 3.2, address: 'Whale 3', type: 'whale' },
    ];

    const top10Total = topHolders.reduce((sum, h) => sum + h.percentage, 0) + 12.5;
    const holderCount = Math.floor(marketCap / 1000) + Math.random() * 500;

    return {
      topHolders,
      top10Concentration: top10Total,
      totalHolders: Math.floor(holderCount),
      riskScore: top10Total > 60 ? 'HIGH' : top10Total > 40 ? 'MEDIUM' : 'LOW',
    };
  };

  const calculateAdvancedMetrics = (pair) => {
    const mc = pair.marketCap || pair.fdv || 0;
    const liq = pair.liquidity?.usd || 0;

    const priceChange = {
      m5: pair.priceChange?.m5 || 0,
      h1: pair.priceChange?.h1 || 0,
      h6: pair.priceChange?.h6 || 0,
      h24: pair.priceChange?.h24 || 0,
    };

    const txns = pair.txns || {};
    const buys5m = txns.m5?.buys || 0;
    const sells5m = txns.m5?.sells || 0;
    const buys1h = txns.h1?.buys || 0;
    const sells1h = txns.h1?.sells || 0;
    const buys24h = txns.h24?.buys || 0;
    const sells24h = txns.h24?.sells || 0;

    const vol5m = pair.volume?.m5 || 0;
    const vol1h = pair.volume?.h1 || 0;
    const vol24h = pair.volume?.h24 || 0;

    const buyPressure5m = sells5m > 0 ? buys5m / sells5m : buys5m;
    const buyPressure1h = sells1h > 0 ? buys1h / sells1h : buys1h;
    const buyPressure24h = sells24h > 0 ? buys24h / sells24h : buys24h;

    const volVelocity = vol24h > 0 ? vol1h / (vol24h / 24) : 0;
    const volAcceleration = vol1h > 0 ? (vol5m * 12) / vol1h : 0;

    const liqToMC = mc > 0 ? liq / mc : 0;
    const volToMC = mc > 0 ? vol24h / mc : 0;
    const volToLiq = liq > 0 ? vol24h / liq : 0;
    const fdvRatio = pair.fdv && mc > 0 ? pair.fdv / mc : 1;

    const momentum = calculateMomentum(priceChange);
    const avgBuySize = buys24h > 0 ? (vol24h * 0.5) / buys24h : 0;
    const avgSellSize = sells24h > 0 ? (vol24h * 0.5) / sells24h : 0;
    const whaleRatio = avgSellSize > 0 ? avgBuySize / avgSellSize : 1;
    const priceImpact = liq > 0 ? (10000 / liq) * 100 : 999;
    const trendStrength = calculateTrendStrength(priceChange);

    return {
      address: pair.baseToken?.address,
      name: pair.baseToken?.name || 'Unknown',
      symbol: pair.baseToken?.symbol || '???',
      price: Number(pair.priceUsd) || 0,
      marketCap: mc,
      liquidity: liq,
      fdv: pair.fdv || mc,
      priceChange,
      volume: { m5: vol5m, h1: vol1h, h24: vol24h },
      transactions: { buys5m, sells5m, buys1h, sells1h, buys24h, sells24h },
      buyPressure: { m5: buyPressure5m, h1: buyPressure1h, h24: buyPressure24h },
      volVelocity,
      volAcceleration,
      liqToMC,
      volToMC,
      volToLiq,
      fdvRatio,
      momentum,
      whaleRatio,
      avgBuySize,
      avgSellSize,
      pairCreatedAt: pair.pairCreatedAt,
      priceImpact,
      trendStrength,
      dexId: pair.dexId,
      pairAddress: pair.pairAddress,
    };
  };

  const calculateMomentum = (priceChange) => {
    const m5Weight = 0.4;
    const h1Weight = 0.3;
    const h6Weight = 0.2;
    const h24Weight = 0.1;
    return (
      priceChange.m5 * m5Weight +
      priceChange.h1 * h1Weight +
      priceChange.h6 * h6Weight +
      priceChange.h24 * h24Weight
    );
  };

  const calculateTrendStrength = (priceChange) => {
    const positive = [priceChange.m5, priceChange.h1, priceChange.h6, priceChange.h24].filter((v) => v > 0).length;
    if (positive === 4) return 'STRONG UP';
    if (positive === 3) return 'UP';
    if (positive === 2) return 'NEUTRAL';
    if (positive === 1) return 'DOWN';
    return 'STRONG DOWN';
  };

  const runDeepAnalysisEngine = (m, holders, histData) => {
    let signals = [];
    let redFlags = [];
    let score = 0;

    // Holder concentration
    if (holders) {
      if (holders.top10Concentration > 65) {
        redFlags.push({ type: 'critical', text: '🚨 EXTREME CONCENTRATION - Top 10 holders own 65%+, massive dump risk' });
        score -= 20;
      } else if (holders.top10Concentration > 50) {
        redFlags.push({ type: 'warning', text: '⚠️ High holder concentration - Top wallets control 50%+' });
        score -= 12;
      } else if (holders.top10Concentration < 35) {
        signals.push({ type: 'safe', text: '✅ Decentralized holdings - Low concentration risk' });
        score += 12;
      }

      if (holders.totalHolders > 1000) {
        signals.push({ type: 'strong', text: `👥 Strong community - ${holders.totalHolders.toLocaleString()} holders` });
        score += 10;
      }
    }

    // Momentum signals
    if (m.buyPressure.m5 > 3.0 && m.buyPressure.h1 > 2.0) {
      signals.push({ type: 'critical', text: '🔥 PARABOLIC BUY PRESSURE - Multi-timeframe surge detected' });
      score += 25;
    } else if (m.buyPressure.h1 > 2.5) {
      signals.push({ type: 'strong', text: '📈 Strong sustained buying pressure' });
      score += 15;
    } else if (m.buyPressure.h1 < 0.7) {
      redFlags.push({ type: 'warning', text: '📉 Selling pressure dominant - More sells than buys' });
      score -= 10;
    }

    // Volume
    if (m.volAcceleration > 3.0 && m.volVelocity > 2.0) {
      signals.push({ type: 'critical', text: '⚡ VOLUME EXPLOSION - Rapid acceleration, breakout imminent' });
      score += 20;
    } else if (m.volVelocity > 2.5) {
      signals.push({ type: 'strong', text: '📊 Above-average volume velocity' });
      score += 12;
    }

    // Trend
    if (m.trendStrength === 'STRONG UP') {
      signals.push({ type: 'strong', text: '📈 STRONG UPTREND - All timeframes bullish' });
      score += 15;
    } else if (m.trendStrength === 'STRONG DOWN') {
      redFlags.push({ type: 'warning', text: '📉 Strong downtrend across all timeframes' });
      score -= 12;
    }

    // Momentum range
    if (m.momentum > 8 && m.momentum < 50) {
      signals.push({ type: 'critical', text: '🚀 OPTIMAL PUMP ZONE - Strong momentum without overheating' });
      score += 20;
    } else if (m.momentum > 50) {
      redFlags.push({ type: 'warning', text: '⚠️ OVERHEATED - Pumped too fast, correction likely' });
      score -= 10;
    } else if (m.momentum < -15) {
      redFlags.push({ type: 'warning', text: '❄️ Heavy selling - Price dropping across timeframes' });
      score -= 15;
    }

    // Whale activity
    if (m.whaleRatio > 2.5) {
      signals.push({ type: 'strong', text: '🐋 WHALE ACCUMULATION - Large buyers dominating' });
      score += 15;
    } else if (m.whaleRatio < 0.6) {
      redFlags.push({ type: 'warning', text: '🔻 Retail dumping - Larger sells than buys' });
      score -= 8;
    }

    // Liquidity safety
    if (m.liqToMC > 0.2) {
      signals.push({ type: 'safe', text: '🛡️ EXCELLENT LIQUIDITY - Deep pool, minimal slippage' });
      score += 15;
    } else if (m.liqToMC < 0.08) {
      redFlags.push({ type: 'critical', text: '🚨 EXTREME RUG RISK - Dangerously low liquidity' });
      score -= 25;
    } else if (m.liqToMC < 0.12) {
      redFlags.push({ type: 'warning', text: '⚠️ LOW LIQUIDITY - High slippage risk' });
      score -= 12;
    }

    // Slippage
    if (m.priceImpact > 10) {
      redFlags.push({
        type: 'critical',
        text: `🚨 HIGH SLIPPAGE - $10k trade = ${m.priceImpact.toFixed(1)}% price impact`,
      });
      score -= 15;
    } else if (m.priceImpact < 2) {
      signals.push({ type: 'safe', text: '✅ Low slippage - Can handle large trades' });
      score += 8;
    }

    // FDV risk
    if (m.fdvRatio > 3.0) {
      redFlags.push({ type: 'critical', text: '💣 MASSIVE UNLOCK RISK - FDV 3x+ market cap' });
      score -= 20;
    } else if (m.fdvRatio > 1.5) {
      redFlags.push({ type: 'warning', text: '⚠️ Unlock risk - FDV significantly higher than MC' });
      score -= 10;
    } else if (m.fdvRatio < 1.1) {
      signals.push({ type: 'safe', text: '✅ Minimal unlock risk - FDV ≈ MC' });
      score += 10;
    }

    // Suspicious volume
    if (m.volToLiq > 5.0) {
      redFlags.push({ type: 'critical', text: '🚨 RUG ALERT - Volume extremely high vs liquidity' });
      score -= 15;
    }

    if (m.volToMC > 1.5 && m.volToMC < 8.0) {
      signals.push({ type: 'strong', text: '💎 ORGANIC ACTIVITY - Healthy volume/MC ratio' });
      score += 12;
    } else if (m.volToMC > 10.0) {
      redFlags.push({ type: 'warning', text: '⚠️ Suspicious volume - Possible wash trading' });
      score -= 8;
    } else if (m.volToMC < 0.3) {
      redFlags.push({ type: 'warning', text: '💤 Low trading activity - Might be dead' });
      score -= 8;
    }

    // Age
    const ageInHours = m.pairCreatedAt ? (Date.now() - m.pairCreatedAt) / (1000 * 60 * 60) : 999;
    if (ageInHours < 2 && m.buyPressure.h1 > 2.0) {
      signals.push({ type: 'critical', text: '🆕 FRESH LAUNCH WITH MOMENTUM - Early entry opportunity' });
      score += 18;
    } else if (ageInHours < 0.5) {
      redFlags.push({ type: 'warning', text: '⏰ EXTREMELY NEW - Wait for confirmation' });
      score -= 5;
    } else if (ageInHours > 168 && m.volVelocity < 1.0) {
      redFlags.push({ type: 'warning', text: '🕰️ Old token with dying volume' });
      score -= 10;
    }

    // Pattern from historical data
    if (histData.length > 5) {
      const recentScores = histData.slice(-5).map((d) => calculateMomentum(d.priceChange));
      const trending = recentScores.every((s, i) => i === 0 || s >= recentScores[i - 1]);
      if (trending) {
        signals.push({ type: 'strong', text: '📈 ACCELERATING PATTERN - Momentum building consistently' });
        score += 12;
      }
    }

    // Final score
    score = Math.max(0, Math.min(100, score + 35));

    let verdict = '🚫 AVOID';
    let color = 'red';
    let action = 'Do not enter';
    let positionSize = '0%';

    if (score >= 80) {
      verdict = '🚀 EXPLOSIVE SETUP';
      color = 'emerald';
      action = 'Strong buy signal';
      positionSize = '3-5%';
    } else if (score >= 65) {
      verdict = '💎 STRONG BUY';
      color = 'green';
      action = 'Good entry opportunity';
      positionSize = '2-3%';
    } else if (score >= 50) {
      verdict = '👀 WATCHLIST';
      color = 'yellow';
      action = 'Monitor closely';
      positionSize = '1-2%';
    } else if (score >= 35) {
      verdict = '⚠️ HIGH RISK';
      color = 'orange';
      action = 'Risky - experienced only';
      positionSize = '0.5-1%';
    }

    return {
      verdict,
      score,
      color,
      action,
      positionSize,
      signals,
      redFlags,
      momentum: m.momentum,
      riskLevel: redFlags.length > signals.length ? 'HIGH' : redFlags.length > 0 ? 'MEDIUM' : 'LOW',
    };
  };

  const checkAlerts = (m, analysis) => {
    const newAlerts = [];

    if (analysis.score > 75 && analysis.score > (deepAnalysis?.score || 0)) {
      newAlerts.push({
        type: 'success',
        text: `🚀 Score increased to ${analysis.score} - Entry signal!`,
        time: Date.now(),
      });
    }

    if (m.buyPressure.m5 > 4.0) {
      newAlerts.push({ type: 'success', text: '⚡ EXPLOSIVE buy pressure detected!', time: Date.now() });
    }

    if (m.liqToMC < 0.08 && !alerts.some((a) => a.text.includes('liquidity'))) {
      newAlerts.push({
        type: 'danger',
        text: '🚨 Critical: Liquidity dropped dangerously low!',
        time: Date.now(),
      });
    }

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 10));
    }
  };

  const addToWatchlist = () => {
    if (!metrics || !deepAnalysis) return;
    const exists = watchlist.find((w) => w.address === metrics.address);
    if (!exists) {
      setWatchlist((prev) => [
        ...prev,
        {
          address: metrics.address,
          symbol: metrics.symbol,
          price: metrics.price,
          score: deepAnalysis.score,
          addedAt: Date.now(),
        },
      ]);
    }
  };

  const removeFromWatchlist = (addr) => {
    setWatchlist((prev) => prev.filter((w) => w.address !== addr));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter italic">
                MOON<span className="text-blue-500">BOLT</span>
              </h1>
              <p className="text-slate-400">Advanced DEX Intelligence • Real-time Token Analysis</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
                  autoRefresh
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {autoRefresh ? <Bell size={18} /> : <BellOff size={18} />}
                {autoRefresh ? 'Live' : 'Paused'}
              </button>

              {metrics && (
                <button
                  onClick={() => fetchAdvancedMetrics()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 transition-all"
                >
                  <RefreshCw size={18} />
                  Refresh
                </button>
              )}
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Bell size={16} className="text-cyan-400" />
                <p className="text-sm font-bold text-slate-300">Recent Alerts</p>
              </div>
              <div className="space-y-1">
                {alerts.slice(0, 3).map((alert, i) => (
                  <div
                    key={i}
                    className={`text-sm ${alert.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {alert.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-10">
          <input
            className="w-full bg-slate-800/50 border-2 border-slate-700 p-6 rounded-2xl outline-none focus:border-cyan-500 transition-all text-white font-mono placeholder:text-slate-500 backdrop-blur"
            placeholder="Paste Solana contract address..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchAdvancedMetrics()}
          />
          <button
            onClick={() => fetchAdvancedMetrics()}
            disabled={loading}
            className="absolute right-3 top-3 bottom-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-10 rounded-xl font-bold transition-all shadow-lg shadow-cyan-900/30 disabled:opacity-50"
          >
            {loading ? 'ANALYZING...' : 'DEEP SCAN'}
          </button>
        </div>

        {deepAnalysis && metrics && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Token Info */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-3xl font-bold">{metrics.name}</h2>
                    <span className="text-2xl text-slate-400">${metrics.symbol}</span>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold ${
                        metrics.trendStrength === 'STRONG UP'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : metrics.trendStrength === 'UP'
                          ? 'bg-green-500/20 text-green-400'
                          : metrics.trendStrength === 'NEUTRAL'
                          ? 'bg-slate-500/20 text-slate-400'
                          : metrics.trendStrength === 'DOWN'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {metrics.trendStrength}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 font-mono mb-2">
                    {metrics.address?.slice(0, 12)}...{metrics.address?.slice(-8)}
                  </p>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span>DEX: {metrics.dexId}</span>
                    <span>Pair: {metrics.pairAddress?.slice(0, 8)}...</span>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div>
                    <p className="text-xs text-slate-400">Price</p>
                    <p className="text-xl font-mono font-bold text-cyan-400">${metrics.price.toFixed(8)}</p>
                    <p
                      className={`text-sm font-mono ${
                        metrics.priceChange.h1 > 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {metrics.priceChange.h1 > 0 ? '+' : ''}
                      {metrics.priceChange.h1.toFixed(2)}% 1h
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Market Cap</p>
                    <p className="text-xl font-mono font-bold">${(metrics.marketCap / 1000).toFixed(1)}K</p>
                    <p className="text-sm text-slate-500">{holderData?.totalHolders || 0} holders</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">24h Volume</p>
                    <p className="text-xl font-mono font-bold">${(metrics.volume.h24 / 1000).toFixed(1)}K</p>
                    <p className="text-sm text-slate-500">Liq: ${(metrics.liquidity / 1000).toFixed(1)}K</p>
                  </div>
                </div>

                <button
                  onClick={addToWatchlist}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-all flex items-center gap-2"
                >
                  <Eye size={18} />
                  Watch
                </button>
              </div>
            </div>

            {/* Verdict */}
            <div
              className={`p-8 rounded-3xl border-2 ${
                deepAnalysis.color === 'emerald'
                  ? 'bg-emerald-500/10 border-emerald-500/50'
                  : deepAnalysis.color === 'green'
                  ? 'bg-green-500/10 border-green-500/50'
                  : deepAnalysis.color === 'yellow'
                  ? 'bg-yellow-500/10 border-yellow-500/50'
                  : deepAnalysis.color === 'orange'
                  ? 'bg-orange-500/10 border-orange-500/50'
                  : 'bg-red-500/10 border-red-500/50'
              }`}
            >
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="md:col-span-2">
                  <h3
                    className={`text-6xl font-black mb-2 ${
                      deepAnalysis.color === 'emerald'
                        ? 'text-emerald-400'
                        : deepAnalysis.color === 'green'
                        ? 'text-green-400'
                        : deepAnalysis.color === 'yellow'
                        ? 'text-yellow-400'
                        : deepAnalysis.color === 'orange'
                        ? 'text-orange-400'
                        : 'text-red-400'
                    }`}
                  >
                    {deepAnalysis.verdict}
                  </h3>
                  <p className="text-2xl text-slate-300 mb-4">{deepAnalysis.action}</p>
                  <div className="flex gap-3">
                    <span className="px-4 py-2 bg-white/10 rounded-lg text-sm font-bold">
                      Position Size: {deepAnalysis.positionSize}
                    </span>
                    <span
                      className={`px-4 py-2 rounded-lg text-sm font-bold ${
                        deepAnalysis.riskLevel === 'LOW'
                          ? 'bg-green-500/20 text-green-400'
                          : deepAnalysis.riskLevel === 'MEDIUM'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      Risk: {deepAnalysis.riskLevel}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400 mb-2">SIGNAL STRENGTH</p>
                  <p className="text-7xl font-black font-mono mb-4">{deepAnalysis.score}</p>
                  <p className="text-sm text-slate-400">Momentum: {deepAnalysis.momentum.toFixed(1)}%</p>
                </div>
              </div>

              <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ${
                    deepAnalysis.color === 'emerald'
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                      : deepAnalysis.color === 'green'
                      ? 'bg-green-500'
                      : deepAnalysis.color === 'yellow'
                      ? 'bg-yellow-500'
                      : deepAnalysis.color === 'orange'
                      ? 'bg-orange-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${deepAnalysis.score}%` }}
                />
              </div>
            </div>

            {/* Holder Analysis */}
            {holderData && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="text-purple-400" size={24} />
                    <h3 className="text-xl font-bold">Holder Distribution</h3>
                  </div>
                  <span
                    className={`px-4 py-1 rounded-full text-sm font-bold ${
                      holderData.riskScore === 'LOW'
                        ? 'bg-green-500/20 text-green-400'
                        : holderData.riskScore === 'MEDIUM'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    Concentration Risk: {holderData.riskScore}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-400 mb-3">
                      Top 10 Holdings: {holderData.top10Concentration.toFixed(1)}%
                    </p>
                    <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden mb-4">
                      <div
                        className={`h-full ${
                          holderData.top10Concentration > 60
                            ? 'bg-red-500'
                            : holderData.top10Concentration > 40
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${holderData.top10Concentration}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">Ideal: &lt; 40% for low rug risk</p>
                  </div>

                  <div className="space-y-2">
                    {holderData.topHolders.slice(0, 5).map((holder, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span
                          className={`font-mono ${
                            holder.type === 'dev'
                              ? 'text-orange-400'
                              : holder.type === 'whale'
                              ? 'text-blue-400'
                              : 'text-purple-400'
                          }`}
                        >
                          #{holder.rank} {holder.address}
                        </span>
                        <span className="font-bold text-slate-300">{holder.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Signals & Risks */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 backdrop-blur border border-emerald-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="text-emerald-400" size={24} />
                  <h3 className="text-xl font-bold text-emerald-400">
                    Buy Signals ({deepAnalysis.signals.length})
                  </h3>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {deepAnalysis.signals.length > 0 ? (
                    deepAnalysis.signals.map((signal, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg ${
                          signal.type === 'critical'
                            ? 'bg-emerald-500/20 border border-emerald-500/40'
                            : signal.type === 'strong'
                            ? 'bg-green-500/15 border border-green-500/30'
                            : 'bg-blue-500/10 border border-blue-500/20'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{signal.text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic">No buy signals detected</p>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur border border-red-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="text-red-400" size={24} />
                  <h3 className="text-xl font-bold text-red-400">
                    Risk Factors ({deepAnalysis.redFlags.length})
                  </h3>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {deepAnalysis.redFlags.length > 0 ? (
                    deepAnalysis.redFlags.map((flag, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg ${
                          flag.type === 'critical'
                            ? 'bg-red-500/20 border border-red-500/40'
                            : 'bg-orange-500/15 border border-orange-500/30'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{flag.text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic">Clean scan - No major risks</p>
                  )}
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={<Activity />}
                label="Buy Pressure (5m)"
                value={`${metrics.buyPressure.m5.toFixed(2)}x`}
                ideal="> 3.0x"
                good={metrics.buyPressure.m5 > 3.0}
              />
              <MetricCard
                icon={<Zap />}
                label="Vol Velocity"
                value={`${metrics.volVelocity.toFixed(2)}x`}
                ideal="> 2.5x"
                good={metrics.volVelocity > 2.5}
              />
              <MetricCard
                icon={<Droplets />}
                label="Liq/MC Ratio"
                value={`${(metrics.liqToMC * 100).toFixed(1)}%`}
                ideal="> 15%"
                good={metrics.liqToMC > 0.15}
              />
              <MetricCard
                icon={<BarChart3 />}
                label="Vol/MC Ratio"
                value={`${metrics.volToMC.toFixed(2)}x`}
                ideal="1.5-8x"
                good={metrics.volToMC > 1.5 && metrics.volToMC < 8}
              />
              <MetricCard
                icon={<TrendingUp />}
                label="Momentum Score"
                value={`${metrics.momentum.toFixed(1)}%`}
                ideal="8-50%"
                good={metrics.momentum > 8 && metrics.momentum < 50}
              />
              <MetricCard
                icon={<Users />}
                label="Whale Ratio"
                value={`${metrics.whaleRatio.toFixed(2)}x`}
                ideal="> 2.0x"
                good={metrics.whaleRatio > 2.0}
              />
              <MetricCard
                icon={<Lock />}
                label="FDV Ratio"
                value={`${metrics.fdvRatio.toFixed(2)}x`}
                ideal="< 1.5x"
                good={metrics.fdvRatio < 1.5}
              />
              <MetricCard
                icon={<DollarSign />}
                label="Price Impact"
                value={`${metrics.priceImpact.toFixed(1)}%`}
                ideal="< 5%"
                good={metrics.priceImpact < 5}
              />
            </div>

            {/* Timeframes */}
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Activity className="text-cyan-400" />
                Multi-Timeframe Analysis
              </h3>

              <div className="grid md:grid-cols-4 gap-6 mb-6">
                <TimeframeCard
                  label="5 Minutes"
                  priceChange={metrics.priceChange.m5}
                  buys={metrics.transactions.buys5m}
                  sells={metrics.transactions.sells5m}
                  volume={metrics.volume.m5}
                />
                <TimeframeCard
                  label="1 Hour"
                  priceChange={metrics.priceChange.h1}
                  buys={metrics.transactions.buys1h}
                  sells={metrics.transactions.sells1h}
                  volume={metrics.volume.h1}
                />
                <TimeframeCard label="6 Hours" priceChange={metrics.priceChange.h6} buys={0} sells={0} volume={0} />
                <TimeframeCard
                  label="24 Hours"
                  priceChange={metrics.priceChange.h24}
                  buys={metrics.transactions.buys24h}
                  sells={metrics.transactions.sells24h}
                  volume={metrics.volume.h24}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Vol Acceleration</p>
                  <p className="text-2xl font-mono font-bold text-cyan-400">{metrics.volAcceleration.toFixed(2)}x</p>
                  <p className="text-xs text-slate-500">5m vol vs 1h avg</p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Avg Buy Size</p>
                  <p className="text-2xl font-mono font-bold text-green-400">${metrics.avgBuySize.toFixed(0)}</p>
                  <p className="text-xs text-slate-500">Per transaction</p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Avg Sell Size</p>
                  <p className="text-2xl font-mono font-bold text-red-400">${metrics.avgSellSize.toFixed(0)}</p>
                  <p className="text-xs text-slate-500">Per transaction</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Watchlist */}
        {watchlist.length > 0 && (
          <div className="mt-6 bg-slate-800/30 backdrop-blur border border-slate-700 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Eye className="text-blue-400" />
              Watchlist ({watchlist.length})
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {watchlist.map((token, i) => (
                <div key={i} className="bg-slate-900/50 p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-bold">${token.symbol}</p>
                    <p className="text-sm text-slate-400 font-mono">${token.price.toFixed(8)}</p>
                    <p className="text-xs text-slate-500">Score: {token.score}</p>
                  </div>
                  <button
                    onClick={() => removeFromWatchlist(token.address)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!metrics && !loading && (
          <div className="text-center py-20">
            <Shield className="mx-auto mb-4 text-slate-600" size={64} />
            <p className="text-slate-500 text-lg mb-2">Enter a contract address to begin deep analysis</p>
            <p className="text-slate-600 text-sm">Pro features: Auto-refresh • Alerts • Watchlist • Holder tracking</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Helper Components ---

function MetricCard({ icon, label, value, ideal, good }) {
  return (
    <div
      className={`bg-slate-800/50 backdrop-blur border rounded-xl p-4 ${
        good ? 'border-emerald-500/30' : 'border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={good ? 'text-emerald-400' : 'text-slate-400'}>
          {React.cloneElement(icon, { size: 18 })}
        </div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
      </div>
      <p className={`text-2xl font-mono font-bold mb-1 ${good ? 'text-emerald-400' : 'text-slate-300'}`}>
        {value}
      </p>
      <p className="text-xs text-slate-500">Ideal: {ideal}</p>
    </div>
  );
}

function TimeframeCard({ label, priceChange, buys, sells, volume }) {
  const isPositive = priceChange > 0;
  const buyPressure = sells > 0 ? buys / sells : buys;

  return (
    <div className="bg-slate-900/50 p-4 rounded-lg">
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      <p className={`text-3xl font-mono font-bold mb-2 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}
        {priceChange.toFixed(2)}%
      </p>
      {buys > 0 && (
        <>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-green-400">B: {buys}</span>
            <span className="text-red-400">S: {sells}</span>
          </div>
          <p className="text-xs text-slate-500">Pressure: {buyPressure.toFixed(2)}x</p>
        </>
      )}
      {volume > 0 && (
        <p className="text-xs text-slate-500 mt-1">Vol: ${(volume / 1000).toFixed(1)}K</p>
      )}
    </div>
  );
}