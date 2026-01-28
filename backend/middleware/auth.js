/**
 * Authentication Middleware for REST APIs
 * Verifies Clerk JWT tokens and extracts user metadata
 */

import { requireAuth } from "@clerk/express";

/**
 * Authenticate - Main authentication middleware
 * Verifies Clerk JWT token and attaches user info to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Use Clerk's requireAuth to verify JWT
    await requireAuth()(req, res, next);

    // Extract user information from Clerk session
    if (req.auth) {
      req.user = {
        userId: req.auth.userId,
        companyId: req.auth.publicMetadata?.companyId || null,
        role: req.auth.publicMetadata?.role || 'public',
        email: req.auth.primaryEmailAddress?.emailAddress
      };
    }
  } catch (error) {
    console.error('[Auth Middleware Error]', {
      error: error.message,
      requestId: req.id
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        requestId: req.id || 'no-id'
      }
    });
  }
};

/**
 * requireRole - Role-based authorization middleware
 * Checks if authenticated user has one of the required roles
 *
 * @param {...string} roles - Allowed roles
 * @returns {Function} Express middleware function
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    // First ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.id || 'no-id'
        }
      });
    }

    // Check if user has one of the required roles
    if (!roles.includes(req.user.role)) {
      console.warn('[Authorization Failed]', {
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRoles: roles,
        requestId: req.id
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient permissions. Required roles: ${roles.join(', ')}`,
          requestId: req.id || 'no-id'
        }
      });
    }

    // User is authenticated and has required role
    console.log('[Authorization Success]', {
      userId: req.user.userId,
      role: req.user.role,
      companyId: req.user.companyId,
      requestId: req.id
    });

    next();
  };
};

/**
 * requireCompany - Ensures user belongs to a company
 * Superadmin bypasses this check
 */
export const requireCompany = (req, res, next) => {
  // Superadmin doesn't need company
  if (req.user && req.user.role === 'superadmin') {
    return next();
  }

  if (!req.user || !req.user.companyId) {
    console.warn('[Company Check Failed]', {
      userId: req.user?.userId,
      hasCompanyId: !!req.user?.companyId,
      requestId: req.id
    });

    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Must belong to a company',
        requestId: req.id || 'no-id'
      }
    });
  }

  next();
};

/**
 * optionalAuth - Allows access without authentication
 * Useful for public endpoints
 */
export const optionalAuth = async (req, res, next) => {
  try {
    await requireAuth()(req, res, () => {
      // Continue regardless of auth result
      next();
    });
  } catch (error) {
    // No authentication required, continue
    next();
  }
};

/**
 * attachRequestId - Adds unique request ID for tracing
 */
export const attachRequestId = (req, res, next) => {
  // Generate or use existing request ID
  req.id = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  // Add request ID to response headers for tracing
  res.setHeader('X-Request-ID', req.id);

  next();
};

export default {
  authenticate,
  requireRole,
  requireCompany,
  optionalAuth,
  attachRequestId
};
