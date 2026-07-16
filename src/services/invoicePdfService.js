import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { formatDate, formatDateTime } from '../utils/helpers.js';
import { Coupon } from '../models/Coupon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = 48;
const CONTENT_W = PAGE.w - MARGIN * 2;

// Modern color palette - softer, more elegant
const C = {
  ink: rgb(0.07, 0.08, 0.12),
  muted: rgb(0.45, 0.48, 0.55),
  mutedLight: rgb(0.72, 0.75, 0.82),
  brand: rgb(0.15, 0.35, 0.85),
  brandLight: rgb(0.60, 0.75, 0.95),
  brandSoft: rgb(0.92, 0.95, 1.0),
  line: rgb(0.88, 0.90, 0.93),
  panel: rgb(0.98, 0.99, 0.995),
  white: rgb(1, 1, 1),
  success: rgb(0.10, 0.55, 0.35),
  warn: rgb(0.75, 0.55, 0.10),
  danger: rgb(0.72, 0.18, 0.18),
  surface: rgb(0.995, 0.997, 1.0),
};

const COMPANY = {
  name: process.env.COMPANY_NAME || 'DocShare Pro',
  address: process.env.COMPANY_ADDRESS || '123 Document Street, Accra, Ghana',
  email: process.env.COMPANY_EMAIL || 'billing@docshare.io',
  taxId: process.env.COMPANY_TAX_ID || null,
  website: process.env.FRONTEND_URL || 'https://docshare.io',
};

const planLabels = { free: 'Free', pro: 'Pro', express: 'Express' };

const formatMoney = (amount, currency) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);

const textMetrics = (text, font, size) => ({
  width: font.widthOfTextAtSize(text, size),
  height: font.heightAtSize(size),
});

const drawText = (page, text, x, y, { font, size = 10, color = C.ink, align = 'left', opacity = 1 } = {}) => {
  let tx = x;
  if (align === 'right') tx = x - font.widthOfTextAtSize(text, size);
  else if (align === 'center') tx = x - font.widthOfTextAtSize(text, size) / 2;
  page.drawText(text, { 
    x: tx, 
    y, 
    size, 
    font, 
    color,
    opacity 
  });
  return font.widthOfTextAtSize(text, size);
};

const drawPill = (page, text, x, y, { font, bg, fg = C.white, padX = 10, padY = 5, size = 9 } = {}) => {
  const w = font.widthOfTextAtSize(text, size) + padX * 2;
  const h = size + padY * 2;
  page.drawRectangle({ 
    x, 
    y, 
    width: w, 
    height: h, 
    color: bg, 
    borderRadius: 6,
  });
  drawText(page, text, x + padX, y + padY, { font, size, color: fg });
  return w;
};

const drawDivider = (page, x, y, width, color = C.line, thickness = 1) => {
  page.drawLine({ 
    start: { x, y }, 
    end: { x: x + width, y }, 
    thickness, 
    color 
  });
};

const loadLogo = async () => {
  const candidates = [
    path.join(__dirname, '..', 'assets', 'logo.png'),
    path.join(process.cwd(), 'assets', 'logo.png'),
  ];
  for (const p of candidates) {
    try {
      const bytes = await fs.readFile(p);
      return { bytes, ext: 'png' };
    } catch {
      // try next
    }
  }
  return null;
};

export const generateInvoicePdf = async (invoice, user) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([PAGE.w, PAGE.h]);
  const currency = invoice.currency || 'USD';

  let y = PAGE.h - MARGIN;

  // ---- Modern Header with gradient effect ----
  const headerHeight = 140;
  page.drawRectangle({
    x: 0,
    y: PAGE.h - headerHeight,
    width: PAGE.w,
    height: headerHeight,
    color: C.surface,
  });
  
  // Subtle accent line with brand color
  page.drawRectangle({
    x: 0,
    y: PAGE.h - headerHeight + 4,
    width: PAGE.w,
    height: 3,
    color: C.brand,
    opacity: 0.8,
  });

  const logo = await loadLogo();
  const logoY = PAGE.h - MARGIN - 24;
  
  if (logo) {
    const img = await pdfDoc.embedPng(logo.bytes);
    const scale = 0.35;
    const lh = img.height * scale;
    const lw = img.width * scale;
    page.drawImage(img, { 
      x: MARGIN, 
      y: logoY - lh, 
      width: lw, 
      height: lh 
    });
  } else {
    drawText(page, COMPANY.name, MARGIN, logoY, { 
      font: bold, 
      size: 20, 
      color: C.brand 
    });
  }

  // Invoice title with modern styling
  const titleY = PAGE.h - MARGIN - 16;
  drawText(page, 'INVOICE', PAGE.w - MARGIN, titleY, { 
    font: bold, 
    size: 24, 
    color: C.ink, 
    align: 'right',
    opacity: 0.9
  });
  
  drawText(page, `#${invoice.invoiceNumber}`, PAGE.w - MARGIN, titleY - 26, { 
    font, 
    size: 11, 
    color: C.muted, 
    align: 'right' 
  });

  y = PAGE.h - headerHeight - 20;

  // ---- Two Column Layout with improved spacing ----
  const colW = CONTENT_W / 2 - 16;
  const detailsX = MARGIN + colW + 32;

  // Left Column - Bill To
  const billToY = y;
  drawText(page, 'BILL TO', MARGIN, billToY, { 
    font: bold, 
    size: 9, 
    color: C.muted,
    opacity: 0.7
  });
  
  drawText(page, user?.fullName || 'Valued Customer', MARGIN, billToY - 20, { 
    font: bold, 
    size: 14, 
    color: C.ink 
  });
  
  drawText(page, user?.email || '', MARGIN, billToY - 40, { 
    font, 
    size: 10, 
    color: C.muted 
  });
  
  const planLabel = planLabels[invoice.plan] || invoice.plan || '—';
  drawText(page, `Plan: ${planLabel}`, MARGIN, billToY - 58, { 
    font, 
    size: 10, 
    color: C.muted 
  });

  // Right Column - Invoice Details
  drawText(page, 'INVOICE DETAILS', detailsX, billToY, { 
    font: bold, 
    size: 9, 
    color: C.muted,
    opacity: 0.7
  });
  
  const detailItems = [
    ['Issue Date', formatDate(invoice.createdAt)],
    invoice.paidAt ? ['Paid Date', formatDateTime(invoice.paidAt)] : null,
    invoice.billingPeriod?.start && invoice.billingPeriod?.end 
      ? ['Period', `${formatDate(invoice.billingPeriod.start)} – ${formatDate(invoice.billingPeriod.end)}`] 
      : null,
  ].filter(Boolean);

  let detailY = billToY - 20;
  detailItems.forEach(([label, value]) => {
    drawText(page, label, detailsX, detailY, { 
      font: bold, 
      size: 9, 
      color: C.muted,
      opacity: 0.6
    });
    drawText(page, value, detailsX + 80, detailY, { 
      font, 
      size: 10, 
      color: C.ink 
    });
    detailY -= 20;
  });

  // Status pill with modern styling
  const statusColors = { 
    paid: C.success, 
    pending: C.warn, 
    failed: C.danger, 
    refunded: C.muted 
  };
  const statusColor = statusColors[invoice.status] || C.muted;
  drawPill(page, (invoice.status || 'pending').toUpperCase(), detailsX, detailY - 10, { 
    font: bold, 
    bg: statusColor, 
    size: 9 
  });

  y = detailY - 50;

  // ---- Table Section with modern styling ----
  drawDivider(page, MARGIN, y, CONTENT_W, C.line, 1.5);
  y -= 24;

  // Table headers
  const cols = [
    { key: 'desc', label: 'DESCRIPTION', x: MARGIN, w: colW + 40 },
    { key: 'qty', label: 'QTY', x: 0, w: 50, align: 'right' },
    { key: 'rate', label: 'RATE', x: 0, w: 90, align: 'right' },
    { key: 'tax', label: 'TAX', x: 0, w: 70, align: 'right' },
    { key: 'amount', label: 'AMOUNT', x: 0, w: 90, align: 'right' },
  ];
  
  let cx = MARGIN;
  for (const c of cols) {
    if (c.key !== 'desc') {
      c.x = cx;
      cx += c.w;
    }
  }
  const amountColX = PAGE.w - MARGIN;

  // Header with subtle background
  const headerBgY = y - 4;
  page.drawRectangle({
    x: MARGIN,
    y: headerBgY - 16,
    width: CONTENT_W,
    height: 28,
    color: C.brandSoft,
    borderRadius: 4,
  });

  drawText(page, cols[0].label, MARGIN + 8, y, { 
    font: bold, 
    size: 9, 
    color: C.brand 
  });
  
  for (const c of cols.slice(1)) {
    drawText(page, c.label, c.x + c.w - 8, y, { 
      font: bold, 
      size: 9, 
      color: C.brand, 
      align: 'right' 
    });
  }
  
  y -= 28;
  drawDivider(page, MARGIN, y, CONTENT_W, C.line, 0.5);
  y -= 24;

  // Table rows with alternating backgrounds
  const description = invoice.description || `${planLabel} Plan Subscription`;
  const rowBg = C.surface;
  
  // Item row with subtle background
  page.drawRectangle({
    x: MARGIN,
    y: y - 4,
    width: CONTENT_W,
    height: 28,
    color: rowBg,
    borderRadius: 3,
  });

  drawText(page, description, MARGIN + 8, y + 2, { 
    font, 
    size: 10, 
    color: C.ink 
  });
  
  drawText(page, '1', cols[1].x + cols[1].w - 8, y + 2, { 
    font, 
    size: 10, 
    color: C.ink, 
    align: 'right' 
  });
  
  drawText(page, formatMoney(invoice.amount, currency), cols[2].x + cols[2].w - 8, y + 2, { 
    font, 
    size: 10, 
    color: C.ink, 
    align: 'right' 
  });
  
  drawText(page, formatMoney(0, currency), cols[3].x + cols[3].w - 8, y + 2, { 
    font, 
    size: 10, 
    color: C.muted, 
    align: 'right' 
  });
  
  drawText(page, formatMoney(invoice.amount, currency), amountColX - 8, y + 2, { 
    font: bold, 
    size: 10, 
    color: C.ink, 
    align: 'right' 
  });

  y -= 38;
  drawDivider(page, MARGIN, y, CONTENT_W, C.line, 0.5);
  y -= 20;

  // ---- Totals with modern card style ----
  const totalsX = PAGE.w - MARGIN;
  const lineW = 240;
  const labelX = totalsX - lineW;
  
  // Card background for totals
  const cardY = y - 8;
  page.drawRectangle({
    x: labelX - 16,
    y: cardY - 4,
    width: lineW + 32,
    height: 160,
    color: C.brandSoft,
    borderRadius: 8,
    opacity: 0.5,
  });

  const totalRows = [
    ['Subtotal', invoice.amount],
  ];
  
  const coupon = invoice.couponCode
    ? await Coupon.findOne({ code: invoice.couponCode }).lean().catch(() => null)
    : null;
    
  if (coupon) {
    const discount = coupon.type === 'percentage'
      ? invoice.amount * (coupon.value / 100)
      : Math.min(coupon.value, invoice.amount);
    totalRows.push([`Discount (${coupon.code})`, -discount]);
  }
  totalRows.push(['Tax', 0]);

  let runningTotal = 0;
  let totalY = y;
  
  for (const [label, val] of totalRows) {
    runningTotal += val;
    drawText(page, label, labelX, totalY, { 
      font: label.includes('Total') ? bold : font, 
      size: label.includes('Total') ? 10 : 9, 
      color: label.includes('Total') ? C.ink : C.muted 
    });
    
    const sign = val < 0 ? '-' : '';
    const formattedVal = `${sign}${formatMoney(Math.abs(val), currency)}`;
    drawText(page, formattedVal, totalsX, totalY, { 
      font: label.includes('Total') ? bold : font, 
      size: label.includes('Total') ? 10 : 9, 
      color: label.includes('Total') ? C.ink : C.muted, 
      align: 'right' 
    });
    totalY -= 20;
  }

  // Total due with accent
  totalY -= 4;
  page.drawRectangle({
    x: labelX - 12,
    y: totalY - 8,
    width: lineW + 24,
    height: 34,
    color: C.brand,
    borderRadius: 6,
    opacity: 0.1,
  });
  
  drawText(page, 'TOTAL DUE', labelX + 4, totalY + 4, { 
    font: bold, 
    size: 13, 
    color: C.brand 
  });
  
  drawText(page, formatMoney(runningTotal, currency), totalsX - 4, totalY + 4, { 
    font: bold, 
    size: 15, 
    color: C.brand, 
    align: 'right' 
  });

  y = totalY - 44;

  // ---- Footer with modern styling ----
  drawDivider(page, MARGIN, y, CONTENT_W, C.line, 1);
  y -= 28;

  // Footer columns
  const footerColW = CONTENT_W / 3 - 12;
  
  drawText(page, COMPANY.name, MARGIN, y, { 
    font: bold, 
    size: 10, 
    color: C.ink 
  });
  
  const footerY = y - 16;
  drawText(page, COMPANY.address, MARGIN, footerY, { 
    font, 
    size: 9, 
    color: C.muted 
  });
  
  drawText(page, COMPANY.email, MARGIN, footerY - 16, { 
    font, 
    size: 9, 
    color: C.muted 
  });
  
  if (COMPANY.taxId) {
    drawText(page, `Tax ID: ${COMPANY.taxId}`, MARGIN, footerY - 32, { 
      font, 
      size: 9, 
      color: C.muted 
    });
  }

  // Center column - support
  const centerX = MARGIN + footerColW + 16;
  drawText(page, 'SUPPORT', centerX, y, { 
    font: bold, 
    size: 9, 
    color: C.muted,
    opacity: 0.7
  });
  drawText(page, COMPANY.email, centerX, footerY, { 
    font, 
    size: 9, 
    color: C.muted 
  });
  drawText(page, COMPANY.website, centerX, footerY - 16, { 
    font, 
    size: 9, 
    color: C.brand 
  });

  // Right column - payment info
  const rightX = PAGE.w - MARGIN - footerColW;
  drawText(page, 'PAYMENT', rightX, y, { 
    font: bold, 
    size: 9, 
    color: C.muted,
    opacity: 0.7,
    align: 'right'
  });
  drawText(page, 'Payments processed securely', rightX, footerY, { 
    font, 
    size: 9, 
    color: C.muted,
    align: 'right'
  });
  drawText(page, 'Thank you for your business!', rightX, footerY - 16, { 
    font: bold, 
    size: 9, 
    color: C.brand,
    align: 'right'
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};