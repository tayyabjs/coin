'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Search, Flame, RefreshCw } from 'lucide-react';

// =============== TECHNICAL INDICATORS ===============
const calculateRSI = (prices: number[], period = 14): number => {
  if (prices.length < period) return 50;
  const gains = [], losses = [];
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
};

const calculateMACD = (prices: number[], fast = 12, slow = 26, signal = 9) => {
  const ema = (values: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const result = [values[0]];
    for (let i = 1; i < values.length; i++) {
      result.push(values[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  };
  const fastEMA = ema(prices, fast);
  const slowEMA = ema(prices, slow);
  const macdLine = fastEMA.map((f, i) => f - slowEMA[i]);
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((m, i) => m - signalLine[i]);
  return { macd: macdLine.at(-1)!, signal: signalLine.at(-1)!, histogram: histogram.at(-1)! };
};

const calculateStochastic = (highs: number[], lows: number[], closes: number[], kPeriod = 14, dPeriod = 3) => {
  if (closes.length < kPeriod) return { k: 50, d: 50 };
  const recentHigh = Math.max(...highs.slice(-kPeriod));
  const recentLow = Math.min(...lows.slice(-kPeriod));
  const k = recentHigh === recentLow ? 50 : ((closes.at(-1)! - recentLow) / (recentHigh - recentLow)) * 100;
  return { k, d: k }; // Simplified D
};

const calculateEMA = (prices: number[], period: number): number => {
  if (prices.length < period) return prices.at(-1)!;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
};

// =============== ANALYSIS ENGINE ===============
interface AnalysisResult {
  signal: 'LONG' | 'SHORT' | 'HOLD';
  strength: number;
  isValid: boolean;
  entryRange: { min: number; max: number };
  sl: number;
  tp: number[];
  indicators: {
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    stoch: { k: number; d: number };
    ema20: number;
    ema50: number;
  };
  wave: string;
}

const analyzeCryptoData = (ohlcv: [number, number, number, number, number][], currentPrice: number): AnalysisResult => {
  const closes = ohlcv.map(d => d[4]);
  const highs = ohlcv.map(d => d[2]);
  const lows = ohlcv.map(d => d[3]);

  // Calculate indicators
  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const stoch = calculateStochastic(highs, lows, closes);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);

  // Elliott Wave simulation
  const shortTrend = closes.slice(-10);
  const longTrend = closes.slice(-30);
  const shortSlope = (shortTrend.at(-1)! - shortTrend[0]) / shortTrend[0];
  const longSlope = (longTrend.at(-1)! - longTrend[0]) / longTrend[0];
  
  let wave = 'UNCLEAR';
  if (shortSlope > 0.05 && longSlope > 0.1) wave = 'IMPULSE_UP';
  else if (shortSlope < -0.05 && longSlope < -0.1) wave = 'IMPULSE_DOWN';
  else if (shortSlope > 0 && longSlope > 0) wave = 'WAVE_3_UP';
  else if (shortSlope < 0 && longSlope < 0) wave = 'WAVE_C_DOWN';

  // Fibonacci levels
  const fibHigh = Math.max(...closes.slice(-30));
  const fibLow = Math.min(...closes.slice(-30));
  const range = fibHigh - fibLow;
  const fibLevels = {
    r1: fibLow + range * 0.236,
    r2: fibLow + range * 0.382,
    r3: fibLow + range * 0.618,
    s1: fibHigh - range * 0.236,
    s2: fibHigh - range * 0.382,
    s3: fibHigh - range * 0.618,
  };

  // Signal conditions
  const buyConditions = [
    rsi < 45, // Oversold
    macd.histogram > 0 && macd.macd > macd.signal, // Bullish MACD
    stoch.k < 25 && stoch.k > stoch.d, // Stochastic oversold
    currentPrice > ema20 && ema20 > ema50, // Price above EMAs
    ['IMPULSE_UP', 'WAVE_3_UP'].includes(wave), // Bullish wave
    currentPrice < fibLevels.r2, // Below resistance
  ];
  const buyScore = buyConditions.filter(Boolean).length;

  const sellConditions = [
    rsi > 55, // Overbought
    macd.histogram < 0 && macd.macd < macd.signal, // Bearish MACD
    stoch.k > 75 && stoch.k < stoch.d, // Stochastic overbought
    currentPrice < ema20 && ema20 < ema50, // Price below EMAs
    ['IMPULSE_DOWN', 'WAVE_C_DOWN'].includes(wave), // Bearish wave
    currentPrice > fibLevels.s2, // Above support
  ];
  const sellScore = sellConditions.filter(Boolean).length;

  let signal: 'LONG' | 'SHORT' | 'HOLD' = 'HOLD';
  let strength = 0;
  let isValid = false;
  let entryMin = currentPrice * 0.995;
  let entryMax = currentPrice * 1.005;
  let sl = currentPrice * 0.95;
  let tp = [currentPrice * 1.03, currentPrice * 1.06, currentPrice * 1.10];

  if (buyScore >= 3) {
    signal = 'LONG';
    strength = Math.min(100, buyScore * 25);
    isValid = true;
    entryMin = Math.max(fibLevels.s2, currentPrice * 0.98);
    entryMax = fibLevels.r1;
    sl = fibLevels.s3;
    tp = [fibLevels.r1, fibLevels.r2, fibLevels.r3];
  } else if (sellScore >= 3) {
    signal = 'SHORT';
    strength = Math.min(100, sellScore * 25);
    isValid = true;
    entryMin = fibLevels.s1;
    entryMax = Math.min(fibLevels.r2, currentPrice * 1.02);
    sl = fibLevels.r3;
    tp = [fibLevels.s1, fibLevels.s2, fibLevels.s3].reverse();
  }

  return {
    signal,
    strength,
    isValid,
    entryRange: { min: entryMin, max: entryMax },
    sl,
    tp,
    indicators: { rsi, macd, stoch, ema20, ema50 },
    wave,
  };
};

// =============== MAIN COMPONENT ===============
export default function CryptoAnalyzer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [cryptoData, setCryptoData] = useState<{
    id: string;
    name: string;
    symbol: string;
    price: number;
    analysis: AnalysisResult;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [topCryptos, setTopCryptos] = useState<Array<{
    id: string;
    name: string;
    symbol: string;
    price: number;
    score: number;
    signal: 'LONG' | 'SHORT' | 'HOLD';
  }>>([]);
  const [loadingTop, setLoadingTop] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'top10'>('search');

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();
        setResults(data.coins?.slice(0, 8) || []);
      } catch (err) {
        console.error('Search failed:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const analyzeSingleCrypto = async (coinId: string) => {
    setLoading(true);
    try {
      const ohlcvRes = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=30`
      );
      if (!ohlcvRes.ok) throw new Error('Failed to fetch price data');
      const ohlcv: [number, number, number, number, number][] = await ohlcvRes.json();
      
      if (ohlcv.length < 50) throw new Error('Insufficient price history');

      const coinDataRes = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
      );
      const coinData = await coinDataRes.json();

      const currentPrice = ohlcv.at(-1)![4];
      const analysis = analyzeCryptoData(ohlcv, currentPrice);

      setCryptoData({
        id: coinId,
        name: coinData.name,
        symbol: coinData.symbol.toUpperCase(),
        price: currentPrice,
        analysis,
      });
    } catch (err) {
      console.error('Analysis error:', err);
      alert('Failed to analyze crypto. Try another asset.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTopCryptos = async () => {
    setLoadingTop(true);
    try {
      // Get top 100 coins by market cap
      const marketsRes = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false'
      );
      const markets: any[] = await marketsRes.json();

      const scoredPromises = markets.slice(0, 50).map(async (coin) => {
        try {
          const ohlcvRes = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coin.id}/ohlc?vs_currency=usd&days=30`
          );
          if (!ohlcvRes.ok) return null;
          const ohlcv: [number, number, number, number, number][] = await ohlcvRes.json();
          
          if (ohlcv.length < 50) return null;
          
          const currentPrice = ohlcv.at(-1)![4];
          const analysis = analyzeCryptoData(ohlcv, currentPrice);
          
          // Only include valid LONG opportunities
          if (analysis.signal === 'LONG' && analysis.isValid && analysis.strength >= 60) {
            return {
              id: coin.id,
              name: coin.name,
              symbol: coin.symbol.toUpperCase(),
              price: currentPrice,
              score: analysis.strength,
              signal: analysis.signal,
            };
          }
          return null;
        } catch {
          return null;
        }
      });

      const results = (await Promise.all(scoredPromises)).filter(Boolean) as any[];
      const top10 = results
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      setTopCryptos(top10);
    } catch (err) {
      console.error('Top cryptos error:', err);
      alert('Failed to load top opportunities');
    } finally {
      setLoadingTop(false);
    }
  };

  useEffect(() => {
    fetchTopCryptos();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2 text-cyan-400">
          📈 Advanced Crypto Signal Generator
        </h1>
        <p className="text-gray-400 text-center mb-6">
          Real-time analysis with RSI, MACD, Stochastic, EMA, Elliott Wave & Fibonacci
        </p>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
              activeTab === 'search'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Search className="inline w-4 h-4 mr-2" />
            Search Crypto
          </button>
          <button
            onClick={() => setActiveTab('top10')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
              activeTab === 'top10'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Flame className="inline w-4 h-4 mr-2" />
            Top 10 Explosive Setups
          </button>
        </div>

        {/* Search Tab */}
        {activeTab === 'search' && (
          <>
            <div className="relative mb-8">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cryptocurrency (e.g., Bitcoin, Solana)..."
                className="w-full py-3 pl-10 pr-4 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              {results.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {results.map((coin) => (
                    <div
                      key={coin.id}
                      onClick={() => {
                        analyzeSingleCrypto(coin.id);
                        setSearchQuery(`${coin.name} (${coin.symbol})`);
                      }}
                      className="p-3 hover:bg-gray-700 cursor-pointer flex items-center gap-3"
                    >
                      <img src={coin.thumb} alt={coin.name} className="w-6 h-6" />
                      <div>
                        <div className="font-medium">{coin.name}</div>
                        <div className="text-sm text-gray-400">{coin.symbol.toUpperCase()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-10">
                <RefreshCw className="animate-spin mx-auto w-8 h-8 text-cyan-500" />
                <p className="mt-3">Analyzing market signals...</p>
              </div>
            ) : cryptoData ? (
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{cryptoData.name} ({cryptoData.symbol})</h2>
                    <p className="text-3xl font-mono mt-1">
                      ${cryptoData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      cryptoData.analysis.signal === 'LONG' ? 'text-green-400' : 
                      cryptoData.analysis.signal === 'SHORT' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {cryptoData.analysis.signal}
                    </div>
                    <div className="text-sm text-gray-400">Strength: {cryptoData.analysis.strength}/100</div>
                    <div className={`text-xs mt-1 ${
                      cryptoData.analysis.isValid ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {cryptoData.analysis.isValid ? '✅ VALID SETUP' : '❌ INVALID'}
                    </div>
                  </div>
                </div>

                {/* Entry Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-900/50 p-4 rounded-lg">
                    <div className="text-gray-400 text-sm">ENTRY RANGE</div>
                    <div className="font-mono">
                      ${cryptoData.analysis.entryRange.min.toFixed(6)} – ${cryptoData.analysis.entryRange.max.toFixed(6)}
                    </div>
                  </div>
                  <div className="bg-gray-900/50 p-4 rounded-lg">
                    <div className="text-gray-400 text-sm">STOP LOSS</div>
                    <div className="font-mono text-red-400">
                      ${cryptoData.analysis.sl.toFixed(6)} ({(((cryptoData.analysis.sl - cryptoData.price) / cryptoData.price) * 100).toFixed(1)}%)
                    </div>
                  </div>
                </div>

                {/* Take Profit */}
                <div className="mb-6">
                  <div className="text-gray-400 text-sm mb-2">TAKE PROFIT LEVELS</div>
                  <div className="flex gap-3">
                    {cryptoData.analysis.tp.map((level, i) => (
                      <div key={i} className="bg-gray-900/50 px-3 py-2 rounded text-center flex-1">
                        <div className="text-xs text-gray-400">TP{i+1}</div>
                        <div className="font-mono">${level.toFixed(6)}</div>
                        <div className="text-xs text-green-400">
                          +{(((level - cryptoData.price) / cryptoData.price) * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Indicators */}
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="font-semibold mb-3">Technical Indicators</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div className="bg-gray-900/30 p-2 rounded">
                      <div className="text-gray-400">RSI</div>
                      <div className={cryptoData.analysis.indicators.rsi < 30 ? 'text-green-400' : cryptoData.analysis.indicators.rsi > 70 ? 'text-red-400' : 'text-white'}>
                        {cryptoData.analysis.indicators.rsi.toFixed(1)}
                      </div>
                    </div>
                    <div className="bg-gray-900/30 p-2 rounded">
                      <div className="text-gray-400">MACD</div>
                      <div className={cryptoData.analysis.indicators.macd.histogram > 0 ? 'text-green-400' : 'text-red-400'}>
                        {cryptoData.analysis.indicators.macd.histogram > 0 ? 'BULLISH' : 'BEARISH'}
                      </div>
                    </div>
                    <div className="bg-gray-900/30 p-2 rounded">
                      <div className="text-gray-400">Stoch K</div>
                      <div className={cryptoData.analysis.indicators.stoch.k < 20 ? 'text-green-400' : cryptoData.analysis.indicators.stoch.k > 80 ? 'text-red-400' : 'text-white'}>
                        {cryptoData.analysis.indicators.stoch.k.toFixed(1)}
                      </div>
                    </div>
                    <div className="bg-gray-900/30 p-2 rounded">
                      <div className="text-gray-400">EMA 20</div>
                      <div className={cryptoData.price > cryptoData.analysis.indicators.ema20 ? 'text-green-400' : 'text-red-400'}>
                        {cryptoData.price > cryptoData.analysis.indicators.ema20 ? 'ABOVE' : 'BELOW'}
                      </div>
                    </div>
                    <div className="bg-gray-900/30 p-2 rounded">
                      <div className="text-gray-400">Wave</div>
                      <div className="text-white">{cryptoData.analysis.wave}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Enter a cryptocurrency name above to generate trading signals
              </div>
            )}
          </>
        )}

        {/* Top 10 Tab */}
        {activeTab === 'top10' && (
          <div>
            {loadingTop ? (
              <div className="text-center py-10">
                <RefreshCw className="animate-spin mx-auto w-8 h-8 text-orange-500" />
                <p className="mt-3">Finding explosive opportunities...</p>
              </div>
            ) : topCryptos.length > 0 ? (
              <div className="space-y-4">
                {topCryptos.map((crypto) => (
                  <div
                    key={crypto.id}
                    onClick={() => analyzeSingleCrypto(crypto.id)}
                    className="bg-gray-800/50 hover:bg-gray-700/50 p-4 rounded-xl cursor-pointer transition border-l-4 border-green-500"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold">{crypto.name} ({crypto.symbol})</div>
                        <div className="text-sm text-gray-400">Signal Strength: {crypto.score}/100</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono">${crypto.price.toFixed(6)}</div>
                        <div className="text-xs text-green-400 mt-1">✅ VALID LONG</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No high-conviction setups found right now. Check back later!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}