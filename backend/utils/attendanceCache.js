/**
 * Attendance Cache Service
 * Provides Redis caching for attendance statistics and queries
 * Improves performance by reducing database load
 */

import { createClient } from 'redis';
import logger from './logger.js';
import { logCacheAccess } from './attendanceLogger.js';

// Cache configuration
const CACHE_CONFIG = {
  // Time-to-live for different cache types (in seconds)
  TTL: {
    STATS: 5 * 60, // 5 minutes - Statistics cache
    EMPLOYEE_MONTH: 10 * 60, // 10 minutes - Employee monthly attendance
    TODAY: 1 * 60, // 1 minute - Today's attendance (frequent updates)
    REPORTS: 30 * 60, // 30 minutes - Reports cache
    DATERANGE: 5 * 60, // 5 minutes - Date range queries
    EMPLOYEE_DAILY: 2 * 60 // 2 minutes - Employee daily attendance
  },

  // Cache key prefixes
  PREFIX: {
    STATS: 'attendance:stats',
    EMPLOYEE: 'attendance:employee',
    TODAY: 'attendance:today',
    DATERANGE: 'attendance:daterange',
    COMPANY: 'attendance:company'
  }
};

// Redis client singleton
let redisClient = null;
let isConnected = false;

/**
 * Initialize Redis client
 * @returns {Promise<void>}
 */
export const initializeRedis = async () => {
  try {
    if (redisClient && isConnected) {
      return;
    }

    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection failed');
          }
          return retries * 100; // Exponential backoff
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error', { error: err.message });
      isConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
      isConnected = true;
    });

    redisClient.on('disconnect', () => {
      logger.warn('Redis Client Disconnected');
      isConnected = false;
    });

    await redisClient.connect();
    logger.info('Redis cache initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Redis', { error: error.message });
    isConnected = false;
    // Don't throw - allow app to run without cache
  }
};

/**
 * Get Redis client (lazy initialization)
 * @returns {Object|null} Redis client or null if not available
 */
const getClient = () => {
  if (!redisClient || !isConnected) {
    return null;
  }
  return redisClient;
};

/**
 * Build cache key with company context
 * @param {string} prefix - Cache key prefix
 * @param {string} companyId - Company ID
 * @param {string} suffix - Additional key suffix
 * @returns {string} Complete cache key
 */
const buildKey = (prefix, companyId, suffix = '') => {
  return `${prefix}:${companyId}${suffix ? ':' + suffix : ''}`;
};

/**
 * Get cached data
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached data or null
 */
export const getCached = async (key) => {
  const client = getClient();
  if (!client) {
    return null;
  }

  try {
    const data = await client.get(key);
    if (data) {
      logCacheAccess(key, true);
      return JSON.parse(data);
    }
    logCacheAccess(key, false);
    return null;
  } catch (error) {
    logger.error('Cache get error', { key, error: error.message });
    return null;
  }
};

/**
 * Set cached data with TTL
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
export const setCached = async (key, data, ttl) => {
  const client = getClient();
  if (!client) {
    return false;
  }

  try {
    await client.setEx(key, ttl, JSON.stringify(data));
    return true;
  } catch (error) {
    logger.error('Cache set error', { key, error: error.message });
    return false;
  }
};

/**
 * Delete cached data
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Success status
 */
export const deleteCached = async (key) => {
  const client = getClient();
  if (!client) {
    return false;
  }

  try {
    await client.del(key);
    return true;
  } catch (error) {
    logger.error('Cache delete error', { key, error: error.message });
    return false;
  }
};

/**
 * Delete multiple cache keys by pattern
 * @param {string} pattern - Key pattern (supports wildcards)
 * @returns {Promise<number>} Number of deleted keys
 */
export const deleteCachedPattern = async (pattern) => {
  const client = getClient();
  if (!client) {
    return 0;
  }

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
      logger.info('Cache pattern deleted', { pattern, count: keys.length });
    }
    return keys.length;
  } catch (error) {
    logger.error('Cache pattern delete error', { pattern, error: error.message });
    return 0;
  }
};

/**
 * Cache attendance statistics
 * @param {string} companyId - Company ID
 * @param {Object} filters - Query filters
 * @param {Object} stats - Statistics data
 * @returns {Promise<boolean>} Success status
 */
export const cacheStats = async (companyId, filters, stats) => {
  const suffix = filters ? JSON.stringify(filters) : 'all';
  const key = buildKey(CACHE_CONFIG.PREFIX.STATS, companyId, suffix);
  return setCached(key, stats, CACHE_CONFIG.TTL.STATS);
};

/**
 * Get cached attendance statistics
 * @param {string} companyId - Company ID
 * @param {Object} filters - Query filters
 * @returns {Promise<Object|null>} Cached statistics or null
 */
export const getCachedStats = async (companyId, filters) => {
  const suffix = filters ? JSON.stringify(filters) : 'all';
  const key = buildKey(CACHE_CONFIG.PREFIX.STATS, companyId, suffix);
  return getCached(key);
};

/**
 * Cache employee monthly attendance
 * @param {string} companyId - Company ID
 * @param {string} employeeId - Employee ID
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @param {Array} attendance - Attendance records
 * @returns {Promise<boolean>} Success status
 */
export const cacheEmployeeMonth = async (companyId, employeeId, year, month, attendance) => {
  const suffix = `${employeeId}:${year}:${month}`;
  const key = buildKey(CACHE_CONFIG.PREFIX.EMPLOYEE, companyId, suffix);
  return setCached(key, attendance, CACHE_CONFIG.TTL.EMPLOYEE_MONTH);
};

/**
 * Get cached employee monthly attendance
 * @param {string} companyId - Company ID
 * @param {string} employeeId - Employee ID
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {Promise<Array|null>} Cached attendance or null
 */
export const getCachedEmployeeMonth = async (companyId, employeeId, year, month) => {
  const suffix = `${employeeId}:${year}:${month}`;
  const key = buildKey(CACHE_CONFIG.PREFIX.EMPLOYEE, companyId, suffix);
  return getCached(key);
};

/**
 * Cache today's attendance
 * @param {string} companyId - Company ID
 * @param {Array} attendance - Today's attendance records
 * @returns {Promise<boolean>} Success status
 */
export const cacheTodayAttendance = async (companyId, attendance) => {
  const key = buildKey(CACHE_CONFIG.PREFIX.TODAY, companyId, new Date().toISOString().split('T')[0]);
  return setCached(key, attendance, CACHE_CONFIG.TTL.TODAY);
};

/**
 * Get cached today's attendance
 * @param {string} companyId - Company ID
 * @returns {Promise<Array|null>} Cached attendance or null
 */
export const getCachedTodayAttendance = async (companyId) => {
  const key = buildKey(CACHE_CONFIG.PREFIX.TODAY, companyId, new Date().toISOString().split('T')[0]);
  return getCached(key);
};

/**
 * Cache date range attendance
 * @param {string} companyId - Company ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Array} attendance - Attendance records
 * @returns {Promise<boolean>} Success status
 */
export const cacheDateRangeAttendance = async (companyId, startDate, endDate, attendance) => {
  const suffix = `${startDate.toISOString()}:${endDate.toISOString()}`;
  const key = buildKey(CACHE_CONFIG.PREFIX.DATERANGE, companyId, suffix);
  return setCached(key, attendance, CACHE_CONFIG.TTL.DATERANGE);
};

/**
 * Get cached date range attendance
 * @param {string} companyId - Company ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array|null>} Cached attendance or null
 */
export const getCachedDateRangeAttendance = async (companyId, startDate, endDate) => {
  const suffix = `${startDate.toISOString()}:${endDate.toISOString()}`;
  const key = buildKey(CACHE_CONFIG.PREFIX.DATERANGE, companyId, suffix);
  return getCached(key);
};

/**
 * Invalidate all company attendance cache
 * @param {string} companyId - Company ID
 * @returns {Promise<number>} Number of deleted keys
 */
export const invalidateCompanyCache = async (companyId) => {
  const pattern = `attendance:*:${companyId}*`;
  return deleteCachedPattern(pattern);
};

/**
 * Invalidate employee cache
 * @param {string} companyId - Company ID
 * @param {string} employeeId - Employee ID
 * @returns {Promise<number>} Number of deleted keys
 */
export const invalidateEmployeeCache = async (companyId, employeeId) => {
  const patterns = [
    `attendance:*:${companyId}:${employeeId}*`,
    `attendance:today:${companyId}:*`
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    totalDeleted += await deleteCachedPattern(pattern);
  }
  return totalDeleted;
};

/**
 * Invalidate stats cache
 * @param {string} companyId - Company ID
 * @returns {Promise<number>} Number of deleted keys
 */
export const invalidateStatsCache = async (companyId) => {
  const pattern = `attendance:stats:${companyId}*`;
  return deleteCachedPattern(pattern);
};

/**
 * Invalidate today's cache
 * @param {string} companyId - Company ID
 * @returns {Promise<number>} Number of deleted keys
 */
export const invalidateTodayCache = async (companyId) => {
  const key = buildKey(CACHE_CONFIG.PREFIX.TODAY, companyId, new Date().toISOString().split('T')[0]);
  await deleteCached(key);
  return 1;
};

/**
 * Cache middleware helper - wraps async function with caching
 * @param {string} keyFn - Function to generate cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @param {number} ttl - Cache TTL in seconds
 * @returns {Promise<any>} Cached or fetched data
 */
export const withCache = async (keyFn, fetchFn, ttl) => {
  const key = keyFn();
  const client = getClient();

  if (client) {
    try {
      // Try to get from cache
      const cached = await getCached(key);
      if (cached !== null) {
        return cached;
      }

      // Fetch and cache
      const data = await fetchFn();
      await setCached(key, data, ttl);
      return data;
    } catch (error) {
      logger.error('Cache wrapper error', { key, error: error.message });
      // Fallback to fetch
      return fetchFn();
    }
  }

  // No cache, fetch directly
  return fetchFn();
};

/**
 * Health check for Redis cache
 * @returns {Promise<Object>} Health status
 */
export const cacheHealthCheck = async () => {
  const client = getClient();

  if (!client) {
    return {
      status: 'unavailable',
      message: 'Redis client not initialized'
    };
  }

  try {
    const pong = await client.ping();
    return {
      status: 'healthy',
      message: 'Redis cache is operational',
      ping: pong
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Redis cache error',
      error: error.message
    };
  }
};

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
export const getCacheStats = async () => {
  const client = getClient();

  if (!client) {
    return {
      connected: false,
      keys: 0,
      memory: 0
    };
  }

  try {
    const info = await client.info('stats');
    const keyspace = await client.info('keyspace');

    return {
      connected: true,
      info,
      keyspace
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
};

/**
 * Clear all attendance cache (use with caution)
 * @returns {Promise<number>} Number of deleted keys
 */
export const clearAttendanceCache = async () => {
  const pattern = 'attendance:*';
  return deleteCachedPattern(pattern);
};

export default {
  initializeRedis,
  getCached,
  setCached,
  deleteCached,
  deleteCachedPattern,
  cacheStats,
  getCachedStats,
  cacheEmployeeMonth,
  getCachedEmployeeMonth,
  cacheTodayAttendance,
  getCachedTodayAttendance,
  cacheDateRangeAttendance,
  getCachedDateRangeAttendance,
  invalidateCompanyCache,
  invalidateEmployeeCache,
  invalidateStatsCache,
  invalidateTodayCache,
  withCache,
  cacheHealthCheck,
  getCacheStats,
  clearAttendanceCache,
  CACHE_CONFIG
};
