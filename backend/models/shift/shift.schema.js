/**
 * Shift Schema
 * Defines work shift patterns for attendance calculation
 * Supports flexible shift configurations with grace periods
 */

import mongoose from 'mongoose';
import { generateShiftId } from '../../utils/idGenerator.js';

const shiftSchema = new mongoose.Schema({
  shiftId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Shift basic info
  name: {
    type: String,
    required: [true, 'Shift name is required'],
    trim: true,
    maxlength: [100, 'Shift name cannot exceed 100 characters']
  },

  // Shift code for quick reference
  code: {
    type: String,
    uppercase: true,
    trim: true,
    maxlength: [20, 'Shift code cannot exceed 20 characters']
  },

  // Company for multi-tenant isolation
  companyId: {
    type: String,
    required: true,
    index: true
  },

  // Shift timing
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    validate: {
      validator: function(v) {
        // Validate HH:MM format
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Start time must be in HH:MM format (24-hour)'
    }
  },

  endTime: {
    type: String,
    required: [true, 'End time is required'],
    validate: {
      validator: function(v) {
        // Validate HH:MM format
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'End time must be in HH:MM format (24-hour)'
    }
  },

  // Duration in hours (calculated automatically)
  duration: {
    type: Number,
    default: 8,
    min: [1, 'Duration must be at least 1 hour'],
    max: [24, 'Duration cannot exceed 24 hours']
  },

  // Timezone for shift (defaults to company timezone)
  timezone: {
    type: String,
    default: 'UTC'
  },

  // Grace period for late arrival (in minutes)
  gracePeriod: {
    type: Number,
    default: 15,
    min: [0, 'Grace period cannot be negative'],
    max: [60, 'Grace period cannot exceed 60 minutes']
  },

  // Early departure allowance (in minutes)
  earlyDepartureAllowance: {
    type: Number,
    default: 15,
    min: [0, 'Early departure allowance cannot be negative'],
    max: [60, 'Early departure allowance cannot exceed 60 minutes']
  },

  // Minimum hours for full day (in hours)
  minHoursForFullDay: {
    type: Number,
    default: 8,
    min: [1, 'Minimum hours must be at least 1 hour']
  },

  // Half-day threshold (in hours)
  halfDayThreshold: {
    type: Number,
    default: 4,
    min: [1, 'Half-day threshold must be at least 1 hour']
  },

  // Overtime calculation settings
  overtime: {
    enabled: {
      type: Boolean,
      default: true
    },
    threshold: {
      type: Number,
      default: 8,
      min: [1, 'Overtime threshold must be at least 1 hour']
    },
    multiplier: {
      type: Number,
      default: 1.5,
      min: [1, 'Overtime multiplier must be at least 1x']
    }
  },

  // Break settings
  breakSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    mandatory: {
      type: Boolean,
      default: false
    },
    duration: {
      type: Number,
      default: 60,
      min: [0, 'Break duration cannot be negative'],
      max: [180, 'Break duration cannot exceed 3 hours']
    },
    maxDuration: {
      type: Number,
      default: 90,
      min: [0, 'Max break duration cannot be negative'],
      max: [240, 'Max break duration cannot exceed 4 hours']
    }
  },

  // Flexible working hours
  flexibleHours: {
    enabled: {
      type: Boolean,
      default: false
    },
    windowStart: {
      type: String,
      validate: {
        validator: function(v) {
          if (!this.flexibleHours?.enabled) return true;
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Window start time must be in HH:MM format'
      }
    },
    windowEnd: {
      type: String,
      validate: {
        validator: function(v) {
          if (!this.flexibleHours?.enabled) return true;
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Window end time must be in HH:MM format'
      }
    },
    minHoursInOffice: {
      type: Number,
      default: 8,
      min: [1, 'Minimum hours in office must be at least 1 hour']
    }
  },

  // Night shift settings
  isNightShift: {
    type: Boolean,
    default: false
  },

  // Shift type
  type: {
    type: String,
    enum: ['regular', 'night', 'rotating', 'flexible', 'custom'],
    default: 'regular'
  },

  // Working days (for weekly shifts)
  workingDays: {
    type: [Number],
    default: [1, 2, 3, 4, 5], // Monday to Friday
    validate: {
      validator: function(v) {
        return v.every(day => day >= 0 && day <= 6);
      },
      message: 'Working days must be between 0 (Sunday) and 6 (Saturday)'
    }
  },

  // Shift rotation settings (for rotating shifts)
  rotation: {
    enabled: {
      type: Boolean,
      default: false
    },
    cycle: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    rotateAfterDays: {
      type: Number,
      default: 7,
      min: [1, 'Rotation period must be at least 1 day']
    }
  },

  // Color coding for UI
  color: {
    type: String,
    default: '#1890ff',
    validate: {
      validator: function(v) {
        return /^#[0-9A-F]{6}$/i.test(v);
      },
      message: 'Color must be a valid hex color code'
    }
  },

  // Description
  description: {
    type: String,
    maxlength: 500
  },

  // Active status
  isActive: {
    type: Boolean,
    default: true
  },

  // Is default shift for company
  isDefault: {
    type: Boolean,
    default: false
  },

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },

  // Audit fields
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

// Indexes
shiftSchema.index({ companyId: 1, isActive: 1 });
shiftSchema.index({ companyId: 1, isDefault: 1 });
shiftSchema.index({ companyId: 1, isDeleted: 1 });

// Pre-save middleware to calculate duration
shiftSchema.pre('save', function(next) {
  // Calculate duration if start and end times are set
  if (this.startTime && this.endTime) {
    const [startHour, startMin] = this.startTime.split(':').map(Number);
    const [endHour, endMin] = this.endTime.split(':').map(Number);

    let startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;

    // Handle overnight shifts (end time < start time)
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60; // Add 24 hours
    }

    this.duration = Math.round((endMinutes - startMinutes) / 60 * 100) / 100;

    // Mark as night shift if hours are between 9 PM and 6 AM
    this.isNightShift = startHour >= 21 || startHour < 6;
  }

  // Generate shift ID if not present
  if (!this.shiftId) {
    generateShiftId().then(id => {
      this.shiftId = id;
      next();
    }).catch(next);
  } else {
    next();
  }
});

// Virtual for shift time range
shiftSchema.virtual('timeRange').get(function() {
  return `${this.startTime} - ${this.endTime}`;
});

// Static method to get default shift for company
shiftSchema.statics.getDefaultShift = async function(companyId) {
  return this.findOne({
    companyId,
    isActive: true,
    isDefault: true,
    isDeleted: { $ne: true }
  });
};

// Static method to get all active shifts for company
shiftSchema.statics.getActiveShifts = async function(companyId) {
  return this.find({
    companyId,
    isActive: true,
    isDeleted: { $ne: true }
  }).sort({ isDefault: -1, name: 1 });
};

// Method to check if time is within shift window
shiftSchema.methods.isWithinShiftWindow = function(time) {
  if (!this.flexibleHours?.enabled) return true;

  const [hour, min] = time.split(':').map(Number);
  const timeMinutes = hour * 60 + min;

  const [windowStartHour, windowStartMin] = this.flexibleHours.windowStart.split(':').map(Number);
  const [windowEndHour, windowEndMin] = this.flexibleHours.windowEnd.split(':').map(Number);

  const windowStartMinutes = windowStartHour * 60 + windowStartMin;
  const windowEndMinutes = windowEndHour * 60 + windowEndMin;

  return timeMinutes >= windowStartMinutes && timeMinutes <= windowEndMinutes;
};

// Method to calculate if arrival is late
shiftSchema.methods.isLateArrival = function(arrivalTime) {
  const [shiftHour, shiftMin] = this.startTime.split(':').map(Number);
  const [arrivalHour, arrivalMin] = arrivalTime.split(':').map(Number);

  const shiftMinutes = shiftHour * 60 + shiftMin;
  const arrivalMinutes = arrivalHour * 60 + arrivalMin;

  const gracePeriod = this.gracePeriod || 0;

  return arrivalMinutes > (shiftMinutes + gracePeriod);
};

// Method to calculate late minutes
shiftSchema.methods.calculateLateMinutes = function(arrivalTime) {
  const [shiftHour, shiftMin] = this.startTime.split(':').map(Number);
  const [arrivalHour, arrivalMin] = arrivalTime.split(':').map(Number);

  const shiftMinutes = shiftHour * 60 + shiftMin;
  const arrivalMinutes = arrivalHour * 60 + arrivalMin;

  const gracePeriod = this.gracePeriod || 0;
  const lateMinutes = arrivalMinutes - shiftMinutes - gracePeriod;

  return Math.max(0, lateMinutes);
};

// Method to calculate if departure is early
shiftSchema.methods.isEarlyDeparture = function(departureTime) {
  const [shiftEndHour, shiftEndMin] = this.endTime.split(':').map(Number);
  const [departureHour, departureMin] = departureTime.split(':').map(Number);

  const shiftEndMinutes = shiftEndHour * 60 + shiftEndMin;
  const departureMinutes = departureHour * 60 + departureMin;

  const allowance = this.earlyDepartureAllowance || 0;

  return departureMinutes < (shiftEndMinutes - allowance);
};

// Method to calculate early departure minutes
shiftSchema.methods.calculateEarlyDepartureMinutes = function(departureTime) {
  const [shiftEndHour, shiftEndMin] = this.endTime.split(':').map(Number);
  const [departureHour, departureMin] = departureTime.split(':').map(Number);

  const shiftEndMinutes = shiftEndHour * 60 + shiftEndMin;
  const departureMinutes = departureHour * 60 + departureMin;

  const allowance = this.earlyDepartureAllowance || 0;
  const earlyMinutes = shiftEndMinutes - allowance - departureMinutes;

  return Math.max(0, earlyMinutes);
};

// Method to calculate overtime
shiftSchema.methods.calculateOvertime = function(hoursWorked) {
  if (!this.overtime?.enabled) return 0;

  const threshold = this.overtime.threshold || 8;
  const overtime = hoursWorked - threshold;

  return Math.max(0, Math.round(overtime * 100) / 100);
};

const Shift = mongoose.model('Shift', shiftSchema);

export default Shift;
