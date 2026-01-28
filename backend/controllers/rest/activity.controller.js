/**
 * Activity REST Controller
 * Handles all Activity CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Activity from '../../models/activity/activity.schema.js';
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
import { getSocketIO, broadcastActivityEvents } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all activities with pagination and filtering
 * @route   GET /api/activities
 * @access  Private
 */
export const getActivities = asyncHandler(async (req, res) => {
  const { page, limit, search, status, type, priority, owner, startDate, endDate, sortBy, order } = req.query;
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
    filter.activityType = type;
  }

  // Apply priority filter
  if (priority) {
    filter.priority = priority;
  }

  // Apply owner filter
  if (owner) {
    filter.owner = owner;
  }

  // Apply date range filter
  if (startDate || endDate) {
    filter.dueDate = {};
    if (startDate) {
      filter.dueDate.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.dueDate.$lte = new Date(endDate);
    }
  }

  // Apply search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['title', 'description', 'outcome']);
    filter = { ...filter, ...searchFilter };
  }

  // Build sort option
  const sort = {};
  if (sortBy) {
    sort[sortBy] = order === 'asc' ? 1 : -1;
  } else {
    sort.dueDate = -1;
  }

  // Get paginated results
  const result = await filterAndPaginate(Activity, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort
  });

  return sendSuccess(res, result.data, 'Activities retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single activity by ID
 * @route   GET /api/activities/:id
 * @access  Private
 */
export const getActivityById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid activity ID format');
  }

  // Find activity
  const activity = await Activity.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!activity) {
    throw buildNotFoundError('Activity', id);
  }

  return sendSuccess(res, activity);
});

/**
 * @desc    Create new activity
 * @route   POST /api/activities
 * @access  Private
 */
export const createActivity = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const activityData = req.body;

  // Validate required fields
  if (!activityData.title || !activityData.activityType || !activityData.dueDate) {
    throw buildValidationError('fields', 'Title, activity type, and due date are required');
  }

  // Validate activity type
  const validTypes = ['call', 'email', 'meeting', 'task', 'follow-up', 'demo', 'site-visit', 'other'];
  if (!validTypes.includes(activityData.activityType)) {
    throw buildValidationError('activityType', `Invalid type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate priority
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (activityData.priority && !validPriorities.includes(activityData.priority)) {
    throw buildValidationError('priority', `Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
  }

  // Validate reminder
  const validReminders = ['none', '5min', '15min', '30min', '1hour', '1day', '1week'];
  if (activityData.reminder && !validReminders.includes(activityData.reminder)) {
    throw buildValidationError('reminder', `Invalid reminder. Must be one of: ${validReminders.join(', ')}`);
  }

  // Prepare activity data
  activityData.companyId = user.companyId;
  activityData.createdBy = user.userId;

  // Set defaults
  activityData.status = activityData.status || 'pending';
  activityData.priority = activityData.priority || 'medium';
  activityData.reminder = activityData.reminder || 'none';

  // Create activity
  const activity = await Activity.create(activityData);

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastActivityEvents.created(io, user.companyId, activity);

    // Notify owner if assigned
    if (activity.owner && activity.owner !== user.userId) {
      broadcastActivityEvents.assignedToOwner(io, activity.owner, activity);
    }
  }

  return sendCreated(res, activity, 'Activity created successfully');
});

/**
 * @desc    Update activity
 * @route   PUT /api/activities/:id
 * @access  Private
 */
export const updateActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid activity ID format');
  }

  // Find activity
  const activity = await Activity.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!activity) {
    throw buildNotFoundError('Activity', id);
  }

  // If status is being changed to completed
  if (updateData.status === 'completed' && activity.status !== 'completed') {
    updateData.completedAt = new Date();
    updateData.completedBy = user.userId;
  }

  // Update activity
  Object.assign(activity, updateData);
  activity.updatedBy = user.userId;
  await activity.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastActivityEvents.updated(io, user.companyId, activity);

    // Notify owner if status changed
    if (activity.owner && activity.owner !== user.userId) {
      broadcastActivityEvents.statusChanged(io, activity.owner, activity);
    }
  }

  return sendSuccess(res, activity, 'Activity updated successfully');
});

/**
 * @desc    Delete activity (soft delete)
 * @route   DELETE /api/activities/:id
 * @access  Private
 */
export const deleteActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid activity ID format');
  }

  // Find activity
  const activity = await Activity.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!activity) {
    throw buildNotFoundError('Activity', id);
  }

  // Soft delete
  activity.isDeleted = true;
  activity.deletedAt = new Date();
  activity.deletedBy = user.userId;
  await activity.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastActivityEvents.deleted(io, user.companyId, activity.activityId, user.userId);
  }

  return sendSuccess(res, {
    _id: activity._id,
    activityId: activity.activityId,
    isDeleted: true
  }, 'Activity deleted successfully');
});

/**
 * @desc    Get activities by type
 * @route   GET /api/activities/type/:type
 * @access  Private
 */
export const getActivitiesByType = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { page, limit } = req.query;
  const user = extractUser(req);

  // Validate type
  const validTypes = ['call', 'email', 'meeting', 'task', 'follow-up', 'demo', 'site-visit', 'other'];
  if (!validTypes.includes(type)) {
    throw buildValidationError('type', `Invalid type. Must be one of: ${validTypes.join(', ')}`);
  }

  const result = await filterAndPaginate(Activity, {
    companyId: user.companyId,
    activityType: type,
    isDeleted: false
  }, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort: { dueDate: -1 }
  });

  return sendSuccess(res, result.data, `Activities of type '${type}' retrieved successfully`, 200, result.pagination);
});

/**
 * @desc    Get activity statistics
 * @route   GET /api/activities/stats
 * @access  Private
 */
export const getActivityStats = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const stats = await Activity.getStats(user.companyId);

  return sendSuccess(res, stats, 'Activity statistics retrieved successfully');
});

/**
 * @desc    Get activity owners (for filter dropdown)
 * @route   GET /api/activities/owners
 * @access  Private
 */
export const getActivityOwners = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const owners = await Activity.getOwners(user.companyId);

  return sendSuccess(res, owners, 'Activity owners retrieved successfully');
});

/**
 * @desc    Get upcoming activities (within 24 hours)
 * @route   GET /api/activities/upcoming
 * @access  Private
 */
export const getUpcomingActivities = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const activities = await Activity.getUpcoming(user.companyId);

  return sendSuccess(res, activities, 'Upcoming activities retrieved successfully');
});

/**
 * @desc    Get overdue activities
 * @route   GET /api/activities/overdue
 * @access  Private
 */
export const getOverdueActivities = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const activities = await Activity.getOverdue(user.companyId);

  return sendSuccess(res, activities, 'Overdue activities retrieved successfully');
});

/**
 * @desc    Mark activity as complete
 * @route   PUT /api/activities/:id/complete
 * @access  Private
 */
export const markActivityComplete = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid activity ID format');
  }

  // Find activity
  const activity = await Activity.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!activity) {
    throw buildNotFoundError('Activity', id);
  }

  // Mark as complete
  await activity.markComplete(user.userId);

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastActivityEvents.completed(io, user.companyId, activity);

    if (activity.owner && activity.owner !== user.userId) {
      broadcastActivityEvents.completedOwner(io, activity.owner, activity);
    }
  }

  return sendSuccess(res, activity, 'Activity marked as complete');
});

/**
 * @desc    Postpone activity to new date
 * @route   PUT /api/activities/:id/postpone
 * @access  Private
 */
export const postponeActivity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newDueDate } = req.body;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid activity ID format');
  }

  if (!newDueDate) {
    throw buildValidationError('newDueDate', 'New due date is required');
  }

  // Find activity
  const activity = await Activity.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!activity) {
    throw buildNotFoundError('Activity', id);
  }

  // Postpone activity
  await activity.postpone(newDueDate);

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastActivityEvents.postponed(io, user.companyId, activity);

    if (activity.owner && activity.owner !== user.userId) {
      broadcastActivityEvents.postponedOwner(io, activity.owner, activity);
    }
  }

  return sendSuccess(res, activity, 'Activity postponed successfully');
});

export default {
  getActivities,
  getActivityById,
  createActivity,
  updateActivity,
  deleteActivity,
  getActivitiesByType,
  getActivityStats,
  getActivityOwners,
  getUpcomingActivities,
  getOverdueActivities,
  markActivityComplete,
  postponeActivity
};
