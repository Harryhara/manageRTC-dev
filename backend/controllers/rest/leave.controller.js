/**
 * Leave REST Controller
 * Handles all Leave CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Leave from '../../models/leave/leave.schema.js';
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
import { getSocketIO, broadcastLeaveEvents } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all leave requests with pagination and filtering
 * @route   GET /api/leaves
 * @access  Private (Admin, HR, Superadmin)
 */
export const getLeaves = asyncHandler(async (req, res) => {
  const { page, limit, search, status, leaveType, employee, startDate, endDate, sortBy, order } = req.query;
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

  // Apply leave type filter
  if (leaveType) {
    filter.leaveType = leaveType;
  }

  // Apply employee filter
  if (employee) {
    filter.employee = employee;
  }

  // Apply date range filter
  if (startDate || endDate) {
    filter.$or = [
      {
        startDate: {
          $gte: new Date(startDate || '1900-01-01'),
          $lte: new Date(endDate || '2100-12-31')
        }
      },
      {
        endDate: {
          $gte: new Date(startDate || '1900-01-01'),
          $lte: new Date(endDate || '2100-12-31')
        }
      }
    ];
  }

  // Apply search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['reason', 'detailedReason']);
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
  const result = await filterAndPaginate(Leave, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort,
    populate: [
      {
        path: 'employee',
        select: 'firstName lastName fullName employeeId'
      },
      {
        path: 'approvedBy',
        select: 'firstName lastName fullName'
      },
      {
        path: 'rejectedBy',
        select: 'firstName lastName fullName'
      },
      {
        path: 'reportingManager',
        select: 'firstName lastName fullName'
      },
      {
        path: 'handoverTo',
        select: 'firstName lastName fullName'
      }
    ]
  });

  return sendSuccess(res, result.data, 'Leave requests retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single leave request by ID
 * @route   GET /api/leaves/:id
 * @access  Private (All authenticated users)
 */
export const getLeaveById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid leave ID format');
  }

  // Find leave request
  const leave = await Leave.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  }).populate('employee', 'firstName lastName fullName employeeId')
    .populate('approvedBy', 'firstName lastName fullName')
    .populate('rejectedBy', 'firstName lastName fullName')
    .populate('cancelledBy', 'firstName lastName fullName')
    .populate('reportingManager', 'firstName lastName fullName')
    .populate('handoverTo', 'firstName lastName fullName')
    .populate('createdBy', 'firstName lastName fullName')
    .populate('updatedBy', 'firstName lastName fullName');

  if (!leave) {
    throw buildNotFoundError('Leave request', id);
  }

  return sendSuccess(res, leave);
});

/**
 * @desc    Create new leave request
 * @route   POST /api/leaves
 * @access  Private (All authenticated users)
 */
export const createLeave = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const leaveData = req.body;

  // Get Employee record from Clerk user ID
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findOne({
    clerkUserId: user.userId,
    isDeleted: false
  });

  if (!employee) {
    throw buildNotFoundError('Employee', user.userId);
  }

  // Validate dates
  const startDate = new Date(leaveData.startDate);
  const endDate = new Date(leaveData.endDate);

  if (endDate < startDate) {
    throw buildValidationError('endDate', 'End date must be after start date');
  }

  // Check for overlapping leaves
  const overlappingLeaves = await Leave.checkOverlap(
    employee._id,
    leaveData.startDate,
    leaveData.endDate
  );

  if (overlappingLeaves && overlappingLeaves.length > 0) {
    throw buildConflictError('You have overlapping leave requests for the same period');
  }

  // Prepare leave data
  leaveData.employee = employee._id;
  leaveData.companyId = user.companyId;
  leaveData.createdBy = user.userId;

  // Set reporting manager if not provided
  if (!leaveData.reportingManager && employee.reportingManager) {
    leaveData.reportingManager = employee.reportingManager;
  }

  // Get current leave balance
  const currentBalance = await Leave.getLeaveBalance(employee._id, leaveData.leaveType);
  leaveData.balanceAtRequest = currentBalance.balance;

  // Create leave request
  const leave = await Leave.create(leaveData);

  // Populate references for response
  await leave.populate('employee', 'firstName lastName fullName employeeId');
  await leave.populate('reportingManager', 'firstName lastName fullName');
  await leave.populate('handoverTo', 'firstName lastName fullName');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastLeaveEvents.created(io, user.companyId, leave);
  }

  return sendCreated(res, leave, 'Leave request created successfully');
});

/**
 * @desc    Update leave request
 * @route   PUT /api/leaves/:id
 * @access  Private (Admin, HR, Owner)
 */
export const updateLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid leave ID format');
  }

  // Find leave request
  const leave = await Leave.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!leave) {
    throw buildNotFoundError('Leave request', id);
  }

  // Check if leave can be updated
  if (leave.status === 'approved' || leave.status === 'rejected') {
    throw buildConflictError('Cannot update ' + leave.status + ' leave request');
  }

  // Check for overlapping leaves if dates are being updated
  if (updateData.startDate || updateData.endDate) {
    const newStartDate = updateData.startDate || leave.startDate;
    const newEndDate = updateData.endDate || leave.endDate;

    const overlappingLeaves = await Leave.checkOverlap(
      leave.employee,
      newStartDate,
      newEndDate,
      id
    );

    if (overlappingLeaves && overlappingLeaves.length > 0) {
      throw buildConflictError('Overlapping leave requests exist for the new dates');
    }
  }

  // Update leave request
  Object.assign(leave, updateData);
  leave.updatedBy = user.userId;
  await leave.save();

  // Populate references for response
  await leave.populate('employee', 'firstName lastName fullName employeeId');
  await leave.populate('reportingManager', 'firstName lastName fullName');
  await leave.populate('handoverTo', 'firstName lastName fullName');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastLeaveEvents.updated(io, user.companyId, leave);
  }

  return sendSuccess(res, leave, 'Leave request updated successfully');
});

/**
 * @desc    Delete leave request (soft delete)
 * @route   DELETE /api/leaves/:id
 * @access  Private (Admin, Superadmin, Owner)
 */
export const deleteLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid leave ID format');
  }

  // Find leave request
  const leave = await Leave.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!leave) {
    throw buildNotFoundError('Leave request', id);
  }

  // Check if leave can be deleted
  if (leave.status === 'approved') {
    throw buildConflictError('Cannot delete approved leave request. Cancel it instead.');
  }

  // Soft delete
  leave.isDeleted = true;
  leave.deletedAt = new Date();
  leave.deletedBy = user.userId;
  await leave.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastLeaveEvents.deleted(io, user.companyId, leave.leaveId, user.userId);
  }

  return sendSuccess(res, {
    _id: leave._id,
    leaveId: leave.leaveId,
    isDeleted: true
  }, 'Leave request deleted successfully');
});

/**
 * @desc    Get my leave requests
 * @route   GET /api/leaves/my
 * @access  Private (All authenticated users)
 */
export const getMyLeaves = asyncHandler(async (req, res) => {
  const { page, limit, status, leaveType } = req.query;
  const user = extractUser(req);

  // Get Employee record
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findOne({
    clerkUserId: user.userId,
    isDeleted: false
  });

  if (!employee) {
    return sendSuccess(res, [], 'No leave requests found');
  }

  // Build filter
  let filter = {
    employee: employee._id,
    companyId: user.companyId,
    isDeleted: false
  };

  // Apply status filter
  if (status) {
    filter.status = status;
  }

  // Apply leave type filter
  if (leaveType) {
    filter.leaveType = leaveType;
  }

  const result = await filterAndPaginate(Leave, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort: { createdAt: -1 },
    populate: [
      {
        path: 'approvedBy',
        select: 'firstName lastName fullName'
      },
      {
        path: 'rejectedBy',
        select: 'firstName lastName fullName'
      },
      {
        path: 'reportingManager',
        select: 'firstName lastName fullName'
      }
    ]
  });

  return sendSuccess(res, result.data, 'My leave requests retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get leaves by status
 * @route   GET /api/leaves/status/:status
 * @access  Private (Admin, HR, Superadmin)
 */
export const getLeavesByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params;
  const { page, limit } = req.query;
  const user = extractUser(req);

  // Validate status
  const validStatuses = ['pending', 'approved', 'rejected', 'cancelled', 'on-hold'];
  if (!validStatuses.includes(status)) {
    throw buildValidationError('status', `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const result = await filterAndPaginate(Leave, {
    companyId: user.companyId,
    status,
    isDeleted: false
  }, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort: { createdAt: -1 },
    populate: [
      {
        path: 'employee',
        select: 'firstName lastName fullName employeeId'
      },
      {
        path: 'reportingManager',
        select: 'firstName lastName fullName'
      }
    ]
  });

  return sendSuccess(res, result.data, `Leave requests with status '${status}' retrieved successfully`, 200, result.pagination);
});

/**
 * @desc    Approve leave request
 * @route   POST /api/leaves/:id/approve
 * @access  Private (Admin, HR, Manager)
 */
export const approveLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { comments } = req.body;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid leave ID format');
  }

  // Find leave request
  const leave = await Leave.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!leave) {
    throw buildNotFoundError('Leave request', id);
  }

  // Check if leave can be approved
  if (leave.status !== 'pending') {
    throw buildConflictError('Can only approve pending leave requests');
  }

  // Approve leave
  await leave.approve(user.userId, comments);

  // Update employee leave balance
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findOne({
    _id: leave.employee,
    isDeleted: false
  });

  if (employee && employee.leaveBalances) {
    const balanceIndex = employee.leaveBalances.findIndex(
      b => b.type === leave.leaveType
    );

    if (balanceIndex !== -1) {
      employee.leaveBalances[balanceIndex].used += leave.duration;
      employee.leaveBalances[balanceIndex].balance -= leave.duration;
      await employee.save();

      // Broadcast balance update
      const io = getSocketIO(req);
      if (io) {
        broadcastLeaveEvents.balanceUpdated(io, user.companyId, employee._id, employee.leaveBalances);
      }
    }
  }

  // Populate references for response
  await leave.populate('employee', 'firstName lastName fullName employeeId');
  await leave.populate('approvedBy', 'firstName lastName fullName');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastLeaveEvents.approved(io, user.companyId, leave, user.userId);
  }

  return sendSuccess(res, leave, 'Leave request approved successfully');
});

/**
 * @desc    Reject leave request
 * @route   POST /api/leaves/:id/reject
 * @access  Private (Admin, HR, Manager)
 */
export const rejectLeave = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = extractUser(req);

  if (!reason || !reason.trim()) {
    throw buildValidationError('reason', 'Rejection reason is required');
  }

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid leave ID format');
  }

  // Find leave request
  const leave = await Leave.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!leave) {
    throw buildNotFoundError('Leave request', id);
  }

  // Check if leave can be rejected
  if (leave.status !== 'pending') {
    throw buildConflictError('Can only reject pending leave requests');
  }

  // Reject leave
  await leave.reject(user.userId, reason);

  // Populate references for response
  await leave.populate('employee', 'firstName lastName fullName employeeId');
  await leave.populate('rejectedBy', 'firstName lastName fullName');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastLeaveEvents.rejected(io, user.companyId, leave, user.userId, reason);
  }

  return sendSuccess(res, leave, 'Leave request rejected successfully');
});

/**
 * @desc    Get leave balance
 * @route   GET /api/leaves/balance
 * @access  Private (All authenticated users)
 */
export const getLeaveBalance = asyncHandler(async (req, res) => {
  const { leaveType } = req.query;
  const user = extractUser(req);

  // Get Employee record
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findOne({
    clerkUserId: user.userId,
    isDeleted: false
  });

  if (!employee) {
    throw buildNotFoundError('Employee', user.userId);
  }

  // Get balance for specific type or all types
  if (leaveType) {
    const balance = await Leave.getLeaveBalance(employee._id, leaveType);
    return sendSuccess(res, balance, 'Leave balance retrieved successfully');
  }

  // Get all leave balances
  const balances = {};
  const leaveTypes = ['sick', 'casual', 'earned', 'maternity', 'paternity', 'bereavement', 'compensatory', 'unpaid', 'special'];

  for (const type of leaveTypes) {
    balances[type] = await Leave.getLeaveBalance(employee._id, type);
  }

  return sendSuccess(res, balances, 'All leave balances retrieved successfully');
});

export default {
  getLeaves,
  getLeaveById,
  createLeave,
  updateLeave,
  deleteLeave,
  getMyLeaves,
  getLeavesByStatus,
  approveLeave,
  rejectLeave,
  getLeaveBalance
};
