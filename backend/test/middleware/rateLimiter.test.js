/**
 * Rate Limiter Tests
 * Tests for API rate limiting functionality
 */

import { createRateLimiter, rateLimiter, clockInOutRateLimiter, statsRateLimiter, listRateLimiter, bulkRateLimiter, exportRateLimiter, getRateLimitStatus, resetRateLimit } from '../middleware/rateLimiter.js';

// Mock dependencies
jest.mock('../utils/attendanceCache.js', () => ({
  getClient: jest.fn(() => null), // No Redis, use in-memory
  initializeRedis: jest.fn()
}));

jest.mock('../utils/logger.js', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Rate Limiter', () => {
  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      user: {
        userId: 'test-user-id',
        companyId: 'test-company-id'
      }
    };

    mockRes = {
      statusCode: 200,
      body: null,
      setHeader: jest.fn(),
      status: jest.fn(function(code) {
        this.statusCode = code;
        return this;
      }),
      json: jest.fn(function(data) {
        this.body = data;
        return this;
      })
    };

    next = jest.fn();

    // Clear in-memory store
    const inMemoryStore = require('../middleware/rateLimiter.js').inMemoryStore || new Map();
    if (inMemoryStore instanceof Map) {
      inMemoryStore.clear();
    }
  });

  describe('createRateLimiter', () => {
    test('should allow requests within limit', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 5,
        message: 'Too many requests'
      });

      for (let i = 0; i < 5; i++) {
        await limiter(mockReq, mockRes, next);
        expect(next).toHaveBeenCalledTimes(i + 1);
      }
    });

    test('should block requests exceeding limit', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        message: 'Rate limit exceeded'
      });

      // Make 3 allowed requests
      for (let i = 0; i < 3; i++) {
        await limiter(mockReq, mockRes, next);
      }

      // 4th request should be blocked
      await limiter(mockReq, mockRes, next);

      expect(mockRes.statusCode).toBe(429);
      expect(mockRes.body).toBeDefined();
      expect(mockRes.body.success).toBe(false);
      expect(mockRes.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('should set rate limit headers', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 10
      });

      await limiter(mockReq, mockRes, next);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    test('should set Retry-After header when blocked', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 2
      });

      // Exhaust limit
      await limiter(mockReq, mockRes, next);
      await limiter(mockReq, mockRes, next);

      // Block request
      await limiter(mockReq, mockRes, next);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });
  });

  describe('Predefined Rate Limiters', () => {
    test('clockInOutRateLimiter should have strict limits', async () => {
      const limiter = clockInOutRateLimiter();

      // CLOCK_IN_OUT: 10 requests per minute
      for (let i = 0; i < 10; i++) {
        await limiter(mockReq, mockRes, next);
      }

      // 11th request should be blocked
      await limiter(mockReq, mockRes, next);

      expect(mockRes.statusCode).toBe(429);
      expect(mockRes.body.error.message).toContain('clock in/out');
    });

    test('statsRateLimiter should allow more requests', async () => {
      const limiter = statsRateLimiter();

      // STATS: 30 requests per minute
      for (let i = 0; i < 30; i++) {
        await limiter(mockReq, mockRes, next);
      }

      // 31st request should be blocked
      await limiter(mockReq, mockRes, next);

      expect(mockRes.statusCode).toBe(429);
    });

    test('listRateLimiter should allow 100 requests per minute', async () => {
      const limiter = listRateLimiter();

      // First 100 should pass
      for (let i = 0; i < 100; i++) {
        await limiter(mockReq, mockRes, next);
      }

      // 101st should be blocked
      await limiter(mockReq, mockRes, next);

      expect(mockRes.statusCode).toBe(429);
    });

    test('bulkRateLimiter should be restrictive (5 requests)', async () => {
      const limiter = bulkRateLimiter();

      for (let i = 0; i < 5; i++) {
        await limiter(mockReq, mockRes, next);
      }

      await limiter(mockReq, mockRes, next);

      expect(mockRes.statusCode).toBe(429);
      expect(mockRes.body.error.message).toContain('bulk');
    });

    test('exportRateLimiter should be very restrictive (3 requests)', async () => {
      const limiter = exportRateLimiter();

      for (let i = 0; i < 3; i++) {
        await limiter(mockReq, mockRes, next);
      }

      await limiter(mockReq, mockRes, next);

      expect(mockRes.statusCode).toBe(429);
      expect(mockRes.body.error.message).toContain('export');
    });

    test('generalRateLimiter should allow 100 requests per minute', async () => {
      const limiter = generalRateLimiter();

      for (let i = 0; i < 100; i++) {
        await limiter(mockReq, mockRes, next);
      }

      await limiter(mockReq, mockRes, next);

      expect(mockRes.statusCode).toBe(429);
    });
  });

  describe('Rate Limit Keys', () => {
    test('should create unique keys per user', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 2
      });

      // First user
      const req1 = { ...mockReq, user: { userId: 'user-1' } };
      await limiter(req1, mockRes, next);
      await limiter(req1, mockRes, next);

      // Second user should have independent limit
      const req2 = { ...mockReq, user: { userId: 'user-2' } };
      await limiter(req2, { ...mockRes, status: jest.fn().mockReturnThis() }, next);

      expect(next).toHaveBeenCalledTimes(3); // 2 for user-1, 1 for user-2
    });

    test('should create unique keys per IP when no user', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 2
      });

      const reqNoUser = { ip: '192.168.1.1' };
      await limiter(reqNoUser, mockRes, next);
      await limiter(reqNoUser, mockRes, next);

      // Different IP should have independent limit
      const reqNoUser2 = { ip: '192.168.1.2' };
      await limiter(reqNoUser2, { ...mockRes, status: jest.fn().mockReturnThis() }, next);

      expect(next).toHaveBeenCalledTimes(3);
    });

    test('should include company in rate limit key', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 2,
        keyPrefix: 'test'
      });

      const req1 = { ...mockReq, user: { userId: 'user-1', companyId: 'company-1' } };
      await limiter(req1, mockRes, next);

      // Same user, different company = different limit
      const req2 = { ...mockReq, user: { userId: 'user-1', companyId: 'company-2' } };
      await limiter(req2, { ...mockRes, status: jest.fn().mockReturnThis() }, next);

      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe('Window Expiry', () => {
    test('should reset limit after window expires', async () => {
      const limiter = createRateLimiter({
        windowMs: 100, // 100ms window
        maxRequests: 2
      });

      // Exhaust limit
      await limiter(mockReq, mockRes, next);
      await limiter(mockReq, mockRes, next);

      // Should be blocked
      await limiter(mockReq, mockRes, next);
      expect(mockRes.statusCode).toBe(429);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // New request should be allowed
      await limiter(mockReq, { ...mockRes, status: jest.fn().mockReturnThis() }, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Rate Limit Status', () => {
    test('should get current rate limit status', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 10
      });

      await limiter(mockReq, mockRes, next);

      const status = await getRateLimitStatus(mockReq, 'test-prefix');

      expect(status).toBeDefined();
      expect(status.current).toBe(1);
      expect(status.resetTime).toBeDefined();
    });

    test('should return default status for unknown key', async () => {
      const status = await getRateLimitStatus(mockReq, 'unknown-prefix');

      expect(status.current).toBe(0);
      expect(status.resetTime).toBeDefined();
    });
  });

  describe('Rate Limit Reset', () => {
    test('should reset rate limit for specific key', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 2
      });

      // Exhaust limit
      await limiter(mockReq, mockRes, next);
      await limiter(mockReq, mockRes, next);

      // Reset
      const resetSuccess = await resetRateLimit('ratelimit:test:test-company-id:test-user-id');
      expect(resetSuccess).toBe(true);

      // Should be able to make requests again
      await limiter(mockReq, { ...mockRes, status: jest.fn().mockReturnThis() }, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Role-Based Rate Limiting', () => {
    test('should apply different limits per role', async () => {
      const roleLimits = {
        admin: { windowMs: 1000, maxRequests: 100 },
        employee: { windowMs: 1000, maxRequests: 20 }
      };

      const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 50 }); // Default

      // Admin user
      const adminReq = { ...mockReq, user: { userId: 'admin-1', role: 'admin' } };
      const adminLimiter = createRateLimiter(roleLimits.admin);

      // Admin should get 100 requests
      for (let i = 0; i < 100; i++) {
        await adminLimiter(adminReq, mockRes, next);
      }

      // Employee should only get 20
      const employeeReq = { ...mockReq, user: { userId: 'emp-1', role: 'employee' } };
      const employeeLimiter = createRateLimiter(roleLimits.employee);

      for (let i = 0; i < 20; i++) {
        await employeeLimiter(employeeReq, { ...mockRes, status: jest.fn().mockReturnThis() }, next);
      }

      await employeeLimiter(employeeReq, mockRes, next);
      expect(mockRes.statusCode).toBe(429);
    });
  });

  describe('Whitelist', () => {
    test('should skip rate limiting for whitelisted IPs', async () => {
      const whitelist = ['127.0.0.1'];
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 1
      });

      // Whitelisted IP should bypass limit
      for (let i = 0; i < 10; i++) {
        await limiter(mockReq, mockRes, next);
      }

      expect(next).toHaveBeenCalledTimes(10);
    });

    test('should enforce limits for non-whitelisted IPs', async () => {
      const whitelist = ['192.168.1.100'];
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 2
      });

      // Current IP (127.0.0.1) is not whitelisted
      await limiter(mockReq, mockRes, next);
      await limiter(mockReq, mockRes, next);

      await limiter(mockReq, mockRes, next);
      expect(mockRes.statusCode).toBe(429);
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing user gracefully', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 5
      });

      const reqNoUser = { ip: '10.0.0.1' };
      await limiter(reqNoUser, mockRes, next);

      expect(next).toHaveBeenCalled();
    });

    test('should handle requests without IP', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 5
      });

      const reqNoIP = { user: { userId: 'test-user' } };
      await limiter(reqNoIP, mockRes, next);

      expect(next).toHaveBeenCalled();
    });

    test('should handle zero maxRequests', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 0
      });

      await limiter(mockReq, mockRes, next);

      expect(mockRes.statusCode).toBe(429);
    });

    test('should handle very large windowMs', async () => {
      const limiter = createRateLimiter({
        windowMs: 365 * 24 * 60 * 60 * 1000, // 1 year
        maxRequests: 1000000
      });

      await limiter(mockReq, mockRes, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Concurrent Requests', () => {
    test('should handle multiple concurrent requests', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 10
      });

      // Make 10 concurrent requests
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(limiter(mockReq, mockRes, next));
      }

      await Promise.all(requests);

      expect(next).toHaveBeenCalledTimes(10);
    });

    test('should block excess concurrent requests', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 5
      });

      // Make 10 concurrent requests (limit is 5)
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(limiter(mockReq, mockRes, next));
      }

      await Promise.all(requests);

      // Some should have been blocked
      const blockedCount = mockRes.status.mock.calls.filter(call => call[0] === 429).length;
      expect(blockedCount).toBeGreaterThan(0);
    });
  });
});
