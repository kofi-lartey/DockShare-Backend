export const PRICING_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'mo',
    description: 'Perfect for getting started with document sharing',
    popular: false,
    maxUploads: 2,
    maxStorage: 0.1,
    maxFileSize: 10,
    teamMembers: 1,
    retentionDays: 7,
    allowedFormats: ['PDF'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19,
    interval: 'mo',
    description: 'For professionals and growing teams',
    popular: true,
    maxUploads: Infinity,
    maxStorage: 50,
    maxFileSize: 1024,
    teamMembers: 5,
    retentionDays: 90,
    allowedFormats: ['PDF', 'Images', 'DOC/DOCX', 'Excel', 'TXT', 'JSON'],
  },
  {
    id: 'express',
    name: 'Express',
    price: 49,
    interval: 'mo',
    description: 'For enterprises with unlimited needs',
    popular: false,
    maxUploads: Infinity,
    maxStorage: Infinity,
    maxFileSize: Infinity,
    teamMembers: Infinity,
    retentionDays: Infinity,
    allowedFormats: ['All formats supported'],
  },
];

export const FILE_TYPES = [
  { value: 'all', label: 'All Files' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'other', label: 'Other' },
];

export const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
];

export const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest First' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'size-asc', label: 'Size (Smallest)' },
  { value: 'size-desc', label: 'Size (Largest)' },
  { value: 'views-desc', label: 'Most Views' },
  { value: 'views-asc', label: 'Least Views' },
];

export const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const ALLOWED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],
  'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv'],
  'audio/*': ['.mp3', '.wav', '.aac', '.flac'],
};

export const PLAN_LIMITS = {
  free: {
    maxUploads: 2,
    maxStorage: 0.1,
    maxFileSize: 10,
    teamMembers: 1,
    retentionDays: 7,
    allowedFormats: ['PDF'],
  },
  pro: {
    maxUploads: Infinity,
    maxStorage: 50,
    maxFileSize: 1024,
    teamMembers: 5,
    retentionDays: 90,
    allowedFormats: ['PDF', 'Images', 'DOC/DOCX', 'Excel', 'TXT', 'JSON'],
  },
  express: {
    maxUploads: Infinity,
    maxStorage: Infinity,
    maxFileSize: Infinity,
    teamMembers: Infinity,
    retentionDays: Infinity,
    allowedFormats: ['All formats supported'],
  },
};

export const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=User&background=6366f1&color=fff&size=128';

export const APP_NAME = 'DocShare Pro';
export const APP_VERSION = '2.1.0';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password/:token',
  CONFIRM_EMAIL: '/confirm-email/:token',
  DASHBOARD: '/dashboard',
  UPLOAD: '/dashboard/upload',
  MY_UPLOADS: '/dashboard/my-uploads',
  ANALYTICS: '/dashboard/analytics',
  SETTINGS: '/dashboard/settings',
  SUBSCRIPTION: '/dashboard/subscription',
  VIEW_DOCUMENT: '/view/:fileId',
};

export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning',
};