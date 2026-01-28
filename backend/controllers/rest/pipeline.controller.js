/**
 * Pipeline REST Controller
 * Handles all Pipeline CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Pipeline from '../../models/pipeline/pipeline.schema.js';
import {
  buildNotFoundError,
  buildConflictError,
  buildValidationError,
  asyncHandler
} from '../../middleware/errorHandler.js';
import {
  sendSuccess,
  sendCreated,
  filterAndPaginate,
  buildSearchFilter,
  extractUser,
  getRequestId
} from '../../utils/apiResponse.js';
import { getSocketIO, broadcastPipelineEvents } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all pipelines with pagination and filtering
 * @route   GET /api/pipelines
 * @access  Private
 */
export const getPipelines = asyncHandler(async (req, res) => {
  const { page, limit, search, status, type, stage, owner, sortBy, order } = req.query;
  const user = extractUser(req);

  // Build filter
  let filter = {
    companyId: user.companyId,
    isDeleted: false
  };

  // Apply status filter
  if (status) {
    filter.status = status;
  }

  // Apply type filter
  if (type) {
    filter.pipelineType = type;
  }

  // Apply stage filter
  if (stage) {
    filter.stage = stage;
  }

  // Apply owner filter
  if (owner) {
    filter.owner = owner;
  }

  // Apply search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['pipelineName', 'description']);
    filter = { ...filter, ...searchFilter };
  }

  // Build sort option
  const sort = {};
  if (sortBy) {
    sort[sortBy] = order === 'asc' ? 1 : -1;
  } else {
    sort.createdDate = -1;
  }

  // Get paginated results
  const result = await filterAndPaginate(Pipeline, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort
  });

  return sendSuccess(res, result.data, 'Pipelines retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single pipeline by ID
 * @route   GET /api/pipelines/:id
 * @access  Private
 */
export const getPipelineById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid pipeline ID format');
  }

  // Find pipeline
  const pipeline = await Pipeline.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!pipeline) {
    throw buildNotFoundError('Pipeline', id);
  }

  return sendSuccess(res, pipeline);
});

/**
 * @desc    Create new pipeline
 * @route   POST /api/pipelines
 * @access  Private
 */
export const createPipeline = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const pipelineData = req.body;

  // Validate required fields
  if (!pipelineData.pipelineName) {
    throw buildValidationError('pipelineName', 'Pipeline name is required');
  }

  // Validate pipeline type
  const validTypes = ['sales', 'recruitment', 'support', 'project', 'custom'];
  if (pipelineData.pipelineType && !validTypes.includes(pipelineData.pipelineType)) {
    throw buildValidationError('pipelineType', `Invalid type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate status
  const validStatuses = ['active', 'inactive', 'archived', 'completed'];
  if (pipelineData.status && !validStatuses.includes(pipelineData.status)) {
    throw buildValidationError('status', `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Prepare pipeline data
  pipelineData.companyId = user.companyId;
  pipelineData.createdBy = user.userId;

  // Set defaults
  pipelineData.status = pipelineData.status || 'active';
  pipelineData.pipelineType = pipelineData.pipelineType || 'sales';
  pipelineData.stage = pipelineData.stage || 'New';
  pipelineData.priority = pipelineData.priority || 'medium';

  // Create pipeline
  const pipeline = await Pipeline.create(pipelineData);

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastPipelineEvents.created(io, user.companyId, pipeline);

    // Notify owner if assigned
    if (pipeline.owner && pipeline.owner !== user.userId) {
      broadcastPipelineEvents.assignedToOwner(io, pipeline.owner, pipeline);
    }
  }

  return sendCreated(res, pipeline, 'Pipeline created successfully');
});

/**
 * @desc    Update pipeline
 * @route   PUT /api/pipelines/:id
 * @access  Private
 */
export const updatePipeline = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid pipeline ID format');
  }

  // Find pipeline
  const pipeline = await Pipeline.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!pipeline) {
    throw buildNotFoundError('Pipeline', id);
  }

  // Check if pipeline can be updated
  if (pipeline.status === 'completed' || pipeline.status === 'archived') {
    throw buildConflictError('Cannot update ' + pipeline.status + ' pipeline');
  }

  // Update pipeline
  Object.assign(pipeline, updateData);
  pipeline.updatedBy = user.userId;
  await pipeline.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastPipelineEvents.updated(io, user.companyId, pipeline);

    // Notify owner if status changed
    if (pipeline.owner && pipeline.owner !== user.userId) {
      broadcastPipelineEvents.statusChanged(io, pipeline.owner, pipeline);
    }
  }

  return sendSuccess(res, pipeline, 'Pipeline updated successfully');
});

/**
 * @desc    Delete pipeline (soft delete)
 * @route   DELETE /api/pipelines/:id
 * @access  Private
 */
export const deletePipeline = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid pipeline ID format');
  }

  // Find pipeline
  const pipeline = await Pipeline.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!pipeline) {
    throw buildNotFoundError('Pipeline', id);
  }

  // Soft delete
  pipeline.isDeleted = true;
  pipeline.deletedAt = new Date();
  pipeline.deletedBy = user.userId;
  await pipeline.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastPipelineEvents.deleted(io, user.companyId, pipeline.pipelineId, user.userId);
  }

  return sendSuccess(res, {
    _id: pipeline._id,
    pipelineId: pipeline.pipelineId,
    isDeleted: true
  }, 'Pipeline deleted successfully');
});

/**
 * @desc    Get pipelines by type
 * @route   GET /api/pipelines/type/:type
 * @access  Private
 */
export const getPipelinesByType = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { page, limit } = req.query;
  const user = extractUser(req);

  // Validate type
  const validTypes = ['sales', 'recruitment', 'support', 'project', 'custom'];
  if (!validTypes.includes(type)) {
    throw buildValidationError('type', `Invalid type. Must be one of: ${validTypes.join(', ')}`);
  }

  const result = await filterAndPaginate(Pipeline, {
    companyId: user.companyId,
    pipelineType: type,
    isDeleted: false
  }, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort: { createdDate: -1 }
  });

  return sendSuccess(res, result.data, `Pipelines of type '${type}' retrieved successfully`, 200, result.pagination);
});

/**
 * @desc    Get pipeline statistics
 * @route   GET /api/pipelines/stats
 * @access  Private
 */
export const getPipelineStats = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const stats = await Pipeline.getStats(user.companyId);

  // Calculate additional metrics
  stats.conversionRate = stats.total > 0
    ? ((stats.wonDeals / stats.total) * 100).toFixed(2)
    : 0;

  stats.averageDealValue = stats.total > 0
    ? (stats.totalValue / stats.total).toFixed(2)
    : 0;

  stats.weightedPipeline = stats.totalValue || 0;

  return sendSuccess(res, stats, 'Pipeline statistics retrieved successfully');
});

/**
 * @desc    Get overdue pipelines
 * @route   GET /api/pipelines/overdue
 * @access  Private
 */
export const getOverduePipelines = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const pipelines = await Pipeline.getOverdue(user.companyId);

  return sendSuccess(res, pipelines, 'Overdue pipelines retrieved successfully');
});

/**
 * @desc    Get pipelines closing soon (within 7 days)
 * @route   GET /api/pipelines/closing-soon
 * @access  Private
 */
export const getClosingSoonPipelines = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const pipelines = await Pipeline.getClosingSoon(user.companyId);

  return sendSuccess(res, pipelines, 'Pipelines closing soon retrieved successfully');
});

/**
 * @desc    Move pipeline to next stage
 * @route   PUT /api/pipelines/:id/move-stage
 * @access  Private
 */
export const movePipelineStage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stage, notes } = req.body;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid pipeline ID format');
  }

  if (!stage) {
    throw buildValidationError('stage', 'New stage is required');
  }

  // Find pipeline
  const pipeline = await Pipeline.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!pipeline) {
    throw buildNotFoundError('Pipeline', id);
  }

  // Move to new stage
  await pipeline.moveToStage(stage, notes);
  pipeline.updatedBy = user.userId;
  await pipeline.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastPipelineEvents.stageChanged(io, user.companyId, pipeline);

    if (pipeline.owner && pipeline.owner !== user.userId) {
      broadcastPipelineEvents.stageChangedOwner(io, pipeline.owner, pipeline);
    }
  }

  return sendSuccess(res, pipeline, 'Pipeline moved to new stage successfully');
});

/**
 * @desc    Mark pipeline as won
 * @route   PUT /api/pipelines/:id/won
 * @access  Private
 */
export const markPipelineWon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid pipeline ID format');
  }

  // Find pipeline
  const pipeline = await Pipeline.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!pipeline) {
    throw buildNotFoundError('Pipeline', id);
  }

  // Mark as won
  await pipeline.markAsWon(reason);
  pipeline.updatedBy = user.userId;
  await pipeline.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastPipelineEvents.won(io, user.companyId, pipeline);

    if (pipeline.owner && pipeline.owner !== user.userId) {
      broadcastPipelineEvents.wonOwner(io, pipeline.owner, pipeline);
    }
  }

  return sendSuccess(res, pipeline, 'Pipeline marked as won successfully');
});

/**
 * @desc    Mark pipeline as lost
 * @route   PUT /api/pipelines/:id/lost
 * @access  Private
 */
export const markPipelineLost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = extractUser(req);

  if (!reason) {
    throw buildValidationError('reason', 'Reason for losing the deal is required');
  }

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid pipeline ID format');
  }

  // Find pipeline
  const pipeline = await Pipeline.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!pipeline) {
    throw buildNotFoundError('Pipeline', id);
  }

  // Mark as lost
  await pipeline.markAsLost(reason);
  pipeline.updatedBy = user.userId;
  await pipeline.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastPipelineEvents.lost(io, user.companyId, pipeline);

    if (pipeline.owner && pipeline.owner !== user.userId) {
      broadcastPipelineEvents.lostOwner(io, pipeline.owner, pipeline);
    }
  }

  return sendSuccess(res, pipeline, 'Pipeline marked as lost successfully');
});

export default {
  getPipelines,
  getPipelineById,
  createPipeline,
  updatePipeline,
  deletePipeline,
  getPipelinesByType,
  getPipelineStats,
  getOverduePipelines,
  getClosingSoonPipelines,
  movePipelineStage,
  markPipelineWon,
  markPipelineLost
};
