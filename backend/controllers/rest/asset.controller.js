/**
 * Asset REST Controller
 * Handles all Asset CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Asset from '../../models/asset/asset.schema.js';
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
import { getSocketIO, broadcastAssetEvents } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all assets with pagination and filtering
 * @route   GET /api/assets
 * @access  Private (Admin, HR, Superadmin)
 */
export const getAssets = asyncHandler(async (req, res) => {
  const { page, limit, search, status, type, category, assignedTo, sortBy, order } = req.query;
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
    filter.type = type;
  }

  // Apply category filter
  if (category) {
    filter.category = category;
  }

  // Apply assignedTo filter
  if (assignedTo) {
    filter.assignedTo = assignedTo;
  }

  // Apply search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['name', 'serialNumber', 'barcode']);
    filter = { ...filter, ...searchFilter };
  }

  // Build sort option
  const sort = {};
  if (sortBy) {
    sort[sortBy] = order === 'asc' ? 1 : -1;
  } else {
    sort.purchaseDate = -1;
  }

  // Get paginated results
  const result = await filterAndPaginate(Asset, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort,
    populate: [
      {
        path: 'assignedTo',
        select: 'firstName lastName fullName employeeId'
      }
    ]
  });

  return sendSuccess(res, result.data, 'Assets retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single asset by ID
 * @route   GET /api/assets/:id
 * @access  Private (All authenticated users)
 */
export const getAssetById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid asset ID format');
  }

  // Find asset
  const asset = await Asset.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  }).populate('assignedTo', 'firstName lastName fullName employeeId')
    .populate('createdBy', 'firstName lastName fullName')
    .populate('updatedBy', 'firstName lastName fullName');

  if (!asset) {
    throw buildNotFoundError('Asset', id);
  }

  return sendSuccess(res, asset);
});

/**
 * @desc    Create new asset
 * @route   POST /api/assets
 * @access  Private (Admin, HR, Superadmin)
 */
export const createAsset = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const assetData = req.body;

  // Check for duplicate serial number
  if (assetData.serialNumber) {
    const existingAsset = await Asset.findOne({
      serialNumber: assetData.serialNumber,
      companyId: user.companyId,
      isDeleted: false
    });

    if (existingAsset) {
      throw buildConflictError('An asset with this serial number already exists');
    }
  }

  // Verify assignedTo employee exists if provided
  if (assetData.assignedTo) {
    const Employee = mongoose.model('Employee');
    const employee = await Employee.findOne({
      _id: assetData.assignedTo,
      isDeleted: false
    });

    if (!employee) {
      throw buildNotFoundError('Employee', assetData.assignedTo);
    }
  }

  // Prepare asset data
  assetData.companyId = user.companyId;
  assetData.createdBy = user.userId;

  // Create asset
  const asset = await Asset.create(assetData);

  // Populate references for response
  await asset.populate('assignedTo', 'firstName lastName fullName employeeId');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastAssetEvents.created(io, user.companyId, asset);
  }

  return sendCreated(res, asset, 'Asset created successfully');
});

/**
 * @desc    Update asset
 * @route   PUT /api/assets/:id
 * @access  Private (Admin, HR, Superadmin)
 */
export const updateAsset = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid asset ID format');
  }

  // Find asset
  const asset = await Asset.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!asset) {
    throw buildNotFoundError('Asset', id);
  }

  // Check for duplicate serial number if being updated
  if (updateData.serialNumber && updateData.serialNumber !== asset.serialNumber) {
    const existingAsset = await Asset.findOne({
      serialNumber: updateData.serialNumber,
      companyId: user.companyId,
      _id: { $ne: id },
      isDeleted: false
    });

    if (existingAsset) {
      throw buildConflictError('An asset with this serial number already exists');
    }
  }

  // Update asset
  Object.assign(asset, updateData);
  asset.updatedBy = user.userId;
  await asset.save();

  // Populate references for response
  await asset.populate('assignedTo', 'firstName lastName fullName employeeId');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastAssetEvents.updated(io, user.companyId, asset);
  }

  return sendSuccess(res, asset, 'Asset updated successfully');
});

/**
 * @desc    Delete asset (soft delete)
 * @route   DELETE /api/assets/:id
 * @access  Private (Admin, Superadmin)
 */
export const deleteAsset = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid asset ID format');
  }

  // Find asset
  const asset = await Asset.findOne({
    _id: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!asset) {
    throw buildNotFoundError('Asset', id);
  }

  // Soft delete
  asset.isDeleted = true;
  asset.deletedAt = new Date();
  asset.deletedBy = user.userId;
  asset.status = 'retired';
  await asset.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastAssetEvents.deleted(io, user.companyId, asset.assetId, user.userId);
  }

  return sendSuccess(res, {
    _id: asset._id,
    assetId: asset.assetId,
    isDeleted: true
  }, 'Asset deleted successfully');
});

/**
 * @desc    Get assets by category
 * @route   GET /api/assets/category/:category
 * @access  Private (All authenticated users)
 */
export const getAssetsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { page, limit } = req.query;
  const user = extractUser(req);

  const result = await filterAndPaginate(Asset, {
    companyId: user.companyId,
    category,
    isDeleted: false
  }, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort: { name: 1 },
    populate: [
      {
        path: 'assignedTo',
        select: 'firstName lastName fullName employeeId'
      }
    ]
  });

  return sendSuccess(res, result.data, `Assets in category '${category}' retrieved successfully`, 200, result.pagination);
});

/**
 * @desc    Get assets by status
 * @route   GET /api/assets/status/:status
 * @access  Private (All authenticated users)
 */
export const getAssetsByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params;
  const { page, limit } = req.query;
  const user = extractUser(req);

  // Validate status
  const validStatuses = ['available', 'assigned', 'in-maintenance', 'retired', 'lost', 'damaged', 'sold', 'disposed'];
  if (!validStatuses.includes(status)) {
    throw buildValidationError('status', `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const result = await filterAndPaginate(Asset, {
    companyId: user.companyId,
    status,
    isDeleted: false
  }, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort: { name: 1 },
    populate: [
      {
        path: 'assignedTo',
        select: 'firstName lastName fullName employeeId'
      }
    ]
  });

  return sendSuccess(res, result.data, `Assets with status '${status}' retrieved successfully`, 200, result.pagination);
});

/**
 * @desc    Get asset statistics
 * @route   GET /api/assets/stats
 * @access  Private (Admin, HR, Superadmin)
 */
export const getAssetStats = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const stats = await Asset.getStats(user.companyId);

  // Add calculated metrics
  stats.depreciationRate = stats.totalValue > 0
    ? ((stats.totalDepreciation / stats.totalValue) * 100).toFixed(2)
    : 0;

  stats.assignmentRate = stats.total > 0
    ? ((stats.assigned / stats.total) * 100).toFixed(2)
    : 0;

  return sendSuccess(res, stats, 'Asset statistics retrieved successfully');
});

export default {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetsByCategory,
  getAssetsByStatus,
  getAssetStats
};
