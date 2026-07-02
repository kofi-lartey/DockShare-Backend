import { FRONTEND_URL } from './env.js';

const parseOrigins = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const sanitizeOrigin = (origin) => {
  if (!origin) return null;
  const trimmed = origin.trim();
  if (trimmed === 'null') return null;
  return trimmed;
};

const normalizeOrigin = (origin) => {
  if (!origin) return origin;
  return origin.replace(/\/$/, '');
};

const isLocalhost = (origin) => {
  return (
    origin === 'http://localhost' ||
    origin === 'http://127.0.0.1' ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('https://localhost:')
  );
};

const originMatches = (origin, pattern) => {
  const normalizedOrigin = normalizeOrigin(origin);
  const normalizedPattern = normalizeOrigin(pattern);
  if (normalizedOrigin === normalizedPattern) return true;
  if (isLocalhost(normalizedPattern) && isLocalhost(normalizedOrigin)) {
    return true;
  }
  return false;
};

const isOriginAllowed = (origin, allowedOrigins) => {
  if (!origin || origin === 'null') return false;
  if (allowedOrigins.includes('*')) return true;
  
  // Allow any localhost origin by default for development flexibility
  if (isLocalhost(origin)) return true;
  
  return allowedOrigins.some((pattern) => originMatches(origin, pattern));
};

const corsLogger = {
  warn: (...args) => {
    console.warn('[CORS]', ...args);
  },
};

const logRejection = (req, origin, allowedOrigins) => {
  const method = req.method;
  const path = req.originalUrl || req.url;
  corsLogger.warn(
    `Blocked ${method} ${path} - Origin: ${origin || 'missing'} | Allowed: ${allowedOrigins.join(', ') || 'none'}`
  );
};

export const corsMiddleware = (req, res, next) => {
  const origin = sanitizeOrigin(req.headers.origin);
  let allowedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);

  if (allowedOrigins.length === 0 && FRONTEND_URL) {
    allowedOrigins = [FRONTEND_URL];
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Authorization, X-Total-Count, Retry-After');
  res.header('Access-Control-Max-Age', '86400');

  const isOptions = req.method === 'OPTIONS';

  if (!origin) {
    if (isOptions) {
      return res.status(204).send();
    }
    return next();
  }

  if (isOriginAllowed(origin, allowedOrigins)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    if (process.env.CORS_CREDENTIALS !== 'false') {
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    if (isOptions) {
      return res.status(204).send();
    }
    return next();
  }

  logRejection(req, origin, allowedOrigins);

  if (isOptions) {
    return res.status(403).json({
      success: false,
      message: 'CORS preflight rejected: origin not allowed',
    });
  }

  return res.status(403).json({
    success: false,
    message: 'CORS rejected: origin not allowed',
  });
};

export const getConfiguredOrigins = () => {
  let allowedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0 && FRONTEND_URL) {
    allowedOrigins = [FRONTEND_URL];
  }
  return allowedOrigins;
};
