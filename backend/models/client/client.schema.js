/**
 * Client Schema - Mongoose Model
 * CRM Client/Company management
 */

import mongoose from 'mongoose';
import { generateClientId } from '../../utils/idGenerator.js';

/**
 * Client Schema
 */
const clientSchema = new mongoose.Schema({
  // Auto-generated client ID (e.g., CLI-2026-001)
  clientId: {
    type: String,
    unique: true,
    index: true
  },

  // Basic Information
  name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
    maxlength: [200, 'Client name cannot exceed 200 characters']
  },

  displayName: {
    type: String,
    trim: true
  },

  // Industry & Type
  industry: {
    type: String,
    trim: true
  },

  clientType: {
    type: String,
    enum: ['Enterprise', 'SME', 'Startup', 'Individual', 'Government', 'Other'],
    default: 'Other'
  },

  // Contact Information
  email: {
    type: String,
    lowercase: true,
    trim: true
  },

  phone: {
    type: String,
    trim: true
  },

  website: {
    type: String,
    trim: true
  },

  // Address
  address: {
    street: {
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
    country: {
      type: String,
      trim: true
    },
    postalCode: {
      type: String,
      trim: true
    }
  },

  // Client Contacts (multiple people from same company)
  contacts: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    designation: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],

  // Client Status
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Prospect', 'Churned'],
    default: 'Prospect'
  },

  // Source
  source: {
    type: String,
    enum: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Email Campaign', 'Event', 'Other', 'Unknown'],
    default: 'Unknown'
  },

  // Account Manager
  accountManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  // Team Members
  teamMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }],

  // Financial Information
  annualRevenue: {
    type: Number,
    default: 0,
    min: [0, 'Revenue cannot be negative']
  },

  employeeCount: {
    type: Number,
    default: 0,
    min: [0, 'Employee count cannot be negative']
  },

  // Client Tier/Classification
  tier: {
    type: String,
    enum: ['Enterprise', 'Mid-Market', 'Small-Business', 'Startup'],
    default: 'Small-Business'
  },

  // Tags & Notes
  tags: [{
    type: String,
    trim: true
  }],

  notes: {
    type: String,
    maxlength: 5000
  },

  // Social Media
  socialMedia: {
    linkedin: {
      type: String,
      trim: true
    },
    twitter: {
      type: String,
      trim: true
    },
    facebook: {
      type: String,
      trim: true
    }
  },

  // Deals/Opportunities
  totalDeals: {
    type: Number,
    default: 0
  },

  wonDeals: {
    type: Number,
    default: 0
  },

  totalValue: {
    type: Number,
    default: 0
  },

  wonValue: {
    type: Number,
    default: 0
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
clientSchema.index({ companyId: 1, status: 1 });
clientSchema.index({ companyId: 1, tier: 1 });
clientSchema.index({ companyId: 1, accountManager: 1 });
clientSchema.index({ companyId: 1, source: 1 });
clientSchema.index({ companyId: 1, isDeleted: 1 });
clientSchema.index({ createdAt: -1 });
clientSchema.index({ totalValue: -1 });

// Text search index
clientSchema.index({
  name: 'text',
  displayName: 'text',
  industry: 'text',
  tags: 'text'
});

/**
 * Virtuals
 */

// Virtual for average deal value
clientSchema.virtual('averageDealValue').get(function() {
  if (this.totalDeals === 0) return 0;
  return this.totalValue / this.totalDeals;
});

// Virtual for win rate
clientSchema.virtual('winRate').get(function() {
  if (this.totalDeals === 0) return 0;
  return (this.wonDeals / this.totalDeals) * 100;
});

/**
 * Pre-save Middleware
 */

// Generate clientId before saving if not exists
clientSchema.pre('save', async function(next) {
  if (!this.clientId) {
    this.clientId = await generateClientId(this.companyId);
  }

  // Auto-calculate tier based on revenue
  if (this.annualRevenue > 10000000) { // > $10M
    this.tier = 'Enterprise';
  } else if (this.annualRevenue > 1000000) { // > $1M
    this.tier = 'Mid-Market';
  } else if (this.annualRevenue > 100000) { // > $100K
    this.tier = 'Small-Business';
  } else {
    this.tier = 'Startup';
  }

  next();
});

/**
 * Static Methods
 */

// Get active clients only
clientSchema.statics.getActiveClients = function(companyId) {
  return this.find({
    companyId,
    isActive: true,
    isDeleted: false
  });
};

// Get clients by status
clientSchema.statics.getByStatus = function(companyId, status) {
  return this.find({
    companyId,
    status,
    isActive: true,
    isDeleted: false
  });
};

// Get clients by account manager
clientSchema.statics.getByAccountManager = function(accountManagerId) {
  return this.find({
    accountManager: accountManagerId,
    isActive: true,
    isDeleted: false
  }).populate('accountManager', 'firstName lastName fullName employeeId');
};

// Search clients
clientSchema.statics.searchClients = function(companyId, searchTerm) {
  return this.find({
    companyId,
    isActive: true,
    isDeleted: false,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { displayName: { $regex: searchTerm, $options: 'i' } },
      { industry: { $regex: searchTerm, $options: 'i' } },
      { tags: { $regex: searchTerm, $options: 'i' } }
    ]
  });
};

/**
 * Instance Methods
 */

// Soft delete client
clientSchema.methods.softDelete = function(deletedBy) {
  this.isActive = false;
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.status = 'Churned';
  return this.save();
};

// Update deal statistics
clientSchema.methods.updateDealStats = function(won, value, isWon) {
  if (isWon) {
    this.wonDeals += 1;
    this.wonValue += value;
  }

  this.totalDeals += 1;
  this.totalValue += value;
  return this.save();
};

/**
 * Create and export model
 */
const Client = mongoose.model('Client', clientSchema);

export default Client;
