/**
 * Project REST Controller
 * Handles all Project CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Project from '../../models/project/project.schema.js';
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
  buildDateRangeFilter,
  extractUser,
  buildAuditFields,
  getRequestId
} from '../../utils/apiResponse.js';
import { generateProjectId } from '../../utils/idGenerator.js';
import { getSocketIO, broadcastProjectEvents } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all projects with pagination and filtering
 * @route   GET /api/projects
 * @access  Private (Admin, HR, Superadmin, Employee)
 */
export const getProjects = asyncHandler(async (req, res) => {
  const { page, limit, search, status, priority, client, sortBy, order, dateFrom, dateTo } = req.query;
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

  // Apply priority filter
  if (priority) {
    filter.priority = priority;
  }

  // Apply client filter
  if (client) {
    filter.client = client;
  }

  // Apply search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['name', 'description', 'client']);
    filter = { ...filter, ...searchFilter };
  }

  // Apply date range filter
  if (dateFrom || dateTo) {
    const dateFilter = buildDateRangeFilter(dateFrom, dateTo, 'startDate');
    filter = { ...filter, ...dateFilter };
  }

  // Build sort option
  const sort = {};
  if (sortBy) {
    sort[sortBy] = order === 'asc' ? 1 : -1;
  } else {
    sort.createdAt = -1;
  }

  // Get paginated results
  const result = await filterAndPaginate(Project, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort,
    populate: [
      { path: 'teamLeader', select: 'firstName lastName fullName employeeId' },
      { path: 'teamMembers', select: 'firstName lastName fullName employeeId' },
      { path: 'projectManager', select: 'firstName lastName fullName employeeId' }
    ]
  });

  // Add overdue flag to each project
  result.data = result.data.map(project => {
    const proj = project.toObject();
    proj.isOverdue = project.isOverdue;
    return proj;
  });

  return sendSuccess(res, result.data, 'Projects retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single project by ID
 * @route   GET /api/projects/:id
 * @access  Private (All authenticated users)
 */
export const getProjectById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid project ID format');
  }

  // Find project
  const project = await Project.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  }).populate('teamLeader', 'firstName lastName fullName employeeId')
    .populate('teamMembers', 'firstName lastName fullName employeeId')
    .populate('projectManager', 'firstName lastName fullName employeeId');

  if (!project) {
    throw buildNotFoundError('Project', id);
  }

  const result = project.toObject();
  result.isOverdue = project.isOverdue;

  return sendSuccess(res, result);
});

/**
 * @desc    Create new project
 * @route   POST /api/projects
 * @access  Private (Admin, HR, Superadmin)
 */
export const createProject = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const projectData = req.body;

  // Generate project ID
  if (!projectData.projectId) {
    projectData.projectId = await generateProjectId(user.companyId);
  }

  // Add company and audit fields
  projectData.companyId = user.companyId;
  projectData.createdBy = user.userId;
  projectData.updatedBy = user.userId;

  // Create project
  const project = await Project.create(projectData);

  // Populate references for response
  await project.populate('teamLeader', 'firstName lastName fullName employeeId');
  await project.populate('teamMembers', 'firstName lastName fullName employeeId');
  await project.populate('projectManager', 'firstName lastName fullName employeeId');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastProjectEvents.created(io, user.companyId, project);
  }

  return sendCreated(res, project, 'Project created successfully');
});

/**
 * @desc    Update project
 * @route   PUT /api/projects/:id
 * @access  Private (Admin, HR, Superadmin)
 */
export const updateProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid project ID format');
  }

  // Find project
  const project = await Project.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!project) {
    throw buildNotFoundError('Project', id);
  }

  // Update audit fields
  updateData.updatedBy = user.userId;
  updateData.updatedAt = new Date();

  // Update project
  Object.assign(project, updateData);
  await project.save();

  // Populate references for response
  await project.populate('teamLeader', 'firstName lastName fullName employeeId');
  await project.populate('teamMembers', 'firstName lastName fullName employeeId');
  await project.populate('projectManager', 'firstName lastName fullName employeeId');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastProjectEvents.updated(io, user.companyId, project);
  }

  return sendSuccess(res, project, 'Project updated successfully');
});

/**
 * @desc    Delete project (soft delete)
 * @route   DELETE /api/projects/:id
 * @access  Private (Admin, Superadmin only)
 */
export const deleteProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid project ID format');
  }

  // Find project
  const project = await Project.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!project) {
    throw buildNotFoundError('Project', id);
  }

  // Check if project has active tasks
  const Task = mongoose.model('Task');
  const activeTaskCount = await Task.countDocuments({
    projectId: id,
    status: { $in: ['Pending', 'Inprogress'] },
    isDeleted: false
  });

  if (activeTaskCount > 0) {
    throw buildValidationError('project', `Cannot delete project with ${activeTaskCount} active tasks`);
  }

  // Soft delete
  project.isDeleted = true;
  project.updatedBy = user.userId;
  await project.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastProjectEvents.deleted(io, user.companyId, project.projectId, user.userId);
  }

  return sendSuccess(res, {
    _id: project._id,
    projectId: project.projectId,
    isDeleted: true
  }, 'Project deleted successfully');
});

/**
 * @desc    Get project statistics
 * @route   GET /api/projects/stats
 * @access  Private (Admin, HR, Superadmin)
 */
export const getProjectStats = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const stats = await Project.aggregate([
    {
      $match: {
        companyId: new mongoose.Types.ObjectId(user.companyId),
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
        },
        onHold: {
          $sum: { $cond: [{ $eq: ['$status', 'On Hold'] }, 1, 0] }
        },
        totalValue: { $sum: '$projectValue' },
        highPriority: {
          $sum: { $cond: [{ $eq: ['$priority', 'High'] }, 1, 0] }
        }
      }
    }
  ]);

  const overdueProjects = await Project.countDocuments({
    companyId: user.companyId,
    status: { $ne: 'Completed' },
    dueDate: { $lt: new Date() },
    isDeleted: false
  });

  const result = stats[0] || {
    total: 0,
    active: 0,
    completed: 0,
    onHold: 0,
    totalValue: 0,
    highPriority: 0
  };

  result.overdue = overdueProjects;

  return sendSuccess(res, result, 'Project statistics retrieved successfully');
});

/**
 * @desc    Get my projects (projects where user is a team member or leader)
 * @route   GET /api/projects/my
 * @access  Private (All authenticated users)
 */
export const getMyProjects = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const user = extractUser(req);

  // Find the Employee record for this user
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findOne({ clerkUserId: user.userId });

  if (!employee) {
    return sendSuccess(res, [], 'No projects found');
  }

  // Build filter - projects where user is team member or leader
  let filter = {
    companyId: user.companyId,
    isDeleted: false,
    $or: [
      { teamMembers: employee._id },
      { teamLeader: employee._id },
      { projectManager: employee._id }
    ]
  };

  if (status) {
    filter.status = status;
  }

  const projects = await Project.find(filter)
    .populate('teamLeader', 'firstName lastName fullName employeeId')
    .populate('teamMembers', 'firstName lastName fullName employeeId')
    .populate('projectManager', 'firstName lastName fullName employeeId')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) || 50);

  const result = projects.map(project => {
    const proj = project.toObject();
    proj.isOverdue = project.isOverdue;
    return proj;
  });

  return sendSuccess(res, result, 'My projects retrieved successfully');
});

/**
 * @desc    Update project progress
 * @route   PATCH /api/projects/:id/progress
 * @access  Private (Admin, HR, Superadmin, Team Leaders)
 */
export const updateProjectProgress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { progress } = req.body;
  const user = extractUser(req);

  // Validate progress
  if (typeof progress !== 'number' || progress < 0 || progress > 100) {
    throw buildValidationError('progress', 'Progress must be between 0 and 100');
  }

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid project ID format');
  }

  // Find project
  const project = await Project.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!project) {
    throw buildNotFoundError('Project', id);
  }

  // Update progress
  project.progress = progress;
  project.updatedBy = user.userId;

  // Auto-update status based on progress
  if (progress === 100) {
    project.status = 'Completed';
  } else if (project.status === 'Completed') {
    project.status = 'Active';
  }

  await project.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastProjectEvents.progressUpdated(io, user.companyId, project);
  }

  return sendSuccess(res, {
    _id: project._id,
    projectId: project.projectId,
    progress: project.progress,
    status: project.status
  }, 'Project progress updated successfully');
});

export default {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
  getMyProjects,
  updateProjectProgress
};
