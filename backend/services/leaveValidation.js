/**
 * Leave Validation Service
 * Comprehensive validation for leave requests
 * Checks business rules, balances, and constraints before allowing leave requests
 */

import Leave from '../models/leave/leave.schema.js';
import LeaveType from '../models/leave/leaveType.schema.js';
import Employee from '../models/employee/employee.schema.js';
import { calculateWorkingDays } from '../utils/leaveDaysCalculator.js';

/**
 * Comprehensive leave request validation
 *
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} Validation result with employee, leaveTypeConfig, and workingDaysInfo
 * @throws {Error} Validation error with descriptive message
 */
export const validateLeaveRequest = async (req) => {
  const {
    employeeId,
    leaveType: leaveTypeCode,
    startDate,
    endDate,
    duration
  } = req.body;

  // Get user from request (from extractUser)
  const user = req.user || {};

  // 1. Check if employee exists and belongs to the same company
  const employee = await Employee.findOne({
    employeeId,
    companyId: user.companyId
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  // 2. Validate leave type
  const leaveTypeConfig = await LeaveType.findOne({
    code: leaveTypeCode,
    companyId: user.companyId,
    isActive: true,
    isDeleted: false
  });

  if (!leaveTypeConfig) {
    throw new Error(`Invalid leave type: ${leaveTypeCode}. Please contact HR.`);
  }

  // 3. Calculate and validate duration
  const workingDaysInfo = await calculateWorkingDays(
    user.companyId,
    new Date(startDate),
    new Date(endDate),
    employee.state
  );

  if (workingDaysInfo.workingDays === 0) {
    throw new Error('No working days in the selected date range. All selected dates are either weekends or holidays.');
  }

  // Check if duration matches calculated working days
  if (duration && duration !== workingDaysInfo.workingDays) {
    throw new Error(
      `Duration mismatch. Based on your selected dates, the leave duration should be ${workingDaysInfo.workingDays} working day(s). ` +
      `This includes ${workingDaysInfo.weekendDays} weekend day(s) and ${workingDaysInfo.holidayCount} holiday(s).`
    );
  }

  // 4. Check minimum notice period
  if (leaveTypeConfig.minNoticeDays > 0) {
    const minNoticeDate = new Date();
    minNoticeDate.setHours(0, 0, 0, 0);
    minNoticeDate.setDate(minNoticeDate.getDate() + leaveTypeConfig.minNoticeDays);

    if (new Date(startDate) < minNoticeDate) {
      throw new Error(
        `${leaveTypeConfig.name} requires at least ${leaveTypeConfig.minNoticeDays} day(s) advance notice. ` +
        `Please select a start date on or after ${minNoticeDate.toLocaleDateString()}.`
      );
    }
  }

  // 5. Check maximum consecutive days
  if (leaveTypeConfig.maxConsecutiveDays > 0 &&
      workingDaysInfo.workingDays > leaveTypeConfig.maxConsecutiveDays) {
    throw new Error(
      `Cannot take more than ${leaveTypeConfig.maxConsecutiveDays} consecutive working day(s) for ${leaveTypeConfig.name}. ` +
      `Your selected dates have ${workingDaysInfo.workingDays} working day(s).`
    );
  }

  // 6. Check leave balance
  const balance = await getEmployeeLeaveBalance(employeeId, leaveTypeCode, user.companyId);
  const currentBalance = balance?.balance || 0;

  // Calculate pending usage (leaves with 'pending' status for future dates)
  const pendingUsage = await Leave.aggregate([
    {
      $match: {
        employeeId,
        companyId: user.companyId,
        leaveType: leaveTypeCode,
        status: 'pending',
        startDate: { $gte: new Date() },
        isDeleted: false
      }
    },
    {
      $group: { _id: null, total: { $sum: '$duration' } }
    }
  ]).then(result => result[0]?.total || 0);

  const availableBalance = currentBalance - pendingUsage;

  if (workingDaysInfo.workingDays > availableBalance) {
    throw new Error(
      `Insufficient leave balance for ${leaveTypeConfig.name}. ` +
      `Available: ${availableBalance} day(s), Requested: ${workingDaysInfo.workingDays} day(s). ` +
      `Current Balance: ${currentBalance} day(s), Pending: ${pendingUsage} day(s).`
    );
  }

  // 7. Check for overlapping leave requests
  const overlappingLeaves = await Leave.find({
    employeeId,
    companyId: user.companyId,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: new Date(endDate) },
    endDate: { $gte: new Date(startDate) },
    isDeleted: false
  });

  if (overlappingLeaves.length > 0) {
    const overlapping = overlappingLeaves[0];
    throw new Error(
      `You already have a ${overlapping.status} leave request during this period ` +
      `(${new Date(overlapping.startDate).toLocaleDateString()} to ${new Date(overlapping.endDate).toLocaleDateString()}). ` +
      `Please cancel or modify the existing request before submitting a new one.`
    );
  }

  // 8. Check for document requirement
  if (leaveTypeConfig.requiresDocument && workingDaysInfo.workingDays >= 3) {
    const hasAttachments = req.files && req.files.length > 0;
    const hasBodyAttachments = req.body.attachments && req.body.attachments.length > 0;

    if (!hasAttachments && !hasBodyAttachments) {
      throw new Error(
        `Supporting document(s) are required for ${leaveTypeConfig.name} of 3 or more days. ` +
        `Please upload medical certificate or other relevant documents.`
      );
    }
  }

  // 9. Prevent self-approval for managers
  const ownLeaveRequest = employeeId === user.employeeId;
  if (ownLeaveRequest && leaveTypeConfig.requiresApproval) {
    // Verify that reporting manager is different from employee
    if (employee.reportingManagerId === employeeId) {
      throw new Error(
        'Self-approval is not allowed. Since you are your own reporting manager, ' +
        'please contact HR to approve your leave request.'
      );
    }
  }

  // 10. Check if employee is on probation (optional)
  if (employee.employmentStatus === 'probation') {
    // Probationary employees may have restrictions
    const probationRestrictions = leaveTypeConfig.probationRestrictions || {};
    if (probationRestrictions.allowed === false) {
      throw new Error(
        `${leaveTypeConfig.name} is not available during probation period.`
      );
    }
  }

  return {
    employee,
    leaveTypeConfig,
    workingDaysInfo,
    availableBalance,
    duration: workingDaysInfo.workingDays,
    balanceAtRequest: currentBalance
  };
};

/**
 * Validate leave approval action
 *
 * @param {string} leaveId - Leave ID
 * @param {string} approverId - Approver's employee ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Leave object
 * @throws {Error} Validation error
 */
export const validateLeaveApproval = async (leaveId, approverId, companyId) => {
  const leave = await Leave.findOne({
    leaveId,
    companyId,
    isDeleted: false
  }).populate('employee');

  if (!leave) {
    throw new Error('Leave request not found');
  }

  if (leave.status !== 'pending') {
    throw new Error(`Cannot approve leave with status: ${leave.status}. Leave is already ${leave.status}.`);
  }

  // Get approver details
  const approver = await Employee.findOne({
    employeeId: approverId,
    companyId
  });

  if (!approver) {
    throw new Error('Approver not found');
  }

  // Check if approver is admin or HR
  const isAdminOrHR = approver.role === 'admin' || approver.role === 'hr' || approver.role === 'superadmin';

  // Check if approver is the reporting manager
  const isReportingManager = leave.employee &&
    leave.employee.reportingManagerId === approverId;

  if (!isAdminOrHR && !isReportingManager) {
    throw new Error('You are not authorized to approve this leave request. Only the reporting manager or admin/HR can approve.');
  }

  return leave;
};

/**
 * Validate leave rejection action
 *
 * @param {string} leaveId - Leave ID
 * @param {string} rejectorId - Rejector's employee ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Leave object
 * @throws {Error} Validation error
 */
export const validateLeaveRejection = async (leaveId, rejectorId, companyId) => {
  // Use same validation as approval
  return validateLeaveApproval(leaveId, rejectorId, companyId);
};

/**
 * Validate leave cancellation
 *
 * @param {string} leaveId - Leave ID
 * @param {string} employeeId - Employee ID requesting cancellation
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Leave object with validation info
 * @throws {Error} Validation error
 */
export const validateLeaveCancellation = async (leaveId, employeeId, companyId) => {
  const leave = await Leave.findOne({
    leaveId,
    companyId,
    isDeleted: false
  });

  if (!leave) {
    throw new Error('Leave request not found');
  }

  // Check if the employee owns this leave
  if (leave.employeeId !== employeeId) {
    throw new Error('You can only cancel your own leave requests');
  }

  // Check if leave can be cancelled
  if (leave.status === 'cancelled') {
    throw new Error('This leave has already been cancelled');
  }

  if (leave.status === 'rejected') {
    throw new Error('Cannot cancel a rejected leave request');
  }

  // Check if leave has already started
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const leaveStartDate = new Date(leave.startDate);
  leaveStartDate.setHours(0, 0, 0, 0);

  if (leaveStartDate <= today) {
    throw new Error('Cannot cancel leave that has already started or ended. Please contact HR for assistance.');
  }

  // Check cancellation notice period
  const leaveType = await LeaveType.findOne({
    code: leave.leaveType,
    companyId,
    isActive: true
  });

  if (leaveType && leaveType.cancellationNoticeDays > 0) {
    const minCancellationDate = new Date(leaveStartDate);
    minCancellationDate.setDate(minCancellationDate.getDate() - leaveType.cancellationNoticeDays);

    if (today > minCancellationDate) {
      throw new Error(
        `${leaveType.name} requires at least ${leaveType.cancellationNoticeDays} day(s) notice for cancellation. ` +
        `Please contact HR for assistance.`
      );
    }
  }

  return {
    leave,
    canCancel: true,
    requiresAdminApproval: leave.status === 'approved'
  };
};

/**
 * Get employee leave balance for a specific leave type
 *
 * @param {string} employeeId - Employee ID
 * @param {string} leaveType - Leave type code
 * @param {string} companyId - Company ID
 * @returns {Promise<Object|null>} Balance object
 */
export const getEmployeeLeaveBalance = async (employeeId, leaveType, companyId) => {
  // Check if there's a LeaveBalance collection
  // For now, we'll calculate from leave history
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);

  // Get approved leaves for this year
  const approvedLeaves = await Leave.aggregate([
    {
      $match: {
        employeeId,
        companyId,
        leaveType,
        status: 'approved',
        startDate: { $gte: yearStart, $lte: yearEnd },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        totalUsed: { $sum: '$duration' }
      }
    }
  ]);

  // Get pending leaves
  const pendingLeaves = await Leave.aggregate([
    {
      $match: {
        employeeId,
        companyId,
        leaveType,
        status: 'pending',
        startDate: { $gte: new Date() },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        totalPending: { $sum: '$duration' }
      }
    }
  ]);

  const used = approvedLeaves[0]?.totalUsed || 0;
  const pending = pendingLeaves[0]?.totalPending || 0;

  // Get annual quota from leave type
  const leaveTypeConfig = await LeaveType.findOne({
    code: leaveType,
    companyId,
    isActive: true
  });

  const annualQuota = leaveTypeConfig?.annualQuota || 0;
  const balance = annualQuota - used;

  return {
    leaveType,
    annualQuota,
    used,
    pending,
    balance
  };
};

/**
 * Check if employee can apply for leave
 *
 * @param {string} employeeId - Employee ID
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Eligibility info
 */
export const checkLeaveEligibility = async (employeeId, companyId) => {
  const employee = await Employee.findOne({
    employeeId,
    companyId
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  const eligibility = {
    canApplyForLeave: true,
    restrictions: [],
    warnings: []
  };

  // Check employment status
  if (employee.employmentStatus === 'inactive' || employee.employmentStatus === 'terminated') {
    eligibility.canApplyForLeave = false;
    eligibility.restrictions.push(`Employee status is ${employee.employmentStatus}. Cannot apply for leave.`);
  }

  // Check if employee is on notice period
  if (employee.noticePeriodEndDate) {
    const noticeEndDate = new Date(employee.noticePeriodEndDate);
    if (noticeEndDate < new Date()) {
      eligibility.warnings.push('Employee is past notice period end date.');
    }
  }

  // Check for any long-running leave (to prevent overlaps)
  const activeLeaves = await Leave.countDocuments({
    employeeId,
    companyId,
    status: { $in: ['approved', 'pending'] },
    endDate: { $gte: new Date() },
    isDeleted: false
  });

  if (activeLeaves > 0) {
    eligibility.warnings.push(`Employee has ${activeLeaves} active leave request(s).`);
  }

  return eligibility;
};

export default {
  validateLeaveRequest,
  validateLeaveApproval,
  validateLeaveRejection,
  validateLeaveCancellation,
  getEmployeeLeaveBalance,
  checkLeaveEligibility
};
