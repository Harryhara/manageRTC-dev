/**
 * Cache Management Service
 * Provides in-memory caching with TTL (Time To Live)
 * Can be extended to use Redis for distributed caching
 * Used for caching holidays, leave balances, and other frequently accessed data
 */

import logger from './logger.js';

// In-memory cache store
const cacheStore = new Map();
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  expires: 0
};

// Default TTL values (in milliseconds)
const DEFAULT_TTL = {
  SHORT: 5 * 60 * 1000,      // 5 minutes
  MEDIUM: 15 * 60 * 1000,     // 15 minutes
  LONG: 60 * 60 * 1000,       // 1 hour
  VERY_LONG: 4 * 60 * 60 * 1000 // 4 hours
};

/**
 * Generate cache key from components
 * @param {string} prefix - Cache key prefix
 * @param {Array} components - Key components
 * @returns {string} Generated cache key
 */
const generateCacheKey = (prefix, components = []) => {
  const keyParts = [prefix, ...components];
  return keyParts.filter(Boolean).join(':');
};

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} ttl - Time to live in milliseconds
 */
export const set = (key, value, ttl = DEFAULT_TTL.MEDIUM) => {
  const expiresAt = Date.now() + ttl;

  cacheStore.set(key, {
    value,
    expiresAt
  });

  cacheStats.sets++;

  logger.debug('Cache set', { key, ttl, expiresAt: new Date(expiresAt).toISOString() });
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {*} Cached value or undefined if not found/expired
 */
export const get = (key) => {
  const item = cacheStore.get(key);

  if (!item) {
    cacheStats.misses++;
    logger.debug('Cache miss', { key });
    return undefined;
  }

  // Check if expired
  if (Date.now() > item.expiresAt) {
    cacheStore.delete(key);
    cacheStats.expires++;
    cacheStats.misses++;
    logger.debug('Cache expired', { key });
    return undefined;
  }

  cacheStats.hits++;
  logger.debug('Cache hit', { key });
  return item.value;
};

/**
 * Check if key exists and is valid
 * @param {string} key - Cache key
 * @returns {boolean} True if key exists and is valid
 */
export const has = (key) => {
  return get(key) !== undefined;
};

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {boolean} True if key was deleted
 */
export const del = (key) => {
  const deleted = cacheStore.delete(key);
  if (deleted) {
    cacheStats.deletes++;
    logger.debug('Cache deleted', { key });
  }
  return deleted;
};

/**
 * Clear all cache or by pattern
 * @param {string} pattern - Optional pattern to match keys
 * @returns {number} Number of keys deleted
 */
export const clear = (pattern = null) => {
  if (!pattern) {
    const count = cacheStore.size;
    cacheStore.clear();
    logger.info('Cache cleared', { count });
    return count;
  }

  let count = 0;
  for (const key of cacheStore.keys()) {
    if (key.includes(pattern)) {
      cacheStore.delete(key);
      count++;
    }
  }

  logger.info('Cache cleared by pattern', { pattern, count });
  return count;
};

/**
 * Get or set pattern - returns cached value or sets and returns new value
 * @param {string} key - Cache key
 * @param {Function} factory - Function to generate value if not cached
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise<*>} Cached or newly generated value
 */
export const getOrSet = async (key, factory, ttl = DEFAULT_TTL.MEDIUM) => {
  const cached = get(key);
  if (cached !== undefined) {
    return cached;
  }

  const value = await factory();
  set(key, value, ttl);
  return value;
};

/**
 * Get multiple values by pattern
 * @param {string} pattern - Pattern to match keys
 * @returns {Array} Array of cached values
 */
export const getByPattern = (pattern) => {
  const results = [];
  const now = Date.now();

  for (const [key, item] of cacheStore.entries()) {
    if (key.includes(pattern) && now <= item.expiresAt) {
      results.push({ key, value: item.value, expiresAt: item.expiresAt });
    }
  }

  logger.debug('Cache get by pattern', { pattern, count: results.length });
  return results;
};

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export const getStats = () => {
  const size = cacheStore.size;
  const memoryUsage = process.memoryUsage();

  // Get all keys and their expiration status
  const keys = Array.from(cacheStore.entries()).map(([key, item]) => ({
    key,
    expiresAt: item.expiresAt,
    isExpired: Date.now() > item.expiresAt,
    ttl: Math.max(0, item.expiresAt - Date.now())
  }));

  const expiredCount = keys.filter(k => k.isExpired).length;

  return {
    size,
    activeKeys: size - expiredCount,
    expiredKeys: expiredCount,
    hitRate: size > 0 ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(2) + '%' : '0%',
    stats: { ...cacheStats },
    keys,
    memoryUsage: {
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
    }
  };
};

/**
 * Clean up expired entries
 * @returns {number} Number of entries cleaned
 */
export const cleanup = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, item] of cacheStore.entries()) {
    if (now > item.expiresAt) {
      cacheStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    cacheStats.deletes += cleaned;
    logger.info('Cache cleanup', { cleaned });
  }

  return cleaned;
};

// Auto-cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);

/**
 * HRM-specific caching helpers
 */

/**
 * Cache holiday data
 * @param {string} companyId - Company ID
 * @param {Array} holidays - Holiday data
 * @param {number} ttl - Time to live
 */
export const cacheHolidays = (companyId, holidays, ttl = DEFAULT_TTL.LONG) => {
  const key = generateCacheKey('holidays', [companyId]);
  set(key, holidays, ttl);
  logger.info('Holidays cached', { companyId, count: holidays.length });
};

/**
 * Get cached holidays
 * @param {string} companyId - Company ID
 * @returns {Array|undefined} Cached holidays or undefined
 */
export const getCachedHolidays = (companyId) => {
  const key = generateCacheKey('holidays', [companyId]);
  return get(key);
};

/**
 * Cache employee leave balance
 * @param {string} companyId - Company ID
 * @param {string} employeeId - Employee ID
 * @param {Object} balances - Leave balance data
 * @param {number} ttl - Time to live
 */
export const cacheLeaveBalance = (companyId, employeeId, balances, ttl = DEFAULT_TTL.MEDIUM) => {
  const key = generateCacheKey('leaveBalance', [companyId, employeeId]);
  set(key, balances, ttl);
  logger.debug('Leave balance cached', { companyId, employeeId });
};

/**
 * Get cached leave balance
 * @param {string} companyId - Company ID
 * @param {string} employeeId - Employee ID
 * @returns {Object|undefined} Cached balance or undefined
 */
export const getCachedLeaveBalance = (companyId, employeeId) => {
  const key = generateCacheKey('leaveBalance', [companyId, employeeId]);
  return get(key);
};

/**
 * Invalidate all cache for a company
 * @param {string} companyId - Company ID
 * @returns {number} Number of keys deleted
 */
export const invalidateCompanyCache = (companyId) => {
  const pattern = generateCacheKey('', [companyId]);
  return clear(pattern);
};

/**
 * Invalidate employee-specific cache
 * @param {string} companyId - Company ID
 * @param {string} employeeId - Employee ID
 * @returns {number} Number of keys deleted
 */
export const invalidateEmployeeCache = (companyId, employeeId) => {
  const pattern = generateCacheKey('', [companyId, employeeId]);
  return clear(pattern);
};

/**
 * Cache working days calculation result
 * @param {string} companyId - Company ID
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @param {Object} result - Working days calculation result
 * @param {number} ttl - Time to live
 */
export const cacheWorkingDays = (companyId, startDate, endDate, result, ttl = DEFAULT_TTL.LONG) => {
  const key = generateCacheKey('workingDays', [companyId, startDate, endDate]);
  set(key, result, ttl);
  logger.debug('Working days cached', { companyId, startDate, endDate, workingDays: result.workingDays });
};

/**
 * Get cached working days calculation
 * @param {string} companyId - Company ID
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {Object|undefined} Cached result or undefined
 */
export const getCachedWorkingDays = (companyId, startDate, endDate) => {
  const key = generateCacheKey('workingDays', [companyId, startDate, endDate]);
  return get(key);
};

/**
 * Prefetch commonly accessed data
 * @param {string} companyId - Company ID
 */
export const prefetchCompanyData = async (companyId) => {
  // This can be expanded to prefetch multiple types of data
  logger.info('Prefetching company data', { companyId });
  // Implementation would call various services to populate cache
};

/**
 * Get cache size (number of entries)
 * @returns {number} Cache size
 */
export const size = () => {
  // Count only non-expired entries
  const now = Date.now();
  let count = 0;
  for (const [, item] of cacheStore.entries()) {
    if (now <= item.expiresAt) {
      count++;
    }
  }
  return count;
};

/**
 * Cache configuration
 */
export const TTL = DEFAULT_TTL;

export default {
  // Core cache operations
  set,
  get,
  has,
  del,
  clear,
  getOrSet,
  getByPattern,
  getStats,
  cleanup,
  size,

  // HRM-specific caching
  cacheHolidays,
  getCachedHolidays,
  cacheLeaveBalance,
  getCachedLeaveBalance,
  cacheWorkingDays,
  getCachedWorkingDays,
  invalidateCompanyCache,
  invalidateEmployeeCache,
  prefetchCompanyData,

  // Configuration
  TTL,
  generateCacheKey
};
