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

const C = {
  ink: rgb(0.12, 0.13, 0.16),
  muted: rgb(0.45, 0.47, 0.52),
  brand: rgb(0.20, 0.36, 0.98),
  brandSoft: rgb(0.90, 0.93, 1.0),
  line: rgb(0.90, 0.91, 0.93),
  panel: rgb(0.97, 0.98, 0.99),
  white: rgb(1, 1, 1),
  success: rgb(0.13, 0.55, 0.30),
  warn: rgb(0.78, 0.55, 0.10),
  danger: rgb(0.75, 0.20, 0.20),
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
  }).format(Number(amount) || 0);

const textMetrics = (text, font, size) => ({
  width: font.widthOfTextAtSize(text, size),
  height: font.heightAtSize(size),
});

const drawText = (page, text, x, y, { font, size = 10, color = C.ink, align = 'left' } = {}) => {
  let tx = x;
  if (align === 'right') tx = x - font.widthOfTextAtSize(text, size);
  else if (align === 'center') tx = x - font.widthOfTextAtSize(text, size) / 2;
  page.drawText(text, { x: tx, y, size, font, color });
  return font.widthOfTextAtSize(text, size);
};

const drawPill = (page, text, x, y, { font, bg, fg = C.white, padX = 8, padY = 4, size = 9 } = {}) => {
  const w = font.widthOfTextAtSize(text, size) + padX * 2;
  const h = size + padY * 2;
  page.drawRectangle({ x, y, width: w, height: h, color: bg, borderRadius: 4 });
  drawText(page, text, x + padX, y + padY, { font, size, color: fg });
  return w;
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

  // ---- Header band ----
  page.drawRectangle({
    x: 0,
    y: PAGE.h - 132,
    width: PAGE.w,
    height: 132,
    color: C.panel,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE.h - 136,
    width: PAGE.w,
    height: 4,
    color: C.brand,
  });

  const logo = await loadLogo();
  if (logo) {
    const img = await pdfDoc.embedPng(logo.bytes);
    const scale = 0.32;
    const lh = img.height * scale;
    const lw = img.width * scale;
    page.drawImage(img, { x: MARGIN, y: PAGE.h - MARGIN - lh, width: lw, height: lh });
  } else {
    drawText(page, COMPANY.name, MARGIN, PAGE.h - MARGIN - 16, { font: bold, size: 18, color: C.brand });
  }

  drawText(page, 'INVOICE', PAGE.w - MARGIN, PAGE.h - MARGIN - 14, { font: bold, size: 22, color: C.ink, align: 'right' });
  drawText(page, invoice.invoiceNumber, PAGE.w - MARGIN, PAGE.h - MARGIN - 36, { font, size: 10, color: C.muted, align: 'right' });

  y = PAGE.h - 150;

  // ---- Bill To / Invoice Details (two columns) ----
  const colW = CONTENT_W / 2 - 12;

  drawText(page, 'BILL TO', MARGIN, y, { font: bold, size: 10, color: C.brand });
  drawText(page, user?.fullName || 'Valued Customer', MARGIN, y - 18, { font: bold, size: 12, color: C.ink });
  drawText(page, user?.email || '', MARGIN, y - 36, { font, size: 10, color: C.muted });
  const planLabel = planLabels[invoice.plan] || invoice.plan || '—';
  drawText(page, `Plan: ${planLabel}`, MARGIN, y - 54, { font, size: 10, color: C.muted });

  const detailsX = MARGIN + colW + 24;
  drawText(page, 'INVOICE DETAILS', detailsX, y, { font: bold, size: 10, color: C.brand });
  drawText(page, `Issue date: ${formatDate(invoice.createdAt)}`, detailsX, y - 18, { font, size: 10, color: C.ink });
  if (invoice.paidAt) {
    drawText(page, `Paid date: ${formatDateTime(invoice.paidAt)}`, detailsX, y - 36, { font, size: 10, color: C.ink });
  }
  if (invoice.billingPeriod?.start && invoice.billingPeriod?.end) {
    drawText(page, `Period: ${formatDate(invoice.billingPeriod.start)} – ${formatDate(invoice.billingPeriod.end)}`, detailsX, y - 54, { font, size: 10, color: C.muted });
  }

  // Status pill
  const statusColor = { paid: C.success, pending: C.warn, failed: C.danger, refunded: C.muted }[invoice.status] || C.muted;
  drawPill(page, (invoice.status || 'pending').toUpperCase(), detailsX, y - 78, { font: bold, bg: statusColor, size: 9 });

  y -= 110;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.w - MARGIN, y }, thickness: 1, color: C.line });
  y -= 24;

  // ---- Itemized table ----
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

  drawText(page, cols[0].label, MARGIN, y, { font: bold, size: 9, color: C.muted });
  for (const c of cols.slice(1)) {
    drawText(page, c.label, c.x + c.w, y, { font: bold, size: 9, color: C.muted, align: 'right' });
  }
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.w - MARGIN, y }, thickness: 1, color: C.line });
  y -= 22;

  const description = invoice.description || `${planLabel} Plan Subscription`;
  drawText(page, description, MARGIN, y, { font, size: 10, color: C.ink });
  drawText(page, '1', cols[1].x + cols[1].w, y, { font, size: 10, color: C.ink, align: 'right' });
  drawText(page, formatMoney(invoice.amount, currency), cols[2].x + cols[2].w, y, { font, size: 10, color: C.ink, align: 'right' });
  drawText(page, formatMoney(0, currency), cols[3].x + cols[3].w, y, { font, size: 10, color: C.ink, align: 'right' });
  drawText(page, formatMoney(invoice.amount, currency), amountColX, y, { font, size: 10, color: C.ink, align: 'right' });

  y -= 26;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.w - MARGIN, y }, thickness: 1, color: C.line });
  y -= 16;

  // ---- Totals ----
  const totalsX = PAGE.w - MARGIN;
  const lineW = 220;
  const labelX = totalsX - lineW;

  const totalRows = [['Subtotal', invoice.amount]];
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
  for (const [label, val] of totalRows) {
    runningTotal += val;
    drawText(page, label, labelX, y, { font, size: 10, color: C.muted });
    const sign = val < 0 ? '-' : '';
    drawText(page, `${sign}${formatMoney(Math.abs(val), currency)}`, totalsX, y, { font, size: 10, color: C.ink, align: 'right' });
    y -= 20;
  }

  y -= 4;
  page.drawRectangle({ x: labelX - 12, y: y - 12, width: lineW + 12, height: 32, color: C.brandSoft });
  drawText(page, 'TOTAL DUE', labelX, y, { font: bold, size: 12, color: C.brand });
  drawText(page, formatMoney(runningTotal, currency), totalsX, y, { font: bold, size: 12, color: C.brand, align: 'right' });
  y -= 44;

  // ---- Footer ----
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE.w - MARGIN, y }, thickness: 1, color: C.line });
  y -= 22;

  drawText(page, `${COMPANY.name} · ${COMPANY.website}`, MARGIN, y, { font: bold, size: 9, color: C.ink });
  if (COMPANY.taxId) {
    drawText(page, `Tax ID: ${COMPANY.taxId}`, MARGIN, y - 14, { font, size: 9, color: C.muted });
  }
  drawText(page, COMPANY.address, MARGIN, y - (COMPANY.taxId ? 28 : 14), { font, size: 9, color: C.muted });
  drawText(page, COMPANY.email, MARGIN, y - (COMPANY.taxId ? 42 : 28), { font, size: 9, color: C.muted });

  drawText(page, 'Thank you for your business.', PAGE.w - MARGIN, y, { font: bold, size: 9, color: C.brand, align: 'right' });
  drawText(page, 'This is a computer-generated invoice.', PAGE.w - MARGIN, y - 14, { font, size: 9, color: C.muted, align: 'right' });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};
