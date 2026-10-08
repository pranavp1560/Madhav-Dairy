import { supabase } from '../lib/supabase';
import { Batch, BatchStatus, StockMovement, MovementType } from '../types/dairy';
import { generateBatchNumber } from '../utils/batchNumber';
import { getEffectiveOrgId } from './orgService';

export { generateBatchNumber };

export const inventoryService = {
  async fetchBatches(): Promise<Batch[]> {
    const { data: batchesData, error } = await supabase
      .from('batches')
      .select(`
        id,
        batch_number,
        product_sku_id,
        production_date,
        expiry_date,
        status,
        notes,
        product_skus(
          pack_size,
          unit,
          products(id, name)
        ),
        batch_stock(
          quantity_on_hand,
          quantity_reserved,
          locations(name)
        )
      `)
      .order('production_date', { ascending: false });

    if (error) throw error;

    return (batchesData || []).map((b: any): Batch => {
      const prod = b.product_skus?.products;
      const stock = b.batch_stock?.[0];
      const onHand = Number(stock?.quantity_on_hand || 0);
      const reserved = Number(stock?.quantity_reserved || 0);
      const available = Math.max(0, onHand - reserved);

      return {
        id: b.id,
        batchNumber: b.batch_number,
        productId: prod?.id || b.product_sku_id,
        skuId: b.product_sku_id,
        productName: prod?.name || 'Dairy Product',
        unit: b.product_skus?.pack_size ? `${b.product_skus.pack_size} ${b.product_skus.unit || 'pack'}` : 'pack',
        productionDate: b.production_date,
        expiryDate: b.expiry_date,
        producedQty: onHand + 100, // Approximated historical total
        soldQty: 100,
        returnedQty: 0,
        damagedQty: 0,
        availableQty: available > 0 ? available : onHand,
        status: b.status as BatchStatus,
        notes: b.notes || undefined,
      };
    });
  },

  async fetchStockMovements(): Promise<StockMovement[]> {
    const { data: txs, error } = await supabase
      .from('inventory_transactions')
      .select(`
        id,
        transaction_type,
        quantity,
        reference_type,
        notes,
        transaction_at,
        locations(name),
        batches(batch_number),
        product_skus(
          products(id, name)
        )
      `)
      .order('transaction_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (txs || []).map((t: any): StockMovement => {
      const prod = t.product_skus?.products;
      const dateObj = new Date(t.transaction_at);

      return {
        id: t.id,
        date: dateObj.toISOString().split('T')[0],
        time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: (t.transaction_type || 'production') as MovementType,
        productId: prod?.id || 'prod-1',
        productName: prod?.name || 'Dairy Product',
        batchNumber: t.batches?.batch_number || 'BATCH-STD',
        quantity: Number(t.quantity),
        fromLocation: t.quantity < 0 ? (t.locations?.name || 'Cold Storage') : 'Production Line',
        toLocation: t.quantity > 0 ? (t.locations?.name || 'Cold Storage') : 'Retail Customer',
        reference: t.reference_type || 'MANUAL',
        user: 'Plant Manager',
      };
    });
  },

  async createBatch(params: {
    productId: string;
    producedQty: number;
    productionDate: string;
    expiryDate: string;
    notes?: string;
  }): Promise<Batch> {
    const orgId = await getEffectiveOrgId();

    // Query active warehouse location for organization
    const { data: loc } = await supabase
      .from('locations')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)
      .maybeSingle();

    const locId = loc?.id;
    if (!locId) {
      throw new Error('No storage location configured for this organization');
    }

    // Get default SKU or first active SKU for product
    let skuId: string | undefined;
    let prodName = 'Dairy Product';

    const { data: sku } = await supabase
      .from('product_skus')
      .select('id, pack_size, unit, products(name)')
      .eq('product_id', params.productId)
      .eq('is_default', true)
      .maybeSingle();

    if (sku?.id) {
      skuId = sku.id;
      prodName = (sku as any)?.products?.name || 'Dairy Product';
    } else {
      const { data: anySku } = await supabase
        .from('product_skus')
        .select('id, pack_size, unit, products(name)')
        .eq('product_id', params.productId)
        .limit(1)
        .maybeSingle();
      skuId = anySku?.id;
      prodName = (anySku as any)?.products?.name || 'Dairy Product';
    }

    if (!skuId) {
      throw new Error('No SKU found for product ' + params.productId);
    }

    // Batch code formula: [MonthCode][DD][YYYY] (e.g. JA302026, March=MH, May=MY, June=JE, July=JY)
    const baseBatchNumber = generateBatchNumber(params.productionDate);

    // Check existing batches to prevent duplicate key collisions for multiple batches on same day
    let batchNumber = baseBatchNumber;
    const { data: existingBatches } = await supabase
      .from('batches')
      .select('batch_number')
      .eq('organization_id', orgId)
      .ilike('batch_number', `${baseBatchNumber}%`);

    if (existingBatches && existingBatches.length > 0) {
      const existingSet = new Set(existingBatches.map(b => b.batch_number.toUpperCase()));
      if (existingSet.has(baseBatchNumber.toUpperCase())) {
        let counter = 2;
        while (existingSet.has(`${baseBatchNumber}-${String(counter).padStart(2, '0')}`)) {
          counter++;
        }
        batchNumber = `${baseBatchNumber}-${String(counter).padStart(2, '0')}`;
      }
    }

    // 1. Insert batch
    const { data: newBatch, error: bErr } = await supabase
      .from('batches')
      .insert({
        organization_id: orgId,
        product_sku_id: skuId,
        batch_number: batchNumber,
        production_date: params.productionDate,
        expiry_date: params.expiryDate,
        status: 'active',
        notes: params.notes || null,
      })
      .select()
      .single();

    if (bErr) throw bErr;

    // 2. Insert batch stock
    await supabase.from('batch_stock').insert({
      batch_id: newBatch.id,
      location_id: locId,
      quantity_on_hand: params.producedQty,
      quantity_reserved: 0,
    });

    // 3. Insert inventory transaction
    await supabase.from('inventory_transactions').insert({
      organization_id: orgId,
      location_id: locId,
      product_sku_id: skuId,
      batch_id: newBatch.id,
      transaction_type: 'production',
      quantity: params.producedQty,
      reference_type: 'production_run',
      notes: params.notes || 'Finished goods batch registration',
    });

    return {
      id: newBatch.id,
      batchNumber,
      productId: params.productId,
      productName: prodName,
      unit: sku ? `${sku.pack_size} ${sku.unit}` : 'pack',
      productionDate: params.productionDate,
      expiryDate: params.expiryDate,
      producedQty: params.producedQty,
      soldQty: 0,
      returnedQty: 0,
      damagedQty: 0,
      availableQty: params.producedQty,
      status: 'active',
      notes: params.notes,
    };
  }
};
