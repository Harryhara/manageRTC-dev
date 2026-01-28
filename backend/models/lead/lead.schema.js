/**
 * Lead Schema - Mongoose Model
 * CRM Lead management with pipeline stages
 */

import mongoose from 'mongoose';
import { generateLeadId } from '../../utils/idGenerator.js';

/**
 * Lead Schema
 */
const leadSchema = new mongoose.Schema({
  // Auto-generated lead ID (e.g., LD-2026-001)
  leadId: {
    type: String,
    unique: true,
    index: true
  },

  // Basic Information
  name: {
    type: String,
    required: [true, 'Lead name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },

  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    maxlength: [200, 'Company name cannot exceed 200 characters']
  },

  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },

  phone: {
    type: String,
    trim: true
  },

  // Lead Value & Status
  value: {
    type: Number,
    default: 0,
    min: [0, 'Value cannot be negative']
  },

  stage: {
    type: String,
    enum: ['Not Contacted', 'Contacted', 'Opportunity', 'Closed', 'Lost'],
    default: 'Not Contacted',
    index: true
  },

  status: {
    type: String,
    enum: ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'],
    default: 'New'
  },

  // Lead Source
  source: {
    type: String,
    enum: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Email Campaign', 'Event', 'Other', 'Unknown'],
    default: 'Unknown'
  },

  // Location Information
  country: {
    type: String,
    trim: true
  },

  address: {
    type: String,
    trim: true
  },

  city: {
    type: String,
    trim: true
  },

  state: {
    type: String,
    trim: true
  },

  // Lead Management
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    index: true
  },

  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },

  tags: [{
    type: String,
    trim: true
  }],

  // Lost Lead Analysis
  lostReason: {
    type: String,
    trim: true
  },

  // Dates
  followUpDate: {
    type: Date
  },

  dueDate: {
    type: Date
  },

  lastContactDate: {
    type: Date
  },

  nextFollowUpDate: {
    type: Date
  },

  // Conversion tracking
  convertedAt: {
    type: Date
  },

  convertedToDeal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal'
  },

  // Client Reference
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },

  // Pipeline & Stage
  pipelineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pipeline'
  },

  // Additional Notes
  notes: {
    type: String,
    maxlength: 2000
  },

  description: {
    type: String,
    maxlength: 1000
  },

  // Company (Multi-tenant)
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'Company is required'],
    index: true
  },

  // Audit Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  // Soft Delete
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * Indexes
 */

// Compound indexes for common queries
leadSchema.index({ companyId: 1, stage: 1 });
leadSchema.index({ companyId: 1, status: 1 });
leadSchema.index({ companyId: 1, owner: 1 });
leadSchema.index({ companyId: 1, source: 1 });
leadSchema.index({ companyId: 1, priority: 1 });
leadSchema.index({ companyId: 1, isDeleted: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ value: -1 });

// Text search index
leadSchema.index({
  name: 'text',
  company: 'text',
  email: 'text',
  tags: 'text'
});

/**
 * Virtuals
 */

// Virtual for checking if lead is hot (high priority + recent)
leadSchema.virtual('isHot').get(function() {
  if (this.priority !== 'High') return false;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return this.createdAt >= thirtyDaysAgo;
});

// Virtual for days in current stage
leadSchema.virtual('daysInStage').get(function() {
  if (!this.updatedAt) return 0;

  const now = new Date();
  const diff = now - this.updatedAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

/**
 * Pre-save Middleware
 */

// Generate leadId before saving if not exists
leadSchema.pre('save', async function(next) {
  if (!this.leadId) {
    this.leadId = await generateLeadId(this.companyId);
  }

  // Auto-set status based on stage
  if (this.stage === 'Closed' && this.status !== 'Won') {
    this.status = 'Won';
    this.convertedAt = new Date();
  } else if (this.stage === 'Lost' && this.status !== 'Lost') {
    this.status = 'Lost';
  } else if (this.stage === 'Opportunity' && this.status === 'New') {
    this.status = 'Qualified';
  }

  next();
});

/**
 * Static Methods
 */

// Get active leads only
leadSchema.statics.getActiveLeads = function(companyId) {
  return this.find({
    companyId,
    isActive: true,
    isDeleted: false
  });
};

// Get leads by stage
leadSchema.statics.getByStage = function(companyId, stage) {
  return this.find({
    companyId,
    stage,
    isActive: true,
    isDeleted: false
  });
};

// Get leads by owner
leadSchema.statics.getByOwner = function(ownerId) {
  return this.find({
    owner: ownerId,
    isActive: true,
    isDeleted: false
  }).populate('owner', 'firstName lastName fullName employeeId');
};

// Search leads
leadSchema.statics.searchLeads = function(companyId, searchTerm) {
  return this.find({
    companyId,
    isActive: true,
    isDeleted: false,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { company: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { tags: { $regex: searchTerm, $options: 'i' } }
    ]
  });
};

/**
 * Instance Methods
 */

// Soft delete lead
leadSchema.methods.softDelete = function(deletedBy) {
  this.isActive = false;
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.stage = 'Lost';
  return this.save();
};

// Move to different stage
leadSchema.methods.moveToStage = function(newStage, userId) {
  this.stage = newStage;
  this.updatedBy = userId;

  // Auto-set status based on stage
  if (newStage === 'Closed') {
    this.status = 'Won';
    this.convertedAt = new Date();
  } else if (newStage === 'Lost') {
    this.status = 'Lost';
  }

  return this.save();
};

// Mark as converted
leadSchema.methods.markAsConverted = function(dealId, userId) {
  this.stage = 'Closed';
  this.status = 'Won';
  this.convertedAt = new Date();
  this.convertedToDeal = dealId;
  this.updatedBy = userId;
  return this.save();
};

/**
 * Create and export model
 */
const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
