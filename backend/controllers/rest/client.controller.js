/**
 * Client REST Controller
 * Handles all Client CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Client from '../../models/client/client.schema.js';
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
import { generateClientId } from '../../utils/idGenerator.js';
import { getSocketIO, broadcastClientEvents } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all clients with pagination and filtering
 * @route   GET /api/clients
 * @access  Private (Admin, HR, Superadmin)
 */
export const getClients = asyncHandler(async (req, res) => {
  const { page, limit, search, status, tier, source, clientType, accountManager, sortBy, order } = req.query;
  const user = extractUser(req);

  // Build filter
  let filter = {
    isDeleted: false
  };

  // Apply status filter
  if (status) {
    filter.status = status;
  }

  // Apply tier filter
  if (tier) {
    filter.tier = tier;
  }

  // Apply source filter
  if (source) {
    filter.source = source;
  }

  // Apply clientType filter
  if (clientType) {
    filter.clientType = clientType;
  }

  // Apply accountManager filter
  if (accountManager) {
    filter.accountManager = accountManager;
  }

  // Apply search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['name', 'displayName', 'industry', 'tags']);
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
  const result = await filterAndPaginate(Client, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort,
    populate: [
      {
        path: 'accountManager',
        select: 'firstName lastName fullName employeeId'
      },
      {
        path: 'teamMembers',
        select: 'firstName lastName fullName employeeId'
      }
    ]
  });

  return sendSuccess(res, result.data, 'Clients retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single client by ID
 * @route   GET /api/clients/:id
 * @access  Private (All authenticated users)
 */
export const getClientById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid client ID format');
  }

  // Find client
  const client = await Client.findOne({
    _id: id,
    isDeleted: false
  }).populate('accountManager', 'firstName lastName fullName employeeId')
    .populate('teamMembers', 'firstName lastName fullName employeeId')
    .populate('createdBy', 'firstName lastName fullName employeeId')
    .populate('updatedBy', 'firstName lastName fullName employeeId');

  if (!client) {
    throw buildNotFoundError('Client', id);
  }

  return sendSuccess(res, client);
});

/**
 * @desc    Create new client
 * @route   POST /api/clients
 * @access  Private (Admin, HR, Superadmin)
 */
export const createClient = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const clientData = req.body;

  // Check for duplicate name
  const existingClient = await Client.findOne({
    name: clientData.name,
    isDeleted: false
  });

  if (existingClient) {
    throw buildConflictError('A client with this name already exists');
  }

  // Verify account manager exists if provided
  if (clientData.accountManager) {
    const Employee = mongoose.model('Employee');
    const employee = await Employee.findOne({
      _id: clientData.accountManager,
      isDeleted: false
    });

    if (!employee) {
      throw buildNotFoundError('Employee (Account Manager)', clientData.accountManager);
    }
  }

  // Verify team members exist if provided
  if (clientData.teamMembers && clientData.teamMembers.length > 0) {
    const Employee = mongoose.model('Employee');
    const employees = await Employee.find({
      _id: { $in: clientData.teamMembers },
      isDeleted: false
    });

    if (employees.length !== clientData.teamMembers.length) {
      throw buildNotFoundError('Some team members not found');
    }
  }

  // Generate client ID
  if (!clientData.clientId) {
    clientData.clientId = await generateClientId();
  }

  // Add audit fields
  clientData.createdBy = user.userId;

  // Create client
  const client = await Client.create(clientData);

  // Populate references for response
  await client.populate('accountManager', 'firstName lastName fullName employeeId');
  await client.populate('teamMembers', 'firstName lastName fullName employeeId');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastClientEvents.created(io, user.companyId, client);
  }

  return sendCreated(res, client, 'Client created successfully');
});

/**
 * @desc    Update client
 * @route   PUT /api/clients/:id
 * @access  Private (Admin, HR, Superadmin)
 */
export const updateClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid client ID format');
  }

  // Find client
  const client = await Client.findOne({
    _id: id,
    isDeleted: false
  });

  if (!client) {
    throw buildNotFoundError('Client', id);
  }

  // Check for duplicate name if name is being updated
  if (updateData.name && updateData.name !== client.name) {
    const existingClient = await Client.findOne({
      name: updateData.name,
      _id: { $ne: id },
      isDeleted: false
    });

    if (existingClient) {
      throw buildConflictError('A client with this name already exists');
    }
  }

  // Update client
  Object.assign(client, updateData);
  client.updatedBy = user.userId;
  await client.save();

  // Populate references for response
  await client.populate('accountManager', 'firstName lastName fullName employeeId');
  await client.populate('teamMembers', 'firstName lastName fullName employeeId');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastClientEvents.updated(io, user.companyId, client);
  }

  return sendSuccess(res, client, 'Client updated successfully');
});

/**
 * @desc    Delete client (soft delete)
 * @route   DELETE /api/clients/:id
 * @access  Private (Admin, Superadmin)
 */
export const deleteClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid client ID format');
  }

  // Find client
  const client = await Client.findOne({
    _id: id,
    isDeleted: false
  });

  if (!client) {
    throw buildNotFoundError('Client', id);
  }

  // Soft delete
  client.isActive = false;
  client.isDeleted = true;
  client.deletedAt = new Date();
  client.deletedBy = user.userId;
  client.status = 'Churned';
  await client.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastClientEvents.deleted(io, user.companyId, client.clientId, user.userId);
  }

  return sendSuccess(res, {
    _id: client._id,
    clientId: client.clientId,
    isDeleted: true
  }, 'Client deleted successfully');
});

/**
 * @desc    Get clients by account manager
 * @route   GET /api/clients/account-manager/:managerId
 * @access  Private (All authenticated users)
 */
export const getClientsByAccountManager = asyncHandler(async (req, res) => {
  const { managerId } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(managerId)) {
    throw buildValidationError('managerId', 'Invalid account manager ID format');
  }

  const clients = await Client.find({
    accountManager: managerId,
    isDeleted: false
  }).populate('accountManager', 'firstName lastName fullName employeeId')
    .populate('teamMembers', 'firstName lastName fullName employeeId')
    .sort({ name: 1 });

  return sendSuccess(res, clients, 'Clients by account manager retrieved successfully');
});

/**
 * @desc    Get clients by status
 * @route   GET /api/clients/status/:status
 * @access  Private (All authenticated users)
 */
export const getClientsByStatus = asyncHandler(async (req, res) => {
  const { status } = req.params;
  const user = extractUser(req);

  // Validate status
  const validStatuses = ['Active', 'Inactive', 'Prospect', 'Churned'];
  if (!validStatuses.includes(status)) {
    throw buildValidationError('status', `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const clients = await Client.find({
    status,
    isDeleted: false
  }).populate('accountManager', 'firstName lastName fullName employeeId')
    .populate('teamMembers', 'firstName lastName fullName employeeId')
    .sort({ name: 1 });

  return sendSuccess(res, clients, 'Clients by status retrieved successfully');
});

/**
 * @desc    Get clients by tier
 * @route   GET /api/clients/tier/:tier
 * @access  Private (All authenticated users)
 */
export const getClientsByTier = asyncHandler(async (req, res) => {
  const { tier } = req.params;
  const user = extractUser(req);

  // Validate tier
  const validTiers = ['Enterprise', 'Mid-Market', 'Small-Business', 'Startup'];
  if (!validTiers.includes(tier)) {
    throw buildValidationError('tier', `Invalid tier. Must be one of: ${validTiers.join(', ')}`);
  }

  const clients = await Client.find({
    tier,
    isDeleted: false
  }).populate('accountManager', 'firstName lastName fullName employeeId')
    .populate('teamMembers', 'firstName lastName fullName employeeId')
    .sort({ totalValue: -1 });

  return sendSuccess(res, clients, 'Clients by tier retrieved successfully');
});

/**
 * @desc    Search clients
 * @route   GET /api/clients/search
 * @access  Private (All authenticated users)
 */
export const searchClients = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.query;
  const user = extractUser(req);

  if (!q || !q.trim()) {
    throw buildValidationError('q', 'Search query is required');
  }

  const searchFilter = buildSearchFilter(q, ['name', 'displayName', 'industry', 'tags']);

  const result = await filterAndPaginate(Client, {
    isDeleted: false,
    ...searchFilter
  }, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    populate: [
      {
        path: 'accountManager',
        select: 'firstName lastName fullName employeeId'
      },
      {
        path: 'teamMembers',
        select: 'firstName lastName fullName employeeId'
      }
    ]
  });

  return sendSuccess(res, result.data, 'Client search results', 200, result.pagination);
});

/**
 * @desc    Get client statistics
 * @route   GET /api/clients/stats
 * @access  Private (Admin, HR, Superadmin)
 */
export const getClientStats = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const stats = await Client.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
        },
        inactive: {
          $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] }
        },
        prospect: {
          $sum: { $cond: [{ $eq: ['$status', 'Prospect'] }, 1, 0] }
        },
        churned: {
          $sum: { $cond: [{ $eq: ['$status', 'Churned'] }, 1, 0] }
        },
        enterprise: {
          $sum: { $cond: [{ $eq: ['$tier', 'Enterprise'] }, 1, 0] }
        },
        midMarket: {
          $sum: { $cond: [{ $eq: ['$tier', 'Mid-Market'] }, 1, 0] }
        },
        smallBusiness: {
          $sum: { $cond: [{ $eq: ['$tier', 'Small-Business'] }, 1, 0] }
        },
        startup: {
          $sum: { $cond: [{ $eq: ['$tier', 'Startup'] }, 1, 0] }
        },
        totalDeals: { $sum: '$totalDeals' },
        wonDeals: { $sum: '$wonDeals' },
        totalValue: { $sum: '$totalValue' },
        wonValue: { $sum: '$wonValue' }
      }
    }
  ]);

  const result = stats[0] || {
    total: 0,
    active: 0,
    inactive: 0,
    prospect: 0,
    churned: 0,
    enterprise: 0,
    midMarket: 0,
    smallBusiness: 0,
    startup: 0,
    totalDeals: 0,
    wonDeals: 0,
    totalValue: 0,
    wonValue: 0
  };

  // Add calculated metrics
  result.winRate = result.totalDeals > 0 ? ((result.wonDeals / result.totalDeals) * 100).toFixed(2) : 0;
  result.averageDealValue = result.totalDeals > 0 ? (result.totalValue / result.totalDeals).toFixed(2) : 0;

  return sendSuccess(res, result, 'Client statistics retrieved successfully');
});

/**
 * @desc    Update deal statistics for a client
 * @route   PATCH /api/clients/:id/deal-stats
 * @access  Private (Admin, HR, Superadmin)
 */
export const updateClientDealStats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { won, value } = req.body;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid client ID format');
  }

  // Find client
  const client = await Client.findOne({
    _id: id,
    isDeleted: false
  });

  if (!client) {
    throw buildNotFoundError('Client', id);
  }

  // Update deal statistics
  if (won) {
    client.wonDeals += 1;
    client.wonValue += value || 0;
  }

  client.totalDeals += 1;
  client.totalValue += value || 0;
  await client.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastClientEvents.dealStatsUpdated(io, user.companyId, client);
  }

  return sendSuccess(res, {
    _id: client._id,
    clientId: client.clientId,
    totalDeals: client.totalDeals,
    wonDeals: client.wonDeals,
    totalValue: client.totalValue,
    wonValue: client.wonValue
  }, 'Client deal statistics updated successfully');
});

export default {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientsByAccountManager,
  getClientsByStatus,
  getClientsByTier,
  searchClients,
  getClientStats,
  updateClientDealStats
};
