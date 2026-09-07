import type { Customer, MonthlyBill, MilkEntry } from '../types';
import { formatQuantity, formatCurrency } from '../types';
import { format, getDaysInMonth } from 'date-fns';
import { APP_LOGO_BASE64 } from './logoBase64';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfCrossPlatform, type PdfDownloadResult } from './pdfDownloader';

export interface BillPdfData {
  farmName: string;
  customer: Customer;
  bill?: MonthlyBill;
  entries: MilkEntry[];
  year: number;
  month: number;
  rate: number;
}

export function generateBillHtml(data: BillPdfData): string {
  const { farmName, customer, bill, entries, year, month, rate } = data;
  const monthDate = new Date(year, month - 1, 1);
  const monthName = format(monthDate, 'MMMM yyyy');
  const daysCount = getDaysInMonth(monthDate);

  // Group entries by date
  const morningMap = new Map<string, MilkEntry>();
  const eveningMap = new Map<string, MilkEntry>();

  entries.forEach((e) => {
    if (e.batch === 'evening') {
      eveningMap.set(e.entry_date, e);
    } else {
      morningMap.set(e.entry_date, e);
    }
  });

  let totalLitres = 0;
  const tableRows: string[] = [];

  for (let day = 1; day <= daysCount; day++) {
    const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const mEntry = morningMap.get(dStr);
    const eEntry = eveningMap.get(dStr);

    const mQty = mEntry && mEntry.status === 'delivered' ? (mEntry.quantity_litre || 0) : 0;
    const eQty = eEntry && eEntry.status === 'delivered' ? (eEntry.quantity_litre || 0) : 0;
    const dayTotal = mQty + eQty;
    totalLitres += dayTotal;

    const mDisplay = !mEntry ? '—' : mEntry.status === 'no_milk' ? 'No Milk' : formatQuantity(mEntry.quantity_litre || 0);
    const eDisplay = !eEntry ? '—' : eEntry.status === 'no_milk' ? 'No Milk' : formatQuantity(eEntry.quantity_litre || 0);
    const dayTotalDisplay = dayTotal > 0 ? `${dayTotal} L` : '—';

    // Only render days up to today if viewing current month, or all days if past month
    tableRows.push(`
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 8px 12px; font-weight: 500;">${format(new Date(dStr + 'T00:00:00'), 'dd MMM (EEE)')}</td>
        <td style="padding: 8px 12px; text-align: center;">${mDisplay}</td>
        <td style="padding: 8px 12px; text-align: center;">${eDisplay}</td>
        <td style="padding: 8px 12px; text-align: right; font-weight: 600;">${dayTotalDisplay}</td>
      </tr>
    `);
  }

  const finalLitres = bill ? bill.total_litres : parseFloat(totalLitres.toFixed(2));
  const finalAmount = bill ? bill.total_amount : parseFloat((finalLitres * rate).toFixed(2));
  const paidAmount = bill ? bill.paid_amount : 0;
  const balance = bill ? bill.balance_amount : finalAmount;
  const status = bill ? bill.status.toUpperCase() : balance <= 0 ? 'PAID' : 'PENDING';

  const statusColor = status === 'PAID' ? '#16a34a' : status === 'PARTIAL' ? '#ca8a04' : '#dc2626';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Milk Bill - ${customer.name} - ${monthName}</title>
    <style>
      @page { size: A4 portrait; margin: 15mm; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #1e293b;
        background: #ffffff;
        margin: 0;
        padding: 24px;
        line-height: 1.5;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #22c55e;
        padding-bottom: 16px;
        margin-bottom: 20px;
      }
      .farm-title {
        font-size: 24px;
        font-weight: 800;
        color: #15803d;
      }
      .tagline {
        font-size: 12px;
        color: #64748b;
        margin-top: 2px;
      }
      .bill-badge {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 13px;
        font-weight: 700;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        background: #f8fafc;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 20px;
      }
      .info-label {
        font-size: 11px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .info-value {
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
        margin-top: 2px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 13px;
      }
      th {
        background: #f1f5f9;
        padding: 10px 12px;
        font-weight: 700;
        color: #334155;
        border-bottom: 2px solid #cbd5e1;
      }
      .summary-box {
        margin-left: auto;
        width: 280px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        font-size: 13px;
      }
      .summary-total {
        border-top: 2px solid #cbd5e1;
        margin-top: 8px;
        padding-top: 8px;
        font-size: 16px;
        font-weight: 800;
        color: #0f172a;
      }
      .status-stamp {
        display: inline-block;
        border: 2px solid ${statusColor};
        color: ${statusColor};
        font-weight: 900;
        font-size: 14px;
        padding: 4px 14px;
        border-radius: 8px;
        transform: rotate(-5deg);
        text-align: center;
        letter-spacing: 1px;
      }
      .footer {
        text-align: center;
        margin-top: 30px;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
        font-size: 12px;
        color: #94a3b8;
      }
      @media print {
        body { padding: 0; }
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div style="display: flex; align-items: center; gap: 14px;">
        <img src="${APP_LOGO_BASE64}" alt="${farmName}" style="width: 70px; height: 70px; object-fit: contain; border-radius: 12px; border: 1px solid #bbf7d0;" />
        <div>
          <div class="farm-title">${farmName}</div>
          <div class="tagline">Fresh from Our Farm to Your Family</div>
        </div>
      </div>
      <div style="text-align: right;">
        <span class="bill-badge">MONTHLY MILK BILL</span>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Billing Period: <strong>${monthName}</strong></div>
      </div>
    </div>

    <div class="info-grid">
      <div>
        <div class="info-label">Customer Name</div>
        <div class="info-value">${customer.name}</div>
        ${customer.phone ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">📞 ${customer.phone}</div>` : ''}
        ${customer.address ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">📍 ${customer.address}</div>` : ''}
      </div>
      <div>
        <div class="info-label">Delivery Schedule</div>
        <div class="info-value">
          ${customer.batch === 'both' ? 'Morning and Evening' : customer.batch === 'morning' ? 'Morning' : 'Evening'}
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
          Applicable Rate: <strong>₹${rate} / Litre</strong>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Date</th>
          <th style="text-align: center;">Morning (L)</th>
          <th style="text-align: center;">Evening (L)</th>
          <th style="text-align: right;">Day Total</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows.join('')}
      </tbody>
    </table>

    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div class="status-stamp">${status}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 8px;">Generated on ${format(new Date(), 'dd MMMM yyyy, hh:mm a')}</div>
      </div>

      <div class="summary-box">
        <div class="summary-row">
          <span style="color: #64748b;">Total Milk:</span>
          <span style="font-weight: 700;">${finalLitres} L</span>
        </div>
        <div class="summary-row">
          <span style="color: #64748b;">Rate per Litre:</span>
          <span>₹${rate}</span>
        </div>
        <div class="summary-row">
          <span style="color: #64748b;">Total Amount:</span>
          <span style="font-weight: 700;">${formatCurrency(finalAmount)}</span>
        </div>
        <div class="summary-row">
          <span style="color: #16a34a;">Amount Paid:</span>
          <span style="font-weight: 700; color: #16a34a;">- ${formatCurrency(paidAmount)}</span>
        </div>
        <div class="summary-row summary-total">
          <span>Pending Balance:</span>
          <span style="color: ${balance > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(balance)}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      Thank you for your business! For queries, please contact ${farmName}.
    </div>

    <script>
      window.onload = function() {
        window.print();
      };
    </script>
  </body>
  </html>
  `;
}

/**
 * Downloads a clean, professional individual customer bill PDF (A4 format)
 * Works on desktop browsers and mobile (Capacitor Android).
 */
export async function downloadCustomerBillPdf(data: BillPdfData): Promise<PdfDownloadResult> {
  const { farmName, customer, bill, entries, year, month, rate } = data;
  const monthDate = new Date(year, month - 1, 1);
  const monthName = format(monthDate, 'MMMM yyyy');
  const daysCount = getDaysInMonth(monthDate);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header Banner
  doc.setFillColor(21, 128, 61); // Green #15803d
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Farm Logo
  try {
    doc.addImage(APP_LOGO_BASE64, 'PNG', margin, 4, 20, 20);
  } catch (e) {
    console.warn('Could not add logo to customer bill PDF:', e);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(farmName.toUpperCase(), margin + 24, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(220, 252, 231);
  doc.text('Fresh from Our Farm to Your Family', margin + 24, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('MILK BILL & INVOICE', pageWidth - margin, 11, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(254, 240, 138); // Yellow accent
  doc.text(`Month: ${monthName}`, pageWidth - margin, 18, { align: 'right' });

  // Customer & Bill Info Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 32, pageWidth - margin * 2, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Customer: ${customer.name}`, margin + 4, 39);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const phoneText = customer.phone ? `Phone: ${customer.phone}` : 'Phone: —';
  const batchText = `Batch: ${customer.batch === 'both' ? 'Morning & Evening' : customer.batch === 'evening' ? 'Evening' : 'Morning'}`;
  doc.text(`${phoneText}  •  ${batchText}`, margin + 4, 45);
  if (customer.address) {
    doc.text(`Address: ${customer.address}`, margin + 4, 50);
  }

  // Right side of info box: Rate & Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(22, 101, 52);
  doc.text(`Rate: Rs. ${rate} / Litre`, pageWidth - margin - 4, 39, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy')}`, pageWidth - margin - 4, 45, { align: 'right' });

  // Daily entries map
  const morningMap = new Map<string, MilkEntry>();
  const eveningMap = new Map<string, MilkEntry>();
  entries.forEach((e) => {
    if (e.batch === 'evening') eveningMap.set(e.entry_date, e);
    else morningMap.set(e.entry_date, e);
  });

  const tableBody: string[][] = [];
  let calculatedTotalLitres = 0;

  for (let day = 1; day <= daysCount; day++) {
    const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const mEntry = morningMap.get(dStr);
    const eEntry = eveningMap.get(dStr);

    const mQty = mEntry && mEntry.status === 'delivered' ? (mEntry.quantity_litre || 0) : 0;
    const eQty = eEntry && eEntry.status === 'delivered' ? (eEntry.quantity_litre || 0) : 0;
    const dayTotal = mQty + eQty;
    calculatedTotalLitres += dayTotal;

    const mDisplay = !mEntry ? '—' : mEntry.status === 'no_milk' ? 'No Milk' : `${mEntry.quantity_litre || 0} L`;
    const eDisplay = !eEntry ? '—' : eEntry.status === 'no_milk' ? 'No Milk' : `${eEntry.quantity_litre || 0} L`;
    const dayTotalDisplay = dayTotal > 0 ? `${dayTotal.toFixed(2)} L` : '—';

    tableBody.push([
      format(new Date(dStr + 'T00:00:00'), 'dd MMM (EEE)'),
      mDisplay,
      eDisplay,
      dayTotalDisplay,
    ]);
  }

  const finalLitres = bill ? bill.total_litres : parseFloat(calculatedTotalLitres.toFixed(2));
  const totalAmount = bill ? bill.total_amount : parseFloat((finalLitres * rate).toFixed(2));
  const paidAmount = bill ? bill.paid_amount : 0;
  const balance = bill ? bill.balance_amount : parseFloat(Math.max(0, totalAmount - paidAmount).toFixed(2));
  const statusLabel = balance <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY PAID' : 'PENDING';

  autoTable(doc, {
    head: [['Date', 'Morning Batch', 'Evening Batch', 'Daily Total']],
    body: tableBody,
    foot: [['TOTAL DELIVERED', '—', '—', `${finalLitres} Litres`]],
    startY: 58,
    margin: { left: margin, right: margin, bottom: 42, top: 18 },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    footStyles: {
      fillColor: [20, 83, 45],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'right',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 40, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 46 },
      2: { halign: 'center', cellWidth: 46 },
      3: { halign: 'right', cellWidth: 50, fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (hookData) => {
      // Page footer only
      const totalPages = (doc.internal as any).getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${hookData.pageNumber} of ${totalPages} • ${farmName} - Fresh from Our Farm to Your Family`, margin, pageHeight - 6);
    },
  });

  // Draw bill calculation summary box after autoTable has completed execution
  const lastTable = (doc as any).lastAutoTable;
  let finalY = lastTable && typeof lastTable.finalY === 'number' ? lastTable.finalY + 4 : 210;
  if (finalY + 30 > pageHeight - 12) {
    doc.addPage();
    finalY = 20;
  }

  // Summary card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, finalY, pageWidth - margin * 2, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Litres: ${finalLitres} L  @  Rs. ${rate}/L`, margin + 4, finalY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Bill: Rs. ${totalAmount.toLocaleString('en-IN')}`, margin + 4, finalY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(22, 101, 52);
  doc.text(`Amount Paid: Rs. ${paidAmount.toLocaleString('en-IN')}`, margin + 4, finalY + 21);

  // Right side: Pending Balance and Status
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(balance > 0 ? 185 : 22, balance > 0 ? 28 : 101, balance > 0 ? 28 : 52);
  doc.text(`Pending: Rs. ${balance.toLocaleString('en-IN')}`, pageWidth - margin - 4, finalY + 11, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Status: ${statusLabel}`, pageWidth - margin - 4, finalY + 19, { align: 'right' });

  // Format filename strictly as username_month_bill.pdf
  const cleanCustomer = customer.name.trim().replace(/\s+/g, '_');
  const cleanMonth = format(monthDate, 'MMMM_yyyy');
  const fileName = `${cleanCustomer}_${cleanMonth}_bill.pdf`;
  return await savePdfCrossPlatform(doc, fileName, `${customer.name} Milk Bill - ${monthName}`);
}

/**
 * Opens a formatted printable window ready for PDF save/print
 */
export function printCustomerBill(data: BillPdfData) {
  const html = generateBillHtml(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

/**
 * Generates prefilled WhatsApp text message and opens WhatsApp URL
 */
export function shareBillViaWhatsApp(data: BillPdfData) {
  const { farmName, customer, bill, year, month, rate } = data;
  const monthName = format(new Date(year, month - 1, 1), 'MMMM yyyy');
  const finalLitres = bill ? bill.total_litres : 0;
  const finalAmount = bill ? bill.total_amount : 0;
  const paidAmount = bill ? bill.paid_amount : 0;
  const balance = bill ? bill.balance_amount : 0;

  const text = `🥛 *${farmName}*%0A` +
    `_Fresh from Our Farm to Your Family_%0A` +
    `👤 Customer: *${customer.name}*%0A` +
    `📅 Month: *${monthName}*%0A` +
    `----------------------------%0A` +
    `🥛 Total Milk: *${finalLitres} Litres*%0A` +
    `💰 Rate: *₹${rate}/L*%0A` +
    `💵 Total Bill: *₹${finalAmount}*%0A` +
    `✅ Paid: *₹${paidAmount}*%0A` +
    `🔴 Pending Balance: *₹${balance}*%0A` +
    `----------------------------%0A` +
    `Thank you! Please clear any pending balance at your earliest convenience. 🙏`;

  const phone = customer.phone ? customer.phone.replace(/[^0-9]/g, '') : '';
  const url = phone ? `https://wa.me/91${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, '_blank');
}
