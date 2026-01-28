/**
 * Lead API Routes
 * REST API endpoints for Lead management
 */

import express from 'express';
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getMyLeads,
  getLeadsByStage,
  updateLeadStage,
  convertLeadToClient,
  searchLeads,
  getLeadStats
} from '../../controllers/rest/lead.controller.js';
import {
  authenticate,
  requireRole,
  requireCompany,
  attachRequestId
} from '../../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  leadSchemas
} from '../../middleware/validate.js';

const router = express.Router();

// Apply request ID middleware to all routes
router.use(attachRequestId);

/**
 * Public Routes (Authenticated users can access)
 */

// Get current user's leads
router.get(
  '/my',
  authenticate,
  getMyLeads
);

// Get leads by stage
router.get(
  '/stage/:stage',
  authenticate,
  getLeadsByStage
);

// Search leads
router.get(
  '/search',
  authenticate,
  searchLeads
);

// Get lead statistics
router.get(
  '/stats',
  authenticate,
  requireRole('admin', 'hr', 'superadmin'),
  getLeadStats
);

/**
 * Admin/HR Routes (Restricted access)
 */

// List all leads with pagination and filtering
router.get(
  '/',
  authenticate,
  validateQuery(leadSchemas.list),
  getLeads
);

// Create new lead
router.post(
  '/',
  authenticate,
  requireRole('admin', 'hr', 'superadmin'),
  validateBody(leadSchemas.create),
  createLead
);

/**
 * Individual Lead Routes
 */

// Get single lead by ID
router.get(
  '/:id',
  authenticate,
  getLeadById
);

// Update lead
router.put(
  '/:id',
  authenticate,
  requireRole('admin', 'hr', 'superadmin'),
  validateBody(leadSchemas.update),
  updateLead
);

// Delete lead (soft delete)
router.delete(
  '/:id',
  authenticate,
  requireRole('admin', 'superadmin'),
  deleteLead
);

// Update lead stage
router.patch(
  '/:id/stage',
  authenticate,
  requireRole('admin', 'hr', 'superadmin'),
  updateLeadStage
);

// Convert lead to client
router.post(
  '/:id/convert',
  authenticate,
  requireRole('admin', 'hr', 'superadmin'),
  convertLeadToClient
);

export default router;
