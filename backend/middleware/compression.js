/**
 * Compression Middleware
 * Provides response compression for API endpoints
 * Uses gzip and brotli compression for better performance
 */

import compression from 'compression';
import zlib from 'zlib';
import logger from '../utils/logger.js';

/**
 * Compression configuration
 */
const COMPRESSION_CONFIG = {
  // Threshold for compression (bytes)
  threshold: 1024, // Only compress responses larger than 1KB

  // Compression level (0-9)
  level: 6,

  // Chunk size for compression
  chunkSize: 16 * 1024, // 16KB

  // Window size for compression
  windowBits: 15,

  // Memory level for compression
  memLevel: 8,

  // Filter function to determine if response should be compressed
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      // Don't compress if client requests no compression
      return false;
    }

    // Compress all JSON responses
    return res.getHeader('Content-Type')?.includes('application/json');
  }
};

/**
 * Create custom compression middleware
 * @param {Object} options - Compression options
 * @returns {Function} Express middleware
 */
export const createCompressionMiddleware = (options = {}) => {
  const config = { ...COMPRESSION_CONFIG, ...options };

  return compression({
    threshold: config.threshold,
    level: config.level,
    chunkSize: config.chunkSize,
    windowBits: config.windowBits,
    memLevel: config.memLevel,
    filter: config.filter,

    // Use brotli if available
    brotli: {
      enabled: true,
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4
      }
    }
  });
};

/**
 * Default compression middleware
 */
export const compressionMiddleware = createCompressionMiddleware();

/**
 * Selective compression middleware for specific routes
 * @param {Array<string>} routes - Routes to compress
 * @returns {Function} Express middleware
 */
export const selectiveCompression = (routes = []) => {
  const compress = createCompressionMiddleware();

  return (req, res, next) => {
    // Check if current path matches any of the routes
    const shouldCompress = routes.some(route => req.path.startsWith(route));

    if (shouldCompress) {
      return compress(req, res, next);
    }

    return next();
  };
};

/**
 * Compression middleware for API routes only
 * Compresses /api/* routes
 */
export const apiCompression = selectiveCompression(['/api']);

/**
 * Pre-compression filter for attendance data
 * Checks if attendance response should be compressed
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {boolean} Whether to compress
 */
export const attendanceCompressionFilter = (req, res) => {
  // Don't compress if client doesn't accept encoding
  const acceptEncoding = req.headers['accept-encoding'];
  if (!acceptEncoding?.includes('gzip') && !acceptEncoding?.includes('br')) {
    return false;
  }

  // Don't compress if client explicitly requests no compression
  if (req.headers['x-no-compression']) {
    return false;
  }

  // Compress JSON responses for attendance endpoints
  const contentType = res.getHeader('Content-Type');
  const isAttendanceEndpoint = req.path.startsWith('/api/attendance');

  return isAttendanceEndpoint && contentType?.includes('application/json');
};

/**
 * Attendance-specific compression middleware
 */
export const attendanceCompression = createCompressionMiddleware({
  filter: attendanceCompressionFilter,
  threshold: 512, // Lower threshold for attendance data (512 bytes)
  level: 6
});

/**
 * Compression stats middleware
 * Logs compression statistics
 */
export const compressionStats = (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;

  let contentLength = 0;
  let compressed = false;

  // Override res.json
  res.json = function(data) {
    contentLength = JSON.stringify(data).length;
    return originalJson.call(this, data);
  };

  // Override res.send
  res.send = function(data) {
    if (typeof data === 'string') {
      contentLength = data.length;
    } else if (Buffer.isBuffer(data)) {
      contentLength = data.length;
    } else {
      contentLength = JSON.stringify(data).length;
    }
    return originalSend.call(this, data);
  };

  // Check if response will be compressed
  res.on('finish', () => {
    const encoding = res.getHeader('Content-Encoding');
    compressed = encoding === 'gzip' || encoding === 'br';

    if (contentLength > 0) {
      const actualLength = parseInt(res.getHeader('Content-Length') || '0');
      const compressionRatio = actualLength > 0
        ? ((contentLength - actualLength) / contentLength * 100).toFixed(2)
        : 0;

      if (compressed) {
        logger.debug('Compression stats', {
          path: req.path,
          originalSize: contentLength,
          compressedSize: actualLength,
          compressionRatio: `${compressionRatio}%`,
          encoding
        });
      }
    }
  });

  next();
};

/**
 * Add compression headers to response
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next function
 */
export const addCompressionHeaders = (req, res, next) => {
  // Tell client we support compression
  res.setHeader('Vary', 'Accept-Encoding');

  next();
};

/**
 * Disable compression for specific routes
 * @param {Array<string>} routes - Routes to exclude from compression
 * @returns {Function} Express middleware
 */
export const excludeFromCompression = (routes = []) => {
  return (req, res, next) => {
    const shouldExclude = routes.some(route => req.path.startsWith(route));

    if (shouldExclude) {
      res.setHeader('X-No-Compression', 'true');
    }

    next();
  };
};

/**
 * ETag middleware for cache validation
 * Works with compression for better caching
 */
export const etagMiddleware = (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-cache');
  res.setHeader('ETag', `${req.path}-${Date.now()}`);
  next();
};

/**
 * Compression middleware configuration
 */
export const getCompressionConfig = () => {
  return {
    ...COMPRESSION_CONFIG,
    enabled: process.env.COMPRESSION_ENABLED !== 'false',
    brotliEnabled: process.env.BROTLI_ENABLED !== 'false'
  };
};

/**
 * Middleware to add compression stats to response headers
 */
export const addCompressionStatsHeaders = (req, res, next) => {
  const originalWrite = res.write;
  const originalEnd = res.end;

  let writtenBytes = 0;

  res.write = function(chunk, ...args) {
    if (chunk) {
      writtenBytes += Buffer.byteLength(chunk);
    }
    return originalWrite.apply(this, [chunk, ...args]);
  };

  res.end = function(chunk, ...args) {
    if (chunk) {
      writtenBytes += Buffer.byteLength(chunk);
    }

    // Add compression info header
    const encoding = res.getHeader('Content-Encoding');
    if (encoding) {
      res.setHeader('X-Compression-Encoding', encoding);
      res.setHeader('X-Original-Size', writtenBytes);
    }

    return originalEnd.apply(this, [chunk, ...args]);
  };

  next();
};

export default {
  createCompressionMiddleware,
  compressionMiddleware,
  selectiveCompression,
  apiCompression,
  attendanceCompression,
  compressionStats,
  addCompressionHeaders,
  excludeFromCompression,
  etagMiddleware,
  addCompressionStatsHeaders,
  getCompressionConfig,
  COMPRESSION_CONFIG
};
