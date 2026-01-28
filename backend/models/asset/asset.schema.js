/**
 * Asset Schema
 * Tracks company assets, assignments, maintenance, and depreciation
 */

import mongoose from 'mongoose';
import { generateAssetId } from '../../utils/idGenerator.js';

const assetSchema = new mongoose.Schema({
  assetId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Basic asset information
  name: {
    type: String,
    required: [true, 'Asset name is required'],
    trim: true,
    index: true
  },

  // Asset type and categorization
  type: {
    type: String,
    required: [true, 'Asset type is required'],
    enum: ['equipment', 'furniture', 'electronics', 'vehicle', 'software', 'license', 'building', 'other'],
    index: true
  },

  category: {
    type: String,
    required: [true, 'Asset category is required'],
    index: true
  },

  // Identification
  serialNumber: {
    type: String,
    trim: true,
    index: true
  },

  barcode: {
    type: String,
    trim: true
  },

  qrCode: {
    type: String,
    trim: true
  },

  // Company for multi-tenant isolation
  companyId: {
    type: String,
    required: true,
    index: true
  },

  // Purchase information
  purchaseDate: {
    type: Date,
    default: Date.now
  },

  purchaseValue: {
    type: Number,
    required: true,
    min: 0
  },

  currentValue: {
    type: Number,
    min: 0
  },

  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'INR', 'AED']
  },

  vendor: {
    name: String,
    contact: String,
    email: String,
    address: String
  },

  invoiceNumber: String,
  invoiceDate: Date,

  // Location tracking
  location: {
    type: String,
    enum: ['head-office', 'branch', 'remote', 'client-site', 'storage', 'in-transit', 'other']
  },

  locationDetails: {
    building: String,
    floor: String,
    room: String,
    desk: String,
    address: String
  },

  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    index: true
  },

  assignedDate: Date,

  assignmentType: {
    type: String,
    enum: ['permanent', 'temporary', 'shared']
  },

  // Asset status
  status: {
    type: String,
    enum: ['available', 'assigned', 'in-maintenance', 'retired', 'lost', 'damaged', 'sold', 'disposed'],
    default: 'available',
    index: true
  },

  // Physical condition
  condition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'poor', 'damaged'],
    default: 'good'
  },

  // Warranty and support
  warranty: {
    provider: String,
    expiryDate: Date,
    contact: String,
    policyNumber: String
  },

  // Maintenance tracking
  maintenanceSchedule: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'as-needed']
    },
    lastMaintenanceDate: Date,
    nextMaintenanceDate: Date,
    maintenanceCost: {
      type: Number,
      default: 0
    }
  },

  maintenanceHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['routine', 'repair', 'upgrade', 'calibration', 'inspection']
    },
    description: String,
    cost: Number,
    performedBy: String,
    notes: String
  }],

  // Depreciation
  depreciation: {
    method: {
      type: String,
      enum: ['straight-line', 'declining-balance', 'units-of-production', 'none'],
      default: 'straight-line'
    },
    rate: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    },
    salvageValue: {
      type: Number,
      default: 0
    },
    accumulatedDepreciation: {
      type: Number,
      default: 0
    }
  },

  // Useful life in years
  usefulLife: {
    type: Number,
    default: 5
  },

  // Retirement/Disposal
  retirementDate: Date,
  retirementReason: String,
  disposalDetails: {
    method: String,
    date: Date,
    value: Number,
    recipient: String
  },

  // Insurance
  insurance: {
    provider: String,
    policyNumber: String,
    expiryDate: Date,
    coverageAmount: Number
  },

  // Photos and documents
  photos: [{
    filename: String,
    originalName: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  documents: [{
    filename: String,
    originalName: String,
    mimeType: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Specifications (flexible JSON for different asset types)
  specifications: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Notes
  notes: String,

  // Audit fields
  isActive: {
    type: Boolean,
    default: true
  },

  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  deletedAt: Date
}, {
  timestamps: true
});

// Compound indexes for efficient queries
assetSchema.index({ companyId: 1, status: 1 });
assetSchema.index({ companyId: 1, type: 1 });
assetSchema.index({ companyId: 1, category: 1 });
assetSchema.index({ assignedTo: 1, isDeleted: 1 });
assetSchema.index({ companyId: 1, name: 1 });
assetSchema.index({ serialNumber: 1, companyId: 1 });

// Virtual for age in years
assetSchema.virtual('ageInYears').get(function() {
  if (!this.purchaseDate) return 0;
  const now = new Date();
  const purchaseDate = new Date(this.purchaseDate);
  const ageInMs = now - purchaseDate;
  return Math.floor(ageInMs / (1000 * 60 * 60 * 24 * 365));
});

// Virtual for current depreciated value
assetSchema.virtual('depreciatedValue').get(function() {
  if (this.depreciation.method === 'none' || !this.purchaseValue) {
    return this.purchaseValue || 0;
  }

  const ageInYears = this.ageInYears;
  let depreciatedValue = this.purchaseValue;

  switch (this.depreciation.method) {
    case 'straight-line':
      const annualDepreciation = (this.purchaseValue - this.depreciation.salvageValue) / this.usefulLife;
      depreciatedValue = this.purchaseValue - (annualDepreciation * ageInYears);
      break;

    case 'declining-balance':
      const rate = this.depreciation.rate / 100;
      for (let i = 0; i < ageInYears; i++) {
        depreciatedValue = depreciatedValue * (1 - rate);
      }
      break;

    default:
      depreciatedValue = this.purchaseValue;
  }

  return Math.max(this.depreciation.salvageValue, Math.round(depreciatedValue * 100) / 100);
});

// Virtual for is under maintenance
assetSchema.virtual('isUnderMaintenance').get(function() {
  return this.status === 'in-maintenance';
});

// Virtual for is assigned
assetSchema.virtual('isAssigned').get(function() {
  return !!this.assignedTo && this.status === 'assigned';
});

// Pre-save middleware to calculate current value and depreciation
assetSchema.pre('save', function(next) {
  // Update current value based on depreciation
  this.currentValue = this.depreciatedValue;

  // Calculate accumulated depreciation
  if (this.purchaseValue) {
    this.depreciation.accumulatedDepreciation = this.purchaseValue - this.currentValue;
  }

  // Generate asset ID if not present
  if (!this.assetId) {
    generateAssetId().then(id => {
      this.assetId = id;
      next();
    }).catch(next);
  } else {
    next();
  }
});

// Method to assign asset to employee
assetSchema.methods.assignTo = function(employeeId, assignmentType = 'permanent') {
  this.assignedTo = employeeId;
  this.assignedDate = new Date();
  this.assignmentType = assignmentType;
  this.status = 'assigned';
  return this.save();
};

// Method to unassign asset
assetSchema.methods.unassign = function() {
  this.assignedTo = null;
  this.assignedDate = null;
  this.assignmentType = null;
  this.status = 'available';
  return this.save();
};

// Method to schedule maintenance
assetSchema.methods.scheduleMaintenance = function(date, type = 'routine', description = '') {
  this.maintenanceSchedule.nextMaintenanceDate = date;
  this.status = 'in-maintenance';
  this.maintenanceHistory.push({
    date: new Date(),
    type,
    description: description || `Scheduled ${type} maintenance`,
    performedBy: 'System'
  });
  return this.save();
};

// Method to complete maintenance
assetSchema.methods.completeMaintenance = function(cost, performedBy, notes) {
  this.maintenanceSchedule.lastMaintenanceDate = new Date();
  this.maintenanceSchedule.maintenanceCost += cost || 0;

  const lastMaintenance = this.maintenanceHistory[this.maintenanceHistory.length - 1];
  if (lastMaintenance && lastMaintenance.date < this.maintenanceSchedule.lastMaintenanceDate) {
    lastMaintenance.cost = cost;
    lastMaintenance.performedBy = performedBy;
    lastMaintenance.notes = notes;
  }

  this.status = this.assignedTo ? 'assigned' : 'available';
  return this.save();
};

// Static method to get assets by category
assetSchema.statics.getByCategory = async function(companyId, category) {
  return this.find({
    companyId,
    category,
    isDeleted: false
  }).populate('assignedTo', 'firstName lastName fullName employeeId');
};

// Static method to get assets by status
assetSchema.statics.getByStatus = async function(companyId, status) {
  return this.find({
    companyId,
    status,
    isDeleted: false
  }).populate('assignedTo', 'firstName lastName fullName employeeId');
};

// Static method to get assets by employee
assetSchema.statics.getByEmployee = async function(companyId, employeeId) {
  return this.find({
    companyId,
    assignedTo: employeeId,
    isDeleted: false
  });
};

// Static method to get asset statistics
assetSchema.statics.getStats = async function(companyId) {
  const stats = await this.aggregate([
    {
      $match: {
        companyId,
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        available: {
          $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
        },
        assigned: {
          $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] }
        },
        inMaintenance: {
          $sum: { $cond: [{ $eq: ['$status', 'in-maintenance'] }, 1, 0] }
        },
        retired: {
          $sum: { $cond: [{ $eq: ['$status', 'retired'] }, 1, 0] }
        },
        totalValue: { $sum: '$purchaseValue' },
        currentValue: { $sum: '$currentValue' },
        totalDepreciation: { $sum: '$depreciation.accumulatedDepreciation' }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    available: 0,
    assigned: 0,
    inMaintenance: 0,
    retired: 0,
    totalValue: 0,
    currentValue: 0,
    totalDepreciation: 0
  };
};

// Static method to get assets requiring maintenance
assetSchema.statics.getMaintenanceDue = async function(companyId, daysAhead = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return this.find({
    companyId,
    isDeleted: false,
    $or: [
      {
        'maintenanceSchedule.nextMaintenanceDate': {
          $lte: futureDate
        }
      },
      {
        status: 'in-maintenance'
      }
    ]
  }).populate('assignedTo', 'firstName lastName fullName employeeId')
    .sort({ 'maintenanceSchedule.nextMaintenanceDate': 1 });
};

const Asset = mongoose.model('Asset', assetSchema);

export default Asset;
