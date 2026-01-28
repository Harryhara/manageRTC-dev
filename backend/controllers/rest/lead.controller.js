/**
 * Lead REST Controller
 * Handles all Lead CRUD operations via REST API
 */

import mongoose from 'mongoose';
import Lead from '../../models/lead/lead.schema.js';
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
import { generateLeadId } from '../../utils/idGenerator.js';
import { getSocketIO, broadcastLeadEvents } from '../../utils/socketBroadcaster.js';

/**
 * @desc    Get all leads with pagination and filtering
 * @route   GET /api/leads
 * @access  Private (Admin, HR, Superadmin, Leads)
 */
export const getLeads = asyncHandler(async (req, res) => {
  const { page, limit, search, stage, source, status, owner, sortBy, order } = req.query;
  const user = extractUser(req);

  // Build filter
  let filter = {
    isDeleted: false
  };

  // Apply stage filter
  if (stage) {
    filter.stage = stage;
  }

  // Apply source filter
  if (source) {
    filter.source = source;
  }

  // Apply status filter
  if (status) {
    filter.status = status;
  }

  // Apply owner filter
  if (owner) {
    filter.owner = owner;
  }

  // Apply search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['name', 'company', 'email', 'tags']);
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
  const result = await filterAndPaginate(Lead, filter, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sort,
    populate: [
      {
        path: 'owner',
        select: 'firstName lastName fullName employeeId'
      },
      {
        path: 'clientId',
        select: 'name clientId clientType tier'
      },
      {
        path: 'pipelineId',
        select: 'name stage'
      }
    ]
  });

  return sendSuccess(res, result.data, 'Leads retrieved successfully', 200, result.pagination);
});

/**
 * @desc    Get single lead by ID
 * @route   GET /api/leads/:id
 * @access  Private (All authenticated users)
 */
export const getLeadById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid lead ID format');
  }

  // Find lead
  const lead = await Lead.findOne({
    _id: id,
    isDeleted: false
  }).populate('owner', 'firstName lastName fullName employeeId')
    .populate('clientId', 'name clientId clientType tier')
    .populate('pipelineId', 'name stage')
    .populate('dealId', 'dealId value stage')
    .populate('convertedToClient', 'name clientId clientType');

  if (!lead) {
    throw buildNotFoundError('Lead', id);
  }

  return sendSuccess(res, lead);
});

/**
 * @desc    Create new lead
 * @route   POST /api/leads
 * @access  Private (Admin, HR, Superadmin, Leads)
 */
export const createLead = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const leadData = req.body;

  // Check for duplicate email
  if (leadData.email) {
    const existingLead = await Lead.findOne({
      email: leadData.email.toLowerCase(),
      isDeleted: false
    });

    if (existingLead) {
      throw buildConflictError('A lead with this email already exists');
    }
  }

  // Verify owner exists if provided
  if (leadData.owner) {
    const Employee = mongoose.model('Employee');
    const employee = await Employee.findOne({
      _id: leadData.owner,
      isDeleted: false
    });

    if (!employee) {
      throw buildNotFoundError('Employee (Owner)', leadData.owner);
    }
  }

  // Verify client exists if provided
  if (leadData.clientId) {
    const Client = mongoose.model('Client');
    const client = await Client.findOne({
      _id: leadData.clientId,
      isDeleted: false
    });

    if (!client) {
      throw buildNotFoundError('Client', leadData.clientId);
    }
  }

  // Generate lead ID
  if (!leadData.leadId) {
    leadData.leadId = await generateLeadId();
  }

  // Add audit fields
  leadData.createdBy = user.userId;

  // Create lead
  const lead = await Lead.create(leadData);

  // Populate references for response
  await lead.populate('owner', 'firstName lastName fullName employeeId');
  await lead.populate('clientId', 'name clientId clientType tier');
  await lead.populate('pipelineId', 'name stage');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastLeadEvents.created(io, user.companyId, lead);
  }

  return sendCreated(res, lead, 'Lead created successfully');
});

/**
 * @desc    Update lead
 * @route   PUT /api/leads/:id
 * @access  Private (Admin, HR, Superadmin, Leads, Owner)
 */
export const updateLead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);
  const updateData = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid lead ID format');
  }

  // Find lead
  const lead = await Lead.findOne({
    _id: id,
    isDeleted: false
  });

  if (!lead) {
    throw buildNotFoundError('Lead', id);
  }

  // Check for duplicate email if email is being updated
  if (updateData.email && updateData.email !== lead.email) {
    const existingLead = await Lead.findOne({
      email: updateData.email.toLowerCase(),
      _id: { $ne: id },
      isDeleted: false
    });

    if (existingLead) {
      throw buildConflictError('A lead with this email already exists');
    }
  }

  // Update lead
  Object.assign(lead, updateData);
  await lead.save();

  // Populate references for response
  await lead.populate('owner', 'firstName lastName fullName employeeId');
  await lead.populate('clientId', 'name clientId clientType tier');
  await lead.populate('pipelineId', 'name stage');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastLeadEvents.updated(io, user.companyId, lead);
  }

  return sendSuccess(res, lead, 'Lead updated successfully');
});

/**
 * @desc    Delete lead (soft delete)
 * @route   DELETE /api/leads/:id
 * @access  Private (Admin, Superadmin)
 */
export const deleteLead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid lead ID format');
  }

  // Find lead
  const lead = await Lead.findOne({
    _id: id,
    isDeleted: false
  });

  if (!lead) {
    throw buildNotFoundError('Lead', id);
  }

  // Soft delete
  lead.isDeleted = true;
  lead.deletedAt = new Date();
  lead.deletedBy = user.userId;
  await lead.save();

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastLeadEvents.deleted(io, user.companyId, lead.leadId, user.userId);
  }

  return sendSuccess(res, {
    _id: lead._id,
    leadId: lead.leadId,
    isDeleted: true
  }, 'Lead deleted successfully');
});

/**
 * @desc    Get my leads (leads assigned to current user)
 * @route   GET /api/leads/my
 * @access  Private (All authenticated users)
 */
export const getMyLeads = asyncHandler(async (req, res) => {
  const { stage, status, page, limit } = req.query;
  const user = extractUser(req);

  // Find the Employee record for this user
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findOne({ clerkUserId: user.userId });

  if (!employee) {
    return sendSuccess(res, [], 'No leads found');
  }

  // Build filter - leads where user is owner
  let filter = {
    owner: employee._id,
    isDeleted: false
  };

  if (stage) {
    filter.stage = stage;
  }

  if (status) {
    filter.status = status;
  }

  const leads = await Lead.find(filter)
    .populate('clientId', 'name clientId clientType tier')
    .populate('pipelineId', 'name stage')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit) || 50);

  return sendSuccess(res, leads, 'My leads retrieved successfully');
});

/**
 * @desc    Get leads by stage
 * @route   GET /api/leads/stage/:stage
 * @access  Private (All authenticated users)
 */
export const getLeadsByStage = asyncHandler(async (req, res) => {
  const { stage } = req.params;
  const user = extractUser(req);

  // Validate stage
  const validStages = ['Not Contacted', 'Contacted', 'Opportunity', 'Closed', 'Lost'];
  if (!validStages.includes(stage)) {
    throw buildValidationError('stage', `Invalid stage. Must be one of: ${validStages.join(', ')}`);
  }

  const leads = await Lead.find({
    stage,
    isDeleted: false
  }).populate('owner', 'firstName lastName fullName employeeId')
    .populate('clientId', 'name clientId clientType tier')
    .sort({ createdAt: -1 });

  return sendSuccess(res, leads, 'Leads by stage retrieved successfully');
});

/**
 * @desc    Update lead stage
 * @route   PATCH /api/leads/:id/stage
 * @access  Private (Admin, HR, Superadmin, Leads, Owner)
 */
export const updateLeadStage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stage } = req.body;
  const user = extractUser(req);

  // Validate stage
  const validStages = ['Not Contacted', 'Contacted', 'Opportunity', 'Closed', 'Lost'];
  if (!validStages.includes(stage)) {
    throw buildValidationError('stage', `Invalid stage. Must be one of: ${validStages.join(', ')}`);
  }

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid lead ID format');
  }

  // Find lead
  const lead = await Lead.findOne({
    _id: id,
    isDeleted: false
  });

  if (!lead) {
    throw buildNotFoundError('Lead', id);
  }

  // Update stage
  const previousStage = lead.stage;
  lead.stage = stage;
  await lead.save();

  // Populate references for response
  await lead.populate('owner', 'firstName lastName fullName employeeId');
  await lead.populate('clientId', 'name clientId clientType tier');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastLeadEvents.stageChanged(io, user.companyId, lead, previousStage);
  }

  return sendSuccess(res, {
    _id: lead._id,
    leadId: lead.leadId,
    stage: lead.stage,
    previousStage
  }, 'Lead stage updated successfully');
});

/**
 * @desc    Convert lead to client
 * @route   POST /api/leads/:id/convert
 * @access  Private (Admin, HR, Superadmin, Leads)
 */
export const convertLeadToClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw buildValidationError('id', 'Invalid lead ID format');
  }

  // Find lead
  const lead = await Lead.findOne({
    _id: id,
    isDeleted: false
  });

  if (!lead) {
    throw buildNotFoundError('Lead', id);
  }

  // Check if already converted
  if (lead.isConverted) {
    throw buildConflictError('Lead has already been converted to a client');
  }

  // Check if deal is required
  if (!lead.dealId) {
    throw buildValidationError('dealId', 'A deal must be associated with the lead before conversion');
  }

  // Create client from lead
  const Client = mongoose.model('Client');
  const { generateClientId } = await import('../../utils/idGenerator.js');

  const clientData = {
    clientId: await generateClientId(),
    name: lead.company,
    displayName: lead.company,
    industry: lead.industry || '',
    email: lead.email,
    phone: lead.phone,
    website: lead.website,
    address: lead.address || {},
    status: 'Active',
    source: lead.source,
    accountManager: lead.owner,
    annualRevenue: lead.value || 0,
    tags: lead.tags || [],
    notes: lead.notes || '',
    contacts: lead.contactName ? [{
      name: lead.contactName,
      designation: lead.designation || '',
      email: lead.email,
      phone: lead.phone,
      isPrimary: true
    }] : [],
    createdBy: user.userId
  };

  const client = await Client.create(clientData);

  // Update lead
  lead.isConverted = true;
  lead.convertedToClient = client._id;
  lead.convertedAt = new Date();
  lead.stage = 'Closed';
  await lead.save();

  // Populate references for response
  await lead.populate('convertedToClient', 'name clientId clientType tier');

  // Broadcast Socket.IO event
  const io = getSocketIO(req);
  if (io) {
    broadcastLeadEvents.converted(io, user.companyId, lead, client);
  }

  return sendSuccess(res, {
    lead: {
      _id: lead._id,
      leadId: lead.leadId,
      isConverted: lead.isConverted,
      convertedToClient: lead.convertedToClient
    },
    client: {
      _id: client._id,
      clientId: client.clientId,
      name: client.name
    }
  }, 'Lead converted to client successfully');
});

/**
 * @desc    Search leads
 * @route   GET /api/leads/search
 * @access  Private (All authenticated users)
 */
export const searchLeads = asyncHandler(async (req, res) => {
  const { q, page, limit } = req.query;
  const user = extractUser(req);

  if (!q || !q.trim()) {
    throw buildValidationError('q', 'Search query is required');
  }

  const searchFilter = buildSearchFilter(q, ['name', 'company', 'email', 'tags']);

  const result = await filterAndPaginate(Lead, {
    isDeleted: false,
    ...searchFilter
  }, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    populate: [
      {
        path: 'owner',
        select: 'firstName lastName fullName employeeId'
      },
      {
        path: 'clientId',
        select: 'name clientId clientType tier'
      }
    ]
  });

  return sendSuccess(res, result.data, 'Lead search results', 200, result.pagination);
});

/**
 * @desc    Get lead statistics
 * @route   GET /api/leads/stats
 * @access  Private (Admin, HR, Superadmin)
 */
export const getLeadStats = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  const stats = await Lead.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        notContacted: {
          $sum: { $cond: [{ $eq: ['$stage', 'Not Contacted'] }, 1, 0] }
        },
        contacted: {
          $sum: { $cond: [{ $eq: ['$stage', 'Contacted'] }, 1, 0] }
        },
        opportunity: {
          $sum: { $cond: [{ $eq: ['$stage', 'Opportunity'] }, 1, 0] }
        },
        closed: {
          $sum: { $cond: [{ $eq: ['$stage', 'Closed'] }, 1, 0] }
        },
        lost: {
          $sum: { $cond: [{ $eq: ['$stage', 'Lost'] }, 1, 0] }
        },
        converted: {
          $sum: { $cond: ['$isConverted', 1, 0] }
        },
        totalValue: { $sum: '$value' },
        hotLeads: {
          $sum: { $cond: [{ $eq: ['$priority', 'Hot'] }, 1, 0] }
        }
      }
    }
  ]);

  const result = stats[0] || {
    total: 0,
    notContacted: 0,
    contacted: 0,
    opportunity: 0,
    closed: 0,
    lost: 0,
    converted: 0,
    totalValue: 0,
    hotLeads: 0
  };

  // Add conversion rate
  result.conversionRate = result.total > 0 ? ((result.converted / result.total) * 100).toFixed(2) : 0;

  return sendSuccess(res, result, 'Lead statistics retrieved successfully');
});

export default {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getMyLeads,
  getLeadsByStage,
  updateLeadStage,
  convertLeadToClient,
  searchLeads,
  getLeadStats
};
