import { supabase } from '../lib/supabase';
import { Product, ProductCategory, ProductSku, CategoryItem, ProductChannelPrice, SkuChannelPrice } from '../types/dairy';
import { getEffectiveOrgId } from './orgService';

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
        brand,
        base_unit,
        default_price,
        shelf_life_days,
        min_stock_threshold,
        image_url,
        is_available,
        is_active,
        product_categories(id, name),
        product_skus(
          id,
          product_id,
          sku_code,
          variant_name,
          pack_size,
          quantity,
          unit,
          mrp,
          selling_price,
          barcode,
          is_default,
          is_active,
          sku_channel_prices(
            id,
            channel_id,
            standard_price,
            minimum_price,
            is_active,
            sales_channels(id, name, code)
          )
        ),
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
      const skus: ProductSku[] = (p.product_skus || []).map((s: any) => {
        const skuPrices: SkuChannelPrice[] = (s.sku_channel_prices || []).map((scp: any) => ({
          id: scp.id,
          skuId: s.id,
          skuCode: s.sku_code,
          variantName: s.variant_name || s.pack_size,
          productId: p.id,
          productName: p.name,
          channelId: scp.channel_id,
          channelName: scp.sales_channels?.name || 'Channel',
          channelCode: scp.sales_channels?.code || '',
          standardPrice: Number(scp.standard_price),
          minimumPrice: Number(scp.minimum_price),
          isActive: scp.is_active,
        }));

        const activeSkuPrices = skuPrices.filter(sp => sp.isActive).length;
        let skuPricingStatus: 'configured' | 'partial' | 'not_configured' = 'not_configured';
        if (activeSkuPrices >= activeChannelCount && activeChannelCount > 0) {
          skuPricingStatus = 'configured';
        } else if (activeSkuPrices > 0) {
          skuPricingStatus = 'partial';
        }

        return {
          id: s.id,
          productId: p.id,
          productName: p.name,
          skuCode: s.sku_code,
          variantName: s.variant_name || s.pack_size,
          packSize: s.pack_size,
          quantity: s.quantity ? Number(s.quantity) : undefined,
          unit: s.unit,
          mrp: Number(s.mrp),
          sellingPrice: Number(s.selling_price),
          barcode: s.barcode || undefined,
          isDefault: s.is_default,
          isActive: s.is_active !== undefined ? s.is_active : true,
          channelPrices: skuPrices,
          channelCount: activeSkuPrices,
          pricingStatus: skuPricingStatus,
        };
      });

      const defaultSku = skus.find(s => s.isDefault) || skus[0];

      // Backward compatible channelPrices for product level derived from default SKU or product_channel_prices
      let channelPrices: ProductChannelPrice[] = [];
      if (defaultSku?.channelPrices && defaultSku.channelPrices.length > 0) {
        channelPrices = defaultSku.channelPrices.map(sp => ({
          id: sp.id,
          productId: p.id,
          productName: p.name,
          channelId: sp.channelId,
          channelName: sp.channelName,
          channelCode: sp.channelCode,
          standardPrice: sp.standardPrice,
          minimumPrice: sp.minimumPrice,
          isActive: sp.isActive,
        }));
      } else {
        channelPrices = (p.product_channel_prices || []).map((cp: any) => ({
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
      }

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
        brand: p.brand || 'Madhav Dairy',
        unit: defaultSku?.packSize ? `${defaultSku.packSize} ${defaultSku.unit || p.base_unit || 'pack'}` : (p.base_unit || 'unit'),
        mrp: defaultSku?.mrp || Number(p.default_price),
        defaultPrice: defaultSku?.sellingPrice || Number(p.default_price),
        shelfLifeDays: p.shelf_life_days,
        description: p.description || '',
        isAvailable: p.is_available,
        isActive: p.is_active !== undefined ? p.is_active : true,
        minStockThreshold: p.min_stock_threshold,
        imageUrl: p.image_url,
        skus,
        skuCount: skus.length,
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

    const orgId = await getEffectiveOrgId();

    const { data: newCat, error } = await supabase
      .from('product_categories')
      .insert({
        organization_id: orgId,
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

    const orgId = await getEffectiveOrgId();

    const { data: saved, error } = await supabase
      .from('product_channel_prices')
      .upsert({
        organization_id: orgId,
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

    const orgId = await getEffectiveOrgId();

    const rows = prices.map(p => ({
      organization_id: orgId,
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

      if (cat?.id) {
        categoryId = cat.id;
      } else {
        const { data: anyCat } = await supabase
          .from('product_categories')
          .select('id')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        categoryId = anyCat?.id;
      }
    }

    const orgId = await getEffectiveOrgId();

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
          organization_id: orgId,
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
  },

  // -------------------------------------------------------------
  // PARENT PRODUCT MANAGEMENT
  // -------------------------------------------------------------
  async createParentProduct(data: {
    name: string;
    categoryId: string;
    description?: string;
    brand?: string;
    isActive?: boolean;
    baseUnit?: string;
  }): Promise<Product> {
    const cleanName = data.name.trim();
    if (!cleanName) throw new Error('Product name is required');

    const orgId = await getEffectiveOrgId();

    const { data: newProd, error: pErr } = await supabase
      .from('products')
      .insert({
        organization_id: orgId,
        category_id: data.categoryId,
        name: cleanName,
        description: data.description?.trim() || '',
        brand: data.brand?.trim() || 'Madhav Dairy',
        base_unit: data.baseUnit || 'pack',
        default_price: 0,
        shelf_life_days: 7,
        min_stock_threshold: 10,
        is_available: true,
        is_active: data.isActive !== undefined ? data.isActive : true,
      })
      .select(`*, product_categories(id, name)`)
      .single();

    if (pErr) throw pErr;

    return {
      id: newProd.id,
      categoryId: newProd.category_id,
      name: newProd.name,
      category: (newProd.product_categories?.name || 'Dairy') as ProductCategory,
      brand: newProd.brand,
      unit: newProd.base_unit || 'pack',
      defaultPrice: 0,
      shelfLifeDays: newProd.shelf_life_days,
      description: newProd.description || '',
      isAvailable: true,
      isActive: newProd.is_active,
      minStockThreshold: newProd.min_stock_threshold,
      skus: [],
      skuCount: 0,
      channelPrices: [],
      channelCount: 0,
      pricingStatus: 'not_configured',
    };
  },

  async updateParentProduct(id: string, data: {
    name?: string;
    categoryId?: string;
    description?: string;
    brand?: string;
    isActive?: boolean;
    baseUnit?: string;
  }): Promise<void> {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.categoryId !== undefined) updatePayload.category_id = data.categoryId;
    if (data.description !== undefined) updatePayload.description = data.description.trim();
    if (data.brand !== undefined) updatePayload.brand = data.brand.trim();
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive;
    if (data.baseUnit !== undefined) updatePayload.base_unit = data.baseUnit;

    const { error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;
  },

  async toggleParentProductActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteParentProduct(id: string): Promise<void> {
    // Check if any SKUs of this product have transactional references
    const { data: skus } = await supabase
      .from('product_skus')
      .select('id')
      .eq('product_id', id);

    const skuIds = (skus || []).map(s => s.id);
    if (skuIds.length > 0) {
      const { count: orderItemsCount } = await supabase
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .in('product_sku_id', skuIds);

      if (orderItemsCount && orderItemsCount > 0) {
        throw new Error(`This product has ${orderItemsCount} historical order items across its SKUs. Deactivate the product instead of deleting it.`);
      }
    }

    // Delete child SKUs first (which cascade sku_channel_prices)
    if (skuIds.length > 0) {
      await supabase.from('product_skus').delete().in('id', skuIds);
    }

    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  },

  // -------------------------------------------------------------
  // CHILD SKU MANAGEMENT
  // -------------------------------------------------------------
  async createSku(data: {
    productId: string;
    skuCode: string;
    variantName: string;
    packSize?: string;
    quantity?: number;
    unit: string;
    mrp: number;
    sellingPrice?: number;
    barcode?: string;
    isDefault?: boolean;
    isActive?: boolean;
    channelPrices?: {
      channelId: string;
      standardPrice: number;
      minimumPrice: number;
    }[];
  }): Promise<ProductSku> {
    const cleanSkuCode = data.skuCode.trim().toUpperCase();
    if (!cleanSkuCode) throw new Error('SKU Code is required');
    if (!data.variantName.trim()) throw new Error('Variant name is required');
    if (isNaN(data.mrp) || data.mrp <= 0) throw new Error('Valid MRP is required');

    // Check unique skuCode
    const { data: existingSku } = await supabase
      .from('product_skus')
      .select('id, sku_code')
      .eq('sku_code', cleanSkuCode)
      .maybeSingle();

    if (existingSku) {
      throw new Error(`SKU Code "${cleanSkuCode}" already exists. Please choose a unique SKU code.`);
    }

    const packSize = data.packSize || data.variantName;
    const defaultSellingPrice = data.sellingPrice || data.mrp;

    const { data: newSku, error: sErr } = await supabase
      .from('product_skus')
      .insert({
        product_id: data.productId,
        sku_code: cleanSkuCode,
        variant_name: data.variantName.trim(),
        pack_size: packSize,
        quantity: data.quantity || 1,
        unit: data.unit,
        mrp: data.mrp,
        selling_price: defaultSellingPrice,
        barcode: data.barcode?.trim() || null,
        is_default: Boolean(data.isDefault),
        is_active: data.isActive !== undefined ? data.isActive : true,
      })
      .select('*, products(id, name)')
      .single();

    if (sErr) throw sErr;

    // Fetch active sales channels
    const { data: channels } = await supabase
      .from('sales_channels')
      .select('id, code, name')
      .eq('is_active', true);

    const createdChannelPrices: SkuChannelPrice[] = [];

    if (channels && channels.length > 0) {
      const orgId = await getEffectiveOrgId();
      const channelPricingRows = channels.map(ch => {
        const custom = data.channelPrices?.find(cp => cp.channelId === ch.id);
        let stdPrice = defaultSellingPrice;
        let minPrice = Math.round(defaultSellingPrice * 0.95);

        if (custom) {
          stdPrice = custom.standardPrice;
          minPrice = custom.minimumPrice;
        } else if (ch.code === 'WHOLESALE') {
          stdPrice = Math.round(defaultSellingPrice * 0.90);
          minPrice = Math.round(defaultSellingPrice * 0.85);
        } else if (ch.code === 'RETAIL') {
          stdPrice = defaultSellingPrice;
          minPrice = Math.round(defaultSellingPrice * 0.93);
        }

        if (minPrice > stdPrice) {
          throw new Error(`Minimum Price (₹${minPrice}) cannot be greater than Standard Price (₹${stdPrice}) for ${ch.name}`);
        }

        return {
          organization_id: orgId,
          sku_id: newSku.id,
          channel_id: ch.id,
          standard_price: stdPrice,
          minimum_price: minPrice,
          is_active: true,
        };
      });

      const { data: insertedPrices, error: ipErr } = await supabase
        .from('sku_channel_prices')
        .insert(channelPricingRows)
        .select(`
          id,
          sku_id,
          channel_id,
          standard_price,
          minimum_price,
          is_active,
          sales_channels(id, name, code)
        `);

      if (!ipErr && insertedPrices) {
        insertedPrices.forEach((ip: any) => {
          createdChannelPrices.push({
            id: ip.id,
            skuId: newSku.id,
            skuCode: newSku.sku_code,
            variantName: newSku.variant_name,
            productId: data.productId,
            productName: (newSku as any).products?.name,
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
      id: newSku.id,
      productId: data.productId,
      productName: (newSku as any).products?.name,
      skuCode: newSku.sku_code,
      variantName: newSku.variant_name,
      packSize: newSku.pack_size,
      quantity: newSku.quantity ? Number(newSku.quantity) : undefined,
      unit: newSku.unit,
      mrp: Number(newSku.mrp),
      sellingPrice: Number(newSku.selling_price),
      barcode: newSku.barcode || undefined,
      isDefault: newSku.is_default,
      isActive: newSku.is_active,
      channelPrices: createdChannelPrices,
      channelCount: createdChannelPrices.length,
      pricingStatus: createdChannelPrices.length > 0 ? 'configured' : 'not_configured',
    };
  },

  async updateSku(id: string, data: {
    skuCode?: string;
    variantName?: string;
    packSize?: string;
    quantity?: number;
    unit?: string;
    mrp?: number;
    sellingPrice?: number;
    barcode?: string;
    isDefault?: boolean;
    isActive?: boolean;
  }): Promise<void> {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.skuCode !== undefined) updatePayload.sku_code = data.skuCode.trim().toUpperCase();
    if (data.variantName !== undefined) updatePayload.variant_name = data.variantName.trim();
    if (data.packSize !== undefined) updatePayload.pack_size = data.packSize.trim();
    if (data.quantity !== undefined) updatePayload.quantity = data.quantity;
    if (data.unit !== undefined) updatePayload.unit = data.unit;
    if (data.mrp !== undefined) updatePayload.mrp = data.mrp;
    if (data.sellingPrice !== undefined) updatePayload.selling_price = data.sellingPrice;
    if (data.barcode !== undefined) updatePayload.barcode = data.barcode.trim() || null;
    if (data.isDefault !== undefined) updatePayload.is_default = data.isDefault;
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive;

    const { error } = await supabase
      .from('product_skus')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;
  },

  async toggleSkuActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('product_skus')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteSku(id: string): Promise<void> {
    // Check if referenced in historical orders or inventory
    const { count: ordersCount } = await supabase
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_sku_id', id);

    if (ordersCount && ordersCount > 0) {
      throw new Error(`This SKU is referenced by ${ordersCount} historical order line(s). Deactivate it instead of deleting it to preserve financial history.`);
    }

    const { count: batchesCount } = await supabase
      .from('batches')
      .select('*', { count: 'exact', head: true })
      .eq('product_sku_id', id);

    if (batchesCount && batchesCount > 0) {
      throw new Error(`This SKU is referenced by ${batchesCount} production batch(es). Deactivate it instead of deleting it.`);
    }

    const { error } = await supabase.from('product_skus').delete().eq('id', id);
    if (error) throw error;
  },

  // -------------------------------------------------------------
  // SKU CHANNEL PRICING MANAGEMENT
  // -------------------------------------------------------------
  async fetchSkuChannelPrices(skuId?: string): Promise<SkuChannelPrice[]> {
    let query = supabase
      .from('sku_channel_prices')
      .select(`
        id,
        sku_id,
        channel_id,
        standard_price,
        minimum_price,
        is_active,
        created_at,
        updated_at,
        product_skus(
          id,
          sku_code,
          variant_name,
          products(id, name)
        ),
        sales_channels(id, name, code)
      `);

    if (skuId) {
      query = query.eq('sku_id', skuId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any): SkuChannelPrice => ({
      id: row.id,
      skuId: row.sku_id,
      skuCode: row.product_skus?.sku_code,
      variantName: row.product_skus?.variant_name,
      productId: row.product_skus?.products?.id,
      productName: row.product_skus?.products?.name,
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

  async saveSkuChannelPrice(data: {
    skuId: string;
    channelId: string;
    standardPrice: number;
    minimumPrice: number;
    isActive?: boolean;
  }): Promise<SkuChannelPrice> {
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

    const orgId = await getEffectiveOrgId();

    const { data: saved, error } = await supabase
      .from('sku_channel_prices')
      .upsert({
        organization_id: orgId,
        sku_id: data.skuId,
        channel_id: data.channelId,
        standard_price: std,
        minimum_price: min,
        is_active: data.isActive !== undefined ? data.isActive : true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id,sku_id,channel_id'
      })
      .select(`
        id,
        sku_id,
        channel_id,
        standard_price,
        minimum_price,
        is_active,
        created_at,
        updated_at,
        product_skus(
          id,
          sku_code,
          variant_name,
          products(id, name)
        ),
        sales_channels(id, name, code)
      `)
      .single();

    if (error) throw error;

    return {
      id: saved.id,
      skuId: saved.sku_id,
      skuCode: (saved as any).product_skus?.sku_code,
      variantName: (saved as any).product_skus?.variant_name,
      productId: (saved as any).product_skus?.products?.id,
      productName: (saved as any).product_skus?.products?.name,
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

  async saveMultipleSkuChannelPrices(prices: {
    skuId: string;
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

    const orgId = await getEffectiveOrgId();

    const rows = prices.map(p => ({
      organization_id: orgId,
      sku_id: p.skuId,
      channel_id: p.channelId,
      standard_price: Number(p.standardPrice),
      minimum_price: Number(p.minimumPrice),
      is_active: p.isActive !== undefined ? p.isActive : true,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('sku_channel_prices')
      .upsert(rows, {
        onConflict: 'organization_id,sku_id,channel_id'
      });

    if (error) throw error;
  },
};
