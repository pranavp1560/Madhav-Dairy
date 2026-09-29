# Madhav Dairy — Production Supabase & PostgreSQL Architecture

This directory contains the production-grade PostgreSQL database schema, Row-Level Security (RLS) policies, atomic document sequence engines, and seed data for **Madhav Dairy**.

---

## 🏗️ Architectural Principles

1. **Strict PostgreSQL Multi-Tenancy**:
   - Every domain entity belongs to an `organizations` record (`organization_id`).
   - RLS policies enforce isolation via `public.current_user_org_id()` with optimized subquery caching `(SELECT auth.uid())`.

2. **Supabase Native Authentication Integration**:
   - Zero custom credential tables. Passwords and JWTs are managed strictly by `auth.users`.
   - `public.profiles` maps 1:1 to `auth.users(id)` with cascade deletion.
   - Retailer accounts map to `auth.users` via `public.customer_users`, allowing retailers to log into the customer mobile portal using OTP or email.

3. **Double-Entry Financial Ledger (No Mutable Balances)**:
   - `customers.outstanding_amount` is **not** an independently mutable column.
   - All balance truth is derived from `public.ledger_entries` (debits for sales invoices, credits for payments) via `public.view_customer_outstanding`.
   - Avoids race conditions, balance tampering, and auditing drift.

4. **Immutable Inventory Transactions (Food Safety & Traceability)**:
   - Current finished goods stock and raw material stock are recorded through append-only transactions (`inventory_transactions` and `raw_material_transactions`).
   - `batch_stock` maintains location-specific fast lookup for active batches with quantity on hand and reserved stock.
   - Batch numbers, manufacturing timestamps, and expiry dates are tracked through the supply chain into `invoice_items` for regulatory FSSAI compliance.

5. **Atomic Linear Document Numbering**:
   - No `MAX(id) + 1` or front-end sequential generation (which creates duplicates under concurrent traffic).
   - Generated atomically via `public.next_document_number()` using row-level locking on `public.document_sequences`.

6. **PostgreSQL 15+ Security Invoker Views**:
   - All analytical and balance views (`view_customer_outstanding`, `view_raw_material_stock`, `view_batch_stock_summary`) specify `WITH (security_invoker = true)` to ensure query execution respects the calling user's RLS permissions.

---

## 📁 Migration Sequence

The database schema is organized into 16 sequential, modular migrations:

| File | Module / Content |
|---|---|
| `20260929000001_extensions_and_helpers.sql` | `uuid-ossp`, `pgcrypto`, `citext`, `update_updated_at_column()` trigger helper |
| `20260929000002_organizations.sql` | Multi-tenant organizations master (GSTIN, FSSAI, timezone, currency) |
| `20260929000003_identity_and_rbac.sql` | Profiles, roles, permissions, user_roles, and security definer helpers |
| `20260929000004_locations.sql` | Facilities: processing plants, warehouses, cold storage staging |
| `20260929000005_customers.sql` | Retailers directory and `customer_users` mapping to `auth.users` |
| `20260929000006_products_and_skus.sql` | Multilingual product categories, products, and authoritative SKUs |
| `20260929000007_suppliers.sql` | Farmer cooperatives and raw material vendors |
| `20260929000008_raw_materials.sql` | Raw material categories and items catalog |
| `20260929000009_production_runs.sql` | Manufacturing runs, planned vs produced yields, recipe materials |
| `20260929000010_batches_and_inventory.sql` | Batches, location batch stock, inventory ledger, raw material ledger, stock transfers |
| `20260929000011_orders.sql` | Sales orders, line items with locked unit pricing, status audit history |
| `20260929000012_invoices.sql` | Tax invoices, line items with batch assignment for traceability |
| `20260929000013_finance_and_ledger.sql` | Payments, payment invoice allocations, customer double-entry ledger, expenses |
| `20260929000014_expiry_and_notifications.sql` | Expiry rules, freshness radar alerts, multichannel notifications |
| `20260929000015_audit_and_document_sequences.sql` | Immutable audit log trail, atomic sequence counter generator |
| `20260929000016_views_and_rls.sql` | Derived views and complete RLS policy suite across all tables |
| `seed.sql` | Comprehensive initial dataset reflecting authentic Maharashtra dairy operations |

---

## 🔐 Role-Based Access Control (RBAC) Matrix

| Role Code | Role Name | Primary Responsibilities |
|---|---|---|
| `admin` | Owner / Main Admin | Full administrative access to all modules, financial ledgers, audit logs, and settings. |
| `production_manager` | Production Manager | Manages recipe formulations, production runs, batch quality testing, and raw material usage. |
| `warehouse_manager` | Warehouse Manager | Manages cold room staging, stock transfers, batch expiry radar, and inward purchases. |
| `accountant` | Accountant | Generates tax invoices, logs payment receipts, monitors customer ledgers, and tracks operational expenses. |
| `customer` | Retailer Partner | Mobile portal access to browse available catalog, place sales orders, and review invoice ledger. |

---

## 🚀 Applying Migrations to Supabase

### Local Development
```bash
npx supabase start
npx supabase db reset
```

### Remote Supabase Project (Project Ref: `syhfgcruhabwlqslsuuc`)
```bash
npx supabase link --project-ref syhfgcruhabwlqslsuuc
npx supabase db push
```

Or apply the SQL scripts sequentially in the Supabase Dashboard SQL Editor in numerical order from `001` to `016`, followed by `seed.sql`.
