/**
 * Task REST Controller
 * Handles all Task CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Task from '../../models/task/task.schema.js';
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
import { generateTaskId } from '../../utils/idGenerator.js';
import { getSocketIO, broadcastTaskEvents } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all tasks with pagination and filtering
 * @route   GET /api/tasks
 * @access  Private (Admin, HR, Superadmin, Employee)
 */
export const getTasks = asyncHandler(async (req, res) => {
  const { page, limit, search, project, assignee, status, priority, sortBy, order } = req.query;
  const user = extractUser(req);

  // Build filter
  let filter = {
    isDeleted: false
  };

  // Apply project filter
  if (project) {
    filter.projectId = project;
  }

  // Apply assignee filter
  if (assignee) {
    filter.assignee = { $in: [assignee] };
  }

  // Apply status filter
  if (status) {
    filter.status = status;
  }

  // Apply priority filter
  if (priority) {
    filter.priority = priority;
  }

  // Apply search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['title', 'description']);
    filter = { ...filter, ...searchFilter };
  }

  // Build sort option
  const sort = {};
  if (sortBy) {
    sort[sortBy] = order === 'asc' ? 1 : -1;
  } else {
    sort.createdAt = -1;
  }

  // Get paginated results
  const result = await filterAndPaginate(Task, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort,
    populate: [
      {
        path: 'projectId',
        select: 'name projectId status progress'
      },
      {
        path: 'assignee',
        select: 'firstName lastName fullName employeeId'
      }
    ]
  });

  return sendSuccess(res, result.data, 'Tasks retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single task by ID
 * @route   GET /api/tasks/:id
 * @access  Private (All authenticated users)
 */
export const getTaskById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid task ID format');
  }

  // Find task
  const task = await Task.findOne({
    _id: id,
    isDeleted: false
  }).populate('projectId', 'name projectId status progress')
    .populate('assignee', 'firstName lastName fullName employeeId');

  if (!task) {
    throw buildNotFoundError('Task', id);
  }

  return sendSuccess(res, task);
});

/**
 * @desc    Create new task
 * @route   POST /api/tasks
 * @access  Private (Admin, HR, Superadmin, Project Managers)
 */
export const createTask = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const taskData = req.body;

  // Verify project exists
  const Project = mongoose.model('Project');
  const project = await Project.findOne({
    _id: taskData.projectId,
    isDeleted: false
  });

  if (!project) {
    throw buildNotFoundError('Project', taskData.projectId);
  }

  // Generate task ID
  if (!taskData.taskId) {
    taskData.taskId = await generateTaskId(taskData.projectId);
  }

  // Add audit fields
  taskData.createdBy = user.userId;

  // Create task
  const task = await Task.create(taskData);

  // Populate references for response
  await task.populate('projectId', 'name projectId status progress');
  await task.populate('assignee', 'firstName lastName fullName employeeId');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastTaskEvents.created(io, user.companyId, task);
  }

  return sendCreated(res, task, 'Task created successfully');
});

/**
 * @desc    Update task
 * @route   PUT /api/tasks/:id
 * @access  Private (Admin, HR, Superadmin, Project Managers, Assignees)
 */
export const updateTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid task ID format');
  }

  // Find task
  const task = await Task.findOne({
    _id: id,
    isDeleted: false
  });

  if (!task) {
    throw buildNotFoundError('Task', id);
  }

  // Update task
  Object.assign(task, updateData);
  await task.save();

  // Populate references for response
  await task.populate('projectId', 'name projectId status progress');
  await task.populate('assignee', 'firstName lastName fullName employeeId');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastTaskEvents.updated(io, user.companyId, task);
  }

  return sendSuccess(res, task, 'Task updated successfully');
});

/**
 * @desc    Delete task (soft delete)
 * @route   DELETE /api/tasks/:id
 * @access  Private (Admin, Superadmin, Project Managers)
 */
export const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid task ID format');
  }

  // Find task
  const task = await Task.findOne({
    _id: id,
    isDeleted: false
  });

  if (!task) {
    throw buildNotFoundError('Task', id);
  }

  // Soft delete
  task.isDeleted = true;
  await task.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io && task.projectId) {
    broadcastTaskEvents.deleted(io, user.companyId, task.taskId, task.projectId);
  }

  return sendSuccess(res, {
    _id: task._id,
    taskId: task.taskId,
    isDeleted: true
  }, 'Task deleted successfully');
});

/**
 * @desc    Get my tasks (tasks assigned to current user)
 * @route   GET /api/tasks/my
 * @access  Private (All authenticated users)
 */
export const getMyTasks = asyncHandler(async (req, res) => {
  const { status, project, page, limit } = req.query;
  const user = extractUser(req);

  // Find the Employee record for this user
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findOne({ clerkUserId: user.userId });

  if (!employee) {
    return sendSuccess(res, [], 'No tasks found');
  }

  // Build filter - tasks where user is assigned
  let filter = {
    assignee: employee._id,
    isDeleted: false
  };

  if (status) {
    filter.status = status;
  }

  if (project) {
    filter.projectId = project;
  }

  const tasks = await Task.find(filter)
    .populate('projectId', 'name projectId status progress')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) || 50);

  return sendSuccess(res, tasks, 'My tasks retrieved successfully');
});

/**
 * @desc    Get tasks by project
 * @route   GET /api/tasks/project/:projectId
 * @access  Private (All authenticated users)
 */
export const getTasksByProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { status } = req.query;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw buildValidationError('projectId', 'Invalid project ID format');
  }

  // Build filter
  let filter = {
    projectId,
    isDeleted: false
  };

  if (status) {
    filter.status = status;
  }

  const tasks = await Task.find(filter)
    .populate('assignee', 'firstName lastName fullName employeeId')
    .sort({ createdAt: -1 });

  return sendSuccess(res, tasks, 'Project tasks retrieved successfully');
});

/**
 * @desc    Update task status
 * @route   PATCH /api/tasks/:id/status
 * @access  Private (Admin, HR, Superadmin, Project Managers, Assignees)
 */
export const updateTaskStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const user = extractUser(req);

  // Validate status
  const validStatuses = ['Pending', 'Inprogress', 'Completed', 'Onhold'];
  if (!validStatuses.includes(status)) {
    throw buildValidationError('status', `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid task ID format');
  }

  // Find task
  const task = await Task.findOne({
    _id: id,
    isDeleted: false
  });

  if (!task) {
    throw buildNotFoundError('Task', id);
  }

  // Update status
  task.status = status;
  await task.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastTaskEvents.statusChanged(io, user.companyId, task);
  }

  return sendSuccess(res, {
    _id: task._id,
    taskId: task.taskId,
    status: task.status
  }, 'Task status updated successfully');
});

/**
 * @desc    Get task statistics
 * @route   GET /api/tasks/stats
 * @access  Private (Admin, HR, Superadmin)
 */
export const getTaskStats = asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  const user = extractUser(req);

  // Build match filter
  let matchFilter = { isDeleted: false };

  if (projectId) {
    matchFilter.projectId = new mongoose.Types.ObjectId(projectId);
  }

  const stats = await Task.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'Inprogress'] }, 1, 0] }
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
        },
        onHold: {
          $sum: { $cond: [{ $eq: ['$status', 'Onhold'] }, 1, 0] }
        },
        highPriority: {
          $sum: { $cond: [{ $eq: ['$priority', 'High'] }, 1, 0] }
        },
        totalEstimatedHours: { $sum: '$estimatedHours' },
        totalActualHours: { $sum: '$actualHours' }
      }
    }
  ]);

  const result = stats[0] || {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    onHold: 0,
    highPriority: 0,
    totalEstimatedHours: 0,
    totalActualHours: 0
  };

  return sendSuccess(res, result, 'Task statistics retrieved successfully');
});

export default {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getMyTasks,
  getTasksByProject,
  updateTaskStatus,
  getTaskStats
};
