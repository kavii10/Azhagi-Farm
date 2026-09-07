import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { Customer, MonthlyBill } from '../types';
import { savePdfCrossPlatform, sharePdfCrossPlatform, type PdfDownloadResult } from './pdfDownloader';
import { APP_LOGO_BASE64 } from './logoBase64';

export type StatementPaymentStatus = 'PAID' | 'PARTIALLY PAID' | 'PENDING';

export interface StatementRow {
  no: number;
  customerId: string;
  customerName: string;
  batch: string;
  totalLitres: number;
  ratePerLitre: number;
  totalBill: number;
  paidAmount: number;
  pendingAmount: number;
  status: StatementPaymentStatus;
}

export interface OverallStatementData {
  farmName: string;
  tagline?: string;
  year: number;
  month: number;
  monthName: string;
  totalCustomers: number;
  totalLitres: number;
  totalBillAmount: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
  rows: StatementRow[];
}

/**
 * Determine payment status according to the farm billing rules:
 * - PAID: pending amount <= 0
 * - PARTIALLY PAID: paid amount > 0 and pending amount > 0
 * - PENDING: paid amount = 0 and bill amount > 0 (or pending amount = totalBill)
 */
export function calculatePaymentStatus(
  _totalBill: number,
  paidAmount: number,
  pendingAmount: number
): StatementPaymentStatus {
  if (pendingAmount <= 0) return 'PAID';
  if (paidAmount > 0 && pendingAmount > 0) return 'PARTIALLY PAID';
  return 'PENDING';
}

/**
 * Sort customer rows in useful order:
 * 1. Morning customers
 * 2. Both batch customers
 * 3. Evening customers
 * Within each batch, sort alphabetically by customer name.
 */
export function sortStatementRows<T extends { batch: string; customerName: string }>(rows: T[]): T[] {
  const getBatchRank = (batch: string) => {
    const b = (batch || '').toLowerCase();
    if (b === 'morning') return 1;
    if (b === 'both') return 2;
    if (b === 'evening') return 3;
    return 4;
  };

  return [...rows].sort((a, b) => {
    const rankA = getBatchRank(a.batch);
    const rankB = getBatchRank(b.batch);
    if (rankA !== rankB) return rankA - rankB;
    return a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' });
  });
}

/**
 * Transforms raw monthly bills and customers into structured statement data
 */
export function prepareStatementData(
  bills: (MonthlyBill & { customer: Customer })[],
  year: number,
  month: number,
  farmName = 'Azhagi Farm'
): OverallStatementData {
  const monthDate = new Date(year, month - 1, 1);
  const monthName = format(monthDate, 'MMMM yyyy');

  // Map and calculate each row
  const rawRows: Omit<StatementRow, 'no'>[] = bills.map((b) => {
    const totalLitres = parseFloat((b.total_litres || 0).toFixed(2));
    const rate = b.rate_per_litre || b.customer.custom_rate || 60;
    // Total Bill = applicable milk rate * total delivered litres
    const totalBill = parseFloat((b.total_amount || totalLitres * rate).toFixed(2));
    const paid = parseFloat((b.paid_amount || 0).toFixed(2));
    // Pending = Total Bill - Total Paid
    const pending = parseFloat(Math.max(0, totalBill - paid).toFixed(2));
    const status = calculatePaymentStatus(totalBill, paid, pending);

    const batchDisplay =
      b.customer.batch === 'both'
        ? 'Morning & Evening'
        : b.customer.batch === 'evening'
        ? 'Evening'
        : 'Morning';

    return {
      customerId: b.customer_id,
      customerName: b.customer.name,
      batch: batchDisplay,
      totalLitres,
      ratePerLitre: rate,
      totalBill,
      paidAmount: paid,
      pendingAmount: pending,
      status,
    };
  });

  // Sort: Morning -> Both -> Evening, then alphabetically by name
  const sorted = sortStatementRows(rawRows);

  // Assign sequential 1-based row numbers
  const rows: StatementRow[] = sorted.map((r, index) => ({
    ...r,
    no: index + 1,
  }));

  const totalLitres = parseFloat(rows.reduce((sum, r) => sum + r.totalLitres, 0).toFixed(2));
  const totalBillAmount = parseFloat(rows.reduce((sum, r) => sum + r.totalBill, 0).toFixed(2));
  const totalPaidAmount = parseFloat(rows.reduce((sum, r) => sum + r.paidAmount, 0).toFixed(2));
  const totalPendingAmount = parseFloat(rows.reduce((sum, r) => sum + r.pendingAmount, 0).toFixed(2));

  return {
    farmName,
    tagline: 'Fresh from Our Farm to Your Family',
    year,
    month,
    monthName,
    totalCustomers: rows.length,
    totalLitres,
    totalBillAmount,
    totalPaidAmount,
    totalPendingAmount,
    rows,
  };
}

/**
 * Builds a clean, professional, multi-page A4 PDF of the Overall Bill Statement
 */
export function buildOverallStatementPdfDoc(data: OverallStatementData): jsPDF {
  if (data.rows.length === 0) {
    throw new Error('No bill records found for this month.');
  }

  // Initialize jsPDF with A4 format portrait
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header Banner
  doc.setFillColor(21, 128, 61); // Deep Green #15803d
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Farm Logo
  try {
    doc.addImage(APP_LOGO_BASE64, 'PNG', margin, 4, 20, 20);
  } catch (e) {
    console.warn('Could not add logo to overall statement PDF:', e);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(data.farmName.toUpperCase(), margin + 24, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(220, 252, 231); // light green
  doc.text(data.tagline || 'Fresh from Our Farm to Your Family', margin + 24, 18);

  // Document Title & Month on Right side of banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('OVERALL BILL STATEMENT', pageWidth - margin, 11, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(254, 240, 138); // Yellow accent
  doc.text(`Month: ${data.monthName}`, pageWidth - margin, 18, { align: 'right' });

  // Sub-header date line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(240, 253, 244);
  doc.text(
    `Generated on ${format(new Date(), 'dd MMMM yyyy, hh:mm a')}`,
    pageWidth - margin,
    24,
    { align: 'right' }
  );

  // Summary Cards Section (Y = 32)
  const summaryY = 32;
  const summaryBoxWidth = (pageWidth - margin * 2 - 12) / 5;
  const summaryBoxHeight = 16;

  const summaryItems = [
    { label: 'Total Customers', value: `${data.totalCustomers}`, color: [30, 41, 59] },
    { label: 'Total Milk', value: `${data.totalLitres} L`, color: [2, 132, 199] },
    { label: 'Total Bill', value: `Rs. ${data.totalBillAmount.toLocaleString('en-IN')}`, color: [15, 23, 42] },
    { label: 'Collected', value: `Rs. ${data.totalPaidAmount.toLocaleString('en-IN')}`, color: [22, 101, 52] },
    { label: 'Pending Balance', value: `Rs. ${data.totalPendingAmount.toLocaleString('en-IN')}`, color: [185, 28, 28] },
  ];

  summaryItems.forEach((item, index) => {
    const x = margin + index * (summaryBoxWidth + 3);

    // Box background
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, summaryY, summaryBoxWidth, summaryBoxHeight, 2, 2, 'FD');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + 3, summaryY + 5);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(item.value, x + 3, summaryY + 12);
  });

  // Table Data Preparation
  const tableHead = [
    ['No.', 'Customer', 'Batch', 'Total Litres', 'Rate/L', 'Total Bill', 'Paid', 'Pending', 'Status'],
  ];

  const tableBody = data.rows.map((r) => [
    r.no.toString(),
    r.customerName,
    r.batch,
    `${r.totalLitres} L`,
    `Rs. ${r.ratePerLitre}`,
    `Rs. ${r.totalBill.toLocaleString('en-IN')}`,
    `Rs. ${r.paidAmount.toLocaleString('en-IN')}`,
    `Rs. ${r.pendingAmount.toLocaleString('en-IN')}`,
    r.status,
  ]);

  const tableFoot = [
    [
      'TOTAL',
      `${data.totalCustomers} Customers`,
      '—',
      `${data.totalLitres} L`,
      '—',
      `Rs. ${data.totalBillAmount.toLocaleString('en-IN')}`,
      `Rs. ${data.totalPaidAmount.toLocaleString('en-IN')}`,
      `Rs. ${data.totalPendingAmount.toLocaleString('en-IN')}`,
      data.totalPendingAmount <= 0 ? 'ALL CLEAR' : 'PENDING',
    ],
  ];

  // Render Table with autoTable
  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    startY: 52,
    margin: { left: margin, right: margin, bottom: 16, top: 22 },
    showHead: 'everyPage',
    showFoot: 'lastPage',
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [22, 101, 52], // Dark green
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    footStyles: {
      fillColor: [20, 83, 45], // Darker green for total row
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'right',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 }, // No.
      1: { halign: 'left', cellWidth: 38, fontStyle: 'bold' }, // Customer
      2: { halign: 'center', cellWidth: 22 }, // Batch
      3: { halign: 'right', cellWidth: 20 }, // Total Litres
      4: { halign: 'right', cellWidth: 16 }, // Rate
      5: { halign: 'right', cellWidth: 22, fontStyle: 'bold' }, // Total Bill
      6: { halign: 'right', cellWidth: 20 }, // Paid
      7: { halign: 'right', cellWidth: 20, fontStyle: 'bold' }, // Pending
      8: { halign: 'center', cellWidth: 24, fontStyle: 'bold' }, // Status
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (dataCell) => {
      // Style individual status badge cells in body
      if (dataCell.section === 'body' && dataCell.column.index === 8) {
        const text = String(dataCell.cell.raw);
        if (text === 'PAID') {
          dataCell.cell.styles.textColor = [22, 101, 52]; // Green
          dataCell.cell.styles.fillColor = [240, 253, 244]; // Light green
        } else if (text === 'PARTIALLY PAID') {
          dataCell.cell.styles.textColor = [180, 83, 9]; // Amber
          dataCell.cell.styles.fillColor = [254, 243, 199]; // Light amber
        } else if (text === 'PENDING') {
          dataCell.cell.styles.textColor = [185, 28, 28]; // Red
          dataCell.cell.styles.fillColor = [254, 242, 242]; // Light red
        }
      }

      // Format footer first column align
      if (dataCell.section === 'foot') {
        if (dataCell.column.index === 0) dataCell.cell.styles.halign = 'center';
        if (dataCell.column.index === 1) dataCell.cell.styles.halign = 'left';
      }
    },
    didDrawPage: (hookData) => {
      // Header repetition on subsequent pages
      if (hookData.pageNumber > 1) {
        doc.setFillColor(21, 128, 61);
        doc.rect(0, 0, pageWidth, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`${data.farmName} — Overall Bill Statement (${data.monthName})`, margin, 8);
      }

      // Footer: Page Number & notice
      const totalPages = (doc.internal as any).getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);

      const footerText = `Page ${hookData.pageNumber} of ${totalPages} • Azhagi Farm Dairy Management`;
      doc.text(footerText, margin, pageHeight - 8);

      const farmInfo = `Month: ${data.monthName}`;
      doc.text(farmInfo, pageWidth - margin, pageHeight - 8, { align: 'right' });
    },
  });

  return doc;
}

/**
 * Downloads the overall bill statement PDF directly to user's Documents / Downloads
 */
export async function downloadOverallStatementPdf(data: OverallStatementData): Promise<PdfDownloadResult> {
  const doc = buildOverallStatementPdfDoc(data);
  const cleanFarm = data.farmName.trim().replace(/\s+/g, '_');
  const cleanMonth = data.monthName.trim().replace(/\s+/g, '_');
  const fileName = `${cleanFarm}_${cleanMonth}_Overall_Statement.pdf`;
  return await savePdfCrossPlatform(doc, fileName, `${data.farmName} Overall Bill Statement - ${data.monthName}`);
}

/**
 * Shares the overall bill statement PDF file directly via native mobile share sheet (WhatsApp, Drive, Email)
 */
export async function shareOverallStatementPdf(data: OverallStatementData): Promise<void> {
  const doc = buildOverallStatementPdfDoc(data);
  const fileName = `${data.farmName.replace(/\s+/g, '_')}_Overall_Bill_Statement_${data.monthName.replace(/\s+/g, '_')}.pdf`;
  await sharePdfCrossPlatform(doc, fileName, `${data.farmName} Overall Bill Statement - ${data.monthName}`);
}

/**
 * Opens a printable HTML view in a new window for immediate printing / browser print dialog
 */
export function printOverallStatement(data: OverallStatementData): void {
  if (data.rows.length === 0) {
    throw new Error('No bill records found for this month.');
  }

  const tableRowsHtml = data.rows
    .map((r, i) => {
      const statusBg =
        r.status === 'PAID'
          ? '#dcfce7; color: #15803d;'
          : r.status === 'PARTIALLY PAID'
          ? '#fef3c7; color: #b45309;'
          : '#fee2e2; color: #b91c1c;';

      return `
      <tr style="border-bottom: 1px solid #e2e8f0; ${i % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
        <td style="padding: 7px 8px; text-align: center;">${r.no}</td>
        <td style="padding: 7px 8px; font-weight: 600; text-align: left;">${r.customerName}</td>
        <td style="padding: 7px 8px; text-align: center; color: #475569;">${r.batch}</td>
        <td style="padding: 7px 8px; text-align: right; font-weight: 500;">${r.totalLitres} L</td>
        <td style="padding: 7px 8px; text-align: right; color: #475569;">₹${r.ratePerLitre}</td>
        <td style="padding: 7px 8px; text-align: right; font-weight: 700;">₹${r.totalBill.toLocaleString('en-IN')}</td>
        <td style="padding: 7px 8px; text-align: right; color: #166534;">₹${r.paidAmount.toLocaleString('en-IN')}</td>
        <td style="padding: 7px 8px; text-align: right; font-weight: 700; color: ${r.pendingAmount > 0 ? '#b91c1c' : '#166534'};">
          ₹${r.pendingAmount.toLocaleString('en-IN')}
        </td>
        <td style="padding: 7px 8px; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; background: ${statusBg}">
            ${r.status}
          </span>
        </td>
      </tr>
    `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>${data.farmName} - Overall Bill Statement - ${data.monthName}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 12mm 15mm 12mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          margin: 0;
          padding: 10px;
          color: #0f172a;
          background: #fff;
          font-size: 12px;
        }
        .header {
          background: linear-gradient(135deg, #15803d, #166534);
          color: white;
          padding: 16px 20px;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .header .tagline {
          margin: 3px 0 0 0;
          font-size: 11px;
          color: #bbf7d0;
        }
        .header-right {
          text-align: right;
        }
        .header-right .doc-title {
          font-size: 14px;
          font-weight: 700;
          margin: 0;
        }
        .header-right .month-title {
          font-size: 12px;
          font-weight: 700;
          color: #fef08a;
          margin: 4px 0 0 0;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
          margin-bottom: 18px;
        }
        .summary-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 10px 12px;
          border-radius: 10px;
        }
        .summary-label {
          font-size: 10px;
          color: #64748b;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .summary-value {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        thead {
          display: table-header-group;
        }
        tr {
          page-break-inside: avoid;
        }
        th {
          background-color: #166534;
          color: white;
          padding: 8px 6px;
          font-weight: 700;
          font-size: 11px;
          text-align: center;
          border: 1px solid #15803d;
        }
        td {
          border: 1px solid #e2e8f0;
        }
        .footer-row td {
          background-color: #14532d !important;
          color: white !important;
          font-weight: 800;
          font-size: 11px;
          padding: 9px 8px;
          border: 1px solid #14532d;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div style="display: flex; align-items: center; gap: 14px;">
          <img src="${APP_LOGO_BASE64}" alt="${data.farmName}" style="width: 52px; height: 52px; object-fit: contain; border-radius: 10px; border: 1px solid #bbf7d0; background: #fff;" />
          <div>
            <h1>${data.farmName.toUpperCase()}</h1>
            <div class="tagline">${data.tagline || 'Fresh from Our Farm to Your Family'}</div>
          </div>
        </div>
        <div class="header-right">
          <div class="doc-title">OVERALL BILL STATEMENT</div>
          <div class="month-title">Month: ${data.monthName}</div>
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-box">
          <div class="summary-label">TOTAL CUSTOMERS</div>
          <div class="summary-value">${data.totalCustomers}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">TOTAL MILK</div>
          <div class="summary-value" style="color: #0284c7;">${data.totalLitres} L</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">TOTAL BILL</div>
          <div class="summary-value">₹${data.totalBillAmount.toLocaleString('en-IN')}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">COLLECTED</div>
          <div class="summary-value" style="color: #166534;">₹${data.totalPaidAmount.toLocaleString('en-IN')}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">PENDING BALANCE</div>
          <div class="summary-value" style="color: #b91c1c;">₹${data.totalPendingAmount.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 4%;">No.</th>
            <th style="width: 22%; text-align: left;">Customer</th>
            <th style="width: 14%;">Batch</th>
            <th style="width: 11%; text-align: right;">Total Litres</th>
            <th style="width: 9%; text-align: right;">Rate/L</th>
            <th style="width: 12%; text-align: right;">Total Bill</th>
            <th style="width: 12%; text-align: right;">Paid</th>
            <th style="width: 12%; text-align: right;">Pending</th>
            <th style="width: 12%;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
        <tfoot>
          <tr class="footer-row">
            <td style="text-align: center;">TOTAL</td>
            <td style="text-align: left;">${data.totalCustomers} Customers</td>
            <td style="text-align: center;">—</td>
            <td style="text-align: right;">${data.totalLitres} L</td>
            <td style="text-align: right;">—</td>
            <td style="text-align: right;">₹${data.totalBillAmount.toLocaleString('en-IN')}</td>
            <td style="text-align: right;">₹${data.totalPaidAmount.toLocaleString('en-IN')}</td>
            <td style="text-align: right;">₹${data.totalPendingAmount.toLocaleString('en-IN')}</td>
            <td style="text-align: center;">${data.totalPendingAmount <= 0 ? 'ALL CLEAR' : 'PENDING'}</td>
          </tr>
        </tfoot>
      </table>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

/**
 * Generate a WhatsApp summary message for the farm owner to share
 */
export function shareOverallStatementWhatsApp(data: OverallStatementData): void {
  const pendingCount = data.rows.filter((r) => r.pendingAmount > 0).length;

  const text =
    `📋 *${data.farmName.toUpperCase()} - OVERALL BILL STATEMENT*%0A` +
    `📅 *Month: ${data.monthName}*%0A` +
    `--------------------------------%0A` +
    `👥 *Total Customers:* ${data.totalCustomers}%0A` +
    `🥛 *Total Milk Delivered:* ${data.totalLitres} L%0A` +
    `💵 *Total Bill Amount:* ₹${data.totalBillAmount.toLocaleString('en-IN')}%0A` +
    `✅ *Total Collected:* ₹${data.totalPaidAmount.toLocaleString('en-IN')}%0A` +
    `🔴 *Total Pending Balance:* ₹${data.totalPendingAmount.toLocaleString('en-IN')}%0A` +
    `⚠️ *Customers with Pending:* ${pendingCount} of ${data.totalCustomers}%0A` +
    `--------------------------------%0A` +
    `_Generated from Azhagi Farm Milk App_`;

  window.open(`https://wa.me/?text=${text}`, '_blank');
}
