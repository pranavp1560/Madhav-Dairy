export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          code: string;
          legal_name: string | null;
          gstin: string | null;
          fssai_number: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          logo_url: string | null;
          timezone: string;
          currency: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          email: string | null;
          mobile: string | null;
          avatar_url: string | null;
          user_type: 'internal' | 'customer';
          status: 'active' | 'inactive' | 'suspended';
          department_id: string | null;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      customers: {
        Row: {
          id: string;
          organization_id: string;
          customer_code: string;
          business_name: string;
          owner_name: string;
          mobile: string;
          email: string | null;
          address: string;
          area: string | null;
          city: string;
          state: string;
          pincode: string | null;
          gstin: string | null;
          credit_limit: number;
          payment_terms_days: number;
          status: 'active' | 'inactive' | 'blocked';
          last_order_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      products: {
        Row: {
          id: string;
          organization_id: string;
          category_id: string;
          name: string;
          name_mr: string | null;
          name_hi: string | null;
          description: string | null;
          base_unit: string;
          default_price: number;
          shelf_life_days: number;
          min_stock_threshold: number;
          image_url: string | null;
          is_available: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      product_skus: {
        Row: {
          id: string;
          product_id: string;
          sku_code: string;
          pack_size: string;
          unit: string;
          mrp: number;
          selling_price: number;
          is_default: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      batches: {
        Row: {
          id: string;
          organization_id: string;
          product_sku_id: string;
          production_run_id: string | null;
          batch_number: string;
          production_date: string;
          expiry_date: string;
          status: 'active' | 'near_expiry' | 'expired' | 'exhausted';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      orders: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string;
          order_number: string;
          order_date: string;
          requested_delivery_date: string | null;
          status: 'pending' | 'confirmed' | 'preparing' | 'dispatched' | 'delivered' | 'cancelled';
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total_amount: number;
          payment_status: 'unpaid' | 'partial' | 'paid';
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string;
          order_id: string | null;
          invoice_number: string;
          invoice_date: string;
          due_date: string;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total_amount: number;
          status: 'unpaid' | 'partial' | 'paid' | 'cancelled';
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      payments: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string;
          payment_number: string;
          payment_date: string;
          amount: number;
          payment_method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
          reference_number: string | null;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      ledger_entries: {
        Row: {
          id: string;
          organization_id: string;
          customer_id: string;
          entry_date: string;
          entry_type: 'invoice' | 'payment' | 'credit_note' | 'debit_note' | 'opening_balance';
          reference_type: string;
          reference_id: string | null;
          debit: number | null;
          credit: number | null;
          description: string;
          created_at: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          organization_id: string;
          expense_number: string;
          expense_date: string;
          category_id: string;
          description: string;
          amount: number;
          payment_method: 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
          paid_to: string;
          reference_number: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      raw_materials: {
        Row: {
          id: string;
          organization_id: string;
          category_id: string;
          material_code: string;
          name: string;
          name_mr: string | null;
          name_hi: string | null;
          unit: string;
          min_stock_threshold: number;
          cost_per_unit: number;
          default_supplier_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Views: {
      view_customer_outstanding: {
        Row: {
          customer_id: string;
          organization_id: string;
          customer_code: string;
          business_name: string;
          total_debit: number;
          total_credit: number;
          current_outstanding: number;
        };
      };
      view_raw_material_stock: {
        Row: {
          raw_material_id: string;
          organization_id: string;
          material_code: string;
          name: string;
          unit: string;
          current_stock: number;
          min_stock_threshold: number;
        };
      };
      view_batch_stock_summary: {
        Row: {
          batch_id: string;
          organization_id: string;
          batch_number: string;
          product_sku_id: string;
          product_name: string;
          pack_size: string;
          sku_code: string;
          production_date: string;
          expiry_date: string;
          status: string;
          total_on_hand: number;
          total_reserved: number;
          available_stock: number;
        };
      };
    };
  };
}
