import rateLimit from 'express-rate-limit';

const getRateLimitOptions = (req) => {
  const userPlan = req.user?.plan || 'anonymous';
  
  const limits = {
    anonymous: { windowMs: 15 * 60 * 1000, max: 100 },
    free: { windowMs: 15 * 60 * 1000, max: 100 },
    pro: { windowMs: 15 * 60 * 1000, max: 500 },
    express: { windowMs: 15 * 60 * 1000, max: 1000 }
  };
  
  return limits[userPlan] || limits.anonymous;
};

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});