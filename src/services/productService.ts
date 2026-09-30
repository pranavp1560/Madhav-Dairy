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
  },

  async createProduct(data: {
    name: string;
    nameMr?: string;
    nameHi?: string;
    categoryName?: string;
    categoryId?: string;
    packSize: string;
    unit: string;
    mrp: number;
    sellingPrice: number;
    shelfLifeDays: number;
    description?: string;
    minStockThreshold?: number;
  }): Promise<Product> {
    const orgId = '00000000-0000-0000-0000-000000000001';

    let categoryId = data.categoryId;
    if (!categoryId) {
      const { data: cat } = await supabase
        .from('product_categories')
        .select('id')
        .eq('name', data.categoryName || 'Fresh Milk & Curd')
        .maybeSingle();
      categoryId = cat?.id || '30000000-0000-0000-0000-000000000002';
    }

    const { data: newProd, error: pErr } = await supabase
      .from('products')
      .insert({
        organization_id: orgId,
        category_id: categoryId,
        name: data.name,
        name_mr: data.nameMr || null,
        name_hi: data.nameHi || null,
        description: data.description || '',
        base_unit: data.unit || 'pack',
        default_price: data.sellingPrice,
        shelf_life_days: data.shelfLifeDays || 10,
        min_stock_threshold: data.minStockThreshold || 50,
        is_available: true,
        is_active: true,
      })
      .select()
      .single();

    if (pErr) throw pErr;

    const skuCode = 'SKU-' + data.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);

    const { data: newSku, error: sErr } = await supabase
      .from('product_skus')
      .insert({
        product_id: newProd.id,
        sku_code: skuCode,
        pack_size: data.packSize,
        unit: data.unit,
        mrp: data.mrp,
        selling_price: data.sellingPrice,
        is_default: true,
        is_active: true,
      })
      .select()
      .single();

    if (sErr) throw sErr;

    return {
      id: newProd.id,
      name: newProd.name,
      nameMr: newProd.name_mr,
      nameHi: newProd.name_hi,
      category: (data.categoryName || 'Fresh Milk & Curd') as ProductCategory,
      unit: `${data.packSize} ${data.unit}`,
      mrp: data.mrp,
      defaultPrice: data.sellingPrice,
      shelfLifeDays: newProd.shelf_life_days,
      description: newProd.description || '',
      isAvailable: true,
      minStockThreshold: newProd.min_stock_threshold,
      skus: [
        {
          id: newSku.id,
          skuCode: newSku.sku_code,
          packSize: newSku.pack_size,
          mrp: Number(newSku.mrp),
          sellingPrice: Number(newSku.selling_price),
          isDefault: true,
        },
      ],
    };
  }
};
