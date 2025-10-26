// Shared constants for MereMiners - used by both frontend and backend

// Economic constants
export const MERE_TO_USD_RATE = 0.5; // 1 MERE = $0.50 USD
export const TH_BASE_PRICE_MERE = 27.98; // Base price per 1 TH/s in MERE
export const TH_DAILY_YIELD_MERE = 0.16; // Daily yield per 1 TH/s in MERE
export const DEFAULT_SLOTS = 6; // Default number of mining slots
export const SLOT_EXPANSION_PRICE_MERE = 50; // Cost to unlock one additional slot
export const REFERRAL_BONUS_PERCENT = 10; // Referrer earns 10% of referee's mining earnings

// Formatting helpers
export function formatMERE(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${num.toFixed(2)} MERE`;
}

export function formatUSD(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `$${num.toFixed(2)}`;
}

// Conversion helpers
export function mereToUSD(mere: number | string): number {
  const num = typeof mere === "string" ? parseFloat(mere) : mere;
  return num * MERE_TO_USD_RATE;
}

export function usdToMERE(usd: number | string): number {
  const num = typeof usd === "string" ? parseFloat(usd) : usd;
  return num / MERE_TO_USD_RATE;
}

// Bulk discount calculation
// Formula: Discount = min(20%, 5% × log₁₀(TH + 1))
export function calculateDiscountedPrice(totalTH: number): {
  originalPrice: number;
  discount: number;
  discountPercent: number;
  finalPrice: number;
} {
  const originalPrice = totalTH * TH_BASE_PRICE_MERE;
  const discountPercent = Math.min(20, 5 * Math.log10(totalTH + 1));
  const discount = originalPrice * (discountPercent / 100);
  const finalPrice = originalPrice - discount;

  return {
    originalPrice,
    discount,
    discountPercent,
    finalPrice,
  };
}
