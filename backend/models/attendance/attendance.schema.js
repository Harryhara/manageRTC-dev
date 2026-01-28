/**
 * Attendance Schema
 * Tracks employee clock in/out, work hours, overtime, and attendance status
 */

import mongoose from 'mongoose';
import { generateAttendanceId } from '../../utils/idGenerator.js';

const attendanceSchema = new mongoose.Schema({
  attendanceId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Reference to employee
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee is required'],
    index: true
  },

  // Company for multi-tenant isolation
  companyId: {
    type: String,
    required: true,
    index: true
  },

  // Date of attendance
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },

  // Clock in details
  clockIn: {
    time: {
      type: Date,
      default: Date.now
    },
    location: {
      type: {
        type: String,
        enum: ['office', 'remote', 'client-site', 'other']
      },
      coordinates: {
        latitude: Number,
        longitude: Number
      },
      ipAddress: String,
      deviceId: String
    },
    notes: String
  },

  // Clock out details
  clockOut: {
    time: {
      type: Date
    },
    location: {
      type: {
        type: String,
        enum: ['office', 'remote', 'client-site', 'other']
      },
      coordinates: {
        latitude: Number,
        longitude: Number
      },
      ipAddress: String,
      deviceId: String
    },
    notes: String
  },

  // Work hours calculation
  hoursWorked: {
    type: Number,
    default: 0,
    min: 0
  },

  regularHours: {
    type: Number,
    default: 0
  },

  overtimeHours: {
    type: Number,
    default: 0
  },

  // Attendance status
  status: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'late', 'early-departure', 'on-leave', 'holiday', 'weekend'],
    default: 'present',
    index: true
  },

  // Late/Early tracking
  isLate: {
    type: Boolean,
    default: false
  },

  lateMinutes: {
    type: Number,
    default: 0
  },

  isEarlyDeparture: {
    type: Boolean,
    default: false
  },

  earlyDepartureMinutes: {
    type: Number,
    default: 0
  },

  // Break time tracking
  breakDuration: {
    type: Number,
    default: 0
  },

  breakStartTime: Date,
  breakEndTime: Date,

  // Shift information
  shift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift'
  },

  // Schedule details
  scheduledStart: Date,
  scheduledEnd: Date,

  // Approval/Regularization
  isRegularized: {
    type: Boolean,
    default: false
  },

  regularizationRequest: {
    requested: {
      type: Boolean,
      default: false
    },
    reason: String,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    requestedAt: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    approvedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    rejectionReason: String
  },

  // Notes and comments
  notes: {
    type: String,
    maxlength: 500
  },

  managerNotes: {
    type: String,
    maxlength: 500
  },

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
attendanceSchema.index({ employee: 1, date: -1 });
attendanceSchema.index({ companyId: 1, date: -1 });
attendanceSchema.index({ companyId: 1, status: 1 });
attendanceSchema.index({ employee: 1, isDeleted: 1 });
attendanceSchema.index({ date: 1, status: 1, isDeleted: 1 });

// Virtual for total duration
attendanceSchema.virtual('totalDuration').get(function() {
  if (this.clockIn.time && this.clockOut.time) {
    return (this.clockOut.time - this.clockIn.time) / (1000 * 60 * 60); // Convert to hours
  }
  return 0;
});

// Virtual for work session
attendanceSchema.virtual('workSession').get(function() {
  return {
    start: this.clockIn?.time,
    end: this.clockOut?.time,
    duration: this.hoursWorked,
    breakDuration: this.breakDuration
  };
});

// Pre-save middleware to calculate hours worked
attendanceSchema.pre('save', function(next) {
  // Calculate hours worked if both clock in and clock out are present
  if (this.clockIn?.time && this.clockOut?.time) {
    const totalMs = this.clockOut.time - this.clockIn.time;
    const totalHours = totalMs / (1000 * 60 * 60);

    // Subtract break duration
    const workHours = totalHours - (this.breakDuration || 0) / 60;

    this.hoursWorked = Math.max(0, workHours);

    // Calculate regular and overtime hours (assuming 8 hours is regular)
    const regularHoursLimit = 8;
    if (this.hoursWorked > regularHoursLimit) {
      this.regularHours = regularHoursLimit;
      this.overtimeHours = this.hoursWorked - regularHoursLimit;
    } else {
      this.regularHours = this.hoursWorked;
      this.overtimeHours = 0;
    }

    // Determine if late (after 9:30 AM)
    if (this.clockIn.time) {
      const clockInHour = this.clockIn.time.getHours();
      const clockInMinute = this.clockIn.time.getMinutes();
      const lateThreshold = 9.5; // 9:30 AM

      if (clockInHour + (clockInMinute / 60) > lateThreshold) {
        this.isLate = true;
        this.lateMinutes = Math.round((clockInHour + (clockInMinute / 60) - lateThreshold) * 60);
      } else {
        this.isLate = false;
        this.lateMinutes = 0;
      }
    }

    // Determine if early departure (before 6:00 PM)
    if (this.clockOut.time) {
      const clockOutHour = this.clockOut.time.getHours();
      const earlyThreshold = 18; // 6:00 PM

      if (clockOutHour < earlyThreshold && !this.isLate) {
        this.isEarlyDeparture = true;
        this.earlyDepartureMinutes = Math.round((earlyThreshold - clockOutHour) * 60);
      } else {
        this.isEarlyDeparture = false;
        this.earlyDepartureMinutes = 0;
      }
    }
  }

  // Generate attendance ID if not present
  if (!this.attendanceId) {
    generateAttendanceId().then(id => {
      this.attendanceId = id;
      next();
    }).catch(next);
  } else {
    next();
  }
});

// Method to clock in
attendanceSchema.methods.clockIn = function(locationData, notes) {
  this.clockIn = {
    time: new Date(),
    location: locationData?.type || 'office',
    coordinates: locationData?.coordinates,
    ipAddress: locationData?.ipAddress,
    deviceId: locationData?.deviceId,
    notes: notes || ''
  };
  this.status = 'present';
  return this.save();
};

// Method to clock out
attendanceSchema.methods.clockOut = function(locationData, notes) {
  this.clockOut = {
    time: new Date(),
    location: locationData?.type || 'office',
    coordinates: locationData?.coordinates,
    ipAddress: locationData?.ipAddress,
    deviceId: locationData?.deviceId,
    notes: notes || ''
  };
  return this.save();
};

// Method to start break
attendanceSchema.methods.startBreak = function() {
  this.breakStartTime = new Date();
  return this.save();
};

// Method to end break
attendanceSchema.methods.endBreak = function() {
  if (this.breakStartTime) {
    this.breakEndTime = new Date();
    const breakMs = this.breakEndTime - this.breakStartTime;
    this.breakDuration = Math.round(breakMs / (1000 * 60)); // Convert to minutes
  }
  return this.save();
};

// Method to request regularization
attendanceSchema.methods.requestRegularization = function(reason, requestedBy) {
  this.regularizationRequest = {
    requested: true,
    reason,
    requestedBy,
    requestedAt: new Date(),
    status: 'pending'
  };
  return this.save();
};

// Static method to check if employee is already clocked in today
attendanceSchema.statics.isClockedIn = async function(employeeId, date = new Date()) {
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));

  const attendance = await this.findOne({
    employee: employeeId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    clockIn: { $exists: true },
    clockOut: { $exists: false },
    isDeleted: false
  });

  return !!attendance;
};

// Static method to get monthly attendance
attendanceSchema.statics.getMonthlyAttendance = async function(employeeId, year, month) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  return this.find({
    employee: employeeId,
    date: { $gte: startDate, $lte: endDate },
    isDeleted: false
  }).sort({ date: 1 });
};

// Static method to get attendance stats
attendanceSchema.statics.getStats = async function(companyId, filters = {}) {
  const matchQuery = {
    companyId,
    isDeleted: false,
    ...filters
  };

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        present: {
          $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
        },
        absent: {
          $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
        },
        halfDay: {
          $sum: { $cond: [{ $eq: ['$status', 'half-day'] }, 1, 0] }
        },
        late: {
          $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
        },
        onLeave: {
          $sum: { $cond: [{ $eq: ['$status', 'on-leave'] }, 1, 0] }
        },
        totalHoursWorked: { $sum: '$hoursWorked' },
        totalOvertimeHours: { $sum: '$overtimeHours' }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    present: 0,
    absent: 0,
    halfDay: 0,
    late: 0,
    onLeave: 0,
    totalHoursWorked: 0,
    totalOvertimeHours: 0
  };
};

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
