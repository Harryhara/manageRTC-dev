/**
 * Promotion REST API Routes
 * All promotion management endpoints
 */

import express from 'express';
import promotionController from '../../controllers/rest/promotion.controller.js';

const router = express.Router();

/**
 * @route   GET /api/promotions
 * @desc    Get all promotions
 * @access  Private
 */
router.get('/', promotionController.getPromotions);

/**
 * @route   GET /api/promotions/departments
 * @desc    Get departments for promotion selection
 * @access  Private
 */
router.get('/departments', promotionController.getDepartments);

/**
 * @route   GET /api/promotions/designations
 * @desc    Get designations for promotion selection
 * @access  Private
 */
router.get('/designations', promotionController.getDesignationsForPromotion);

/**
 * @route   GET /api/promotions/:id
 * @desc    Get single promotion by ID
 * @access  Private
 */
router.get('/:id', promotionController.getPromotionById);

/**
 * @route   POST /api/promotions
 * @desc    Create new promotion
 * @access  Private (Admin, HR)
 */
router.post('/', promotionController.createPromotion);

/**
 * @route   PUT /api/promotions/:id
 * @desc    Update promotion
 * @access  Private (Admin, HR)
 */
router.put('/:id', promotionController.updatePromotion);

/**
 * @route   PUT /api/promotions/:id/apply
 * @desc    Apply promotion
 * @access  Private (Admin, HR)
 */
router.put('/:id/apply', promotionController.applyPromotion);

/**
 * @route   PUT /api/promotions/:id/cancel
 * @desc    Cancel promotion
 * @access  Private (Admin, HR)
 */
router.put('/:id/cancel', promotionController.cancelPromotion);

/**
 * @route   DELETE /api/promotions/:id
 * @desc    Delete promotion (soft delete)
 * @access  Private (Admin)
 */
router.delete('/:id', promotionController.deletePromotion);

export default router;
