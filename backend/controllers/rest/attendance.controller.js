/**
 * Attendance REST Controller
 * Handles all Attendance CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Attendance from '../../models/attendance/attendance.schema.js';
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
import { getSocketIO, broadcastAttendanceEvents } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all attendance records with pagination and filtering
 * @route   GET /api/attendance
 * @access  Private (Admin, HR, Superadmin)
 */
export const getAttendances = asyncHandler(async (req, res) => {
  const { page, limit, search, status, employee, startDate, endDate, sortBy, order } = req.query;
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

  // Apply employee filter
  if (employee) {
    filter.employee = employee;
  }

  // Apply date range filter
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) {
      filter.date.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.date.$lte = new Date(endDate);
    }
  }

  // Apply search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['notes', 'managerNotes']);
    filter = { ...filter, ...searchFilter };
  }

  // Build sort option
  const sort = {};
  if (sortBy) {
    sort[sortBy] = order === 'asc' ? 1 : -1;
  } else {
    sort.date = -1;
  }

  // Get paginated results
  const result = await filterAndPaginate(Attendance, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort,
    populate: [
      {
        path: 'employee',
        select: 'firstName lastName fullName employeeId'
      },
      {
        path: 'shift',
        select: 'name startTime endTime'
      }
    ]
  });

  return sendSuccess(res, result.data, 'Attendance records retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single attendance record by ID
 * @route   GET /api/attendance/:id
 * @access  Private (All authenticated users)
 */
export const getAttendanceById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid attendance ID format');
  }

  // Find attendance record
  const attendance = await Attendance.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  }).populate('employee', 'firstName lastName fullName employeeId')
    .populate('shift', 'name startTime endTime')
    .populate('createdBy', 'firstName lastName fullName')
    .populate('updatedBy', 'firstName lastName fullName');

  if (!attendance) {
    throw buildNotFoundError('Attendance record', id);
  }

  return sendSuccess(res, attendance);
});

/**
 * @desc    Create new attendance record (clock in)
 * @route   POST /api/attendance
 * @access  Private (All authenticated users)
 */
export const createAttendance = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const attendanceData = req.body;

  // Get Employee record from Clerk user ID
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findOne({
    clerkUserId: user.userId,
    isDeleted: false
  });

  if (!employee) {
    throw buildNotFoundError('Employee', user.userId);
  }

  // Check if already clocked in today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingAttendance = await Attendance.findOne({
    employee: employee._id,
    date: {
      $gte: today,
      $lt: tomorrow
    },
    isDeleted: false
  });

  if (existingAttendance && existingAttendance.clockIn.time && !existingAttendance.clockOut.time) {
    throw buildConflictError('Already clocked in today. Please clock out first.');
  }

  // Prepare attendance data
  attendanceData.employee = employee._id;
  attendanceData.companyId = user.companyId;
  attendanceData.createdBy = user.userId;

  // If clock-in data provided, set it
  if (!attendanceData.clockIn) {
    attendanceData.clockIn = {
      time: new Date(),
      location: req.body.location || { type: 'office' }
    };
  }

  // Create attendance record
  const attendance = await Attendance.create(attendanceData);

  // Populate references for response
  await attendance.populate('employee', 'firstName lastName fullName employeeId');
  await attendance.populate('shift', 'name startTime endTime');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastAttendanceEvents.created(io, user.companyId, attendance);
    broadcastAttendanceEvents.clockIn(io, user.companyId, attendance);
  }

  return sendCreated(res, attendance, 'Clocked in successfully');
});

/**
 * @desc    Update attendance record (clock out)
 * @route   PUT /api/attendance/:id
 * @access  Private (All authenticated users)
 */
export const updateAttendance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid attendance ID format');
  }

  // Find attendance record
  const attendance = await Attendance.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!attendance) {
    throw buildNotFoundError('Attendance record', id);
  }

  // Check if clocked in
  if (!attendance.clockIn || !attendance.clockIn.time) {
    throw buildConflictError('Not clocked in yet');
  }

  // Check if already clocked out
  if (attendance.clockOut && attendance.clockOut.time) {
    throw buildConflictError('Already clocked out');
  }

  // If clock-out data provided, set it
  if (updateData.clockOut) {
    attendance.clockOut = {
      time: updateData.clockOut.time || new Date(),
      location: updateData.clockOut.location || { type: 'office' },
      notes: updateData.clockOut.notes || ''
    };
  } else if (!updateData.clockOut) {
    attendance.clockOut = {
      time: new Date(),
      location: { type: 'office' }
    };
  }

  // Update break duration if provided
  if (updateData.breakDuration !== undefined) {
    attendance.breakDuration = updateData.breakDuration;
  }

  attendance.updatedBy = user.userId;
  await attendance.save();

  // Populate references for response
  await attendance.populate('employee', 'firstName lastName fullName employeeId');
  await attendance.populate('shift', 'name startTime endTime');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastAttendanceEvents.updated(io, user.companyId, attendance);
    broadcastAttendanceEvents.clockOut(io, user.companyId, attendance);
  }

  return sendSuccess(res, attendance, 'Clocked out successfully');
});

/**
 * @desc    Delete attendance record (soft delete)
 * @route   DELETE /api/attendance/:id
 * @access  Private (Admin, Superadmin)
 */
export const deleteAttendance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid attendance ID format');
  }

  // Find attendance record
  const attendance = await Attendance.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!attendance) {
    throw buildNotFoundError('Attendance record', id);
  }

  // Soft delete
  attendance.isDeleted = true;
  attendance.deletedAt = new Date();
  attendance.deletedBy = user.userId;
  await attendance.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastAttendanceEvents.deleted(io, user.companyId, attendance.attendanceId, user.userId);
  }

  return sendSuccess(res, {
    _id: attendance._id,
    attendanceId: attendance.attendanceId,
    isDeleted: true
  }, 'Attendance record deleted successfully');
});

/**
 * @desc    Get my attendance records
 * @route   GET /api/attendance/my
 * @access  Private (All authenticated users)
 */
export const getMyAttendance = asyncHandler(async (req, res) => {
  const { page, limit, startDate, endDate, status } = req.query;
  const user = extractUser(req);

  // Get Employee record
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findOne({
    clerkUserId: user.userId,
    isDeleted: false
  });

  if (!employee) {
    return sendSuccess(res, [], 'No attendance records found');
  }

  // Build filter
  let filter = {
    employee: employee._id,
    companyId: user.companyId,
    isDeleted: false
  };

  // Apply date range filter
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) {
      filter.date.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.date.$lte = new Date(endDate);
    }
  }

  // Apply status filter
  if (status) {
    filter.status = status;
  }

  const attendances = await Attendance.find(filter)
    .populate('shift', 'name startTime endTime')
    .sort({ date: -1 })
    .limit(parseInt(limit) || 31);

  return sendSuccess(res, attendances, 'My attendance records retrieved successfully');
});

/**
 * @desc    Get attendance by date range
 * @route   GET /api/attendance/daterange
 * @access  Private (Admin, HR, Superadmin)
 */
export const getAttendanceByDateRange = asyncHandler(async (req, res) => {
  const { startDate, endDate, page, limit } = req.query;
  const user = extractUser(req);

  if (!startDate || !endDate) {
    throw buildValidationError('startDate/endDate', 'Both startDate and endDate are required');
  }

  // Build filter
  const filter = {
    companyId: user.companyId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    isDeleted: false
  };

  const result = await filterAndPaginate(Attendance, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 31,
    sort: { date: -1 },
    populate: [
      {
        path: 'employee',
        select: 'firstName lastName fullName employeeId'
      },
      {
        path: 'shift',
        select: 'name startTime endTime'
      }
    ]
  });

  return sendSuccess(res, result.data, 'Attendance records retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get attendance by employee
 * @route   GET /api/attendance/employee/:employeeId
 * @access  Private (Admin, HR, Superadmin)
 */
export const getAttendanceByEmployee = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { page, limit, startDate, endDate } = req.query;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    throw buildValidationError('employeeId', 'Invalid employee ID format');
  }

  // Build filter
  const filter = {
    employee: employeeId,
    companyId: user.companyId,
    isDeleted: false
  };

  // Apply date range filter
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) {
      filter.date.$gte = new Date(startDate);
    }
    if (endDate) {
      filter.date.$lte = new Date(endDate);
    }
  }

  const result = await filterAndPaginate(Attendance, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 31,
    sort: { date: -1 },
    populate: {
      path: 'shift',
      select: 'name startTime endTime'
    }
  });

  return sendSuccess(res, result.data, 'Employee attendance records retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get attendance statistics
 * @route   GET /api/attendance/stats
 * @access  Private (Admin, HR, Superadmin)
 */
export const getAttendanceStats = asyncHandler(async (req, res) => {
  const { startDate, endDate, employee } = req.query;
  const user = extractUser(req);

  // Build filters
  const filters = {
    companyId: user.companyId,
    isDeleted: false
  };

  if (employee) {
    filters.employee = new mongoose.Types.ObjectId(employee);
  }

  if (startDate || endDate) {
    filters.date = {};
    if (startDate) {
      filters.date.$gte = new Date(startDate);
    }
    if (endDate) {
      filters.date.$lte = new Date(endDate);
    }
  }

  const stats = await Attendance.getStats(user.companyId, filters);

  // Add calculated metrics
  stats.averageHoursPerDay = stats.total > 0 ? (stats.totalHoursWorked / stats.total).toFixed(2) : 0;
  stats.attendanceRate = stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(2) : 0;
  stats.lateRate = stats.total > 0 ? ((stats.late / stats.total) * 100).toFixed(2) : 0;

  return sendSuccess(res, stats, 'Attendance statistics retrieved successfully');
});

/**
 * @desc    Bulk attendance action
 * @route   POST /api/attendance/bulk
 * @access  Private (Admin, HR, Superadmin)
 */
export const bulkAttendanceAction = asyncHandler(async (req, res) => {
  const { action, attendanceIds, data } = req.body;
  const user = extractUser(req);

  if (!action || !attendanceIds || !Array.isArray(attendanceIds)) {
    throw buildValidationError('action/attendanceIds', 'Action and attendanceIds array are required');
  }

  const validActions = ['approve-regularization', 'reject-regularization', 'update-status', 'bulk-delete'];
  if (!validActions.includes(action)) {
    throw buildValidationError('action', `Invalid action. Must be one of: ${validActions.join(', ')}`);
  }

  // Convert IDs to ObjectIds
  const attendanceObjectIds = attendanceIds.map(id => new mongoose.Types.ObjectId(id));

  // Find all attendance records
  const attendances = await Attendance.find({
    _id: { $in: attendanceObjectIds },
    companyId: user.companyId,
    isDeleted: false
  });

  if (attendances.length === 0) {
    throw buildNotFoundError('Attendance records', attendanceIds.join(', '));
  }

  let updatedCount = 0;
  const results = [];

  // Perform bulk action
  for (const attendance of attendances) {
    try {
      switch (action) {
        case 'approve-regularization':
          if (attendance.regularizationRequest?.requested) {
            attendance.regularizationRequest.status = 'approved';
            attendance.regularizationRequest.approvedBy = user.userId;
            attendance.regularizationRequest.approvedAt = new Date();
            attendance.isRegularized = true;
            attendance.updatedBy = user.userId;
            await attendance.save();
            updatedCount++;
          }
          break;

        case 'reject-regularization':
          if (attendance.regularizationRequest?.requested) {
            attendance.regularizationRequest.status = 'rejected';
            attendance.regularizationRequest.rejectionReason = data?.reason || 'Request rejected';
            attendance.updatedBy = user.userId;
            await attendance.save();
            updatedCount++;
          }
          break;

        case 'update-status':
          if (data?.status) {
            attendance.status = data.status;
            attendance.updatedBy = user.userId;
            await attendance.save();
            updatedCount++;
          }
          break;

        case 'bulk-delete':
          attendance.isDeleted = true;
          attendance.deletedAt = new Date();
          attendance.deletedBy = user.userId;
          await attendance.save();
          updatedCount++;
          break;
      }

      results.push({
        attendanceId: attendance.attendanceId,
        _id: attendance._id,
        success: true
      });
    } catch (error) {
      results.push({
        attendanceId: attendance.attendanceId,
        _id: attendance._id,
        success: false,
        error: error.message
      });
    }
  }

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastAttendanceEvents.bulkUpdated(io, user.companyId, {
      action,
      updatedCount,
      results
    });
  }

  return sendSuccess(res, {
    action,
    requested: attendanceIds.length,
    updated: updatedCount,
    results
  }, `Bulk action completed: ${updatedCount} of ${attendanceIds.length} attendance records updated`);
});

export default {
  getAttendances,
  getAttendanceById,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getMyAttendance,
  getAttendanceByDateRange,
  getAttendanceByEmployee,
  getAttendanceStats,
  bulkAttendanceAction
};
