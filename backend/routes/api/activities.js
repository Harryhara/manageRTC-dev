/**
 * Activity REST API Routes
 * All activity management endpoints
 */

import express from 'express';
import activityController from '../../controllers/rest/activity.controller.js';

const router = express.Router();

/**
 * @route   GET /api/activities
 * @desc    Get all activities with pagination and filtering
 * @access  Private
 */
router.get('/', activityController.getActivities);

/**
 * @route   GET /api/activities/type/:type
 * @desc    Get activities by type
 * @access  Private
 */
router.get('/type/:type', activityController.getActivitiesByType);

/**
 * @route   GET /api/activities/stats
 * @desc    Get activity statistics
 * @access  Private
 */
router.get('/stats', activityController.getActivityStats);

/**
 * @route   GET /api/activities/owners
 * @desc    Get activity owners (for filter dropdown)
 * @access  Private
 */
router.get('/owners', activityController.getActivityOwners);

/**
 * @route   GET /api/activities/upcoming
 * @desc    Get upcoming activities (within 24 hours)
 * @access  Private
 */
router.get('/upcoming', activityController.getUpcomingActivities);

/**
 * @route   GET /api/activities/overdue
 * @desc    Get overdue activities
 * @access  Private
 */
router.get('/overdue', activityController.getOverdueActivities);

/**
 * @route   GET /api/activities/:id
 * @desc    Get single activity by ID
 * @access  Private
 */
router.get('/:id', activityController.getActivityById);

/**
 * @route   POST /api/activities
 * @desc    Create new activity
 * @access  Private
 */
router.post('/', activityController.createActivity);

/**
 * @route   PUT /api/activities/:id
 * @desc    Update activity
 * @access  Private
 */
router.put('/:id', activityController.updateActivity);

/**
 * @route   PUT /api/activities/:id/complete
 * @desc    Mark activity as complete
 * @access  Private
 */
router.put('/:id/complete', activityController.markActivityComplete);

/**
 * @route   PUT /api/activities/:id/postpone
 * @desc    Postpone activity to new date
 * @access  Private
 */
router.put('/:id/postpone', activityController.postponeActivity);

/**
 * @route   DELETE /api/activities/:id
 * @desc    Delete activity (soft delete)
 * @access  Private
 */
router.delete('/:id', activityController.deleteActivity);

export default router;
