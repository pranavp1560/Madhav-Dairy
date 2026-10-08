import { supabase } from '../lib/supabase';
import { RawMaterial, RawMaterialMovement, RawMaterialMovementType } from '../types/dairy';
import { getEffectiveOrgId } from './orgService';

export const rawMaterialService = {
  async fetchRawMaterials(): Promise<RawMaterial[]> {
    const { data: rms, error } = await supabase
      .from('raw_materials')
      .select(`
        id,
        name,
        name_mr,
        name_hi,
        unit,
        min_stock_threshold,
        cost_per_unit,
        raw_material_categories(name),
        suppliers(name)
      `)
      .order('name');

    if (error) throw error;

    // Fetch live calculated stock from view_raw_material_stock
    const { data: stockSummary } = await supabase
      .from('view_raw_material_stock')
      .select('raw_material_id, current_stock');

    const stockMap: Record<string, number> = {};
    if (stockSummary) {
      stockSummary.forEach((s: any) => {
        stockMap[s.raw_material_id] = Number(s.current_stock || 0);
      });
    }

    return (rms || []).map((r: any): RawMaterial => {
      const stock = stockMap[r.id] !== undefined ? stockMap[r.id] : 0;
      const minThresh = Number(r.min_stock_threshold || 0);

      let status: 'healthy' | 'low_stock' | 'out_of_stock' = 'healthy';
      if (stock <= 0) status = 'out_of_stock';
      else if (stock < minThresh) status = 'low_stock';

      return {
        id: r.id,
        name: r.name,
        nameMr: r.name_mr,
        nameHi: r.name_hi,
        category: (r as any).raw_material_categories?.name || 'Dairy Inward',
        unit: r.unit,
        currentStock: stock,
        minStockThreshold: minThresh,
        costPerUnit: Number(r.cost_per_unit || 0),
        supplier: (r as any).suppliers?.name || 'Local Farmer Society',
        status,
        lastRestockedDate: new Date().toISOString().split('T')[0],
      };
    });
  },

  async fetchRawMaterialMovements(): Promise<RawMaterialMovement[]> {
    const { data: txs, error } = await supabase
      .from('raw_material_transactions')
      .select(`
        id,
        material_id:raw_material_id,
        transaction_type,
        quantity,
        reference_type,
        notes,
        created_at,
        raw_materials(name, unit)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (txs || []).map((t: any): RawMaterialMovement => {
      const d = new Date(t.created_at);
      return {
        id: t.id,
        date: d.toISOString().split('T')[0],
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        materialId: t.material_id,
        materialName: (t as any).raw_materials?.name || 'Raw Material',
        type: (t.transaction_type || 'purchase') as RawMaterialMovementType,
        quantity: Number(t.quantity),
        unit: (t as any).raw_materials?.unit || 'Litres',
        reference: t.reference_type || 'PO-DIRECT',
        user: 'Procurement Officer',
        notes: t.notes || undefined,
      };
    });
  },

  async addRawMaterialStock(materialId: string, qty: number, reference: string, notes?: string) {
    const orgId = await getEffectiveOrgId();
    const { data: loc } = await supabase
      .from('locations')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)
      .maybeSingle();

    const locId = loc?.id;
    if (!locId) throw new Error('No storage location found for organization');

    const { error } = await supabase.from('raw_material_transactions').insert({
      organization_id: orgId,
      location_id: locId,
      raw_material_id: materialId,
      transaction_type: 'purchase',
      quantity: qty,
      reference_type: reference,
      notes: notes || 'Raw material inward restock',
    });

    if (error) throw error;
  },

  async recordRawMaterialUsage(materialId: string, qty: number, reference?: string, notes?: string): Promise<boolean> {
    const orgId = await getEffectiveOrgId();
    const { data: loc } = await supabase
      .from('locations')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)
      .maybeSingle();

    const locId = loc?.id;
    if (!locId) throw new Error('No storage location found for organization');

    const { error } = await supabase.from('raw_material_transactions').insert({
      organization_id: orgId,
      location_id: locId,
      raw_material_id: materialId,
      transaction_type: 'production_consumption',
      quantity: -Math.abs(qty),
      reference_type: reference || 'production_run',
      notes: notes || 'Consumed in batch processing',
    });

    if (error) throw error;
    return true;
  },
};
