export interface TokenMetrics {
  price: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  fdvRatio: number;      // Original
  volMcRatio: number;    // Original
  buyPressure: number;   // New: Technical (Buys vs Sells)
  volVelocity: number;   // New: Technical (Is volume spiking now?)
  priceChangeH1: number; // New: Trend Direction
}

