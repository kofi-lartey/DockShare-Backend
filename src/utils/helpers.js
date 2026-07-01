import crypto from 'crypto';

export const generateShareableLink = () => {
  return crypto.randomBytes(10).toString('hex');
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