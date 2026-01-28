/**
 * Training REST Controller
 * Handles all Training CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Training from '../../models/training/training.schema.js';
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
import { getSocketIO, broadcastTrainingEvents } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all trainings with pagination and filtering
 * @route   GET /api/trainings
 * @access  Private (Admin, HR, Superadmin)
 */
export const getTrainings = asyncHandler(async (req, res) => {
  const { page, limit, search, status, type, category, startDate, endDate, sortBy, order } = req.query;
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
    filter.type = type;
  }

  // Apply category filter
  if (category) {
    filter.category = category;
  }

  // Apply date range filter
  if (startDate || endDate) {
    filter.startDate = {};
    if (startDate) {
      filter.startDate.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.startDate.$lte = new Date(endDate);
    }
  }

  // Apply search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['name', 'description']);
    filter = { ...filter, ...searchFilter };
  }

  // Build sort option
  const sort = {};
  if (sortBy) {
    sort[sortBy] = order === 'asc' ? 1 : -1;
  } else {
    sort.startDate = -1;
  }

  // Get paginated results
  const result = await filterAndPaginate(Training, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort,
    populate: [
      {
        path: 'instructor',
        select: 'firstName lastName fullName employeeId'
      }
    ]
  });

  return sendSuccess(res, result.data, 'Trainings retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single training by ID
 * @route   GET /api/trainings/:id
 * @access  Private (All authenticated users)
 */
export const getTrainingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid training ID format');
  }

  // Find training
  const training = await Training.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  }).populate('instructor', 'firstName lastName fullName employeeId')
    .populate('participants.employee', 'firstName lastName fullName employeeId')
    .populate('createdBy', 'firstName lastName fullName')
    .populate('updatedBy', 'firstName lastName fullName');

  if (!training) {
    throw buildNotFoundError('Training', id);
  }

  return sendSuccess(res, training);
});

/**
 * @desc    Create new training
 * @route   POST /api/trainings
 * @access  Private (Admin, HR, Superadmin)
 */
export const createTraining = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const trainingData = req.body;

  // Validate dates
  const startDate = new Date(trainingData.startDate);
  const endDate = new Date(trainingData.endDate);

  if (endDate < startDate) {
    throw buildValidationError('endDate', 'End date must be after start date');
  }

  // Verify instructor exists if provided
  if (trainingData.instructor) {
    const Employee = mongoose.model('Employee');
    const employee = await Employee.findOne({
      _id: trainingData.instructor,
      isDeleted: false
    });

    if (!employee) {
      throw buildNotFoundError('Instructor', trainingData.instructor);
    }
  }

  // Prepare training data
  trainingData.companyId = user.companyId;
  trainingData.createdBy = user.userId;

  // Create training
  const training = await Training.create(trainingData);

  // Populate references for response
  await training.populate('instructor', 'firstName lastName fullName');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastTrainingEvents.created(io, user.companyId, training);
  }

  return sendCreated(res, training, 'Training created successfully');
});

/**
 * @desc    Update training
 * @route   PUT /api/trainings/:id
 * @access  Private (Admin, HR, Superadmin)
 */
export const updateTraining = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid training ID format');
  }

  // Find training
  const training = await Training.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!training) {
    throw buildNotFoundError('Training', id);
  }

  // Check if training can be updated
  if (training.status === 'in-progress' || training.status === 'completed') {
    throw buildConflictError('Cannot update ' + training.status + ' training');
  }

  // Validate dates if being updated
  if (updateData.startDate || updateData.endDate) {
    const startDate = new Date(updateData.startDate || training.startDate);
    const endDate = new Date(updateData.endDate || training.endDate);

    if (endDate < startDate) {
      throw buildValidationError('endDate', 'End date must be after start date');
    }
  }

  // Update training
  Object.assign(training, updateData);
  training.updatedBy = user.userId;
  await training.save();

  // Populate references for response
  await training.populate('instructor', 'firstName lastName fullName');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastTrainingEvents.updated(io, user.companyId, training);
  }

  return sendSuccess(res, training, 'Training updated successfully');
});

/**
 * @desc    Delete training (soft delete)
 * @route   DELETE /api/trainings/:id
 * @access  Private (Admin, Superadmin)
 */
export const deleteTraining = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid training ID format');
  }

  // Find training
  const training = await Training.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!training) {
    throw buildNotFoundError('Training', id);
  }

  // Check if training can be deleted
  if (training.status === 'in-progress' || training.status === 'completed') {
    throw buildConflictError('Cannot delete ' + training.status + ' training');
  }

  // Soft delete
  training.isDeleted = true;
  training.deletedAt = new Date();
  training.deletedBy = user.userId;
  await training.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastTrainingEvents.deleted(io, user.companyId, training.trainingId, user.userId);
  }

  return sendSuccess(res, {
    _id: training._id,
    trainingId: training.trainingId,
    isDeleted: true
  }, 'Training deleted successfully');
});

/**
 * @desc    Get trainings by type
 * @route   GET /api/trainings/type/:type
 * @access  Private (All authenticated users)
 */
export const getTrainingsByType = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { page, limit } = req.query;
  const user = extractUser(req);

  // Validate type
  const validTypes = ['technical', 'soft-skills', 'compliance', 'safety', 'leadership', 'onboarding', 'certification', 'other'];
  if (!validTypes.includes(type)) {
    throw buildValidationError('type', `Invalid type. Must be one of: ${validTypes.join(', ')}`);
  }

  const result = await filterAndPaginate(Training, {
    companyId: user.companyId,
    type,
    isDeleted: false
  }, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort: { startDate: -1 },
    populate: {
      path: 'instructor',
      select: 'firstName lastName fullName'
    }
  });

  return sendSuccess(res, result.data, `Trainings of type '${type}' retrieved successfully`, 200, result.pagination);
});

/**
 * @desc    Get training statistics
 * @route   GET /api/trainings/stats
 * @access  Private (Admin, HR, Superadmin)
 */
export const getTrainingStats = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const stats = await Training.getStats(user.companyId);

  // Add calculated metrics
  stats.averageBudgetPerTraining = stats.total > 0
    ? (stats.totalBudget / stats.total).toFixed(2)
    : 0;

  stats.budgetUtilization = stats.totalBudget > 0
    ? ((stats.spentBudget / stats.totalBudget) * 100).toFixed(2)
    : 0;

  stats.averageParticipantsPerTraining = stats.total > 0
    ? (stats.totalParticipants / stats.total).toFixed(2)
    : 0;

  return sendSuccess(res, stats, 'Training statistics retrieved successfully');
});

export default {
  getTrainings,
  getTrainingById,
  createTraining,
  updateTraining,
  deleteTraining,
  getTrainingsByType,
  getTrainingStats
};
