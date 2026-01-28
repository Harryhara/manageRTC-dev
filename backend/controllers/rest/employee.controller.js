/**
 * Employee REST Controller
 * Handles all Employee CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Employee from '../../models/employee/employee.schema.js';
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
  buildAuditFields,
  getRequestId
} from '../../utils/apiResponse.js';
import { getSocketIO, broadcastEmployeeEvents } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all employees with pagination and filtering
 * @route   GET /api/employees
 * @access  Private (Admin, HR, Superadmin)
 */
export const getEmployees = asyncHandler(async (req, res) => {
  const { page, limit, search, department, designation, status, sortBy, order } = req.query;
  const user = extractUser(req);

  // Build filter
  let filter = {
    companyId: user.companyId,
    isActive: true,
    isDeleted: false
  };

  // Apply status filter
  if (status) {
    filter.employmentStatus = status;
  }

  // Apply department filter
  if (department) {
    filter.department = department;
  }

  // Apply designation filter
  if (designation) {
    filter.designation = designation;
  }

  // Apply search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['firstName', 'lastName', 'email', 'employeeCode']);
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
  const result = await filterAndPaginate(Employee, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort,
    populate: [
      { path: 'department', select: 'name' },
      { path: 'designation', select: 'title level' },
      { path: 'reportingTo', select: 'firstName lastName fullName employeeId' }
    ],
    select: '-salary -bankDetails -emergencyContact -socialProfiles'
  });

  return sendSuccess(res, result.data, 'Employees retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single employee by ID
 * @route   GET /api/employees/:id
 * @access  Private (All roles can view their own profile)
 */
export const getEmployeeById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid employee ID format');
  }

  // Find employee
  const employee = await Employee.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  }).populate('department', 'name')
    .populate('designation', 'title level')
    .populate('reportingTo', 'firstName lastName fullName employeeId')
    .populate('reportees', 'firstName lastName fullName employeeId designation')
    .populate('createdBy', 'firstName lastName fullName')
    .populate('updatedBy', 'firstName lastName fullName');

  if (!employee) {
    throw buildNotFoundError('Employee', id);
  }

  // Remove sensitive fields for non-admin users
  if (user.role !== 'admin' && user.role !== 'hr' && user.role !== 'superadmin') {
    // Regular employees can't see salary, bank details
    const { salary, bankDetails, ...sanitizedEmployee } = employee.toObject();
    return sendSuccess(res, sanitizedEmployee);
  }

  return sendSuccess(res, employee);
});

/**
 * @desc    Create new employee
 * @route   POST /api/employees
 * @access  Private (Admin, HR, Superadmin)
 */
export const createEmployee = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const employeeData = req.body;

  // Check if email already exists
  const existingEmployee = await Employee.findOne({
    email: employeeData.email,
    companyId: user.companyId
  });

  if (existingEmployee) {
    throw buildConflictError('Employee', `email: ${employeeData.email}`);
  }

  // Check if employee code already exists (if provided)
  if (employeeData.employeeCode) {
    const existingCode = await Employee.findOne({
      employeeCode: employeeData.employeeCode,
      companyId: user.companyId
    });

    if (existingCode) {
      throw buildConflictError('Employee', `employee code: ${employeeData.employeeCode}`);
    }
  }

  // Add company and audit fields
  employeeData.companyId = user.companyId;
  Object.assign(employeeData, buildAuditFields(user.userId));

  // Create employee
  const employee = await Employee.create(employeeData);

  // Populate references for response
  await employee.populate('department', 'name');
  await employee.populate('designation', 'title level');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastEmployeeEvents.created(io, user.companyId, employee);
  }

  return sendCreated(res, employee, 'Employee created successfully');
});

/**
 * @desc    Update employee
 * @route   PUT /api/employees/:id
 * @access  Private (Admin, HR, Superadmin)
 */
export const updateEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid employee ID format');
  }

  // Find employee
  const employee = await Employee.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!employee) {
    throw buildNotFoundError('Employee', id);
  }

  // Check email uniqueness if email is being updated
  if (updateData.email && updateData.email !== employee.email) {
    const existingEmployee = await Employee.findOne({
      email: updateData.email,
      companyId: user.companyId,
      _id: { $ne: id }
    });

    if (existingEmployee) {
      throw buildConflictError('Employee', `email: ${updateData.email}`);
    }
  }

  // Check employee code uniqueness if being updated
  if (updateData.employeeCode && updateData.employeeCode !== employee.employeeCode) {
    const existingCode = await Employee.findOne({
      employeeCode: updateData.employeeCode,
      companyId: user.companyId,
      _id: { $ne: id }
    });

    if (existingCode) {
      throw buildConflictError('Employee', `employee code: ${updateData.employeeCode}`);
    }
  }

  // Update audit fields
  Object.assign(updateData, buildAuditFields(user.userId, true));

  // Update employee
  Object.assign(employee, updateData);
  await employee.save();

  // Populate references for response
  await employee.populate('department', 'name');
  await employee.populate('designation', 'title level');
  await employee.populate('reportingTo', 'firstName lastName fullName employeeId');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastEmployeeEvents.updated(io, user.companyId, employee);
  }

  return sendSuccess(res, employee, 'Employee updated successfully');
});

/**
 * @desc    Delete employee (soft delete)
 * @route   DELETE /api/employees/:id
 * @access  Private (Admin, Superadmin only)
 */
export const deleteEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid employee ID format');
  }

  // Find employee
  const employee = await Employee.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!employee) {
    throw buildNotFoundError('Employee', id);
  }

  // Prevent deletion of active employees with assigned tasks/projects
  // Add business logic validation here if needed

  // Soft delete
  await employee.softDelete(user.userId);

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastEmployeeEvents.deleted(io, user.companyId, employee.employeeId, user.userId);
  }

  return sendSuccess(res, {
    _id: employee._id,
    employeeId: employee.employeeId,
    isDeleted: true,
    deletedAt: employee.deletedAt
  }, 'Employee deleted successfully');
});

/**
 * @desc    Get employee profile (current user)
 * @route   GET /api/employees/me
 * @access  Private (All authenticated users)
 */
export const getMyProfile = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  // Find employee by clerk user ID
  const employee = await Employee.findOne({
    clerkUserId: user.userId,
    isDeleted: false
  }).populate('department', 'name')
    .populate('designation', 'title level')
    .populate('reportingTo', 'firstName lastName fullName employeeId');

  if (!employee) {
    throw buildNotFoundError('Employee profile');
  }

  // Remove sensitive fields
  const { salary, bankDetails, ...sanitizedEmployee } = employee.toObject();

  return sendSuccess(res, sanitizedEmployee);
});

/**
 * @desc    Update my profile
 * @route   PUT /api/employees/me
 * @access  Private (All authenticated users)
 */
export const updateMyProfile = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const updateData = req.body;

  // Find employee by clerk user ID
  const employee = await Employee.findOne({
    clerkUserId: user.userId,
    isDeleted: false
  });

  if (!employee) {
    throw buildNotFoundError('Employee profile');
  }

  // Restrict what fields can be updated by users themselves
  const allowedFields = [
    'phone',
    'dateOfBirth',
    'gender',
    'address',
    'emergencyContact',
    'socialProfiles',
    'profileImage'
  ];

  const sanitizedUpdate = {};
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      sanitizedUpdate[field] = updateData[field];
    }
  });

  // Update audit fields
  Object.assign(sanitizedUpdate, buildAuditFields(user.userId, true));

  // Update employee
  Object.assign(employee, sanitizedUpdate);
  await employee.save();

  await employee.populate('department', 'name');
  await employee.populate('designation', 'title level');

  return sendSuccess(res, employee, 'Profile updated successfully');
});

/**
 * @desc    Get employee reportees (subordinates)
 * @route   GET /api/employees/:id/reportees
 * @access  Private (Admin, HR, Superadmin, or the manager themselves)
 */
export const getEmployeeReportees = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid employee ID format');
  }

  // Find employee
  const employee = await Employee.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!employee) {
    throw buildNotFoundError('Employee', id);
  }

  // Get all reportees
  const reportees = await Employee.find({
    reportingTo: id,
    companyId: user.companyId,
    isActive: true,
    isDeleted: false
  }).populate('department', 'name')
    .populate('designation', 'title level')
    .select('-salary -bankDetails -emergencyContact');

  return sendSuccess(res, reportees, 'Reportees retrieved successfully');
});

/**
 * @desc    Get employee count by department
 * @route   GET /api/employees/stats/by-department
 * @access  Private (Admin, HR, Superadmin)
 */
export const getEmployeeStatsByDepartment = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const stats = await Employee.aggregate([
    {
      $match: {
        companyId: new mongoose.Types.ObjectId(user.companyId),
        isActive: true,
        isDeleted: false
      }
    },
    {
      $lookup: {
        from: 'departments',
        localField: 'department',
        foreignField: '_id',
        as: 'departmentInfo'
      }
    },
    {
      $unwind: '$departmentInfo'
    },
    {
      $group: {
        _id: '$department',
        departmentName: { $first: '$departmentInfo.name' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  return sendSuccess(res, stats, 'Employee statistics by department retrieved successfully');
});

/**
 * @desc    Search employees
 * @route   GET /api/employees/search
 * @access  Private (Admin, HR, Superadmin)
 */
export const searchEmployees = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const user = extractUser(req);

  if (!q || q.trim().length < 2) {
    throw buildValidationError('q', 'Search query must be at least 2 characters');
  }

  const employees = await Employee.find({
    companyId: user.companyId,
    isActive: true,
    isDeleted: false,
    $or: [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { fullName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { employeeCode: { $regex: q, $options: 'i' } }
    ]
  })
    .populate('department', 'name')
    .populate('designation', 'title level')
    .select('-salary -bankDetails -emergencyContact')
    .limit(20);

  return sendSuccess(res, employees, 'Search results retrieved successfully');
});

/**
 * @desc    Bulk upload employees
 * @route   POST /api/employees/bulk-upload
 * @access  Private (Admin, HR, Superadmin)
 */
export const bulkUploadEmployees = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const { employees } = req.body;

  if (!employees || !Array.isArray(employees) || employees.length === 0) {
    throw buildValidationError('employees', 'At least one employee is required');
  }

  if (employees.length > 100) {
    throw buildValidationError('employees', 'Maximum 100 employees can be uploaded at once');
  }

  const results = {
    success: [],
    failed: [],
    duplicate: []
  };

  for (const empData of employees) {
    try {
      // Check for duplicate email
      const existing = await Employee.findOne({
        email: empData.email,
        companyId: user.companyId
      });

      if (existing) {
        results.duplicate.push({
          email: empData.email,
          reason: 'Email already exists'
        });
        continue;
      }

      // Create employee
      const employee = await Employee.create({
        ...empData,
        companyId: user.companyId,
        ...buildAuditFields(user.userId)
      });

      results.success.push({
        employeeId: employee.employeeId,
        email: employee.email,
        name: `${employee.firstName} ${employee.lastName}`
      });
    } catch (error) {
      results.failed.push({
        email: empData.email,
        reason: error.message
      });
    }
  }

  return sendSuccess(res, results, `Bulk upload completed: ${results.success.length} created, ${results.duplicate.length} duplicates, ${results.failed.length} failed`);
});

export default {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getMyProfile,
  updateMyProfile,
  getEmployeeReportees,
  getEmployeeStatsByDepartment,
  searchEmployees,
  bulkUploadEmployees
};
