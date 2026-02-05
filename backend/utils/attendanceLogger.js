/**
 * Attendance Logger Utility
 * Provides specialized logging for attendance operations
 * Integrates with main logger for centralized log management
 */

import logger from './logger.js';

/**
 * Log clock in operation
 * @param {Object} data - Attendance data
 */
export const logClockIn = (data) => {
  logger.info('Attendance: Clock In', {
    action: 'clock_in',
    attendanceId: data.attendanceId,
    employeeId: data.employeeId,
    companyId: data.companyId,
    timestamp: new Date().toISOString(),
    location: data.clockIn?.location?.type,
    notes: data.clockIn?.notes
  });
};

/**
 * Log clock out operation
 * @param {Object} data - Attendance data
 */
export const logClockOut = (data) => {
  logger.info('Attendance: Clock Out', {
    action: 'clock_out',
    attendanceId: data.attendanceId,
    employeeId: data.employeeId,
    companyId: data.companyId,
    timestamp: new Date().toISOString(),
    hoursWorked: data.hoursWorked,
    isLate: data.isLate,
    isEarlyDeparture: data.isEarlyDeparture
  });
};

/**
 * Log attendance update
 * @param {string} attendanceId - Attendance ID
 * @param {Object} updates - Update data
 * @param {string} userId - User making the update
 */
export const logAttendanceUpdate = (attendanceId, updates, userId) => {
  logger.info('Attendance: Updated', {
    action: 'update',
    attendanceId,
    updatedBy: userId,
    updates: Object.keys(updates),
    timestamp: new Date().toISOString()
  });
};

/**
 * Log attendance deletion
 * @param {string} attendanceId - Attendance ID
 * @param {string} userId - User deleting the record
 */
export const logAttendanceDelete = (attendanceId, userId) => {
  logger.warn('Attendance: Deleted', {
    action: 'delete',
    attendanceId,
    deletedBy: userId,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log regularization request
 * @param {string} attendanceId - Attendance ID
 * @param {string} employeeId - Employee ID
 * @param {string} reason - Reason for regularization
 */
export const logRegularizationRequest = (attendanceId, employeeId, reason) => {
  logger.info('Attendance: Regularization Requested', {
    action: 'regularization_request',
    attendanceId,
    employeeId,
    reason,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log regularization approval/rejection
 * @param {string} attendanceId - Attendance ID
 * @param {string} status - Status (approved/rejected)
 * @param {string} approvedBy - User who approved/rejected
 */
export const logRegularizationDecision = (attendanceId, status, approvedBy) => {
  logger.info('Attendance: Regularization Decision', {
    action: 'regularization_decision',
    attendanceId,
    status,
    approvedBy,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log bulk attendance operation
 * @param {string} action - Action performed
 * @param {number} count - Number of records affected
 * @param {string} userId - User who performed the action
 */
export const logBulkOperation = (action, count, userId) => {
  logger.info('Attendance: Bulk Operation', {
    action: 'bulk_' + action,
    recordCount: count,
    performedBy: userId,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log attendance statistics query
 * @param {string} companyId - Company ID
 * @param {Object} filters - Applied filters
 * @param {number} duration - Query duration in ms
 */
export const logStatsQuery = (companyId, filters, duration) => {
  logger.debug('Attendance: Statistics Query', {
    action: 'stats_query',
    companyId,
    filters,
    duration: `${duration}ms`
  });
};

/**
 * Log attendance validation error
 * @param {string} field - Field that failed validation
 * @param {string} message - Error message
 * @param {Object} data - Related data
 */
export const logValidationError = (field, message, data) => {
  logger.warn('Attendance: Validation Error', {
    action: 'validation_error',
    field,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log attendance conflict (duplicate clock-in, etc.)
 * @param {string} conflictType - Type of conflict
 * @param {string} employeeId - Employee ID
 * @param {Object} details - Conflict details
 */
export const logConflict = (conflictType, employeeId, details) => {
  logger.warn('Attendance: Conflict Detected', {
    action: 'conflict',
    conflictType,
    employeeId,
    details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log attendance cache hit/miss
 * @param {string} cacheKey - Cache key
 * @param {boolean} hit - Cache hit or miss
 */
export const logCacheAccess = (cacheKey, hit) => {
  logger.debug('Attendance: Cache Access', {
    action: 'cache_access',
    cacheKey,
    hit,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log slow attendance operation
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in ms
 * @param {Object} details - Additional details
 */
export const logSlowOperation = (operation, duration, details) => {
  logger.warn('Attendance: Slow Operation', {
    action: 'slow_operation',
    operation,
    duration: `${duration}ms`,
    details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log Socket.IO event
 * @param {string} event - Event name
 * @param {string} companyId - Company ID
 * @param {Object} payload - Event payload
 */
export const logSocketEvent = (event, companyId, payload) => {
  logger.debug('Attendance: Socket Event', {
    action: 'socket_event',
    event,
    companyId,
    payloadKeys: Object.keys(payload),
    timestamp: new Date().toISOString()
  });
};

/**
 * Log export operation
 * @param {string} format - Export format (csv/pdf)
 * @param {string} userId - User requesting export
 * @param {number} recordCount - Number of records exported
 */
export const logExport = (format, userId, recordCount) => {
  logger.info('Attendance: Export', {
    action: 'export',
    format,
    userId,
    recordCount,
    timestamp: new Date().toISOString()
  });
};

/**
 * Create attendance operation logger with context
 * @param {string} requestId - Request ID
 * @param {string} userId - User ID
 * @param {string} companyId - Company ID
 * @returns {Object} Contextual logger
 */
export const createAttendanceLogger = (requestId, userId, companyId) => {
  return {
    clockIn: (data) => logClockIn({ ...data, requestId, userId, companyId }),
    clockOut: (data) => logClockOut({ ...data, requestId, userId, companyId }),
    update: (attendanceId, updates) => logAttendanceUpdate(attendanceId, updates, userId),
    delete: (attendanceId) => logAttendanceDelete(attendanceId, userId),
    regularizationRequest: (attendanceId, reason) => logRegularizationRequest(attendanceId, userId, reason),
    regularizationDecision: (attendanceId, status) => logRegularizationDecision(attendanceId, status, userId),
    bulk: (action, count) => logBulkOperation(action, count, userId),
    stats: (filters, duration) => logStatsQuery(companyId, filters, duration),
    validationError: (field, message, data) => logValidationError(field, message, { ...data, requestId, userId, companyId }),
    conflict: (conflictType, details) => logConflict(conflictType, userId, { ...details, requestId }),
    slowOperation: (operation, duration, details) => logSlowOperation(operation, duration, { ...details, requestId }),
    export: (format, recordCount) => logExport(format, userId, recordCount)
  };
};

/**
 * Performance monitoring wrapper for attendance operations
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to monitor
 * @returns {Promise} Result of the function
 */
export const monitorAttendancePerformance = async (operation, fn) => {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    if (duration > 1000) {
      logSlowOperation(operation, duration, {});
    } else {
      logger.debug('Attendance: Operation completed', {
        action: 'performance',
        operation,
        duration: `${duration}ms`
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Attendance: Operation failed', {
      action: 'performance_error',
      operation,
      duration: `${duration}ms`,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

export default {
  logClockIn,
  logClockOut,
  logAttendanceUpdate,
  logAttendanceDelete,
  logRegularizationRequest,
  logRegularizationDecision,
  logBulkOperation,
  logStatsQuery,
  logValidationError,
  logConflict,
  logCacheAccess,
  logSlowOperation,
  logSocketEvent,
  logExport,
  createAttendanceLogger,
  monitorAttendancePerformance
};
