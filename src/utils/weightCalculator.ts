/**
 * Utility for converting bulk weights (KG/Grams) to SKU pack sizes (pouches/units)
 * and vice-versa for dairy products (Milk, Paneer, Dahi, Ghee, Shrikhand, etc.)
 */

export interface SkuWeightInfo {
  packSize?: string;
  variantName?: string;
  quantity?: number;
  unit?: string;
}

/**
 * Extracts the single unit weight in Kilograms (KG) from an SKU definition.
 * Examples:
 * - 500 gm / 500 ml -> 0.5 KG
 * - 250 gm / 250 g  -> 0.25 KG
 * - 1 kg / 1 Litre  -> 1.0 KG
 * - 5 kg            -> 5.0 KG
 */
export function getSkuWeightInKg(sku?: SkuWeightInfo | null): number {
  if (!sku) return 1;

  // 1. Direct unit checking if quantity and unit are given
  if (sku.quantity && sku.quantity > 0 && sku.unit) {
    const u = sku.unit.toLowerCase().trim();
    if (u === 'gm' || u === 'g' || u === 'grams' || u === 'gram' || u === 'ml') {
      return sku.quantity / 1000;
    }
    if (u === 'kg' || u === 'kilo' || u === 'l' || u === 'ltr' || u === 'litre' || u === 'liter') {
      return sku.quantity;
    }
  }

  // 2. Parse text from variantName or packSize
  const text = `${sku.variantName || ''} ${sku.packSize || ''}`.toLowerCase();

  // Match grams / ml: e.g. "500gm", "500 g", "250 ml", "200 g"
  const gmMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:gm|g|grams|gram|ml)\b/);
  if (gmMatch) {
    const val = parseFloat(gmMatch[1]);
    if (!isNaN(val) && val > 0) {
      return val / 1000;
    }
  }

  // Match kg / litre: e.g. "1kg", "1 kg", "5 kg", "1 l", "1 litre"
  const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|litre|liter|ltr|l)\b/);
  if (kgMatch) {
    const val = parseFloat(kgMatch[1]);
    if (!isNaN(val) && val > 0) {
      return val;
    }
  }

  return 1; // Default fallback to 1 unit
}

/**
 * Calculates number of pouches/packs required for a given total KG target.
 * E.g., 10 KG with 500 GM pouch -> 20 pouches
 */
export function calculatePouchesFromKg(totalKg: number, skuWeightInKg: number): number {
  if (!totalKg || totalKg <= 0 || !skuWeightInKg || skuWeightInKg <= 0) return 0;
  return Math.round(totalKg / skuWeightInKg);
}

/**
 * Calculates total weight in KG from number of pouches.
 * E.g., 20 pouches of 500 GM (0.5 KG) -> 10.0 KG
 */
export function calculateKgFromPouches(pouches: number, skuWeightInKg: number): number {
  if (!pouches || pouches <= 0 || !skuWeightInKg || skuWeightInKg <= 0) return 0;
  return Number((pouches * skuWeightInKg).toFixed(2));
}

/**
 * Formats pack size clearly, e.g. "500 GM", "1 KG", "250 GM"
 */
export function formatSkuPackLabel(sku?: SkuWeightInfo | null): string {
  if (!sku) return 'Pack';
  const weightKg = getSkuWeightInKg(sku);
  if (weightKg < 1) {
    return `${Math.round(weightKg * 1000)} GM`;
  }
  return `${weightKg % 1 === 0 ? weightKg.toFixed(0) : weightKg.toFixed(2)} KG`;
}
