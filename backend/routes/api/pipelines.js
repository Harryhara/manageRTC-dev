/**
 * Pipeline REST API Routes
 * All pipeline management endpoints
 */

import express from 'express';
import pipelineController from '../../controllers/rest/pipeline.controller.js';

const router = express.Router();

/**
 * @route   GET /api/pipelines
 * @desc    Get all pipelines with pagination and filtering
 * @access  Private
 */
router.get('/', pipelineController.getPipelines);

/**
 * @route   GET /api/pipelines/type/:type
 * @desc    Get pipelines by type
 * @access  Private
 */
router.get('/type/:type', pipelineController.getPipelinesByType);

/**
 * @route   GET /api/pipelines/stats
 * @desc    Get pipeline statistics
 * @access  Private
 */
router.get('/stats', pipelineController.getPipelineStats);

/**
 * @route   GET /api/pipelines/overdue
 * @desc    Get overdue pipelines
 * @access  Private
 */
router.get('/overdue', pipelineController.getOverduePipelines);

/**
 * @route   GET /api/pipelines/closing-soon
 * @desc    Get pipelines closing soon (within 7 days)
 * @access  Private
 */
router.get('/closing-soon', pipelineController.getClosingSoonPipelines);

/**
 * @route   GET /api/pipelines/:id
 * @desc    Get single pipeline by ID
 * @access  Private
 */
router.get('/:id', pipelineController.getPipelineById);

/**
 * @route   POST /api/pipelines
 * @desc    Create new pipeline
 * @access  Private
 */
router.post('/', pipelineController.createPipeline);

/**
 * @route   PUT /api/pipelines/:id
 * @desc    Update pipeline
 * @access  Private
 */
router.put('/:id', pipelineController.updatePipeline);

/**
 * @route   PUT /api/pipelines/:id/move-stage
 * @desc    Move pipeline to next stage
 * @access  Private
 */
router.put('/:id/move-stage', pipelineController.movePipelineStage);

/**
 * @route   PUT /api/pipelines/:id/won
 * @desc    Mark pipeline as won
 * @access  Private
 */
router.put('/:id/won', pipelineController.markPipelineWon);

/**
 * @route   PUT /api/pipelines/:id/lost
 * @desc    Mark pipeline as lost
 * @access  Private
 */
router.put('/:id/lost', pipelineController.markPipelineLost);

/**
 * @route   DELETE /api/pipelines/:id
 * @desc    Delete pipeline (soft delete)
 * @access  Private
 */
router.delete('/:id', pipelineController.deletePipeline);

export default router;
