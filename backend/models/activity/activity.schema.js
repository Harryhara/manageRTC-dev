/**
 * Activity Schema
 * Tracks CRM activities (calls, emails, meetings, tasks)
 */

import mongoose from 'mongoose';
import { generateActivityId } from '../../utils/idGenerator.js';

const activitySchema = new mongoose.Schema({
  // Auto-generated unique activity ID
  activityId: {
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

  // Activity details
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },

  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },

  // Activity type: call, email, meeting, task, etc.
  activityType: {
    type: String,
    required: true,
    enum: ['call', 'email', 'meeting', 'task', 'follow-up', 'demo', 'site-visit', 'other'],
    index: true
  },

  // Activity status
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'cancelled', 'overdue'],
    default: 'pending',
    index: true
  },

  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Due date for the activity
  dueDate: {
    type: Date,
    required: true,
    index: true
  },

  // Activity owner/assigned user
  owner: {
    type: String,
    index: true
  },

  // Related entities
  relatedTo: {
    entityType: {
      type: String,
      enum: ['lead', 'deal', 'contact', 'company', 'ticket', 'none'],
      default: 'none'
    },
    entityId: {
      type: String,
      default: null
    }
  },

  // Location for meetings/site visits
  location: {
    type: String,
    trim: true
  },

  // Duration in minutes
  duration: {
    type: Number,
    min: 0
  },

  // Reminder setting
  reminder: {
    type: String,
    enum: ['none', '5min', '15min', '30min', '1hour', '1day', '1week'],
    default: 'none'
  },

  // Guests/Participants (for meetings)
  guests: [{
    type: String
  }],

  // Activity outcome/result
  outcome: {
    type: String,
    trim: true,
    maxlength: 1000
  },

  // Notes from the activity
  notes: {
    type: String,
    trim: true,
    maxlength: 2000
  },

  // Attachments
  attachments: [{
    name: String,
    url: String,
    fileType: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Completion details
  completedAt: {
    type: Date
  },
  completedBy: {
    type: String
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
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
activitySchema.index({ companyId: 1, isDeleted: 1, dueDate: -1 });
activitySchema.index({ companyId: 1, owner: 1, status: 1 });
activitySchema.index({ companyId: 1, activityType: 1, status: 1 });
activitySchema.index({ companyId: 1, relatedTo: 1 });

// Virtual: Check if activity is overdue
activitySchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  return new Date(this.dueDate) < new Date();
});

// Virtual: Check if activity is upcoming (within 24 hours)
activitySchema.virtual('isUpcoming').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  const now = new Date();
  const dueDate = new Date(this.dueDate);
  const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
  return hoursUntilDue > 0 && hoursUntilDue <= 24;
});

// Pre-save middleware: Generate activity ID
activitySchema.pre('save', async function(next) {
  if (!this.activityId) {
    this.activityId = await generateActivityId(this.companyId);
  }

  // Update status to overdue if past due date and not completed
  if (this.status === 'pending' && new Date(this.dueDate) < new Date()) {
    this.status = 'overdue';
  }

  // Set completion timestamp
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }

  next();
});

// Static method: Get activity statistics
activitySchema.statics.getStats = async function(companyId) {
  const stats = await this.aggregate([
    { $match: { companyId, isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } }
      }
    }
  ]);

  const result = stats[0] || { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0 };

  // Get type distribution
  const typeStats = await this.aggregate([
    { $match: { companyId, isDeleted: false } },
    { $group: { _id: '$activityType', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  return { ...result, typeDistribution: typeStats };
};

// Static method: Get distinct owners
activitySchema.statics.getOwners = async function(companyId) {
  return this.distinct('owner', { companyId, isDeleted: false, owner: { $exists: true, $ne: null } });
};

// Static method: Get upcoming activities (within 24 hours)
activitySchema.statics.getUpcoming = async function(companyId) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.find({
    companyId,
    isDeleted: false,
    status: { $in: ['pending', 'in-progress'] },
    dueDate: { $gte: new Date(), $lte: tomorrow }
  }).sort({ dueDate: 1 });
};

// Static method: Get overdue activities
activitySchema.statics.getOverdue = async function(companyId) {
  return this.find({
    companyId,
    isDeleted: false,
    status: { $in: ['pending', 'overdue', 'in-progress'] },
    dueDate: { $lt: new Date() }
  }).sort({ dueDate: 1 });
};

// Instance method: Mark as complete
activitySchema.methods.markComplete = async function(userId) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.completedBy = userId;
  return this.save();
};

// Instance method: Postpone activity
activitySchema.methods.postpone = async function(newDueDate) {
  this.dueDate = new Date(newDueDate);

  // Reset status if it was overdue
  if (this.status === 'overdue') {
    this.status = 'pending';
  }

  return this.save();
};

const Activity = mongoose.model('Activity', activitySchema);

export default Activity;
