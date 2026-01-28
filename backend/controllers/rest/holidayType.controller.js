/**
 * Holiday Type REST Controller
 * Handles all Holiday Type CRUD operations via REST API
 */

import mongoose from 'mongoose';
import HolidayType from '../../models/holidayType/holidayType.schema.js';
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
  extractUser
} from '../../utils/apiResponse.js';
import { getSocketIO } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all holiday types
 * @route   GET /api/holiday-types
 * @access  Private
 */
export const getHolidayTypes = asyncHandler(async (req, res) => {
  const { active } = req.query;
  const user = extractUser(req);

  // Build filter
  let filter = {
    companyId: user.companyId,
    isDeleted: false
  };

  // Apply active filter
  if (active !== undefined) {
    filter.isActive = active === 'true';
  }

  const holidayTypes = await HolidayType.find(filter).sort({ displayOrder: 1, name: 1 });

  return sendSuccess(res, holidayTypes, 'Holiday types retrieved successfully');
});

/**
 * @desc    Get single holiday type by ID
 * @route   GET /api/holiday-types/:id
 * @access  Private
 */
export const getHolidayTypeById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid holiday type ID format');
  }

  const holidayType = await HolidayType.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!holidayType) {
    throw buildNotFoundError('Holiday Type', id);
  }

  return sendSuccess(res, holidayType);
});

/**
 * @desc    Create new holiday type
 * @route   POST /api/holiday-types
 * @access  Private (Admin, HR)
 */
export const createHolidayType = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const holidayTypeData = req.body;

  // Validate required fields
  if (!holidayTypeData.name || !holidayTypeData.code) {
    throw buildValidationError('fields', 'Name and code are required');
  }

  // Check if code already exists
  const existingByCode = await HolidayType.findOne({
    companyId: user.companyId,
    code: holidayTypeData.code.toUpperCase(),
    isDeleted: false
  });

  if (existingByCode) {
    throw buildConflictError('Holiday type with this code already exists');
  }

  // Prepare holiday type data
  holidayTypeData.companyId = user.companyId;
  holidayTypeData.code = holidayTypeData.code.toUpperCase();
  holidayTypeData.createdBy = user.userId;

  const holidayType = await HolidayType.create(holidayTypeData);

  return sendCreated(res, holidayType, 'Holiday type created successfully');
});

/**
 * @desc    Update holiday type
 * @route   PUT /api/holiday-types/:id
 * @access  Private (Admin, HR)
 */
export const updateHolidayType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid holiday type ID format');
  }

  const holidayType = await HolidayType.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!holidayType) {
    throw buildNotFoundError('Holiday Type', id);
  }

  // Update code to uppercase if provided
  if (updateData.code) {
    updateData.code = updateData.code.toUpperCase();
  }

  Object.assign(holidayType, updateData);
  holidayType.updatedBy = user.userId;
  await holidayType.save();

  return sendSuccess(res, holidayType, 'Holiday type updated successfully');
});

/**
 * @desc    Delete holiday type (soft delete)
 * @route   DELETE /api/holiday-types/:id
 * @access  Private (Admin)
 */
export const deleteHolidayType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid holiday type ID format');
  }

  const holidayType = await HolidayType.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!holidayType) {
    throw buildNotFoundError('Holiday Type', id);
  }

  // Soft delete
  holidayType.isDeleted = true;
  holidayType.deletedAt = new Date();
  holidayType.deletedBy = user.userId;
  await holidayType.save();

  return sendSuccess(res, {
    _id: holidayType._id,
    isDeleted: true
  }, 'Holiday type deleted successfully');
});

/**
 * @desc    Initialize default holiday types
 * @route   POST /api/holiday-types/initialize
 * @access  Private (Admin, HR)
 */
export const initializeDefaults = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const holidayTypes = await HolidayType.initializeDefaults(user.companyId, user.userId);

  return sendSuccess(res, holidayTypes, 'Default holiday types initialized successfully');
});

export default {
  getHolidayTypes,
  getHolidayTypeById,
  createHolidayType,
  updateHolidayType,
  deleteHolidayType,
  initializeDefaults
};
