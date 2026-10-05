import { supabase } from '../lib/supabase';
import { Product, ProductCategory, ProductSku, CategoryItem, ProductChannelPrice } from '../types/dairy';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export const productService = {
  async fetchProducts(): Promise<Product[]> {
    const { data: prods, error: pErr } = await supabase
      .from('products')
      .select(`
        id,
        category_id,
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
        product_categories(id, name),
        product_skus(id, sku_code, pack_size, unit, mrp, selling_price, is_default),
        product_channel_prices(
          id,
          channel_id,
          standard_price,
          minimum_price,
          is_active,
          sales_channels(id, name, code)
        )
      `)
      .order('name');

    if (pErr) throw pErr;

    // Fetch active channels count for determining pricing configuration status
    const { count: totalActiveChannels } = await supabase
      .from('sales_channels')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const activeChannelCount = totalActiveChannels || 3;

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

      const channelPrices: ProductChannelPrice[] = (p.product_channel_prices || []).map((cp: any) => ({
        id: cp.id,
        productId: p.id,
        productName: p.name,
        channelId: cp.channel_id,
        channelName: cp.sales_channels?.name || 'Channel',
        channelCode: cp.sales_channels?.code || '',
        standardPrice: Number(cp.standard_price),
        minimumPrice: Number(cp.minimum_price),
        isActive: cp.is_active,
      }));

      const activePricesCount = channelPrices.filter(cp => cp.isActive).length;
      let pricingStatus: 'configured' | 'partial' | 'not_configured' = 'not_configured';
      if (activePricesCount >= activeChannelCount && activeChannelCount > 0) {
        pricingStatus = 'configured';
      } else if (activePricesCount > 0) {
        pricingStatus = 'partial';
      }

      return {
        id: p.id,
        categoryId: p.category_id,
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
        channelPrices,
        channelCount: activePricesCount,
        pricingStatus,
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

  async fetchCategoriesDetail(): Promise<CategoryItem[]> {
    const { data: cats, error } = await supabase
      .from('product_categories')
      .select('*')
      .order('name');

    if (error) throw error;

    // Fetch product counts per category
    const { data: prodCounts } = await supabase
      .from('products')
      .select('category_id');

    const countMap: Record<string, number> = {};
    if (prodCounts) {
      prodCounts.forEach((p: any) => {
        if (p.category_id) {
          countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
        }
      });
    }

    return (cats || []).map((c: any): CategoryItem => ({
      id: c.id,
      name: c.name,
      nameMr: c.name_mr || undefined,
      nameHi: c.name_hi || undefined,
      description: c.description || '',
      isActive: c.is_active,
      productCount: countMap[c.id] || 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  },

  async createCategory(data: {
    name: string;
    nameMr?: string;
    nameHi?: string;
    description?: string;
  }): Promise<CategoryItem> {
    const cleanName = data.name.trim();
    if (!cleanName) throw new Error('Category name is required');

    // Duplicate check
    const { data: existing } = await supabase
      .from('product_categories')
      .select('id, name')
      .ilike('name', cleanName)
      .maybeSingle();

    if (existing) {
      throw new Error(`Category "${cleanName}" already exists.`);
    }

    const { data: newCat, error } = await supabase
      .from('product_categories')
      .insert({
        organization_id: DEFAULT_ORG_ID,
        name: cleanName,
        name_mr: data.nameMr?.trim() || null,
        name_hi: data.nameHi?.trim() || null,
        description: data.description?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: newCat.id,
      name: newCat.name,
      nameMr: newCat.name_mr,
      nameHi: newCat.name_hi,
      description: newCat.description || '',
      isActive: newCat.is_active,
      productCount: 0,
      createdAt: newCat.created_at,
      updatedAt: newCat.updated_at,
    };
  },

  async updateCategory(id: string, data: {
    name?: string;
    nameMr?: string;
    nameHi?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<void> {
    const updatePayload: Record<string, any> = {};

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      if (!cleanName) throw new Error('Category name cannot be empty');
      updatePayload.name = cleanName;
    }

    if (data.nameMr !== undefined) updatePayload.name_mr = data.nameMr.trim() || null;
    if (data.nameHi !== undefined) updatePayload.name_hi = data.nameHi.trim() || null;
    if (data.description !== undefined) updatePayload.description = data.description.trim() || null;
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive;

    const { error } = await supabase
      .from('product_categories')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;
  },

  async toggleCategoryActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('product_categories')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteCategory(id: string): Promise<void> {
    // Check if category has products
    const { count, error: countErr } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id);

    if (countErr) throw countErr;

    if (count && count > 0) {
      throw new Error(`This category is currently assigned to ${count} product${count > 1 ? 's' : ''}. Deactivate it instead of deleting it.`);
    }

    const { error: delErr } = await supabase
      .from('product_categories')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;
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

  async fetchChannelPrices(productId?: string): Promise<ProductChannelPrice[]> {
    let query = supabase
      .from('product_channel_prices')
      .select(`
        id,
        product_id,
        channel_id,
        standard_price,
        minimum_price,
        is_active,
        created_at,
        updated_at,
        products(id, name),
        sales_channels(id, name, code)
      `);

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any): ProductChannelPrice => ({
      id: row.id,
      productId: row.product_id,
      productName: row.products?.name,
      channelId: row.channel_id,
      channelName: row.sales_channels?.name,
      channelCode: row.sales_channels?.code,
      standardPrice: Number(row.standard_price),
      minimumPrice: Number(row.minimum_price),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  async saveChannelPrice(data: {
    productId: string;
    channelId: string;
    standardPrice: number;
    minimumPrice: number;
    isActive?: boolean;
  }): Promise<ProductChannelPrice> {
    const std = Number(data.standardPrice);
    const min = Number(data.minimumPrice);

    if (isNaN(std) || std < 0) {
      throw new Error('Standard Price must be a valid positive number');
    }
    if (isNaN(min) || min < 0) {
      throw new Error('Minimum Price must be a valid positive number');
    }
    if (min > std) {
      throw new Error(`Minimum Price (₹${min}) cannot be higher than Standard Price (₹${std})`);
    }

    const { data: saved, error } = await supabase
      .from('product_channel_prices')
      .upsert({
        organization_id: DEFAULT_ORG_ID,
        product_id: data.productId,
        channel_id: data.channelId,
        standard_price: std,
        minimum_price: min,
        is_active: data.isActive !== undefined ? data.isActive : true,
      }, {
        onConflict: 'organization_id,product_id,channel_id'
      })
      .select(`
        id,
        product_id,
        channel_id,
        standard_price,
        minimum_price,
        is_active,
        created_at,
        updated_at,
        products(id, name),
        sales_channels(id, name, code)
      `)
      .single();

    if (error) throw error;

    return {
      id: saved.id,
      productId: saved.product_id,
      productName: (saved as any).products?.name,
      channelId: saved.channel_id,
      channelName: (saved as any).sales_channels?.name,
      channelCode: (saved as any).sales_channels?.code,
      standardPrice: Number(saved.standard_price),
      minimumPrice: Number(saved.minimum_price),
      isActive: saved.is_active,
      createdAt: saved.created_at,
      updatedAt: saved.updated_at,
    };
  },

  async saveMultipleChannelPrices(prices: {
    productId: string;
    channelId: string;
    standardPrice: number;
    minimumPrice: number;
    isActive?: boolean;
  }[]): Promise<void> {
    for (const p of prices) {
      const std = Number(p.standardPrice);
      const min = Number(p.minimumPrice);

      if (isNaN(std) || std < 0) {
        throw new Error('Standard Price must be a valid positive number');
      }
      if (isNaN(min) || min < 0) {
        throw new Error('Minimum Price must be a valid positive number');
      }
      if (min > std) {
        throw new Error(`Minimum Price (₹${min}) cannot be higher than Standard Price (₹${std})`);
      }
    }

    const rows = prices.map(p => ({
      organization_id: DEFAULT_ORG_ID,
      product_id: p.productId,
      channel_id: p.channelId,
      standard_price: Number(p.standardPrice),
      minimum_price: Number(p.minimumPrice),
      is_active: p.isActive !== undefined ? p.isActive : true,
    }));

    const { error } = await supabase
      .from('product_channel_prices')
      .upsert(rows, {
        onConflict: 'organization_id,product_id,channel_id'
      });

    if (error) throw error;
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
    channelPrices?: {
      channelId: string;
      standardPrice: number;
      minimumPrice: number;
    }[];
  }): Promise<Product> {
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
        organization_id: DEFAULT_ORG_ID,
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

    // Create channel pricing records:
    // If specific channel prices provided, use those; otherwise generate defaults across active channels
    const { data: channels } = await supabase
      .from('sales_channels')
      .select('id, code, name')
      .eq('is_active', true);

    const createdChannelPrices: ProductChannelPrice[] = [];

    if (channels && channels.length > 0) {
      const channelPricingRows = channels.map(ch => {
        const custom = data.channelPrices?.find(cp => cp.channelId === ch.id);
        let stdPrice = data.sellingPrice;
        let minPrice = Math.round(data.sellingPrice * 0.95);

        if (custom) {
          stdPrice = custom.standardPrice;
          minPrice = custom.minimumPrice;
        } else if (ch.code === 'WHOLESALE') {
          stdPrice = Math.round(data.sellingPrice * 0.90);
          minPrice = Math.round(data.sellingPrice * 0.85);
        } else if (ch.code === 'RETAIL') {
          stdPrice = data.sellingPrice;
          minPrice = Math.round(data.sellingPrice * 0.93);
        }

        return {
          organization_id: DEFAULT_ORG_ID,
          product_id: newProd.id,
          channel_id: ch.id,
          standard_price: stdPrice,
          minimum_price: minPrice,
          is_active: true,
        };
      });

      const { data: insertedPrices } = await supabase
        .from('product_channel_prices')
        .insert(channelPricingRows)
        .select(`
          id,
          channel_id,
          standard_price,
          minimum_price,
          is_active,
          sales_channels(id, name, code)
        `);

      if (insertedPrices) {
        insertedPrices.forEach((ip: any) => {
          createdChannelPrices.push({
            id: ip.id,
            productId: newProd.id,
            productName: newProd.name,
            channelId: ip.channel_id,
            channelName: ip.sales_channels?.name,
            channelCode: ip.sales_channels?.code,
            standardPrice: Number(ip.standard_price),
            minimumPrice: Number(ip.minimum_price),
            isActive: ip.is_active,
          });
        });
      }
    }

    return {
      id: newProd.id,
      categoryId: newProd.category_id,
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
      channelPrices: createdChannelPrices,
      channelCount: createdChannelPrices.length,
      pricingStatus: createdChannelPrices.length > 0 ? 'configured' : 'not_configured',
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
