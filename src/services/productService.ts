import { supabase } from '../lib/supabase';
import { Product, ProductCategory, ProductSku } from '../types/dairy';

export const productService = {
  async fetchProducts(): Promise<Product[]> {
    const { data: prods, error: pErr } = await supabase
      .from('products')
      .select(`
        id,
        name,
        name_mr,
        name_hi,
        description,
        base_unit,
        default_price,
        shelf_life_days,
        min_stock_threshold,
        image_url,
        is_available,
        product_categories(name),
        product_skus(id, sku_code, pack_size, unit, mrp, selling_price, is_default)
      `)
      .order('name');

    if (pErr) throw pErr;

    return (prods || []).map((p: any): Product => {
      const skus: ProductSku[] = (p.product_skus || []).map((s: any) => ({
        id: s.id,
        skuCode: s.sku_code,
        packSize: s.pack_size,
        mrp: Number(s.mrp),
        sellingPrice: Number(s.selling_price),
        isDefault: s.is_default,
      }));

      const defaultSku = skus.find(s => s.isDefault) || skus[0];

      return {
        id: p.id,
        name: p.name,
        nameMr: p.name_mr,
        nameHi: p.name_hi,
        category: (p.product_categories?.name || 'Fresh Milk & Curd') as ProductCategory,
        unit: defaultSku?.packSize ? `${defaultSku.packSize} ${p.base_unit || 'pack'}` : (p.base_unit || 'unit'),
        mrp: defaultSku?.mrp || Number(p.default_price),
        defaultPrice: defaultSku?.sellingPrice || Number(p.default_price),
        shelfLifeDays: p.shelf_life_days,
        description: p.description || '',
        isAvailable: p.is_available,
        minStockThreshold: p.min_stock_threshold,
        imageUrl: p.image_url,
        skus,
      };
    });
  },

  async fetchCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('product_categories')
      .select('name')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return (data || []).map(c => c.name);
  },

  async updateProductAvailability(id: string, isAvailable: boolean) {
    const { error } = await supabase
      .from('products')
      .update({ is_available: isAvailable })
      .eq('id', id);

    if (error) throw error;
  },

  async updateProductPrice(id: string, defaultPrice: number, mrp?: number) {
    const { error } = await supabase
      .from('products')
      .update({ default_price: defaultPrice })
      .eq('id', id);

    if (error) throw error;

    if (mrp !== undefined) {
      await supabase
        .from('product_skus')
        .update({ mrp, selling_price: defaultPrice })
        .eq('product_id', id)
        .eq('is_default', true);
    }
  }
};
