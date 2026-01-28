/**
 * Leave REST API Routes
 * All leave management endpoints
 */

import express from 'express';
import leaveController from '../../controllers/rest/leave.controller.js';

const router = express.Router();

/**
 * @route   GET /api/leaves
 * @desc    Get all leave requests with pagination and filtering
 * @access  Private (Admin, HR, Superadmin)
 */
router.get('/', leaveController.getLeaves);

/**
 * @route   GET /api/leaves/my
 * @desc    Get current user's leave requests
 * @access  Private (All authenticated users)
 */
router.get('/my', leaveController.getMyLeaves);

/**
 * @route   GET /api/leaves/status/:status
 * @desc    Get leave requests by status
 * @access  Private (Admin, HR, Superadmin)
 */
router.get('/status/:status', leaveController.getLeavesByStatus);

/**
 * @route   GET /api/leaves/balance
 * @desc    Get leave balance
 * @access  Private (All authenticated users)
 */
router.get('/balance', leaveController.getLeaveBalance);

/**
 * @route   GET /api/leaves/:id
 * @desc    Get single leave request by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id', leaveController.getLeaveById);

/**
 * @route   POST /api/leaves
 * @desc    Create new leave request
 * @access  Private (All authenticated users)
 */
router.post('/', leaveController.createLeave);

/**
 * @route   PUT /api/leaves/:id
 * @desc    Update leave request
 * @access  Private (Admin, HR, Owner)
 */
router.put('/:id', leaveController.updateLeave);

/**
 * @route   DELETE /api/leaves/:id
 * @desc    Delete leave request (soft delete)
 * @access  Private (Admin, Superadmin, Owner)
 */
router.delete('/:id', leaveController.deleteLeave);

/**
 * @route   POST /api/leaves/:id/approve
 * @desc    Approve leave request
 * @access  Private (Admin, HR, Manager)
 */
router.post('/:id/approve', leaveController.approveLeave);

/**
 * @route   POST /api/leaves/:id/reject
 * @desc    Reject leave request
 * @access  Private (Admin, HR, Manager)
 */
router.post('/:id/reject', leaveController.rejectLeave);

export default router;
