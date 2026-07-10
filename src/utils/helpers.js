import crypto from 'crypto';
import QRCode from 'qrcode';
import { PDFDocument } from 'pdf-lib';

/**
 * Detects the number of pages in a PDF from its raw buffer.
 * Returns the page count, or null if it cannot be determined
 * (e.g. the buffer is not a valid/parseable PDF).
 */
export const getPdfPageCount = async (buffer) => {
  try {
    if (!buffer || !buffer.length) return null;
    const pdfDoc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false
    });
    const count = pdfDoc.getPageCount();
    return count > 0 ? count : null;
  } catch (error) {
    console.error('Failed to detect PDF page count:', error.message);
    return null;
  }
};

export const generateShareableLink = () => {
  return crypto.randomBytes(16).toString('base64url');
};

export const generateQRCode = async (text, options = {}) => {
  const defaultOptions = {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M',
    ...options
  };
  return await QRCode.toDataURL(text, defaultOptions);
};

export const generateInvoiceNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `INV-${timestamp}-${random}`;
};

export const getFileTypeCategory = (mimeType) => {
  if (!mimeType) return 'other';
  if (mimeType === 'application/pdf' || mimeType.includes('pdf')) return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('msword')) return 'document';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'document';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'document';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'other';
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getFileTypeIcon = (type) => {
  if (type?.includes('pdf')) return 'FilePdf';
  if (type?.startsWith('image/')) return 'FileImage';
  if (type?.includes('word') || type?.includes('document')) return 'FileDoc';
  if (type?.includes('excel') || type?.includes('spreadsheet')) return 'FileXls';
  if (type?.startsWith('video/')) return 'FileVideo';
  if (type?.startsWith('audio/')) return 'FileAudio';
  return 'File';
};

export const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown';
};

/**
 * Produces a privacy-preserving, salted hash of an IP address so that we can
 * correlate download events without storing raw PII. The secret salt comes
 * from the environment and is never persisted alongside the hash.
 */
export const hashIP = (ip) => {
  if (!ip || ip === 'unknown') return null;
  const salt = process.env.IP_HASH_SECRET || 'docshare-default-salt';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
};

/**
 * Truncates an IPv4 address to its /24 prefix (drops the last octet) for
 * coarse-grained, non-reidentifying geo rollups when full geolocation is
 * not consented to.
 */
export const anonymizeIP = (ip) => {
  if (!ip || ip === 'unknown') return null;
  const v4 = ip.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  if (v4) return ip.split('.').slice(0, 3).join('.') + '.0';
  return ip; // IPv6 – leave as-is (already coarse)
};