/**
 * Training Schema
 * Tracks training programs, enrollments, and completion
 */

import mongoose from 'mongoose';
import { generateTrainingId } from '../../utils/idGenerator.js';

const trainingSchema = new mongoose.Schema({
  trainingId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Basic training information
  name: {
    type: String,
    required: [true, 'Training name is required'],
    trim: true,
    index: true
  },

  // Training type and categorization
  type: {
    type: String,
    required: [true, 'Training type is required'],
    enum: ['technical', 'soft-skills', 'compliance', 'safety', 'leadership', 'onboarding', 'certification', 'other'],
    index: true
  },

  category: {
    type: String,
    required: [true, 'Training category is required'],
    index: true
  },

  // Company for multi-tenant isolation
  companyId: {
    type: String,
    required: true,
    index: true
  },

  // Description
  description: {
    type: String,
    maxlength: 2000
  },

  // Training schedule
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    index: true
  },

  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    index: true
  },

  // Duration (calculated automatically)
  duration: {
    type: Number,
    min: 0
  },

  // Instructor information
  instructor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },

  externalInstructor: {
    name: String,
    email: String,
    phone: String,
    organization: String
  },

  // Location
  location: {
    type: {
      type: String,
      enum: ['office', 'online', 'external', 'hybrid']
    },
    address: String,
    meetingLink: String,
    room: String
  },

  // Capacity and enrollment
  maxParticipants: {
    type: Number,
    default: 30,
    min: 1
  },

  minParticipants: {
    type: Number,
    default: 5,
    min: 1
  },

  enrolledCount: {
    type: Number,
    default: 0
  },

  // Enrolled employees
  participants: [{
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    enrolledAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['enrolled', 'in-progress', 'completed', 'dropped', 'no-show'],
      default: 'enrolled'
    },
    completionDate: Date,
    score: Number,
    certificate: {
      issued: {
        type: Boolean,
        default: false
      },
      issuedDate: Date,
      certificateUrl: String
    },
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comments: String
    }
  }],

  // Waitlist
  waitlist: [{
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Training status
  status: {
    type: String,
    enum: ['draft', 'published', 'registration-open', 'registration-closed', 'in-progress', 'completed', 'cancelled'],
    default: 'draft',
    index: true
  },

  // Budget and cost
  budget: {
    allocated: {
      type: Number,
      default: 0
    },
    spent: {
      type: Number,
      default: 0
    },
    costPerParticipant: {
      type: Number,
      default: 0
    }
  },

  // Training materials
  materials: [{
    filename: String,
    originalName: String,
    mimeType: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Curriculum/Syllabus
  curriculum: [{
    title: String,
    description: String,
    duration: Number,
    order: Number
  }],

  // Prerequisites
  prerequisites: [{
    type: {
      type: String,
      enum: ['training', 'skill', 'experience']
    },
    description: String,
    required: Boolean
  }],

  // Learning objectives
  objectives: [String],

  // Assessment
  hasAssessment: {
    type: Boolean,
    default: false
  },

  assessmentDetails: {
    type: {
      type: String,
      enum: ['quiz', 'exam', 'project', 'presentation', 'practical']
    },
    passingScore: {
      type: Number,
      default: 70
    },
    duration: Number,
    totalMarks: Number
  },

  // Certification
  certification: {
    offered: {
      type: Boolean,
      default: false
    },
    name: String,
    issuer: String,
    validFor: Number // in months
  },

  // Completion requirements
  completionRequirements: {
    minAttendance: {
      type: Number,
      default: 80
    },
    minScore: {
      type: Number,
      default: 70
    }
  },

  // Tags
  tags: [String],

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
trainingSchema.index({ companyId: 1, status: 1 });
trainingSchema.index({ companyId: 1, type: 1 });
trainingSchema.index({ companyId: 1, category: 1 });
trainingSchema.index({ startDate: 1, endDate: 1 });
trainingSchema.index({ 'participants.employee': 1 });
trainingSchema.index({ companyId: 1, name: 1 });

// Virtual for available slots
trainingSchema.virtual('availableSlots').get(function() {
  return Math.max(0, this.maxParticipants - this.enrolledCount);
});

// Virtual for is fully booked
trainingSchema.virtual('isFullyBooked').get(function() {
  return this.enrolledCount >= this.maxParticipants;
});

// Virtual for is upcoming
trainingSchema.virtual('isUpcoming').get(function() {
  return this.startDate > new Date();
});

// Virtual for is completed
trainingSchema.virtual('isCompleted').get(function() {
  return this.endDate < new Date() && this.status === 'completed';
});

// Virtual for duration in days
trainingSchema.virtual('durationInDays').get(function() {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Pre-save middleware to calculate duration
trainingSchema.pre('save', function(next) {
  // Calculate duration
  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffTime = Math.abs(end - start);
    this.duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Convert to days
  }

  // Update enrolled count
  this.enrolledCount = this.participants.length;

  // Generate training ID if not present
  if (!this.trainingId) {
    generateTrainingId().then(id => {
      this.trainingId = id;
      next();
    }).catch(next);
  } else {
    next();
  }
});

// Method to enroll employee
trainingSchema.methods.enrollEmployee = function(employeeId) {
  // Check if already enrolled
  const existingParticipant = this.participants.find(
    p => p.employee.toString() === employeeId.toString()
  );

  if (existingParticipant) {
    throw new Error('Employee already enrolled');
  }

  // Check capacity
  if (this.enrolledCount >= this.maxParticipants) {
    throw new Error('Training is fully booked');
  }

  // Add to participants
  this.participants.push({
    employee: employeeId,
    status: 'enrolled'
  });

  return this.save();
};

// Method to unenroll employee
trainingSchema.methods.unenrollEmployee = function(employeeId) {
  this.participants = this.participants.filter(
    p => p.employee.toString() !== employeeId.toString()
  );
  return this.save();
};

// Method to mark training as in progress
trainingSchema.methods.start = function() {
  this.status = 'in-progress';
  this.participants.forEach(p => {
    if (p.status === 'enrolled') {
      p.status = 'in-progress';
    }
  });
  return this.save();
};

// Method to complete training for employee
trainingSchema.methods.completeForEmployee = function(employeeId, score) {
  const participant = this.participants.find(
    p => p.employee.toString() === employeeId.toString()
  );

  if (participant) {
    participant.status = 'completed';
    participant.completionDate = new Date();
    participant.score = score;

    // Issue certificate if applicable
    if (this.certification.offered) {
      participant.certificate.issued = true;
      participant.certificate.issuedDate = new Date();
    }
  }

  return this.save();
};

// Static method to get upcoming trainings
trainingSchema.statics.getUpcoming = async function(companyId, limit = 10) {
  const now = new Date();
  return this.find({
    companyId,
    startDate: { $gt: now },
    status: { $in: ['published', 'registration-open'] },
    isDeleted: false
  }).sort({ startDate: 1 })
    .limit(limit)
    .populate('instructor', 'firstName lastName fullName');
};

// Static method to get trainings by type
trainingSchema.statics.getByType = async function(companyId, type) {
  return this.find({
    companyId,
    type,
    isDeleted: false
  }).populate('instructor', 'firstName lastName fullName')
    .sort({ startDate: -1 });
};

// Static method to get training statistics
trainingSchema.statics.getStats = async function(companyId) {
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
        draft: {
          $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
        },
        published: {
          $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] }
        },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        totalParticipants: { $sum: '$enrolledCount' },
        totalBudget: { $sum: '$budget.allocated' },
        spentBudget: { $sum: '$budget.spent' }
      }
    }
  ]);

  return stats[0] || {
    total: 0,
    draft: 0,
    published: 0,
    inProgress: 0,
    completed: 0,
    totalParticipants: 0,
    totalBudget: 0,
    spentBudget: 0
  };
};

const Training = mongoose.model('Training', trainingSchema);

export default Training;
