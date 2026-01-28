/**
 * Holiday Type Schema
 * Tracks different types of holidays for leave management
 */

import mongoose from 'mongoose';

const holidayTypeSchema = new mongoose.Schema({
  // Company for multi-tenant isolation
  companyId: {
    type: String,
    required: true,
    index: true
  },

  // Holiday type details
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 100
  },

  // Code/abbreviation for the holiday type
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    maxlength: 20
  },

  // Description
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },

  // Default days allowed per year
  defaultDaysAllowed: {
    type: Number,
    default: 0,
    min: 0
  },

  // Is this type paid leave?
  isPaid: {
    type: Boolean,
    default: true
  },

  // Requires approval?
  requiresApproval: {
    type: Boolean,
    default: true
  },

  // Can be carried forward to next year?
  canCarryForward: {
    type: Boolean,
    default: false
  },

  // Maximum carry forward days
  maxCarryForwardDays: {
    type: Number,
    default: 0,
    min: 0
  },

  // Is this an active type?
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Display order
  displayOrder: {
    type: Number,
    default: 0
  },

  // Icon/color for UI
  icon: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
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
holidayTypeSchema.index({ companyId: 1, isActive: 1, isDeleted: 1 });
holidayTypeSchema.index({ companyId: 1, code: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

// Static method: Get active holiday types
holidayTypeSchema.statics.getActive = async function(companyId) {
  return this.find({
    companyId,
    isActive: true,
    isDeleted: false
  }).sort({ displayOrder: 1, name: 1 });
};

// Static method: Get by code
holidayTypeSchema.statics.getByCode = async function(companyId, code) {
  return this.findOne({
    companyId,
    code: code.toUpperCase(),
    isDeleted: false
  });
};

// Static method: Initialize default holiday types for a company
holidayTypeSchema.statics.initializeDefaults = async function(companyId, userId) {
  const defaults = [
    {
      companyId,
      name: 'Annual Leave',
      code: 'ANNUAL',
      description: 'Regular annual/vacation leave',
      defaultDaysAllowed: 20,
      isPaid: true,
      requiresApproval: true,
      canCarryForward: true,
      maxCarryForwardDays: 5,
      displayOrder: 1,
      icon: '🏖️',
      color: '#4CAF50',
      createdBy: userId
    },
    {
      companyId,
      name: 'Sick Leave',
      code: 'SICK',
      description: 'Leave for illness or medical appointments',
      defaultDaysAllowed: 10,
      isPaid: true,
      requiresApproval: true,
      canCarryForward: false,
      displayOrder: 2,
      icon: '🤒',
      color: '#F44336',
      createdBy: userId
    },
    {
      companyId,
      name: 'Casual Leave',
      code: 'CASUAL',
      description: 'Short-term leave for personal reasons',
      defaultDaysAllowed: 12,
      isPaid: true,
      requiresApproval: true,
      canCarryForward: false,
      displayOrder: 3,
      icon: '🌴',
      color: '#FF9800',
      createdBy: userId
    },
    {
      companyId,
      name: 'Maternity Leave',
      code: 'MATERNITY',
      description: 'Leave for pregnancy and childbirth',
      defaultDaysAllowed: 90,
      isPaid: true,
      requiresApproval: true,
      canCarryForward: false,
      displayOrder: 4,
      icon: '👶',
      color: '#E91E63',
      createdBy: userId
    },
    {
      companyId,
      name: 'Paternity Leave',
      code: 'PATERNITY',
      description: 'Leave for new fathers',
      defaultDaysAllowed: 14,
      isPaid: true,
      requiresApproval: true,
      canCarryForward: false,
      displayOrder: 5,
      icon: '👨',
      color: '#2196F3',
      createdBy: userId
    },
    {
      companyId,
      name: 'Unpaid Leave',
      code: 'UNPAID',
      description: 'Leave without pay',
      defaultDaysAllowed: 0,
      isPaid: false,
      requiresApproval: true,
      canCarryForward: false,
      displayOrder: 6,
      icon: '📋',
      color: '#9E9E9E',
      createdBy: userId
    }
  ];

  // Insert only if they don't exist
  const existing = await this.find({ companyId }).countDocuments();
  if (existing === 0) {
    await this.insertMany(defaults);
  }

  return this.getActive(companyId);
};

const HolidayType = mongoose.model('HolidayType', holidayTypeSchema);

export default HolidayType;
