/**
 * Holiday Type REST API Routes
 * All holiday type management endpoints
 */

import express from 'express';
import holidayTypeController from '../../controllers/rest/holidayType.controller.js';

const router = express.Router();

/**
 * @route   GET /api/holiday-types
 * @desc    Get all holiday types
 * @access  Private
 */
router.get('/', holidayTypeController.getHolidayTypes);

/**
 * @route   POST /api/holiday-types/initialize
 * @desc    Initialize default holiday types
 * @access  Private (Admin, HR)
 */
router.post('/initialize', holidayTypeController.initializeDefaults);

/**
 * @route   GET /api/holiday-types/:id
 * @desc    Get single holiday type by ID
 * @access  Private
 */
router.get('/:id', holidayTypeController.getHolidayTypeById);

/**
 * @route   POST /api/holiday-types
 * @desc    Create new holiday type
 * @access  Private (Admin, HR)
 */
router.post('/', holidayTypeController.createHolidayType);

/**
 * @route   PUT /api/holiday-types/:id
 * @desc    Update holiday type
 * @access  Private (Admin, HR)
 */
router.put('/:id', holidayTypeController.updateHolidayType);

/**
 * @route   DELETE /api/holiday-types/:id
 * @desc    Delete holiday type (soft delete)
 * @access  Private (Admin)
 */
router.delete('/:id', holidayTypeController.deleteHolidayType);

export default router;
