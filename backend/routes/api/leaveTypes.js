/**
 * Leave Type REST API Routes
 * All leave type management endpoints
 */

import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import leaveTypeController from '../../controllers/rest/leaveType.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/leave-types
 * @desc    Get all leave types with pagination and filtering
 * @access  Private (Admin, HR, Superadmin)
 */
router.get('/', leaveTypeController.getLeaveTypes);

/**
 * @route   GET /api/leave-types/active
 * @desc    Get active leave types (for dropdowns/selects)
 * @access  Private (All authenticated users)
 */
router.get('/active', leaveTypeController.getActiveLeaveTypes);

/**
 * @route   GET /api/leave-types/stats
 * @desc    Get leave type statistics
 * @access  Private (Admin, HR, Superadmin)
 */
router.get('/stats', leaveTypeController.getLeaveTypeStats);

/**
 * @route   GET /api/leave-types/:id
 * @desc    Get single leave type by ID
 * @access  Private (Admin, HR, Superadmin)
 */
router.get('/:id', leaveTypeController.getLeaveTypeById);

/**
 * @route   POST /api/leave-types
 * @desc    Create new leave type
 * @access  Private (Admin, Superadmin)
 */
router.post('/', leaveTypeController.createLeaveType);

/**
 * @route   PUT /api/leave-types/:id
 * @desc    Update leave type
 * @access  Private (Admin, Superadmin)
 */
router.put('/:id', leaveTypeController.updateLeaveType);

/**
 * @route   PATCH /api/leave-types/:id/toggle
 * @desc    Toggle leave type active status
 * @access  Private (Admin, Superadmin)
 */
router.patch('/:id/toggle', leaveTypeController.toggleLeaveTypeStatus);

/**
 * @route   DELETE /api/leave-types/:id
 * @desc    Delete leave type (soft delete)
 * @access  Private (Admin, Superadmin)
 */
router.delete('/:id', leaveTypeController.deleteLeaveType);

export default router;
