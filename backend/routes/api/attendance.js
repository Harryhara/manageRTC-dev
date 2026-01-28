/**
 * Attendance REST API Routes
 * All attendance management endpoints
 */

import express from 'express';
import attendanceController from '../../controllers/rest/attendance.controller.js';

const router = express.Router();

/**
 * @route   GET /api/attendance
 * @desc    Get all attendance records with pagination and filtering
 * @access  Private (Admin, HR, Superadmin)
 */
router.get('/', attendanceController.getAttendances);

/**
 * @route   GET /api/attendance/my
 * @desc    Get current user's attendance records
 * @access  Private (All authenticated users)
 */
router.get('/my', attendanceController.getMyAttendance);

/**
 * @route   GET /api/attendance/daterange
 * @desc    Get attendance by date range
 * @access  Private (Admin, HR, Superadmin)
 */
router.get('/daterange', attendanceController.getAttendanceByDateRange);

/**
 * @route   GET /api/attendance/stats
 * @desc    Get attendance statistics
 * @access  Private (Admin, HR, Superadmin)
 */
router.get('/stats', attendanceController.getAttendanceStats);

/**
 * @route   GET /api/attendance/bulk
 * @desc    Bulk attendance actions
 * @access  Private (Admin, HR, Superadmin)
 */
router.post('/bulk', attendanceController.bulkAttendanceAction);

/**
 * @route   GET /api/attendance/employee/:employeeId
 * @desc    Get attendance by employee
 * @access  Private (Admin, HR, Superadmin)
 */
router.get('/employee/:employeeId', attendanceController.getAttendanceByEmployee);

/**
 * @route   GET /api/attendance/:id
 * @desc    Get single attendance record by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id', attendanceController.getAttendanceById);

/**
 * @route   POST /api/attendance
 * @desc    Create new attendance record (clock in)
 * @access  Private (All authenticated users)
 */
router.post('/', attendanceController.createAttendance);

/**
 * @route   PUT /api/attendance/:id
 * @desc    Update attendance record (clock out)
 * @access  Private (All authenticated users)
 */
router.put('/:id', attendanceController.updateAttendance);

/**
 * @route   DELETE /api/attendance/:id
 * @desc    Delete attendance record (soft delete)
 * @access  Private (Admin, Superadmin)
 */
router.delete('/:id', attendanceController.deleteAttendance);

export default router;
