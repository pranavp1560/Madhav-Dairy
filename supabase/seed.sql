-- =============================================================================
-- Madhav Dairy — Production Seed Data
-- Database Engine: PostgreSQL 15+ / Supabase
-- Multi-Tenant Organization, Catalogs, Facilities, Batches, Orders, and Ledger
-- =============================================================================

-- Deterministic UUIDs used throughout the seed script:
-- Organization: 00000000-0000-0000-0000-000000000001
-- Roles:        10000000-0000-0000-0000-000000000001 .. 0005
-- Locations:    20000000-0000-0000-0000-000000000001 .. 0003
-- Categories:   30000000-0000-0000-0000-000000000001 .. 0004
-- Products:     40000000-0000-0000-0000-000000000001 .. 0020
-- SKUs:         41000000-0000-0000-0000-000000000001 .. 0020
-- Suppliers:    50000000-0000-0000-0000-000000000001 .. 0005
-- Raw Mat Cat:  55000000-0000-0000-0000-000000000001 .. 0004
-- Raw Mat:      60000000-0000-0000-0000-000000000001 .. 0008
-- Customers:    70000000-0000-0000-0000-000000000001 .. 0005
-- Users (Auth): 80000000-0000-0000-0000-000000000001 .. 0005
-- Batches:      a1000000-0000-0000-0000-000000000001 .. 0010

-- -----------------------------------------------------------------------------
-- 1. Organization Master
-- -----------------------------------------------------------------------------
INSERT INTO public.organizations (
  id, name, legal_name, slug, code, gstin, fssai_license, phone, email, address, timezone, currency, is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Madhav Dairy Private Limited',
  'Madhav Dairy Products Pvt. Ltd.',
  'madhav-dairy',
  'MD',
  '27AABCM9124K1Z0',
  '11522038000451',
  '+91 98220 11223',
  'contact@madhavdairy.com',
  'Gat No. 142, Shirwal-Lonand Road, Shirwal, Satara, Maharashtra 412801',
  'Asia/Kolkata',
  'INR',
  true
) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. System Permissions
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (module, action, description) VALUES
  ('dashboard', 'view', 'View executive and operational summary metrics'),
  ('production', 'view', 'View production plans and logs'),
  ('production', 'create', 'Create new production batches'),
  ('production', 'edit', 'Update production status and yield'),
  ('production', 'delete', 'Cancel or delete production logs'),
  ('batches', 'view', 'View product batch details'),
  ('batches', 'create', 'Register new product batches'),
  ('batches', 'edit', 'Edit batch quality parameters and expiry'),
  ('batches', 'delete', 'Delete batch entries'),
  ('inventory', 'view', 'View finished goods stock and movements'),
  ('inventory', 'create', 'Perform stock adjustments and transfers'),
  ('inventory', 'edit', 'Modify stock movement records'),
  ('raw_materials', 'view', 'View raw material inventory and logs'),
  ('raw_materials', 'create', 'Record raw material purchases or inward movements'),
  ('raw_materials', 'edit', 'Update raw material usage'),
  ('orders', 'view', 'View retailer sales orders'),
  ('orders', 'create', 'Create retailer sales orders'),
  ('orders', 'edit', 'Modify order line items and status'),
  ('orders', 'delete', 'Cancel sales orders'),
  ('invoices', 'view', 'View tax invoices'),
  ('invoices', 'create', 'Generate invoices from orders'),
  ('invoices', 'edit', 'Update invoice details'),
  ('customers', 'view', 'View customer master directory'),
  ('customers', 'create', 'Register new retailer accounts'),
  ('customers', 'edit', 'Update retailer details and credit limit'),
  ('payments', 'view', 'View payment receipts'),
  ('payments', 'create', 'Record customer payments'),
  ('payments', 'edit', 'Modify payment allocations'),
  ('ledger', 'view', 'View customer double-entry ledger statement'),
  ('expenses', 'view', 'View operational expenses'),
  ('expenses', 'create', 'Record operating expenses'),
  ('expenses', 'edit', 'Update expense entries'),
  ('expiry', 'view', 'Monitor freshness radar and expiry alerts'),
  ('expiry', 'edit', 'Configure expiry rules and action alerts'),
  ('reports', 'view', 'Access compliance, production and financial reports'),
  ('users', 'view', 'View system users and permissions'),
  ('users', 'create', 'Invite and register new staff members'),
  ('users', 'edit', 'Manage user roles and statuses'),
  ('products', 'view', 'View product and SKU catalog'),
  ('products', 'create', 'Create products and SKUs'),
  ('products', 'edit', 'Update product pricing and descriptions'),
  ('settings', 'view', 'View organization configuration'),
  ('settings', 'edit', 'Update company profile and sequences')
ON CONFLICT (module, action) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. System Roles & Role-Permission Matrix
-- -----------------------------------------------------------------------------
INSERT INTO public.roles (id, organization_id, name, description, is_system_role) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin', 'Dairy Owner and Executive Administrator', true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'production_manager', 'Manufacturing Plant and Recipe Lead', true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'warehouse_manager', 'Cold Chain Storage and Dispatch Incharge', true),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'accountant', 'Billing, Collections and Financial Controller', true),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'customer', 'Retailer and Distribution Partner', true)
ON CONFLICT (id) DO NOTHING;

-- Grant all permissions to admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Grant production manager permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM public.permissions
WHERE module IN ('dashboard', 'production', 'batches', 'inventory', 'raw_materials', 'expiry', 'products')
ON CONFLICT DO NOTHING;

-- Grant warehouse manager permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM public.permissions
WHERE module IN ('dashboard', 'batches', 'inventory', 'raw_materials', 'orders', 'expiry')
ON CONFLICT DO NOTHING;

-- Grant accountant permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM public.permissions
WHERE module IN ('dashboard', 'orders', 'invoices', 'customers', 'payments', 'ledger', 'expenses', 'reports')
ON CONFLICT DO NOTHING;

-- Grant customer permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000005', id FROM public.permissions
WHERE (module = 'products' AND action = 'view')
   OR (module = 'orders' AND action IN ('view', 'create'))
   OR (module = 'invoices' AND action = 'view')
   OR (module = 'ledger' AND action = 'view')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Facilities & Cold-Chain Storage Locations
-- -----------------------------------------------------------------------------
INSERT INTO public.locations (id, organization_id, code, name, location_type, address, is_active) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'LOC-SHR01', 'Shirwal Processing Plant', 'production', 'Gat 142, Lonand Road, Shirwal, Satara', true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'LOC-PUN01', 'Pune Central Depot & Cold Storage', 'warehouse', 'Plot 45, Gultekdi Market Yard, Pune - 411037', true),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'LOC-HAD01', 'Hadapsar Cold Storage Staging', 'warehouse', 'S.No. 88, Gadital, Hadapsar, Pune - 411028', true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Product Categories
-- -----------------------------------------------------------------------------
INSERT INTO public.product_categories (id, organization_id, name, name_mr, name_hi, is_active) VALUES
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Sweets & Desserts', 'मिठाई व मिष्टान्न', 'मिठाई और मिष्ठान', true),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Fresh Milk & Curd', 'ताजे दूध व दही', 'ताज़ा दूध और दही', true),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Paneer & Ghee', 'पनीर व तूप', 'पनीर और घी', true),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Beverages & Other', 'पेये व इतर', 'पेय और अन्य', true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. Products Catalog
-- -----------------------------------------------------------------------------
INSERT INTO public.products (
  id, organization_id, category_id, name, name_mr, name_hi, description, base_unit, default_price, shelf_life_days, min_stock_threshold, is_available, is_active
) VALUES
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Basundi', 'बासुंदी', 'बासुंदी', 'Traditional slow-reduced sweetened thickened milk with saffron and cardamom.', 'pouch', 120.00, 40, 50, true, true),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Kesar Pedha', 'केशर पेढा', 'केसर पेड़ा', 'Rich artisanal khoa pedha infused with pure saffron and pistachios.', 'box', 150.00, 15, 40, true, true),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Elaichi Shrikhand', 'वेलची श्रीखंड', 'इलायची श्रीखंड', 'Creamy hung curd blended with aromatic green cardamom and sugar.', 'tub', 180.00, 30, 45, true, true),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Buffalo Full Cream Milk', 'म्हैस फुल क्रीम दूध', 'भैंस का दूध', 'Rich and creamy pasteurized buffalo milk with minimum 6.5% FAT and 9.0% SNF.', 'pouch', 72.00, 3, 200, true, true),
  ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Cow Fresh Milk', 'गायीचे ताजे दूध', 'गाय का ताज़ा दूध', 'Pure, digestible pasteurized cow milk with natural golden hue and 3.5% FAT.', 'pouch', 58.00, 3, 150, true, true),
  ('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Fresh Malai Paneer', 'ताजे मलाई पनीर', 'ताज़ा मलाई पनीर', 'Soft, melt-in-mouth cottage cheese crafted from pure full cream milk.', 'block', 220.00, 7, 60, true, true),
  ('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Dahi (Curd)', 'ताजे दही', 'ताज़ा दही', 'Thick, probiotic-rich homestyle curd with mild natural acidity.', 'cup', 45.00, 10, 80, true, true),
  ('40000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Pure Desi Cow Ghee', 'शुद्ध देशी गायीचे तूप', 'शुद्ध देसी गाय का घी', 'Bilona method slow-cooked golden cow ghee with rich granular texture.', 'jar', 750.00, 180, 30, true, true),
  ('40000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Fresh White Butter (Makkhan)', 'ताजे लोणी', 'सफ़ेद मक्खन', 'Unsalted traditional cultured white butter prepared from fresh cream.', 'pack', 280.00, 25, 25, true, true),
  ('40000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Danedar Khoa (Mawa)', 'दाणेदार खवा', 'दानेदार खोया', 'Fresh evaporated milk solids ideal for festive sweets and culinary use.', 'block', 360.00, 10, 30, true, true),
  ('40000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Shahi Rabdi', 'शाही रबडी', 'शाही रबड़ी', 'Layered malai shreds immersed in sweetened condensed saffron milk.', 'cup', 110.00, 10, 35, true, true),
  ('40000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Elaichi Flavoured Milk', 'इलायची फ्लेवर्ड दूध', 'इलायची फ्लेवर्ड दूध', 'Sterilized double-toned milk with natural cardamom extract and cane sugar.', 'bottle', 35.00, 90, 100, true, true),
  ('40000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Processed Dairy Cheese', 'डेअरी चीज ब्लॉक', 'डेयरी चीज़ ब्लॉक', 'Cheddar-based smooth melting cheese block for culinary preparation.', 'block', 140.00, 120, 40, true, true),
  ('40000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Masala Buttermilk (Taak)', 'मसाला ताक', 'मसाला छाछ', 'Refreshing spiced buttermilk tempered with roasted cumin, ginger and curry leaves.', 'pouch', 15.00, 5, 150, true, true),
  ('40000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Milk Cake', 'मिल्क केक', 'मिल्क केक', 'Caramelized two-tone grainy milk fudge made with pure cow milk.', 'box', 320.00, 20, 25, true, true),
  ('40000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Malai Kalakand', 'मलाई कलाकंद', 'मलाई कलाकंद', 'Delicate, moist sweet prepared from paneer and sweetened condensed milk.', 'box', 170.00, 8, 30, true, true),
  ('40000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Alphonso Mango Lassi', 'हापूस आंबा लस्सी', 'आम लस्सी', 'Thick churned lassi blended with authentic Ratnagiri Alphonso mango pulp.', 'bottle', 40.00, 15, 80, true, true),
  ('40000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Set Sweetened Curd (Misti Doi)', 'मिष्टी दोई', 'मिष्टी दोई', 'Traditional earthen pot set fermented sweet curd with caramelized milk flavor.', 'tub', 90.00, 12, 40, true, true),
  ('40000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Malai Fresh Cream', 'मलाई फ्रेश क्रीम', 'मलाई फ्रेश क्रीम', '25% milk fat fresh whipping cream for gravies, fruit salads and shakes.', 'pack', 95.00, 25, 35, true, true),
  ('40000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Skimmed Milk Powder (SMP)', 'स्कीम्ड मिल्क पावडर', 'मिल्क पाउडर', 'Spray-dried extra grade skimmed milk powder with instant solubility.', 'pack', 380.00, 240, 20, true, true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. Product SKUs (Authoritative Inventory & Pricing Unit)
-- -----------------------------------------------------------------------------
INSERT INTO public.product_skus (
  id, product_id, sku_code, pack_size, unit, mrp, selling_price, is_default, is_active
) VALUES
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'SKU-BAS-500ML', '500 ml', '500 ml pouch', 140.00, 120.00, true, true),
  ('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'SKU-PED-250G', '250 g', '250 g box', 175.00, 150.00, true, true),
  ('41000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'SKU-SHR-500G', '500 g', '500 g tub', 210.00, 180.00, true, true),
  ('41000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', 'SKU-BMK-1L', '1 Litre', '1 Litre pouch', 78.00, 72.00, true, true),
  ('41000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', 'SKU-CMK-1L', '1 Litre', '1 Litre pouch', 64.00, 58.00, true, true),
  ('41000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000006', 'SKU-PAN-500G', '500 g', '500 g block', 250.00, 220.00, true, true),
  ('41000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000007', 'SKU-DAH-400G', '400 g', '400 g cup', 52.00, 45.00, true, true),
  ('41000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000008', 'SKU-GHE-1L', '1 Litre', '1 Litre jar', 850.00, 750.00, true, true),
  ('41000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000009', 'SKU-BUT-500G', '500 g', '500 g pack', 320.00, 280.00, true, true),
  ('41000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000010', 'SKU-KHO-1KG', '1 kg', '1 kg block', 410.00, 360.00, true, true),
  ('41000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000011', 'SKU-RAB-250G', '250 g', '250 g cup', 130.00, 110.00, true, true),
  ('41000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000012', 'SKU-FLM-200ML', '200 ml', '200 ml bottle', 40.00, 35.00, true, true),
  ('41000000-0000-0000-0000-000000000013', '40000000-0000-0000-0000-000000000013', 'SKU-CHE-200G', '200 g', '200 g block', 160.00, 140.00, true, true),
  ('41000000-0000-0000-0000-000000000014', '40000000-0000-0000-0000-000000000014', 'SKU-TAK-250ML', '250 ml', '250 ml pouch', 18.00, 15.00, true, true),
  ('41000000-0000-0000-0000-000000000015', '40000000-0000-0000-0000-000000000015', 'SKU-MCK-500G', '500 g', '500 g box', 360.00, 320.00, true, true),
  ('41000000-0000-0000-0000-000000000016', '40000000-0000-0000-0000-000000000016', 'SKU-KLK-250G', '250 g', '250 g box', 195.00, 170.00, true, true),
  ('41000000-0000-0000-0000-000000000017', '40000000-0000-0000-0000-000000000017', 'SKU-LAS-300ML', '300 ml', '300 ml bottle', 48.00, 40.00, true, true),
  ('41000000-0000-0000-0000-000000000018', '40000000-0000-0000-0000-000000000018', 'SKU-MSD-1KG', '1 kg', '1 kg tub', 110.00, 90.00, true, true),
  ('41000000-0000-0000-0000-000000000019', '40000000-0000-0000-0000-000000000019', 'SKU-CRM-250ML', '250 ml', '250 ml pack', 115.00, 95.00, true, true),
  ('41000000-0000-0000-0000-000000000020', '40000000-0000-0000-0000-000000000020', 'SKU-SMP-1KG', '1 kg', '1 kg pack', 420.00, 380.00, true, true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. Suppliers Master
-- -----------------------------------------------------------------------------
INSERT INTO public.suppliers (id, organization_id, supplier_code, name, contact_person, mobile, email, address, gstin, status) VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'SUP-001', 'Sangamner Farmer Society', 'Balu Thorat', '9822456781', 'sangamner.farmers@gmail.com', 'At Post Talegaon, Sangamner, Ahmednagar', '27AABCS1289K1Z4', 'active'),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'SUP-002', 'Shirwal Milk Union', 'Pandurang More', '9822789123', 'shirwalmilk.union@yahoo.com', 'MIDC Phase II, Shirwal, Satara', '27AABCP4412R1Z8', 'active'),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'SUP-003', 'Someshwar Sugar Mills', 'Vikas Jagtap', '9850123456', 'sales@someshwarsugar.com', 'Someshwarnagar, Baramati, Pune', '27AAACS8976M1ZZ', 'active'),
  ('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'SUP-004', 'Kerala Cardamom Spices Co.', 'Mathew Thomas', '9447129845', 'spices@keralacardamom.in', 'Vandanmedu, Idukki, Kerala', '32AAACK4120L1ZT', 'active'),
  ('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'SUP-005', 'Polyflex Packaging Pune', 'Nilesh Shah', '9822612345', 'sales@polyflexpack.com', 'Bhosari MIDC, Pune', '27AAACP9988D1Z2', 'active')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. Raw Material Categories & Raw Materials Master
-- -----------------------------------------------------------------------------
INSERT INTO public.raw_material_categories (id, organization_id, name, is_active) VALUES
  ('55000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Dairy Inward', true),
  ('55000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Sweeteners', true),
  ('55000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Spices', true),
  ('55000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Packaging', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.raw_materials (
  id, organization_id, category_id, material_code, name, name_mr, name_hi, unit, min_stock_threshold, cost_per_unit, default_supplier_id, is_active
) VALUES
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001', 'RM-CMK', 'Raw Cow Milk', 'कच्चे गायीचे दूध', 'कच्चा गाय का दूध', 'Litres', 1500.00, 36.00, '50000000-0000-0000-0000-000000000001', true),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001', 'RM-BMK', 'Raw Buffalo Milk', 'कच्चे म्हशीचे दूध', 'कच्चा भैंस का दूध', 'Litres', 2000.00, 48.00, '50000000-0000-0000-0000-000000000002', true),
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000002', 'RM-SUG', 'Refined Cane Sugar (M-30)', 'साखर (M-30)', 'रिफाइंड चीनी', 'kg', 500.00, 42.00, '50000000-0000-0000-0000-000000000003', true),
  ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000003', 'RM-ELA', 'Green Cardamom (Elaichi - 8mm)', 'हिरवी वेलची (8mm)', 'हरी इलायची (8mm)', 'kg', 10.00, 2400.00, '50000000-0000-0000-0000-000000000004', true),
  ('60000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000003', 'RM-KES', 'Kashmiri Mogra Saffron (Kesar)', 'काश्मिरी केशर', 'कश्मीरी केसर', 'g', 50.00, 280.00, NULL, true),
  ('60000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000004', 'RM-PCH-500', 'Food Grade 500ml Standy Pouches', '५०० मिली स्टँडी पाऊच', '500 मिली पाउच', 'Units', 1000.00, 2.80, '50000000-0000-0000-0000-000000000005', true),
  ('60000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000004', 'RM-PAN-BAG', 'Paneer Vacuum Barrier Bags', 'पनीर व्हॅक्यूम बॅग्ज', 'पनीर वैक्यूम बैग', 'Units', 1000.00, 3.50, '50000000-0000-0000-0000-000000000005', true),
  ('60000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000004', 'RM-BOX-250', 'Sweet Box Containers (250g)', 'मिठाई बॉक्सेस (२५० ग्रॅम)', 'मिठाई डिब्बे (250 ग्राम)', 'Units', 500.00, 5.20, NULL, true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 10. Customers (Retailers) Master
-- -----------------------------------------------------------------------------
INSERT INTO public.customers (
  id, organization_id, customer_code, business_name, owner_name, mobile, email, address, area, city, state, pincode, gstin, credit_limit, payment_terms_days, status, last_order_at
) VALUES
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'RET-001', 'ABC Retailers', 'Ramesh Patil', '9822012345', 'abc.retailers@gmail.com', 'Shop No. 4, Shivaji Chowk, Kothrud', 'Pune West', 'Pune', 'Maharashtra', '411038', '27AABCU9603R1ZM', 100000.00, 15, 'active', '2026-09-10 10:30:00+05:30'),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'RET-002', 'Shree Ganesh Stores', 'Suresh Shah', '9820154321', 'ganesh.stores.dadar@gmail.com', '12, Ranade Road, Near Station, Dadar West', 'Mumbai South', 'Mumbai', 'Maharashtra', '400028', '27BBPPS1092M1ZK', 150000.00, 15, 'active', '2026-09-12 11:15:00+05:30'),
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'RET-003', 'Sai Dairy Mart', 'Nitin Deshmukh', '9850067890', 'saidairy.nashik@yahoo.com', 'Plot 18, College Road, Near BYK College', 'Nashik Central', 'Nashik', 'Maharashtra', '422005', '27AATPD4489L1Z5', 75000.00, 7, 'active', '2026-09-14 09:45:00+05:30'),
  ('70000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'RET-004', 'Om General Stores', 'Rajesh Gupta', '9765432109', 'omstores.thane@outlook.com', 'G-7, Panchpakhadi, Opp. TMC Office', 'Thane Central', 'Thane', 'Maharashtra', '400602', '27CQRPG5512N1Z4', 80000.00, 15, 'active', '2026-09-08 16:00:00+05:30'),
  ('70000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'RET-005', 'Krishna Foods & Milk Bar', 'Anand Kulkarni', '9923111223', 'krishnafoods.kop@gmail.com', 'Station Road, Shahupuri 2nd Lane', 'Kolhapur City', 'Kolhapur', 'Maharashtra', '416001', '27AAZFK7734E1Z8', 120000.00, 15, 'active', '2026-09-15 14:20:00+05:30')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 11. Document Sequences Initialization
-- -----------------------------------------------------------------------------
INSERT INTO public.document_sequences (organization_id, document_type, prefix, current_year, last_number) VALUES
  ('00000000-0000-0000-0000-000000000001', 'order', 'MD-ORD', 2026, 1025),
  ('00000000-0000-0000-0000-000000000001', 'invoice', 'INV', 2026, 1035),
  ('00000000-0000-0000-0000-000000000001', 'payment', 'REC', 2026, 401),
  ('00000000-0000-0000-0000-000000000001', 'production', 'PROD', 2026, 96),
  ('00000000-0000-0000-0000-000000000001', 'batch', 'BAT', 2026, 12),
  ('00000000-0000-0000-0000-000000000001', 'expense', 'EXP', 2026, 6),
  ('00000000-0000-0000-0000-000000000001', 'transfer', 'TRF', 2026, 18)
ON CONFLICT (organization_id, document_type, current_year) DO UPDATE
SET last_number = EXCLUDED.last_number;

-- -----------------------------------------------------------------------------
-- 12. Production Runs Master
-- -----------------------------------------------------------------------------
INSERT INTO public.production_runs (
  id, organization_id, location_id, production_number, production_date, status, started_at, completed_at, notes
) VALUES
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'PROD-2026-089', '2026-09-10', 'completed', '2026-09-10 06:00:00+05:30', '2026-09-10 11:30:00+05:30', 'Basundi special formulation with 11% sugar.'),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'PROD-2026-094', '2026-09-16', 'completed', '2026-09-16 04:30:00+05:30', '2026-09-16 07:00:00+05:30', 'Morning buffalo milk pasteurization run.'),
  ('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'PROD-2026-095', '2026-09-17', 'completed', '2026-09-17 04:45:00+05:30', '2026-09-17 06:45:00+05:30', 'Cow milk standard dispatch run.'),
  ('90000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'PROD-2026-096', '2026-09-12', 'completed', '2026-09-12 08:00:00+05:30', '2026-09-12 13:00:00+05:30', 'Fresh Malai Paneer press & vacuum pack.')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 13. Batches Master
-- -----------------------------------------------------------------------------
INSERT INTO public.batches (
  id, organization_id, product_sku_id, production_run_id, batch_number, production_date, expiry_date, status, notes
) VALUES
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'A1092026', '2026-09-10', '2026-10-20', 'active', 'Slow-cooked in wide steam cauldrons. 40 days shelf-life at 4°C.'),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', NULL, 'B1092026', '2026-09-05', '2026-09-20', 'near_expiry', 'Artisanal pedha made with pure mawa and Kashmiri saffron.'),
  ('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000003', NULL, 'C1092026', '2026-09-01', '2026-09-22', 'near_expiry', 'Hung curd chakka blended with green cardamom.'),
  ('a1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000002', 'M1692026', '2026-09-16', '2026-09-19', 'active', 'Buffalo milk dispatch batch. FAT 6.8%, SNF 9.2%.'),
  ('a1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000003', 'M1792026', '2026-09-17', '2026-09-20', 'active', 'Cow fresh milk morning dispatch batch.'),
  ('a1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000004', 'P1292026', '2026-09-12', '2026-09-19', 'near_expiry', 'Vacuum sealed in multi-layer barrier pouches. Stored at 2°C.'),
  ('a1000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000008', NULL, 'G0182026', '2026-08-15', '2027-02-15', 'active', 'Traditional bilona churning. Moisture < 0.2%. FSSAI cleared.'),
  ('a1000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000011', NULL, 'R1492026', '2026-09-14', '2026-09-24', 'active', 'Prepared in wide copper cauldrons with heavy milk crusting.'),
  ('a1000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', NULL, 'A1192026', '2026-09-15', '2026-10-25', 'active', 'Standard sweetening recipe with 11% refined cane sugar.'),
  ('a1000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000010', NULL, 'K0892026', '2026-09-08', '2026-09-18', 'near_expiry', 'Granular mawa prepared for festival mithai manufacturers.')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 14. Batch Stock & Inventory Transactions Ledger
-- -----------------------------------------------------------------------------
INSERT INTO public.batch_stock (batch_id, location_id, quantity_on_hand, quantity_reserved) VALUES
  ('a1000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 77.00, 0.00),
  ('a1000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 55.00, 0.00),
  ('a1000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 32.00, 0.00),
  ('a1000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 695.00, 0.00),
  ('a1000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 548.00, 0.00),
  ('a1000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', 46.00, 0.00),
  ('a1000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', 90.00, 0.00),
  ('a1000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002', 84.00, 0.00),
  ('a1000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002', 200.00, 0.00),
  ('a1000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000002', 13.00, 0.00)
ON CONFLICT (batch_id, location_id) DO UPDATE
SET quantity_on_hand = EXCLUDED.quantity_on_hand;

-- Immutable inventory transaction logs for the initial production batches
INSERT INTO public.inventory_transactions (
  organization_id, location_id, product_sku_id, batch_id, transaction_type, quantity, reference_type, notes
) VALUES
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'production', 200.00, 'production_run', 'Initial production yield'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'sale', -50.00, 'invoice', 'INV-1018 sales dispatch'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'sale', -70.00, 'invoice', 'INV-1025 sales dispatch'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'damage', -3.00, 'damage', 'QC packaging seal defect');

-- -----------------------------------------------------------------------------
-- 15. Raw Material Transactions Ledger (Reflects true current stock)
-- -----------------------------------------------------------------------------
INSERT INTO public.raw_material_transactions (
  organization_id, location_id, raw_material_id, transaction_type, quantity, reference_type, notes
) VALUES
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'opening', 2950.00, 'opening_balance', 'Initial stock audit'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'purchase', 2500.00, 'purchase_order', 'Morning tanker procurement from Sangamner'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'production_consumption', -600.00, 'production_run', 'Basundi kettle 1 & 2 preparation'),

  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'opening', 3000.00, 'opening_balance', 'Initial stock audit'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'purchase', 3200.00, 'purchase_order', 'Morning tanker procurement from Shirwal Union'),

  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'opening', 405.00, 'opening_balance', 'Initial stock audit'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 'production_consumption', -85.00, 'production_run', 'Used in Basundi batch sweetening'),

  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000004', 'opening', 18.00, 'opening_balance', 'Initial stock audit'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000005', 'opening', 45.00, 'opening_balance', 'Initial stock audit'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000006', 'opening', 4215.00, 'opening_balance', 'Initial stock audit'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000006', 'damage', -15.00, 'damage', 'Nozzle seal defect during machine run'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000007', 'opening', 850.00, 'opening_balance', 'Initial stock audit'),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000008', 'opening', 1600.00, 'opening_balance', 'Initial stock audit');

-- -----------------------------------------------------------------------------
-- 16. Orders, Order Items, and Status History
-- -----------------------------------------------------------------------------
INSERT INTO public.orders (
  id, organization_id, customer_id, order_number, order_date, requested_delivery_date, status, subtotal, discount_amount, tax_amount, total_amount, payment_status, notes
) VALUES
  ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'MD-1018', '2026-09-06', '2026-09-07', 'delivered', 3800.00, 0.00, 0.00, 3800.00, 'paid', 'Regular weekly delivery.'),
  ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'MD-1025', '2026-09-10', '2026-09-11', 'delivered', 4250.00, 0.00, 0.00, 4250.00, 'paid', 'Urgent early morning delivery required before 8 AM.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (
  order_id, product_sku_id, quantity, unit_price, discount_amount, tax_percent, tax_amount, line_total
) VALUES
  ('b1000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 15.00, 120.00, 0.00, 0.00, 0.00, 1800.00),
  ('b1000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000003', 10.00, 180.00, 0.00, 0.00, 0.00, 1800.00),
  ('b1000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000014', 13.33, 15.00, 0.00, 0.00, 0.00, 200.00),

  ('b1000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', 20.00, 120.00, 0.00, 0.00, 0.00, 2400.00),
  ('b1000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', 10.00, 150.00, 0.00, 0.00, 0.00, 1500.00),
  ('b1000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000012', 10.00, 35.00, 0.00, 0.00, 0.00, 350.00);

INSERT INTO public.order_status_history (order_id, from_status, to_status, notes) VALUES
  ('b1000000-0000-0000-0000-000000000002', NULL, 'pending', 'Customer placed order via mobile portal'),
  ('b1000000-0000-0000-0000-000000000002', 'pending', 'confirmed', 'Order approved by dispatch desk'),
  ('b1000000-0000-0000-0000-000000000002', 'confirmed', 'preparing', 'Staged in cold room'),
  ('b1000000-0000-0000-0000-000000000002', 'preparing', 'dispatched', 'Loaded onto van MH-12-DT-4421'),
  ('b1000000-0000-0000-0000-000000000002', 'dispatched', 'delivered', 'Store receiver signature verified');

-- -----------------------------------------------------------------------------
-- 17. Invoices & Batch-Tracked Line Items
-- -----------------------------------------------------------------------------
INSERT INTO public.invoices (
  id, organization_id, customer_id, order_id, invoice_number, invoice_date, due_date, subtotal, discount_amount, tax_amount, total_amount, status
) VALUES
  ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'INV-1018', '2026-09-07', '2026-09-22', 3800.00, 0.00, 0.00, 3800.00, 'paid'),
  ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'INV-1025', '2026-09-11', '2026-09-26', 4250.00, 0.00, 0.00, 4250.00, 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.invoice_items (
  invoice_id, product_sku_id, batch_id, quantity, rate, discount_amount, tax_percent, tax_amount, line_total
) VALUES
  ('c1000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 15.00, 120.00, 0.00, 0.00, 0.00, 1800.00),
  ('c1000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 10.00, 180.00, 0.00, 0.00, 0.00, 1800.00),
  ('c1000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 20.00, 120.00, 0.00, 0.00, 0.00, 2400.00),
  ('c1000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 10.00, 150.00, 0.00, 0.00, 0.00, 1500.00),
  ('c1000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000012', NULL, 10.00, 35.00, 0.00, 0.00, 0.00, 350.00);

-- -----------------------------------------------------------------------------
-- 18. Payments & Payment Allocations
-- -----------------------------------------------------------------------------
INSERT INTO public.payments (
  id, organization_id, customer_id, payment_number, payment_date, amount, payment_method, reference_number, notes
) VALUES
  ('d1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'PAY-401', '2026-09-08', 3800.00, 'bank_transfer', 'NEFT-20260908129', 'Settlement for Invoice INV-1018'),
  ('d1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'PAY-402', '2026-09-15', 4250.00, 'upi', 'UPI/229048172901', 'Settlement for Invoice INV-1025')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payment_allocations (payment_id, invoice_id, allocated_amount) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 3800.00),
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 4250.00);

-- -----------------------------------------------------------------------------
-- 19. Authoritative Customer Financial Ledger (Double-Entry Balance)
-- -----------------------------------------------------------------------------
-- ABC Retailers: Outstanding balance is exactly ₹28,500
INSERT INTO public.ledger_entries (
  organization_id, customer_id, entry_date, entry_type, reference_type, reference_id, debit, credit, description
) VALUES
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-09-01', 'opening_balance', 'manual', NULL, 28500.00, NULL, 'Opening audited outstanding balance'),
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-09-07', 'invoice', 'invoices', 'c1000000-0000-0000-0000-000000000001', 3800.00, NULL, 'Invoice INV-1018 sales charge'),
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-09-08', 'payment', 'payments', 'd1000000-0000-0000-0000-000000000001', NULL, 3800.00, 'Payment received NEFT-20260908129'),
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-09-11', 'invoice', 'invoices', 'c1000000-0000-0000-0000-000000000002', 4250.00, NULL, 'Invoice INV-1025 sales charge'),
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '2026-09-15', 'payment', 'payments', 'd1000000-0000-0000-0000-000000000002', NULL, 4250.00, 'Payment received UPI/229048172901'),

  -- Other retailers opening balances matching mockData.ts
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002', '2026-09-01', 'opening_balance', 'manual', NULL, 45200.00, NULL, 'Opening audited outstanding balance'),
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003', '2026-09-01', 'opening_balance', 'manual', NULL, 12400.00, NULL, 'Opening audited outstanding balance'),
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', '2026-09-01', 'opening_balance', 'manual', NULL, 18900.00, NULL, 'Opening audited outstanding balance'),
  ('00000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000005', '2026-09-01', 'opening_balance', 'manual', NULL, 34000.00, NULL, 'Opening audited outstanding balance');

-- -----------------------------------------------------------------------------
-- 20. Expense Categories & Expenses
-- -----------------------------------------------------------------------------
INSERT INTO public.expense_categories (id, organization_id, name, is_active) VALUES
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Fuel & Logistics', true),
  ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Electricity & Utilities', true),
  ('e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Packaging Material', true),
  ('e0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Maintenance & Repairs', true),
  ('e0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Salary & Labor Wages', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.expenses (
  organization_id, category_id, amount, expense_date, payment_method, paid_to, reference_number, notes
) VALUES
  ('00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 4200.00, '2026-09-16', 'upi', 'Indian Oil Fuel Pump (Shirwal)', 'UPI-9921448', 'Diesel for Refrigerated Van MH-12-DT-4421'),
  ('00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 48500.00, '2026-09-15', 'bank_transfer', 'MSEDCL Maharashtra Electricity', 'MSEDCL-SEP26', 'Processing plant & cold chain monthly power bill'),
  ('00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000004', 3800.00, '2026-09-12', 'cash', 'Shree Refrigeration Works', 'CASH-VOUCH-18', 'Cold room B compressor Freon top-up & gasket replacement'),
  ('00000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000005', 85000.00, '2026-09-10', 'bank_transfer', 'Staff Payroll (12 Employees)', 'PAYROLL-SEP-1', 'Processing plant operators & technicians semi-monthly wages');

-- -----------------------------------------------------------------------------
-- 21. Freshness Radar: Expiry Rules & Active Alerts
-- -----------------------------------------------------------------------------
INSERT INTO public.expiry_rules (
  id, organization_id, title, days_before_expiry, severity, target_customer, target_internal, enabled
) VALUES
  ('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '5 Days Pre-Expiry Early Notice', 5, 'soon', true, true, true),
  ('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '2 Days Urgent Pre-Expiry Warning', 2, 'urgent', true, true, true),
  ('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Same Day Expiry Immediate Alert', 0, 'urgent', false, true, true),
  ('f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '7 Days Upcoming Stock Sweep', 7, 'upcoming', false, true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.expiry_alerts (
  batch_id, location_id, customer_id, quantity, severity, status, generated_at
) VALUES
  ('a1000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000002', NULL, 13.00, 'urgent', 'active', now() - interval '1 day'),
  ('a1000000-0000-0000-0000-000000000006', NULL, '70000000-0000-0000-0000-000000000001', 8.00, 'urgent', 'active', now() - interval '12 hours'),
  ('a1000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', NULL, 55.00, 'urgent', 'active', now() - interval '6 hours'),
  ('a1000000-0000-0000-0000-000000000003', NULL, '70000000-0000-0000-0000-000000000001', 6.00, 'soon', 'active', now() - interval '3 hours');

-- -----------------------------------------------------------------------------
-- 22. Audit Logs (Sample Operational Traceability)
-- -----------------------------------------------------------------------------
INSERT INTO public.audit_logs (organization_id, action, entity_type, entity_id, new_data) VALUES
  ('00000000-0000-0000-0000-000000000001', 'create', 'orders', 'b1000000-0000-0000-0000-000000000002', '{"order_number": "MD-1025", "total_amount": 4250.00, "customer": "ABC Retailers"}'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'status_change', 'orders', 'b1000000-0000-0000-0000-000000000002', '{"from": "dispatched", "to": "delivered"}'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'create', 'invoices', 'c1000000-0000-0000-0000-000000000002', '{"invoice_number": "INV-1025", "total_amount": 4250.00}'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'create', 'payments', 'd1000000-0000-0000-0000-000000000002', '{"payment_number": "PAY-402", "amount": 4250.00, "method": "upi"}'::jsonb);
