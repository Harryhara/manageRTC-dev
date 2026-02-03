/**
 * Designation REST API Routes
 * Designation-related endpoints
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import {
  getAllDesignations,
  getDesignationById,
  createDesignation,
  updateDesignationById,
  updateDesignationStatus,
  deleteDesignationById
} from '../../controllers/rest/designation.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/designations
 * @desc    Get all designations with optional filtering
 * @query   departmentId - Filter by department ID
 * @query   status - Filter by status
 */
router.get('/', getAllDesignations);

/**
 * @route   GET /api/designations/:id
 * @desc    Get single designation by ID
 * @param   { string } id - Designation ID
 */
router.get('/:id', getDesignationById);

/**
 * @route   POST /api/designations
 * @desc    Create new designation
 * @body    { designation: string, departmentId: string, status?: string }
 */
router.post('/', createDesignation);

/**
 * @route   PUT /api/designations/:id
 * @desc    Update designation
 * @param   { string } id - Designation ID
 * @body    { designation?: string, departmentId?: string, status?: string }
 */
router.put('/:id', updateDesignationById);

/**
 * @route   PUT /api/designations/:id/status
 * @desc    Update designation status
 * @param   { string } id - Designation ID
 * @body    { status: string } - New status (Active, Inactive, etc.)
 */
router.put('/:id/status', updateDesignationStatus);

/**
 * @route   DELETE /api/designations/:id
 * @desc    Delete designation
 * @param   { string } id - Designation ID
 * @body    { reassignTo?: string } - Optional: Reassign employees to this designation ID
 */
router.delete('/:id', deleteDesignationById);

export default router;
