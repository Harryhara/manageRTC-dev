/**
 * Timezone Utilities for Attendance Module
 * Provides comprehensive timezone handling for attendance operations
 * Supports multi-timezone attendance tracking and calculations
 */

import { DateTime } from 'luxon';

/**
 * Default timezone fallback (UTC)
 */
const DEFAULT_TIMEZONE = 'UTC';

/**
 * Get company timezone or fallback to default
 * @param {Object} company - Company object with timezone field
 * @returns {string} Timezone string (IANA format)
 */
export const getCompanyTimezone = (company) => {
  return company?.settings?.timezone || company?.timezone || DEFAULT_TIMEZONE;
};

/**
 * Convert UTC date to company timezone
 * @param {Date} date - UTC date
 * @param {string} timezone - Target timezone (IANA format)
 * @returns {Date} Date converted to target timezone
 */
export const convertToTimeZone = (date, timezone = DEFAULT_TIMEZONE) => {
  if (!date) return null;

  try {
    return DateTime.fromJSDate(date, { zone: 'utc' })
      .setZone(timezone)
      .toJSDate();
  } catch (error) {
    console.error('[Timezone Utils] Error converting timezone:', error);
    return date;
  }
};

/**
 * Get start of day in specified timezone
 * @param {Date} date - Reference date
 * @param {string} timezone - Target timezone
 * @returns {Date} Start of day in target timezone
 */
export const getStartOfDayInTimeZone = (date, timezone = DEFAULT_TIMEZONE) => {
  if (!date) return null;

  try {
    return DateTime.fromJSDate(date, { zone: 'utc' })
      .setZone(timezone)
      .startOf('day')
      .toJSDate();
  } catch (error) {
    console.error('[Timezone Utils] Error getting start of day:', error);
    return new Date(date.setHours(0, 0, 0, 0));
  }
};

/**
 * Get end of day in specified timezone
 * @param {Date} date - Reference date
 * @param {string} timezone - Target timezone
 * @returns {Date} End of day in target timezone
 */
export const getEndOfDayInTimeZone = (date, timezone = DEFAULT_TIMEZONE) => {
  if (!date) return null;

  try {
    return DateTime.fromJSDate(date, { zone: 'utc' })
      .setZone(timezone)
      .endOf('day')
      .toJSDate();
  } catch (error) {
    console.error('[Timezone Utils] Error getting end of day:', error);
    return new Date(date.setHours(23, 59, 59, 999));
  }
};

/**
 * Get date range in specified timezone
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} timezone - Target timezone
 * @returns {Object} Object with start and end dates
 */
export const getDateRangeInTimeZone = (startDate, endDate, timezone = DEFAULT_TIMEZONE) => {
  return {
    start: getStartOfDayInTimeZone(startDate, timezone),
    end: getEndOfDayInTimeZone(endDate, timezone)
  };
};

/**
 * Get current date in company timezone
 * @param {string} timezone - Target timezone
 * @returns {Date} Current date in target timezone
 */
export const getCurrentDateInTimeZone = (timezone = DEFAULT_TIMEZONE) => {
  try {
    return DateTime.now().setZone(timezone).toJSDate();
  } catch (error) {
    console.error('[Timezone Utils] Error getting current date:', error);
    return new Date();
  }
};

/**
 * Format date in timezone
 * @param {Date} date - Date to format
 * @param {string} format - Luxon format string
 * @param {string} timezone - Target timezone
 * @returns {string} Formatted date string
 */
export const formatDateInTimeZone = (date, format = 'yyyy-MM-dd HH:mm:ss', timezone = DEFAULT_TIMEZONE) => {
  if (!date) return null;

  try {
    return DateTime.fromJSDate(date, { zone: 'utc' })
      .setZone(timezone)
      .toFormat(format);
  } catch (error) {
    console.error('[Timezone Utils] Error formatting date:', error);
    return date.toString();
  }
};

/**
 * Check if date is within business hours in timezone
 * @param {Date} date - Date to check
 * @param {Object} shift - Shift object with startTime and endTime
 * @param {string} timezone - Target timezone
 * @returns {Object} Object with isLate, lateMinutes, isEarlyDeparture, earlyDepartureMinutes
 */
export const checkBusinessHours = (date, shift, timezone = DEFAULT_TIMEZONE) => {
  if (!date || !shift) {
    return {
      isLate: false,
      lateMinutes: 0,
      isEarlyDeparture: false,
      earlyDepartureMinutes: 0
    };
  }

  try {
    const checkDate = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone);
    const shiftStart = DateTime.fromISO(shift.startTime, { zone: timezone });
    const shiftEnd = DateTime.fromISO(shift.endTime, { zone: timezone });

    const result = {
      isLate: false,
      lateMinutes: 0,
      isEarlyDeparture: false,
      earlyDepartureMinutes: 0
    };

    // Check if late (more than 15 minutes after shift start, with grace period)
    const lateThreshold = shiftStart.plus({ minutes: shift.gracePeriod || 15 });
    if (checkDate > lateThreshold) {
      result.isLate = true;
      result.lateMinutes = Math.round(checkDate.diff(shiftStart).as('minutes'));
    }

    // Check if early departure (more than 15 minutes before shift end)
    const earlyThreshold = shiftEnd.minus({ minutes: 15 });
    if (checkDate < earlyThreshold) {
      result.isEarlyDeparture = true;
      result.earlyDepartureMinutes = Math.round(shiftEnd.diff(checkDate).as('minutes'));
    }

    return result;
  } catch (error) {
    console.error('[Timezone Utils] Error checking business hours:', error);
    return {
      isLate: false,
      lateMinutes: 0,
      isEarlyDeparture: false,
      earlyDepartureMinutes: 0
    };
  }
};

/**
 * Calculate work duration considering timezone
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @param {number} breakMinutes - Break duration in minutes
 * @param {string} timezone - Target timezone
 * @returns {Object} Object with hoursWorked, regularHours, overtimeHours
 */
export const calculateWorkDuration = (startTime, endTime, breakMinutes = 0, timezone = DEFAULT_TIMEZONE) => {
  if (!startTime || !endTime) {
    return {
      hoursWorked: 0,
      regularHours: 0,
      overtimeHours: 0
    };
  }

  try {
    const start = DateTime.fromJSDate(startTime, { zone: 'utc' }).setZone(timezone);
    const end = DateTime.fromJSDate(endTime, { zone: 'utc' }).setZone(timezone);

    // Calculate total duration in hours
    const totalMinutes = end.diff(start).as('minutes') - breakMinutes;
    const hoursWorked = Math.max(0, totalMinutes / 60);

    // Calculate regular and overtime hours (8 hours is regular)
    const regularHoursLimit = 8;
    const regularHours = Math.min(hoursWorked, regularHoursLimit);
    const overtimeHours = Math.max(hoursWorked - regularHoursLimit, 0);

    return {
      hoursWorked: Math.round(hoursWorked * 100) / 100, // Round to 2 decimal places
      regularHours: Math.round(regularHours * 100) / 100,
      overtimeHours: Math.round(overtimeHours * 100) / 100
    };
  } catch (error) {
    console.error('[Timezone Utils] Error calculating work duration:', error);
    return {
      hoursWorked: 0,
      regularHours: 0,
      overtimeHours: 0
    };
  }
};

/**
 * Get list of supported timezones
 * @returns {Array} Array of timezone objects with id and label
 */
export const getSupportedTimezones = () => {
  const commonTimezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney'
  ];

  return commonTimezones.map(tz => ({
    id: tz,
    label: `${tz} (${DateTime.now().setZone(tz).toFormat('ZZZZ')})`
  }));
};

/**
 * Validate timezone string
 * @param {string} timezone - Timezone to validate
 * @returns {boolean} True if valid timezone
 */
export const isValidTimezone = (timezone) => {
  try {
    DateTime.now().setZone(timezone);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get user's local timezone from request headers
 * @param {Object} req - Express request object
 * @returns {string} Timezone string
 */
export const getUserTimezoneFromRequest = (req) => {
  // Try to get timezone from Accept-Timezone header
  if (req.headers['accept-timezone']) {
    const tz = req.headers['accept-timezone'];
    if (isValidTimezone(tz)) {
      return tz;
    }
  }

  // Try to infer from user's company settings
  if (req.user?.companyId && req.company?.timezone) {
    return req.company.timezone;
  }

  return DEFAULT_TIMEZONE;
};

/**
 * Convert attendance record to company timezone
 * @param {Object} attendance - Attendance record
 * @param {string} timezone - Target timezone
 * @returns {Object} Attendance record with converted dates
 */
export const convertAttendanceToTimeZone = (attendance, timezone = DEFAULT_TIMEZONE) => {
  if (!attendance) return null;

  const converted = { ...attendance };

  if (attendance.clockIn?.time) {
    converted.clockIn = {
      ...attendance.clockIn,
      time: convertToTimeZone(attendance.clockIn.time, timezone),
      timeLocal: formatDateInTimeZone(attendance.clockIn.time, 'HH:mm:ss', timezone)
    };
  }

  if (attendance.clockOut?.time) {
    converted.clockOut = {
      ...attendance.clockOut,
      time: convertToTimeZone(attendance.clockOut.time, timezone),
      timeLocal: formatDateInTimeZone(attendance.clockOut.time, 'HH:mm:ss', timezone)
    };
  }

  if (attendance.date) {
    converted.dateLocal = formatDateInTimeZone(attendance.date, 'yyyy-MM-dd', timezone);
  }

  return converted;
};

/**
 * Get month boundaries in timezone
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @param {string} timezone - Target timezone
 * @returns {Object} Object with startDate and endDate
 */
export const getMonthBoundariesInTimeZone = (year, month, timezone = DEFAULT_TIMEZONE) => {
  try {
    const start = DateTime.fromObject({ year, month, day: 1 }, { zone: timezone });
    const end = start.endOf('month');

    return {
      startDate: start.toJSDate(),
      endDate: end.toJSDate()
    };
  } catch (error) {
    console.error('[Timezone Utils] Error getting month boundaries:', error);
    const defaultStart = new Date(year, month, 1);
    const defaultEnd = new Date(year, month + 1, 0);
    return {
      startDate: defaultStart,
      endDate: defaultEnd
    };
  }
};

/**
 * Get week boundaries in timezone
 * @param {Date} date - Reference date
 * @param {string} timezone - Target timezone
 * @param {number} startOfWeek - Day week starts (0=Sunday, 1=Monday)
 * @returns {Object} Object with startDate and endDate
 */
export const getWeekBoundariesInTimeZone = (date, timezone = DEFAULT_TIMEZONE, startOfWeek = 1) => {
  try {
    let dt = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone);

    // Get to the start of the week
    const currentDay = dt.weekday;
    const daysToSubtract = (currentDay - startOfWeek + 7) % 7;
    const weekStart = dt.minus({ days: daysToSubtract }).startOf('day');
    const weekEnd = weekStart.plus({ days: 6 }).endOf('day');

    return {
      startDate: weekStart.toJSDate(),
      endDate: weekEnd.toJSDate()
    };
  } catch (error) {
    console.error('[Timezone Utils] Error getting week boundaries:', error);
    return {
      startDate: date,
      endDate: date
    };
  }
};

export default {
  getCompanyTimezone,
  convertToTimeZone,
  getStartOfDayInTimeZone,
  getEndOfDayInTimeZone,
  getDateRangeInTimeZone,
  getCurrentDateInTimeZone,
  formatDateInTimeZone,
  checkBusinessHours,
  calculateWorkDuration,
  getSupportedTimezones,
  isValidTimezone,
  getUserTimezoneFromRequest,
  convertAttendanceToTimeZone,
  getMonthBoundariesInTimeZone,
  getWeekBoundariesInTimeZone,
  DEFAULT_TIMEZONE
};
