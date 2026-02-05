/**
 * Holiday Controller
 * Handles all holiday CRUD operations and working day calculations
 */

import Holiday from '../../../models/holiday/holiday.schema.js';
import { extractUser } from '../../../utils/apiResponse.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import { generateId } from '../../../utils/idGenerator.js';
import {
    calculateWorkingDays,
    checkWorkingDay,
    validateLeaveDates
} from '../../../utils/leaveDaysCalculator.js';
import { broadcastHolidayEvents, getSocketIO } from '../../../utils/socketBroadcaster.js';

/**
 * @desc    Get all holidays for a company with optional filtering
 * @route   GET /api/holidays
 * @access  Private
 */
export const getHolidays = asyncHandler(async (req, res) => {
  const { year, month, type, search } = req.query;
  const user = extractUser(req);

  const filter = {
    companyId: user.companyId,
    isActive: true,
    isDeleted: false
  };

  // Filter by year
  if (year) {
    const startDate = new Date(parseInt(year), 0, 1);
    const endDate = new Date(parseInt(year), 11, 31);
    filter.date = { $gte: startDate, $lte: endDate };
  }

  // Filter by month
  if (month) {
    const currentYear = year ? parseInt(year) : new Date().getFullYear();
    const startDate = new Date(currentYear, parseInt(month) - 1, 1);
    const endDate = new Date(currentYear, parseInt(month), 0);
    filter.date = { $gte: startDate, $lte: endDate };
  }

  // Filter by type
  if (type) {
    filter.type = type;
  }

  // Search by name
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const holidays = await Holiday.find(filter).sort({ date: 1 });

  res.status(200).json({
    success: true,
    data: holidays,
    count: holidays.length
  });
});

/**
 * @desc    Get holiday by ID
 * @route   GET /api/holidays/:id
 * @access  Private
 */
export const getHolidayById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  const holiday = await Holiday.findOne({
    holidayId: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!holiday) {
    return res.status(404).json({
      success: false,
      error: { message: 'Holiday not found' }
    });
  }

  res.status(200).json({
    success: true,
    data: holiday
  });
});

/**
 * @desc    Get upcoming holidays
 * @route   GET /api/holidays/upcoming
 * @access  Private
 */
export const getUpcomingHolidaysHandler = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  const user = extractUser(req);

  const holidays = await Holiday.getUpcomingHolidays(user.companyId, parseInt(days));

  res.status(200).json({
    success: true,
    data: holidays,
    count: holidays.length
  });
});

/**
 * @desc    Create new holiday
 * @route   POST /api/holidays
 * @access  Private (Admin, HR)
 */
export const createHoliday = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const holidayData = req.body;

  // Phase 2.5: Check if holiday already exists for this date (including soft-deleted)
  const existingHoliday = await Holiday.findOne({
    companyId: user.companyId,
    date: new Date(holidayData.date)
  });

  if (existingHoliday) {
    if (existingHoliday.isDeleted) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'A holiday previously existed for this date. Please restore it instead of creating a new one.',
          existingHolidayId: existingHoliday.holidayId
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        error: { message: 'Holiday already exists for this date' }
      });
    }
  }

  const holiday = new Holiday({
    holidayId: generateId('HLD', user.companyId),
    companyId: user.companyId,
    name: holidayData.name,
    date: new Date(holidayData.date),
    type: holidayData.type || 'public',
    isRecurring: holidayData.isRecurring || false,
    recurringDay: holidayData.recurringDay,
    recurringMonth: holidayData.recurringMonth,
    applicableStates: holidayData.applicableStates || [],
    description: holidayData.description,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const savedHoliday = await holiday.save();
  console.log('[Holiday Controller] Holiday created:', savedHoliday.holidayId);

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (broadcastHolidayEvents && broadcastHolidayEvents.created) {
    broadcastHolidayEvents.created(io, user.companyId, {
      holidayId: savedHoliday.holidayId,
      name: savedHoliday.name,
      date: savedHoliday.date
    });
  }

  res.status(201).json({
    success: true,
    data: savedHoliday,
    message: 'Holiday created successfully'
  });
});

/**
 * @desc    Update holiday
 * @route   PUT /api/holidays/:id
 * @access  Private (Admin, HR)
 */
export const updateHoliday = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  const holiday = await Holiday.findOne({
    holidayId: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!holiday) {
    return res.status(404).json({
      success: false,
      error: { message: 'Holiday not found' }
    });
  }

  // Check if another holiday exists for the new date
  if (updateData.date && updateData.date !== holiday.date.toISOString()) {
    const existingHoliday = await Holiday.findOne({
      companyId: user.companyId,
      date: new Date(updateData.date),
      holidayId: { $ne: id },
      isDeleted: false
    });

    if (existingHoliday) {
      return res.status(400).json({
        success: false,
        error: { message: 'Holiday already exists for this date' }
      });
    }
  }

  // Update fields
  if (updateData.name) holiday.name = updateData.name;
  if (updateData.date) holiday.date = new Date(updateData.date);
  if (updateData.type !== undefined) holiday.type = updateData.type;
  if (updateData.isRecurring !== undefined) holiday.isRecurring = updateData.isRecurring;
  if (updateData.recurringDay !== undefined) holiday.recurringDay = updateData.recurringDay;
  if (updateData.recurringMonth !== undefined) holiday.recurringMonth = updateData.recurringMonth;
  if (updateData.applicableStates !== undefined) holiday.applicableStates = updateData.applicableStates;
  if (updateData.description !== undefined) holiday.description = updateData.description;
  if (updateData.isActive !== undefined) holiday.isActive = updateData.isActive;

  holiday.updatedAt = new Date();
  const updatedHoliday = await holiday.save();

  console.log('[Holiday Controller] Holiday updated:', updatedHoliday.holidayId);

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (broadcastHolidayEvents && broadcastHolidayEvents.updated) {
    broadcastHolidayEvents.updated(io, user.companyId, {
      holidayId: updatedHoliday.holidayId,
      name: updatedHoliday.name,
      date: updatedHoliday.date
    });
  }

  res.status(200).json({
    success: true,
    data: updatedHoliday,
    message: 'Holiday updated successfully'
  });
});

/**
 * @desc    Delete holiday (soft delete)
 * @route   DELETE /api/holidays/:id
 * @access  Private (Admin, HR)
 */
export const deleteHoliday = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  const holiday = await Holiday.findOne({
    holidayId: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!holiday) {
    return res.status(404).json({
      success: false,
      error: { message: 'Holiday not found' }
    });
  }

  holiday.isDeleted = true;
  holiday.isActive = false;
  holiday.updatedAt = new Date();
  const deletedHoliday = await holiday.save();

  console.log('[Holiday Controller] Holiday soft deleted:', deletedHoliday.holidayId);

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (broadcastHolidayEvents && broadcastHolidayEvents.deleted) {
    broadcastHolidayEvents.deleted(io, user.companyId, {
      holidayId: deletedHoliday.holidayId,
      name: deletedHoliday.name
    });
  }

  res.status(200).json({
    success: true,
    data: { holidayId: id, isDeleted: true },
    message: 'Holiday deleted successfully'
  });
});

/**
 * @desc    Calculate working days for a date range
 * @route   POST /api/holidays/calculate
 * @access  Private
 */
export const calculateDaysHandler = asyncHandler(async (req, res) => {
  const { startDate, endDate, state } = req.body;
  const user = extractUser(req);

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: { message: 'Start date and end date are required' }
    });
  }

  try {
    const result = await calculateWorkingDays(
      user.companyId,
      new Date(startDate),
      new Date(endDate),
      state
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
});

/**
 * @desc    Check if a specific date is a working day
 * @route   GET /api/holidays/check
 * @access  Private
 */
export const checkWorkingDayHandler = asyncHandler(async (req, res) => {
  const { date, state } = req.query;
  const user = extractUser(req);

  if (!date) {
    return res.status(400).json({
      success: false,
      error: { message: 'Date is required' }
    });
  }

  try {
    const result = await checkWorkingDay(user.companyId, new Date(date));

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
});

/**
 * @desc    Validate leave request dates
 * @route   POST /api/holidays/validate
 * @access  Private
 */
export const validateLeaveDatesHandler = asyncHandler(async (req, res) => {
  const { startDate, endDate, employeeId } = req.body;
  const user = extractUser(req);

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      error: { message: 'Start date and end date are required' }
    });
  }

  try {
    const result = await validateLeaveDates(
      user.companyId,
      new Date(startDate),
      new Date(endDate),
      employeeId
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Dates validated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
});

/**
 * @desc    Get holiday statistics
 * @route   GET /api/holidays/stats
 * @access  Private (Admin, HR)
 */
export const getHolidayStats = asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;
  const user = extractUser(req);

  const startDate = new Date(parseInt(year), 0, 1);
  const endDate = new Date(parseInt(year), 11, 31);

  const holidays = await Holiday.find({
    companyId: user.companyId,
    date: { $gte: startDate, $lte: endDate },
    isActive: true,
    isDeleted: false
  });

  const stats = {
    total: holidays.length,
    public: holidays.filter(h => h.type === 'public').length,
    company: holidays.filter(h => h.type === 'company').length,
    optional: holidays.filter(h => h.type === 'optional').length,
    recurring: holidays.filter(h => h.isRecurring).length,
    byMonth: {}
  };

  // Group by month
  holidays.forEach(holiday => {
    const month = holiday.date.getMonth();
    const monthName = new Date(parseInt(year), month, 1).toLocaleString('default', { month: 'long' });
    stats.byMonth[monthName] = (stats.byMonth[monthName] || 0) + 1;
  });

  res.status(200).json({
    success: true,
    data: stats
  });
});

export default {
  getHolidays,
  getHolidayById,
  getUpcomingHolidaysHandler,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  calculateDaysHandler,
  checkWorkingDayHandler,
  validateLeaveDatesHandler,
  getHolidayStats
};
