/**
 * Promotion REST Controller
 * Handles all Promotion CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Promotion from '../../models/promotion/promotion.schema.js';
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
 * @desc    Get all promotions
 * @route   GET /api/promotions
 * @access  Private
 */
export const getPromotions = asyncHandler(async (req, res) => {
  const { page, limit, status, type, departmentId, employeeId, sortBy, order } = req.query;
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

  // Apply type filter
  if (type) {
    filter.promotionType = type;
  }

  // Apply department filter
  if (departmentId) {
    filter['promotionTo.departmentId'] = departmentId;
  }

  // Apply employee filter
  if (employeeId) {
    filter.employeeId = employeeId;
  }

  // Build sort option
  const sort = {};
  if (sortBy) {
    sort[sortBy] = order === 'asc' ? 1 : -1;
  } else {
    sort.promotionDate = -1;
  }

  const result = await filterAndPaginate(Promotion, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort
  });

  return sendSuccess(res, result.data, 'Promotions retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single promotion by ID
 * @route   GET /api/promotions/:id
 * @access  Private
 */
export const getPromotionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid promotion ID format');
  }

  const promotion = await Promotion.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!promotion) {
    throw buildNotFoundError('Promotion', id);
  }

  return sendSuccess(res, promotion);
});

/**
 * @desc    Create new promotion
 * @route   POST /api/promotions
 * @access  Private (Admin, HR)
 */
export const createPromotion = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const promotionData = req.body;

  // Validate required fields
  if (!promotionData.employeeId || !promotionData.promotionTo?.departmentId || !promotionData.promotionTo?.designationId) {
    throw buildValidationError('fields', 'Employee ID and target department/designation are required');
  }

  if (!promotionData.promotionDate) {
    throw buildValidationError('promotionDate', 'Promotion date is required');
  }

  // Prepare promotion data
  promotionData.companyId = user.companyId;
  promotionData.createdBy = {
    userId: user.userId,
    userName: user.userName || user.fullName || user.name || ''
  };

  // Check for overlapping pending promotions
  const overlapping = await Promotion.findOne({
    companyId: user.companyId,
    employeeId: promotionData.employeeId,
    status: 'pending',
    isDeleted: false
  });

  if (overlapping) {
    throw buildConflictError('Employee already has a pending promotion');
  }

  const promotion = await Promotion.create(promotionData);

  // Check if promotion should be applied immediately
  if (promotion.isDue) {
    await promotion.apply();
  }

  return sendCreated(res, promotion, 'Promotion created successfully');
});

/**
 * @desc    Update promotion
 * @route   PUT /api/promotions/:id
 * @access  Private (Admin, HR)
 */
export const updatePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid promotion ID format');
  }

  const promotion = await Promotion.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!promotion) {
    throw buildNotFoundError('Promotion', id);
  }

  // Cannot update applied promotions
  if (promotion.status === 'applied') {
    throw buildConflictError('Cannot update an applied promotion');
  }

  Object.assign(promotion, updateData);
  promotion.updatedBy = {
    userId: user.userId,
    userName: user.userName || user.fullName || user.name || ''
  };
  await promotion.save();

  return sendSuccess(res, promotion, 'Promotion updated successfully');
});

/**
 * @desc    Delete promotion (soft delete)
 * @route   DELETE /api/promotions/:id
 * @access  Private (Admin)
 */
export const deletePromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid promotion ID format');
  }

  const promotion = await Promotion.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!promotion) {
    throw buildNotFoundError('Promotion', id);
  }

  promotion.isDeleted = true;
  promotion.deletedAt = new Date();
  promotion.deletedBy = {
    userId: user.userId,
    userName: user.userName || user.fullName || user.name || ''
  };
  await promotion.save();

  return sendSuccess(res, {
    _id: promotion._id,
    isDeleted: true
  }, 'Promotion deleted successfully');
});

/**
 * @desc    Apply promotion
 * @route   PUT /api/promotions/:id/apply
 * @access  Private (Admin, HR)
 */
export const applyPromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid promotion ID format');
  }

  const promotion = await Promotion.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!promotion) {
    throw buildNotFoundError('Promotion', id);
  }

  await promotion.apply();

  return sendSuccess(res, promotion, 'Promotion applied successfully');
});

/**
 * @desc    Cancel promotion
 * @route   PUT /api/promotions/:id/cancel
 * @access  Private (Admin, HR)
 */
export const cancelPromotion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const user = extractUser(req);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid promotion ID format');
  }

  const promotion = await Promotion.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!promotion) {
    throw buildNotFoundError('Promotion', id);
  }

  await promotion.cancel(reason);

  return sendSuccess(res, promotion, 'Promotion cancelled successfully');
});

/**
 * @desc    Get departments for promotion selection
 * @route   GET /api/promotions/departments
 * @access  Private
 */
export const getDepartments = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  // Using existing departments from employee data
  const Employee = mongoose.model('Employee');
  const departments = await Employee.distinct('department', {
    companyId: user.companyId,
    isDeleted: false
  });

  return sendSuccess(res, departments, 'Departments retrieved successfully');
});

/**
 * @desc    Get designations for promotion selection
 * @route   GET /api/promotions/designations
 * @access  Private
 */
export const getDesignationsForPromotion = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const { departmentId } = req.query;

  const filter = {
    companyId: user.companyId,
    isDeleted: false
  };

  if (departmentId) {
    filter.departmentId = departmentId;
  }

  const Employee = mongoose.model('Employee');
  const designations = await Employee.distinct('designation', filter);

  return sendSuccess(res, designations, 'Designations retrieved successfully');
});

export default {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
  applyPromotion,
  cancelPromotion,
  getDepartments,
  getDesignationsForPromotion
};
