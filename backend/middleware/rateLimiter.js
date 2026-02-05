/**
 * Rate Limiting Middleware
 * Provides configurable rate limiting for API endpoints
 * Uses in-memory storage (can be extended with Redis)
 */

import logger from '../utils/logger.js';

// Simple cache client interface (can be replaced with Redis)
let cacheClient = null;

/**
 * Set cache client (for Redis integration)
 * @param {Object} client - Redis client
 */
export const setCacheClient = (client) => {
  cacheClient = client;
};

/**
 * Get cache client
 */
export const getClient = () => cacheClient;

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Clock in/out - Critical operations, lower limit
  CLOCK_IN_OUT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many clock in/out attempts. Please try again later.'
  },

  // Statistics queries - Higher limit for dashboards
  STATS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Too many statistics requests. Please try again later.'
  },

  // General list queries
  LIST: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many list requests. Please try again later.'
  },

  // Bulk operations - Very restrictive
  BULK: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'Too many bulk operations. Please try again later.'
  },

  // Export operations - Restrictive to prevent abuse
  EXPORT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3,
    message: 'Too many export requests. Please try again later.'
  },

  // General API requests
  GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests. Please try again later.'
  }
};

// In-memory fallback for rate limiting
const inMemoryStore = new Map();

/**
 * Clean up expired in-memory rate limit entries
 */
const cleanupInMemoryStore = () => {
  const now = Date.now();
  for (const [key, value] of inMemoryStore.entries()) {
    if (value.resetTime < now) {
      inMemoryStore.delete(key);
    }
  }
};

// Run cleanup every minute
setInterval(cleanupInMemoryStore, 60 * 1000);

/**
 * Get rate limit key for request
 * @param {Object} req - Express request
 * @param {string} prefix - Key prefix
 * @returns {string} Rate limit key
 */
const getRateLimitKey = (req, prefix = 'ratelimit') => {
  const identifier = req.user?.userId || req.ip || 'anonymous';
  const companyId = req.user?.companyId || 'default';
  return `${prefix}:${companyId}:${identifier}`;
};

/**
 * Check rate limit using Redis
 * @param {string} key - Rate limit key
 * @param {number} windowMs - Window in milliseconds
 * @param {number} maxRequests - Maximum requests
 * @returns {Promise<Object>} Rate limit status
 */
const checkRedisRateLimit = async (key, windowMs, maxRequests) => {
  const client = getClient();
  if (!client) {
    return null; // Fallback to in-memory
  }

  try {
    const windowSec = Math.ceil(windowMs / 1000);
    const current = await client.incr(key);

    if (current === 1) {
      await client.expire(key, windowSec);
    }

    const ttl = await client.pttl(key);

    return {
      current,
      max: maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetTime: Date.now() + ttl,
      success: current <= maxRequests
    };
  } catch (error) {
    logger.error('Redis rate limit error', { error: error.message });
    return null; // Fallback to in-memory
  }
};

/**
 * Check rate limit using in-memory store
 * @param {string} key - Rate limit key
 * @param {number} windowMs - Window in milliseconds
 * @param {number} maxRequests - Maximum requests
 * @returns {Object} Rate limit status
 */
const checkInMemoryRateLimit = (key, windowMs, maxRequests) => {
  const now = Date.now();
  const record = inMemoryStore.get(key);

  // Reset if window expired
  if (!record || record.resetTime < now) {
    inMemoryStore.set(key, {
      current: 1,
      max: maxRequests,
      resetTime: now + windowMs
    });

    return {
      current: 1,
      max: maxRequests,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
      success: true
    };
  }

  // Increment counter
  record.current++;

  if (record.current > maxRequests) {
    return {
      current: record.current,
      max: maxRequests,
      remaining: 0,
      resetTime: record.resetTime,
      success: false
    };
  }

  return {
    current: record.current,
    max: maxRequests,
    remaining: maxRequests - record.current,
    resetTime: record.resetTime,
    success: true
  };
};

/**
 * Create rate limiting middleware
 * @param {Object} options - Rate limit options
 * @returns {Function} Express middleware
 */
export const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000,
    maxRequests = 100,
    message = 'Too many requests. Please try again later.',
    keyPrefix = 'ratelimit',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async (req, res, next) => {
    const key = getRateLimitKey(req, keyPrefix);

    // Try Redis first, fallback to in-memory
    let result = await checkRedisRateLimit(key, windowMs, maxRequests);

    if (!result) {
      result = checkInMemoryRateLimit(key, windowMs, maxRequests);
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', result.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    // Log rate limit
    logger.debug('Rate limit check', {
      key,
      current: result.current,
      max: result.max,
      remaining: result.remaining,
      success: result.success
    });

    // Check if limit exceeded
    if (!result.success) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());

      logger.warn('Rate limit exceeded', {
        key,
        current: result.current,
        max: result.max,
        ip: req.ip,
        userId: req.user?.userId
      });

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfter,
          resetTime: new Date(result.resetTime).toISOString()
        }
      });
    }

    next();
  };
};

/**
 * Rate limiter factory for predefined limits
 * @param {string} type - Rate limit type
 * @returns {Function} Express middleware
 */
export const rateLimiter = (type = 'GENERAL') => {
  const config = RATE_LIMITS[type] || RATE_LIMITS.GENERAL;

  return createRateLimiter({
    ...config,
    keyPrefix: `ratelimit:${type.toLowerCase()}`
  });
};

/**
 * Clock in/out rate limiter
 */
export const clockInOutRateLimiter = rateLimiter('CLOCK_IN_OUT');

/**
 * Statistics rate limiter
 */
export const statsRateLimiter = rateLimiter('STATS');

/**
 * List query rate limiter
 */
export const listRateLimiter = rateLimiter('LIST');

/**
 * Bulk operation rate limiter
 */
export const bulkRateLimiter = rateLimiter('BULK');

/**
 * Export rate limiter
 */
export const exportRateLimiter = rateLimiter('EXPORT');

/**
 * General API rate limiter
 */
export const generalRateLimiter = rateLimiter('GENERAL');

/**
 * Custom rate limiter with dynamic limits based on user role
 * @param {Object} roleLimits - Limits per role
 * @returns {Function} Express middleware
 */
export const roleBasedRateLimiter = (roleLimits = {}) => {
  return async (req, res, next) => {
    const userRole = req.user?.role || 'public';
    const limits = roleLimits[userRole] || roleLimits.public || RATE_LIMITS.GENERAL;

    const limiter = createRateLimiter({
      ...limits,
      keyPrefix: `ratelimit:role:${userRole}`
    });

    return limiter(req, res, next);
  };
};

/**
 * Whitelist middleware - skips rate limiting for specific IPs
 * @param {Array<string>} whitelist - Array of whitelisted IPs
 * @returns {Function} Express middleware
 */
export const createWhitelistedRateLimiter = (whitelist = [], limiterOptions = {}) => {
  const limiter = createRateLimiter(limiterOptions);

  return (req, res, next) => {
    if (whitelist.includes(req.ip)) {
      logger.debug('Rate limit skipped (whitelisted)', { ip: req.ip });
      return next();
    }

    return limiter(req, res, next);
  };
};

/**
 * Get rate limit status for current user
 * @param {Object} req - Express request
 * @param {string} keyPrefix - Rate limit key prefix
 * @returns {Promise<Object>} Rate limit status
 */
export const getRateLimitStatus = async (req, keyPrefix = 'ratelimit') => {
  const key = getRateLimitKey(req, keyPrefix);

  // Check Redis
  const client = getClient();
  if (client) {
    try {
      const current = parseInt(await client.get(key)) || 0;
      const ttl = await client.pttl(key);

      return {
        current,
        resetTime: ttl > 0 ? Date.now() + ttl : Date.now() + 60000
      };
    } catch (error) {
      logger.error('Error getting rate limit status', { error: error.message });
    }
  }

  // Check in-memory
  const record = inMemoryStore.get(key);
  if (record) {
    return {
      current: record.current,
      resetTime: record.resetTime
    };
  }

  return {
    current: 0,
    resetTime: Date.now() + 60000
  };
};

/**
 * Reset rate limit for a specific user (admin function)
 * @param {string} key - Rate limit key
 * @returns {Promise<boolean>} Success status
 */
export const resetRateLimit = async (key) => {
  const client = getClient();
  if (client) {
    try {
      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Error resetting rate limit', { error: error.message });
      return false;
    }
  }

  // In-memory reset
  inMemoryStore.delete(key);
  return true;
};

export default {
  createRateLimiter,
  rateLimiter,
  clockInOutRateLimiter,
  statsRateLimiter,
  listRateLimiter,
  bulkRateLimiter,
  exportRateLimiter,
  generalRateLimiter,
  roleBasedRateLimiter,
  createWhitelistedRateLimiter,
  getRateLimitStatus,
  resetRateLimit,
  RATE_LIMITS
};
