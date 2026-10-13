import { supabase } from '../lib/supabase';
import { DeliveryUnit, DeliveryTrip, DeliveryTripInvoiceItem, Invoice } from '../types/dairy';
import { getEffectiveOrgId } from './orgService';
import ExcelJS from 'exceljs';

export const deliveryService = {
  /**
   * Fetch all delivery units with trip assignment statistics.
   */
  async fetchDeliveryUnits(): Promise<DeliveryUnit[]> {
    const { data, error } = await supabase
      .from('delivery_units')
      .select(`
        id,
        organization_id,
        chalan_number,
        name,
        vehicle_number,
        driver_name,
        driver_phone,
        out_time,
        is_active,
        created_at,
        updated_at,
        created_by,
        updated_by,
        delivery_trips (id)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((u: any): DeliveryUnit => ({
      id: u.id,
      organizationId: u.organization_id,
      chalanNumber: u.chalan_number,
      name: u.name,
      vehicleNumber: u.vehicle_number,
      driverName: u.driver_name,
      driverPhone: u.driver_phone || undefined,
      outTime: u.out_time || undefined,
      isActive: Boolean(u.is_active),
      createdAt: u.created_at,
      updatedAt: u.updated_at,
      createdBy: u.created_by,
      updatedBy: u.updated_by,
      tripsCount: Array.isArray(u.delivery_trips) ? u.delivery_trips.length : 0,
    }));
  },

  /**
   * Create a new delivery unit.
   * Chalan number is generated automatically by database sequence trigger.
   */
  async createDeliveryUnit(params: {
    name: string;
    vehicleNumber: string;
    driverName: string;
    driverPhone?: string;
    outTime?: string;
    isActive?: boolean;
    userId?: string;
  }): Promise<DeliveryUnit> {
    const orgId = await getEffectiveOrgId();

    // Generate atomic sequence preview if needed or let DB trigger generate it
    let chalanNum = '';
    try {
      const { data: seq } = await supabase.rpc('next_document_number', {
        p_org_id: orgId,
        p_doc_type: 'chalan',
        p_prefix: 'CHLN',
        p_padding: 4,
      });
      if (seq) chalanNum = seq;
    } catch {
      chalanNum = `CHLN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const { data, error } = await supabase
      .from('delivery_units')
      .insert({
        organization_id: orgId,
        chalan_number: chalanNum,
        name: params.name.trim(),
        vehicle_number: params.vehicleNumber.trim().toUpperCase(),
        driver_name: params.driverName.trim(),
        driver_phone: params.driverPhone?.trim() || null,
        out_time: params.outTime?.trim() || null,
        is_active: params.isActive !== undefined ? params.isActive : true,
        created_by: params.userId || null,
      })
      .select('*')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      organizationId: data.organization_id,
      chalanNumber: data.chalan_number,
      name: data.name,
      vehicleNumber: data.vehicle_number,
      driverName: data.driver_name,
      driverPhone: data.driver_phone || undefined,
      outTime: data.out_time || undefined,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      tripsCount: 0,
    };
  },

  /**
   * Update delivery unit details.
   * Chalan number is immutable and preserved by trigger.
   */
  async updateDeliveryUnit(id: string, params: {
    name?: string;
    vehicleNumber?: string;
    driverName?: string;
    driverPhone?: string;
    outTime?: string;
    isActive?: boolean;
    userId?: string;
  }): Promise<void> {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (params.name !== undefined) updatePayload.name = params.name.trim();
    if (params.vehicleNumber !== undefined) updatePayload.vehicle_number = params.vehicleNumber.trim().toUpperCase();
    if (params.driverName !== undefined) updatePayload.driver_name = params.driverName.trim();
    if (params.driverPhone !== undefined) updatePayload.driver_phone = params.driverPhone?.trim() || null;
    if (params.outTime !== undefined) updatePayload.out_time = params.outTime?.trim() || null;
    if (params.isActive !== undefined) updatePayload.is_active = params.isActive;
    if (params.userId) updatePayload.updated_by = params.userId;

    const { error } = await supabase
      .from('delivery_units')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Delete a delivery unit only when safe.
   * Throws an explicit, helpful error if unit has existing trips to preserve audit history.
   */
  async deleteDeliveryUnit(id: string): Promise<void> {
    // 1. Check if unit is associated with any delivery trip
    const { count, error: countErr } = await supabase
      .from('delivery_trips')
      .select('id', { count: 'exact', head: true })
      .eq('delivery_unit_id', id);

    if (countErr) throw countErr;

    if (count && count > 0) {
      throw new Error(
        `This delivery unit is linked to ${count} delivery trip(s) in the system and cannot be deleted to preserve historical dispatch records. You can deactivate it instead to prevent future assignments.`
      );
    }

    // 2. Perform safe deletion
    const { error } = await supabase
      .from('delivery_units')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Toggle delivery unit active status (deactivation alternative to deletion).
   */
  async toggleDeliveryUnitActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('delivery_units')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Fetch all delivery trips with unit and invoice summary.
   */
  async fetchDeliveryTrips(): Promise<DeliveryTrip[]> {
    const { data: tripsData, error } = await supabase
      .from('delivery_trips')
      .select(`
        id,
        organization_id,
        trip_number,
        delivery_unit_id,
        vehicle_number,
        driver_name,
        driver_phone,
        status,
        out_time,
        assigned_at,
        assigned_by,
        completed_at,
        completed_by,
        notes,
        created_at,
        updated_at,
        delivery_units (
          id,
          name,
          vehicle_number,
          driver_name
        ),
        delivery_trip_invoices (
          id,
          invoice_id,
          invoices (
            id,
            invoice_number,
            total_amount
          )
        )
      `)
      .order('assigned_at', { ascending: false });

    if (error) throw error;

    return (tripsData || []).map((t: any): DeliveryTrip => {
      const tripInvoices = t.delivery_trip_invoices || [];
      const totalAmount = tripInvoices.reduce(
        (sum: number, ti: any) => sum + (Number(ti.invoices?.total_amount) || 0),
        0
      );

      const unit = Array.isArray(t.delivery_units) ? t.delivery_units[0] : t.delivery_units;
      return {
        id: t.id,
        organizationId: t.organization_id,
        tripNumber: t.trip_number,
        deliveryUnitId: t.delivery_unit_id,
        deliveryUnitName: unit?.name || 'Assigned Unit',
        vehicleNumber: t.vehicle_number || unit?.vehicle_number || '',
        driverName: t.driver_name || unit?.driver_name || '',
        driverPhone: t.driver_phone || undefined,
        status: t.status as any,
        outTime: t.out_time ? new Date(t.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        assignedAt: t.assigned_at,
        assignedBy: t.assigned_by || undefined,
        completedAt: t.completed_at || undefined,
        completedBy: t.completed_by || undefined,
        notes: t.notes || undefined,
        invoicesCount: tripInvoices.length,
        assignedInvoiceCount: tripInvoices.length,
        totalAmount,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      };
    });
  },

  /**
   * Fetch detailed trip information including line-items of all assigned invoices.
   */
  async fetchDeliveryTripDetails(tripId: string): Promise<DeliveryTrip> {
    const { data: trip, error: tripErr } = await supabase
      .from('delivery_trips')
      .select(`
        id,
        organization_id,
        trip_number,
        delivery_unit_id,
        vehicle_number,
        driver_name,
        driver_phone,
        status,
        out_time,
        assigned_at,
        assigned_by,
        completed_at,
        completed_by,
        notes,
        created_at,
        updated_at,
        delivery_units (
          id,
          name,
          vehicle_number,
          driver_name,
          chalan_number
        )
      `)
      .eq('id', tripId)
      .single();

    if (tripErr) throw tripErr;

    // Fetch assigned invoices with full customer addresses and line items
    const { data: tripInvoicesData, error: tiErr } = await supabase
      .from('delivery_trip_invoices')
      .select(`
        id,
        invoice_id,
        invoices (
          id,
          invoice_number,
          order_id,
          invoice_date,
          total_amount,
          status,
          orders (order_number),
          customers (
            id,
            business_name,
            address,
            area,
            city,
            pincode
          ),
          invoice_items (
            id,
            product_sku_id,
            quantity,
            rate,
            line_total,
            product_skus (
              pack_size,
              unit,
              products (id, name)
            )
          )
        )
      `)
      .eq('trip_id', tripId);

    if (tiErr) throw tiErr;

    const invoices: DeliveryTripInvoiceItem[] = (tripInvoicesData || []).map((ti: any) => {
      const inv = ti.invoices;
      const cust = inv?.customers;

      const fullAddressParts = [cust?.address, cust?.area, cust?.city, cust?.pincode].filter(Boolean);
      const fullShopAddress = fullAddressParts.length > 0 ? fullAddressParts.join(', ') : 'Registered Shop Address';

      const items = (inv?.invoice_items || []).map((it: any) => {
        const prod = it.product_skus?.products;
        return {
          productId: prod?.id || it.product_sku_id,
          productName: prod?.name || 'Dairy Product',
          packSize: it.product_skus?.pack_size,
          unit: it.product_skus?.pack_size || it.product_skus?.unit || 'pack',
          quantity: Number(it.quantity),
          rate: Number(it.rate),
          lineTotal: Number(it.line_total),
        };
      });

      return {
        id: ti.id,
        invoiceId: inv?.id,
        invoiceNumber: inv?.invoice_number || 'INV',
        orderId: inv?.order_id || undefined,
        orderNumber: inv?.orders?.order_number || undefined,
        retailerId: cust?.id || '',
        retailerName: cust?.business_name || 'Retailer',
        retailerAddress: fullShopAddress,
        invoiceDate: inv?.invoice_date || '',
        totalAmount: Number(inv?.total_amount || 0),
        status: inv?.status,
        items,
      };
    });

    const totalAmount = invoices.reduce((acc, i) => acc + i.totalAmount, 0);

    const unit = Array.isArray((trip as any).delivery_units)
      ? (trip as any).delivery_units[0]
      : (trip as any).delivery_units;

    return {
      id: trip.id,
      organizationId: trip.organization_id,
      tripNumber: trip.trip_number,
      deliveryUnitId: trip.delivery_unit_id,
      deliveryUnitName: unit?.name || 'Delivery Unit',
      vehicleNumber: trip.vehicle_number || unit?.vehicle_number || '',
      driverName: trip.driver_name || unit?.driver_name || '',
      driverPhone: trip.driver_phone || undefined,
      status: trip.status as any,
      outTime: trip.out_time ? new Date(trip.out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
      assignedAt: trip.assigned_at,
      assignedBy: trip.assigned_by || undefined,
      completedAt: trip.completed_at || undefined,
      completedBy: trip.completed_by || undefined,
      notes: trip.notes || undefined,
      invoicesCount: invoices.length,
      assignedInvoiceCount: invoices.length,
      totalAmount,
      invoices,
      createdAt: trip.created_at,
      updatedAt: trip.updated_at,
    };
  },

  /**
   * Atomically assign selected Ready invoices to a delivery trip.
   */
  async assignDeliveryTrip(params: {
    deliveryUnitId: string;
    invoiceIds: string[];
    outTime?: string;
    notes?: string;
    userId?: string;
  }): Promise<{ success: boolean; trip_id: string; trip_number: string; assigned_count: number }> {
    const { data, error } = await supabase.rpc('assign_delivery_trip', {
      p_delivery_unit_id: params.deliveryUnitId,
      p_invoice_ids: params.invoiceIds,
      p_out_time: params.outTime ? new Date(params.outTime).toISOString() : new Date().toISOString(),
      p_notes: params.notes || null,
      p_user_id: params.userId || null,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Atomically mark delivery trip as completed.
   * All assigned invoices transition from 'dispatched' to 'delivered'.
   */
  async completeDeliveryTrip(tripId: string, userId?: string): Promise<{ success: boolean; delivered_invoices_count: number }> {
    const { data, error } = await supabase.rpc('complete_delivery_trip', {
      p_trip_id: tripId,
      p_user_id: userId || null,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Generates a real, professionally styled .xlsx Excel Driver Sheet.
   * Exactly matches columns required by Module 3.2:
   * 1. Invoice #
   * 2. Date
   * 3. Retailer Name
   * 4. Shop Address
   * 5. Product / Item
   * 6. Quantity
   *
   * Formats columns, repeats invoice details per line item, and triggers browser download.
   */
  async generateDriverSheetExcel(params: {
    tripNumber: string;
    deliveryUnitName?: string;
    vehicleNumber?: string;
    driverName?: string;
    outTime?: string;
    invoices: DeliveryTripInvoiceItem[];
  }): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Madhav Dairy ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Driver Sheet', {
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
      views: [{ showGridLines: true }],
    });

    // Brand Title Header
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'MADHAV DAIRY — OFFICIAL DELIVERY DRIVER SHEET';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Dark Blue
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Trip Metadata Bar
    sheet.mergeCells('A2:F2');
    const metaCell = sheet.getCell('A2');
    const metaText = [
      `Chalan / Trip #: ${params.tripNumber}`,
      params.deliveryUnitName ? `Unit: ${params.deliveryUnitName}` : null,
      params.vehicleNumber ? `Vehicle: ${params.vehicleNumber}` : null,
      params.driverName ? `Driver: ${params.driverName}` : null,
      params.outTime ? `Out Time: ${params.outTime}` : null,
      `Date: ${new Date().toLocaleDateString('en-IN')}`,
    ].filter(Boolean).join('   |   ');

    metaCell.value = metaText;
    metaCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Light Slate
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 24;

    // Empty separator row
    sheet.getRow(3).height = 10;

    // Define table columns
    sheet.getRow(4).values = [
      'Invoice #',
      'Date',
      'Retailer Name',
      'Shop Address',
      'Product / Item',
      'Quantity',
    ];

    const headerRow = sheet.getRow(4);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Royal Blue
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    // Populate line items
    let rowIndex = 5;
    let totalQty = 0;

    params.invoices.forEach((inv) => {
      if (!inv.items || inv.items.length === 0) {
        // Fallback row if invoice has no line items
        const row = sheet.getRow(rowIndex++);
        row.values = [
          inv.invoiceNumber,
          inv.invoiceDate,
          inv.retailerName,
          inv.retailerAddress,
          'Dairy Goods Delivery',
          1,
        ];
        totalQty += 1;
      } else {
        inv.items.forEach((item) => {
          const row = sheet.getRow(rowIndex++);
          const qtyString = `${item.quantity} ${item.unit || item.packSize || 'pack'}`;
          row.values = [
            inv.invoiceNumber,
            inv.invoiceDate,
            inv.retailerName,
            inv.retailerAddress,
            item.packSize ? `${item.productName} (${item.packSize})` : item.productName,
            qtyString,
          ];
          totalQty += item.quantity;
        });
      }
    });

    // Style data rows with subtle alternating fill
    for (let i = 5; i < rowIndex; i++) {
      const row = sheet.getRow(i);
      row.height = 22;
      const isEven = i % 2 === 0;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Arial', size: 10, color: { argb: 'FF0F172A' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
        // Alignments: Invoice #, Date, Quantity centered; Name & Address left-aligned
        if (colNumber === 1 || colNumber === 2 || colNumber === 6) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: colNumber === 4 };
        }
      });
    }

    // Summary Footer Row
    const summaryRow = sheet.getRow(rowIndex);
    summaryRow.height = 24;
    summaryRow.values = [
      'TOTALS',
      '',
      `${params.invoices.length} Invoices Assigned`,
      '',
      '',
      `${totalQty} Total Units`,
    ];
    summaryRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF334155' } },
        bottom: { style: 'double', color: { argb: 'FF334155' } },
      };
      if (colNumber === 1 || colNumber === 6) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    // Driver & Receiving Signatures Section
    const sigStart = rowIndex + 3;
    sheet.getRow(sigStart).values = [
      'Driver Signature: _______________________',
      '',
      '',
      'Dispatch Officer: _______________________',
      '',
      'Store Inward Seal: ______________________',
    ];
    sheet.getRow(sigStart).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };

    // Set readable column widths
    sheet.columns = [
      { key: 'invoice_no', width: 18 },
      { key: 'date', width: 14 },
      { key: 'retailer', width: 28 },
      { key: 'address', width: 42 },
      { key: 'product', width: 30 },
      { key: 'quantity', width: 18 },
    ];

    // Generate real Excel binary buffer and trigger browser download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const safeTripName = params.tripNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Driver_Sheet_${safeTripName}_${dateStr}.xlsx`;

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Convenience method: fetch trip details and trigger driver sheet download.
   */
  async downloadDriverSheet(tripId: string): Promise<void> {
    const trip = await this.fetchDeliveryTripDetails(tripId);
    await this.generateDriverSheetExcel({
      tripNumber: trip.tripNumber,
      deliveryUnitName: trip.deliveryUnitName,
      vehicleNumber: trip.vehicleNumber,
      driverName: trip.driverName,
      outTime: trip.outTime,
      invoices: trip.invoices || [],
    });
  },
};
