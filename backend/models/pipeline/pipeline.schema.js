/**
 * Pipeline Schema
 * Tracks CRM pipelines for managing leads/deals through sales stages
 */

import mongoose from 'mongoose';
import { generatePipelineId } from '../../utils/idGenerator.js';

const pipelineSchema = new mongoose.Schema({
  // Auto-generated unique pipeline ID
  pipelineId: {
    type: String,
    unique: true,
    index: true
  },

  // Company for multi-tenant isolation
  companyId: {
    type: String,
    required: true,
    index: true
  },

  // Pipeline details
  pipelineName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  description: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Pipeline type (sales, recruitment, support, etc.)
  pipelineType: {
    type: String,
    enum: ['sales', 'recruitment', 'support', 'project', 'custom'],
    default: 'sales'
  },

  // Current stage of pipeline
  stage: {
    type: String,
    default: 'New',
    index: true
  },

  // Status of pipeline
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived', 'completed'],
    default: 'active',
    index: true
  },

  // Deal value information
  dealValue: {
    type: Number,
    default: 0,
    min: 0
  },

  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY']
  },

  // Probability of closing (percentage)
  probability: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },

  // Expected close date
  expectedCloseDate: {
    type: Date,
    index: true
  },

  // Actual close date
  actualCloseDate: {
    type: Date
  },

  // Stage history (tracking movement through stages)
  stageHistory: [{
    stage: String,
    enteredAt: {
      type: Date,
      default: Date.now
    },
    duration: Number, // in days
    notes: String
  }],

  // Owner of the pipeline
  owner: {
    type: String,
    index: true
  },

  // Team members
  teamMembers: [{
    type: String
  }],

  // Related entities
  relatedTo: {
    leadId: {
      type: String
    },
    dealId: {
      type: String
    },
    contactId: {
      type: String
    },
    companyId: {
      type: String
    }
  },

  // Pipeline priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Tags for categorization
  tags: [{
    type: String,
    trim: true
  }],

  // Custom fields (flexible storage for additional data)
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  // Lost/Won reasons
  outcome: {
    type: String,
    enum: ['pending', 'won', 'lost', 'abandoned'],
    default: 'pending'
  },
  outcomeReason: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Activity tracking
  lastActivityAt: {
    type: Date
  },
  nextActivityDate: {
    type: Date
  },

  // Audit fields
  createdBy: {
    type: String
  },
  updatedBy: {
    type: String
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: String
  },

  // Computed fields (for aggregation)
  totalDeals: {
    type: Number,
    default: 0
  },
  noOfDeals: {
    type: Number,
    default: 0
  },

  // Created date (for consistency with existing data)
  createdDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
pipelineSchema.index({ companyId: 1, isDeleted: 1, status: 1 });
pipelineSchema.index({ companyId: 1, owner: 1, stage: 1 });
pipelineSchema.index({ companyId: 1, pipelineType: 1, outcome: 1 });
pipelineSchema.index({ companyId: 1, expectedCloseDate: 1 });

// Virtual: Age of pipeline in days
pipelineSchema.virtual('ageInDays').get(function() {
  const createdDate = this.createdDate || this.createdAt;
  return Math.floor((new Date() - new Date(createdDate)) / (1000 * 60 * 60 * 24));
});

// Virtual: Days in current stage
pipelineSchema.virtual('daysInCurrentStage').get(function() {
  if (this.stageHistory.length > 0) {
    const lastStageEntry = this.stageHistory[this.stageHistory.length - 1];
    return Math.floor((new Date() - new Date(lastStageEntry.enteredAt)) / (1000 * 60 * 60 * 24));
  }
  return this.ageInDays;
});

// Virtual: Is overdue (past expected close date)
pipelineSchema.virtual('isOverdue').get(function() {
  if (this.outcome !== 'pending' || !this.expectedCloseDate) {
    return false;
  }
  return new Date(this.expectedCloseDate) < new Date();
});

// Virtual: Total value in pipeline (with currency)
pipelineSchema.virtual('formattedValue').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency || 'USD'
  }).format(this.dealValue || 0);
});

// Pre-save middleware: Generate pipeline ID
pipelineSchema.pre('save', async function(next) {
  if (!this.pipelineId) {
    this.pipelineId = await generatePipelineId(this.companyId);
  }

  // Update stage history when stage changes
  if (this.isModified('stage')) {
    const previousStage = this._doc.stage;

    // Remove from previous stage history if exists
    this.stageHistory = this.stageHistory.filter(h => h.stage !== previousStage);

    // Add new stage entry
    this.stageHistory.push({
      stage: this.stage,
      enteredAt: new Date(),
      duration: 0
    });
  }

  // Update outcome based on status
  if (this.status === 'completed') {
    if (this.outcome === 'pending') {
      this.outcome = 'won';
    }
    this.actualCloseDate = this.actualCloseDate || new Date();
  }

  // Update last activity timestamp
  if (this.isModified()) {
    this.lastActivityAt = new Date();
  }

  next();
});

// Static method: Get pipeline statistics
pipelineSchema.statics.getStats = async function(companyId) {
  const stats = await this.aggregate([
    { $match: { companyId, isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        totalValue: { $sum: '$dealValue' },
        wonDeals: {
          $sum: { $cond: [{ $eq: ['$outcome', 'won'] }, 1, 0] }
        },
        wonValue: {
          $sum: { $cond: [{ $eq: ['$outcome', 'won'] }, '$dealValue', 0] }
        },
        lostDeals: {
          $sum: { $cond: [{ $eq: ['$outcome', 'lost'] }, 1, 0] }
        }
      }
    }
  ]);

  const result = stats[0] || {
    total: 0,
    active: 0,
    completed: 0,
    totalValue: 0,
    wonDeals: 0,
    wonValue: 0,
    lostDeals: 0
  };

  // Get stage distribution
  const stageStats = await this.aggregate([
    { $match: { companyId, isDeleted: false } },
    { $group: { _id: '$stage', count: { $sum: 1 }, totalValue: { $sum: '$dealValue' } } },
    { $sort: { count: -1 } }
  ]);

  return { ...result, stageDistribution: stageStats };
};

// Static method: Get pipelines by type
pipelineSchema.statics.getByType = async function(companyId, pipelineType) {
  return this.find({
    companyId,
    pipelineType,
    isDeleted: false
  }).sort({ createdDate: -1 });
};

// Static method: Get overdue pipelines
pipelineSchema.statics.getOverdue = async function(companyId) {
  return this.find({
    companyId,
    isDeleted: false,
    status: 'active',
    outcome: 'pending',
    expectedCloseDate: { $lt: new Date() }
  }).sort({ expectedCloseDate: 1 });
};

// Static method: Get pipelines closing soon (within 7 days)
pipelineSchema.statics.getClosingSoon = async function(companyId) {
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  return this.find({
    companyId,
    isDeleted: false,
    status: 'active',
    outcome: 'pending',
    expectedCloseDate: { $gte: new Date(), $lte: sevenDaysLater }
  }).sort({ expectedCloseDate: 1 });
};

// Instance method: Move to next stage
pipelineSchema.methods.moveToStage = async function(newStage, notes = '') {
  const previousStage = this.stage;

  // Calculate duration in current stage
  if (this.stageHistory.length > 0) {
    const lastEntry = this.stageHistory[this.stageHistory.length - 1];
    lastEntry.duration = Math.floor((new Date() - new Date(lastEntry.enteredAt)) / (1000 * 60 * 60 * 24));
  }

  // Move to new stage
  this.stage = newStage;
  this.stageHistory.push({
    stage: newStage,
    enteredAt: new Date(),
    duration: 0,
    notes
  });

  // Update probability based on stage (simple logic)
  this.updateProbabilityForStage(newStage);

  return this.save();
};

// Instance method: Update probability based on stage
pipelineSchema.methods.updateProbabilityForStage = function(stage) {
  const stageProbabilities = {
    'New': 10,
    'Qualified': 20,
    'Proposal': 40,
    'Negotiation': 60,
    'Closing': 80,
    'Won': 100,
    'Lost': 0
  };

  this.probability = stageProbabilities[stage] || 0;
};

// Instance method: Mark as won
pipelineSchema.methods.markAsWon = async function(reason = '') {
  this.status = 'completed';
  this.outcome = 'won';
  this.actualCloseDate = new Date();
  this.outcomeReason = reason;
  this.probability = 100;
  return this.save();
};

// Instance method: Mark as lost
pipelineSchema.methods.markAsLost = async function(reason) {
  this.status = 'completed';
  this.outcome = 'lost';
  this.actualCloseDate = new Date();
  this.outcomeReason = reason;
  this.probability = 0;
  return this.save();
};

const Pipeline = mongoose.model('Pipeline', pipelineSchema);

export default Pipeline;
