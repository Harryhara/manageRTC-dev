# 🗄️ COMPLETE DATABASE SCHEMA & INTEGRATION GUIDE
## manageRTC Platform - MongoDB Schema Reference

**Document Version:** 1.0  
**Date:** January 27, 2026  
**Database:** MongoDB 6.13  
**ORM:** Mongoose 8.9.5  
**Platform:** manageRTC (HRMS + PM + CRM)

---

## 📋 TABLE OF CONTENTS

1. [Schema Overview](#1-schema-overview)
2. [Design Principles](#2-design-principles)
3. [Core Schemas (Existing)](#3-core-schemas-existing)
4. [Missing Critical Schemas](#4-missing-critical-schemas)
5. [Relationships & Foreign Keys](#5-relationships--foreign-keys)
6. [Indexes Strategy](#6-indexes-strategy)
7. [Data Migration Guide](#7-data-migration-guide)
8. [Integration Patterns](#8-integration-patterns)
9. [Query Optimization](#9-query-optimization)
10. [Backup & Recovery](#10-backup--recovery)

---

## 1. SCHEMA OVERVIEW

### 1.1 Database Statistics

**Current State:**
- **Total Models:** 21 model files
- **Total Schemas:** 74 embedded + main schemas
- **Collections:** ~30 collections
- **Indexed Fields:** ~50% (NEEDS IMPROVEMENT)
- **Relationships:** ~200 foreign key references

### 1.2 Schema Organization

```
models/
├── chat/
│   ├── conversation.schema.js (✅ EXISTS)
│   └── message.schema.js (✅ EXISTS)
├── client/
│   └── client.schema.js (✅ EXISTS)
├── employee/
│   └── package.schema.js (✅ EXISTS - partial)
├── invoice/
│   ├── invoice.js (✅ EXISTS)
│   └── invoice.schema.js (✅ EXISTS - duplicate)
├── kaban/
│   └── kaban.model.js (✅ EXISTS)
├── performance/
│   ├── goalTracking.model.js (✅ EXISTS)
│   ├── goalType.model.js (✅ EXISTS)
│   ├── performanceAppraisal.model.js (✅ EXISTS)
│   ├── performanceIndicator.model.js (✅ EXISTS)
│   ├── performanceReview.model.js (✅ EXISTS)
│   └── promotion.model.js (✅ EXISTS)
├── project/
│   ├── project.notes.schema.js (✅ EXISTS)
│   └── project.schema.js (✅ EXISTS)
├── socialfeed/
│   └── socialFeed.model.js (✅ EXISTS)
├── superadmin/
│   └── package.schema.js (✅ EXISTS)
├── task/
│   └── task.schema.js (✅ EXISTS)
├── deal.model.js (✅ EXISTS)
├── job.model.js (✅ EXISTS)
└── ticket.model.js (✅ EXISTS)
```

---

## 2. DESIGN PRINCIPLES

### 2.1 Multi-Tenancy Design

**Every collection has `companyId`:**
```javascript
companyId: {
  type: String,
  required: true,
  index: true // 🔴 CRITICAL: Always indexed!
}
```

**Why:** Ensures data isolation between companies  
**Impact:** Every query MUST filter by companyId

### 2.2 Soft Deletes

**Pattern:**
```javascript
isDeleted: {
  type: Boolean,
  default: false,
  index: true
}
deletedAt: Date,
deletedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Employee'
}
```

**Queries must always filter:**
```javascript
// ❌ BAD
const projects = await Project.find({ companyId });

// ✅ GOOD
const projects = await Project.find({ 
  companyId, 
  isDeleted: false 
});
```

### 2.3 Audit Trail Pattern

**Standard fields in ALL schemas:**
```javascript
{
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee' 
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee' 
  }
}
```

### 2.4 ID Generation Strategy

**Pattern 1: UUID String (Most collections)**
```javascript
projectId: {
  type: String,
  required: true,
  unique: true,
  default: () => `PRJ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
```

**Pattern 2: MongoDB ObjectId (Some collections)**
```javascript
_id: mongoose.Schema.Types.ObjectId
```

**Recommendation:** Stick to one pattern (ObjectId is preferred)

---

## 3. CORE SCHEMAS (EXISTING)

### 3.1 PROJECT MANAGEMENT SCHEMAS

#### 3.1.1 Project Schema ✅ COMPLETE

**File:** `models/project/project.schema.js`

```javascript
const projectSchema = new mongoose.Schema({
  // Primary Keys
  projectId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  companyId: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  // Core Information
  name: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 3,
    maxlength: 200
  },
  description: { 
    type: String, 
    trim: true, 
    maxlength: 5000 
  },
  
  // Client Information
  client: { 
    type: String, 
    required: true, 
    trim: true 
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  
  // Timeline
  startDate: { 
    type: Date, 
    required: true,
    validate: {
      validator: function(v) {
        return v <= this.dueDate;
      },
      message: 'Start date must be before due date'
    }
  },
  dueDate: { 
    type: Date, 
    required: true 
  },
  actualStartDate: Date,
  actualEndDate: Date,
  
  // Status & Priority
  priority: { 
    type: String, 
    enum: ['High', 'Medium', 'Low', 'Critical'], 
    default: 'Medium',
    index: true
  },
  status: { 
    type: String, 
    enum: ['Not Started', 'Active', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
    default: 'Not Started',
    index: true
  },
  
  // Financial
  projectValue: { 
    type: Number, 
    default: 0,
    min: 0
  },
  budget: {
    estimated: { type: Number, default: 0 },
    actual: { type: Number, default: 0 }
  },
  
  // Progress Tracking
  progress: { 
    type: Number, 
    min: 0, 
    max: 100, 
    default: 0 
  },
  
  // Team Assignment
  teamMembers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee',
    index: true
  }],
  teamLeader: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee' 
  }],
  projectManager: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee' 
  }],
  
  // Metadata
  tags: [{ 
    type: String, 
    trim: true,
    lowercase: true
  }],
  logo: String,
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    }
  }],
  
  // Soft Delete
  isDeleted: { 
    type: Boolean, 
    default: false,
    index: true
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Audit Trail
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound Indexes
projectSchema.index({ companyId: 1, projectId: 1 }, { unique: true });
projectSchema.index({ companyId: 1, status: 1, isDeleted: 1 });
projectSchema.index({ companyId: 1, priority: 1, isDeleted: 1 });
projectSchema.index({ companyId: 1, client: 1 });
projectSchema.index({ companyId: 1, startDate: 1, dueDate: 1 });
projectSchema.index({ companyId: 1, createdAt: -1 });

// Text search index
projectSchema.index({ 
  name: 'text', 
  description: 'text',
  tags: 'text' 
});

// Virtual: isOverdue
projectSchema.virtual('isOverdue').get(function() {
  if (this.status === 'Completed' || this.status === 'Cancelled') {
    return false;
  }
  return this.dueDate && new Date() > this.dueDate;
});

// Virtual: daysRemaining
projectSchema.virtual('daysRemaining').get(function() {
  if (this.status === 'Completed') return 0;
  const now = new Date();
  const due = new Date(this.dueDate);
  const diff = due - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual: taskCount (requires population)
projectSchema.virtual('taskCount', {
  ref: 'tasks',
  localField: 'projectId',
  foreignField: 'projectId',
  count: true
});

// Middleware: Update timestamps
projectSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware: Validate dates
projectSchema.pre('save', function(next) {
  if (this.startDate > this.dueDate) {
    next(new Error('Start date cannot be after due date'));
  }
  next();
});

export const Project = mongoose.model('projects', projectSchema);
```

**Status:** ✅ Well-designed  
**Missing:** Budget tracking details, billing integration  
**Priority:** 🟡 Enhancement needed

---

#### 3.1.2 Task Schema ✅ COMPLETE (with gaps)

**File:** `models/task/task.schema.js`

```javascript
const taskSchema = new mongoose.Schema({
  // Primary Keys
  taskId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  companyId: { 
    type: String, 
    required: true, 
    index: true 
  },
  projectId: { 
    type: String, 
    required: true, 
    index: true,
    ref: 'projects' 
  },
  
  // Core Information
  title: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 200
  },
  description: { 
    type: String,
    maxlength: 5000
  },
  
  // Timeline
  startDate: Date,
  dueDate: Date,
  completedDate: Date,
  
  // Assignment
  assignedTo: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee',
    index: true
  }],
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Status & Priority
  status: {
    type: String,
    enum: ['To Do', 'In Progress', 'In Review', 'Review', 'Completed', 'Blocked'],
    default: 'To Do',
    index: true
  },
  priority: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    default: 'Medium',
    index: true
  },
  
  // Progress
  progress: { 
    type: Number, 
    min: 0, 
    max: 100, 
    default: 0 
  },
  
  // Time Tracking
  estimatedHours: { type: Number, default: 0 },
  actualHours: { type: Number, default: 0 },
  
  // Metadata
  tags: [String],
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    }
  }],
  
  // 🔴 MISSING: Dependencies
  // dependencies: [{
  //   taskId: { type: String, ref: 'tasks' },
  //   type: { type: String, enum: ['finish-to-start', 'start-to-start', 'finish-to-finish'] }
  // }],
  
  // Soft Delete
  isDeleted: { 
    type: Boolean, 
    default: false,
    index: true
  },
  deletedAt: Date,
  
  // Audit Trail
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }
}, { timestamps: true });

// Compound Indexes
taskSchema.index({ companyId: 1, projectId: 1, isDeleted: 1 });
taskSchema.index({ companyId: 1, status: 1, isDeleted: 1 });
taskSchema.index({ companyId: 1, assignedTo: 1, status: 1 });
taskSchema.index({ companyId: 1, dueDate: 1 });
taskSchema.index({ companyId: 1, priority: 1, status: 1 });

// Text search
taskSchema.index({ title: 'text', description: 'text' });

// Virtual: isOverdue
taskSchema.virtual('isOverdue').get(function() {
  if (this.status === 'Completed') return false;
  return this.dueDate && new Date() > this.dueDate;
});

// Update timestamps
taskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.status === 'Completed' && !this.completedDate) {
    this.completedDate = new Date();
  }
  next();
});

export const Task = mongoose.model('tasks', taskSchema);
```

**Status:** ✅ Good foundation  
**Missing:** 
- Task dependencies (Gantt chart support)
- Subtasks
- Checklist items
- Recurring tasks  
**Priority:** 🔴 HIGH - Add dependencies

---

#### 3.1.3 Project Notes Schema ✅ EXISTS

**File:** `models/project/project.notes.schema.js`

```javascript
const projectNoteSchema = new mongoose.Schema({
  noteId: {
    type: String,
    required: true,
    unique: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  projectId: {
    type: String,
    required: true,
    index: true,
    ref: 'projects'
  },
  
  // Content
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  
  // Author
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  
  // Visibility
  isPrivate: {
    type: Boolean,
    default: false
  },
  
  // Attachments
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: Date
  }],
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
projectNoteSchema.index({ projectId: 1, createdAt: -1 });
projectNoteSchema.index({ createdBy: 1, createdAt: -1 });
projectNoteSchema.index({ companyId: 1, projectId: 1, isPrivate: 1 });

export const ProjectNote = mongoose.model('projectnotes', projectNoteSchema);
```

**Status:** ✅ Complete  
**Priority:** 🟢 No changes needed

---

### 3.2 CRM SCHEMAS

#### 3.2.1 Deal Schema ✅ COMPLETE

**File:** `models/deal.model.js`

```javascript
const OwnerSchema = new mongoose.Schema({
  name: String,
  image: String,
  userId: String
});

const ContactSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String
});

const dealSchema = new mongoose.Schema({
  // Primary Keys
  dealId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  companyId: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  // Core Information
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: {
    type: String,
    maxlength: 5000
  },
  
  // Financial
  value: { 
    type: Number, 
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'INR', 'AED']
  },
  
  // Relationships
  contactId: String,
  contact: {
    type: ContactSchema,
    default: null
  },
  companyId_related: String, // Related company (different from tenant companyId)
  
  // Pipeline Management
  pipelineId: { 
    type: String, 
    required: true,
    index: true
  },
  stage: { 
    type: String, 
    required: true,
    index: true
  },
  position: {
    type: Number,
    default: 0
  },
  
  // Dates
  expectedCloseDate: {
    type: Date,
    index: true
  },
  actualCloseDate: Date,
  
  // Probability & Forecasting
  probability: { 
    type: Number, 
    min: 0, 
    max: 100,
    default: 50
  },
  weightedValue: {
    type: Number,
    default: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ['Open', 'Won', 'Lost', 'Abandoned'],
    default: 'Open',
    index: true
  },
  lostReason: String,
  
  // Ownership
  ownerId: { 
    type: String, 
    required: true,
    index: true
  },
  owner: {
    type: OwnerSchema,
    default: null
  },
  
  // Source
  source: {
    type: String,
    enum: ['Website', 'Referral', 'Cold Call', 'Email', 'Social Media', 'Event', 'Other'],
    default: 'Other'
  },
  
  // Metadata
  tags: [String],
  customFields: mongoose.Schema.Types.Mixed,
  
  // Soft Delete
  isDeleted: { 
    type: Boolean, 
    default: false,
    index: true
  },
  deletedAt: Date,
  
  // Audit Trail
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound Indexes
dealSchema.index({ companyId: 1, pipelineId: 1, stage: 1 });
dealSchema.index({ companyId: 1, status: 1, isDeleted: 1 });
dealSchema.index({ companyId: 1, ownerId: 1, status: 1 });
dealSchema.index({ companyId: 1, expectedCloseDate: 1 });
dealSchema.index({ companyId: 1, value: -1 });

// Text search
dealSchema.index({ title: 'text', description: 'text' });

// Virtual: expectedRevenue
dealSchema.virtual('expectedRevenue').get(function() {
  return (this.value * this.probability) / 100;
});

// Middleware: Calculate weighted value
dealSchema.pre('save', function(next) {
  this.weightedValue = (this.value * this.probability) / 100;
  next();
});

export const Deal = mongoose.model('deals', dealSchema);
```

**Status:** ✅ Complete  
**Has REST API:** ✅ Yes (`routes/deals.js`)  
**Priority:** 🟢 Production ready

---

#### 3.2.2 Client Schema ✅ COMPLETE

**File:** `models/client/client.schema.js`

```javascript
const clientSchema = new mongoose.Schema({
  // Primary Keys
  clientId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  phone: {
    type: String,
    trim: true
  },
  
  // Company Details
  companyName: String,
  website: String,
  industry: {
    type: String,
    enum: ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Other']
  },
  
  // Address
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  
  // Financial
  billingAddress: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  taxId: String,
  paymentTerms: {
    type: String,
    enum: ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Immediate'],
    default: 'Net 30'
  },
  
  // Status
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Prospect', 'Former'],
    default: 'Prospect',
    index: true
  },
  
  // Relationship
  accountManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Metadata
  tags: [String],
  notes: String,
  customFields: mongoose.Schema.Types.Mixed,
  
  // Soft Delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  
  // Audit Trail
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }
}, { timestamps: true });

// Indexes
clientSchema.index({ companyId: 1, status: 1, isDeleted: 1 });
clientSchema.index({ companyId: 1, email: 1 }, { unique: true });
clientSchema.index({ companyId: 1, companyName: 1 });
clientSchema.index({ companyId: 1, accountManager: 1 });

// Text search
clientSchema.index({ 
  name: 'text', 
  companyName: 'text', 
  email: 'text' 
});

export const Client = mongoose.model('clients', clientSchema);
```

**Status:** ✅ Complete  
**Priority:** 🟢 Production ready

---

#### 3.2.3 Ticket Schema ✅ COMPLETE

**File:** `models/ticket.model.js`

```javascript
const ticketSchema = new mongoose.Schema({
  // Primary Keys
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  
  // Ticket Information
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Category
  category: {
    type: String,
    enum: ['Technical', 'Billing', 'General', 'Feature Request', 'Bug Report'],
    default: 'General',
    index: true
  },
  
  // Priority & Status
  priority: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    default: 'Medium',
    index: true
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Waiting', 'Resolved', 'Closed'],
    default: 'Open',
    index: true
  },
  
  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  // Client Information
  clientId: {
    type: String,
    ref: 'clients',
    index: true
  },
  clientName: String,
  clientEmail: String,
  
  // Dates
  dueDate: Date,
  resolvedDate: Date,
  closedDate: Date,
  
  // Attachments
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: Date
  }],
  
  // Comments/Replies
  replies: [{
    replyId: String,
    message: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    createdAt: { type: Date, default: Date.now },
    isInternal: Boolean
  }],
  
  // Metadata
  tags: [String],
  
  // Soft Delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
ticketSchema.index({ companyId: 1, status: 1, isDeleted: 1 });
ticketSchema.index({ companyId: 1, assignedTo: 1, status: 1 });
ticketSchema.index({ companyId: 1, clientId: 1 });
ticketSchema.index({ companyId: 1, priority: 1, status: 1 });
ticketSchema.index({ companyId: 1, category: 1 });

// Text search
ticketSchema.index({ subject: 'text', description: 'text' });

export const Ticket = mongoose.model('tickets', ticketSchema);
```

**Status:** ✅ Complete  
**Has REST API:** ✅ Yes (`routes/tickets.js`)  
**Priority:** 🟢 Production ready

---

### 3.3 HRMS SCHEMAS (PARTIAL)

#### 3.3.1 Job/Recruitment Schema ✅ EXISTS

**File:** `models/job.model.js`

```javascript
const jobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  
  // Job Details
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  requirements: [String],
  responsibilities: [String],
  
  // Job Specifications
  department: String,
  location: String,
  employmentType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
    default: 'Full-time'
  },
  experienceLevel: {
    type: String,
    enum: ['Entry', 'Mid', 'Senior', 'Executive'],
    default: 'Mid'
  },
  
  // Compensation
  salary: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'USD' }
  },
  
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Open', 'Closed', 'On Hold'],
    default: 'Draft',
    index: true
  },
  
  // Dates
  postedDate: Date,
  closingDate: Date,
  
  // Hiring Process
  hiringManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Metadata
  tags: [String],
  isRemote: Boolean,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
jobSchema.index({ companyId: 1, status: 1 });
jobSchema.index({ companyId: 1, department: 1 });
jobSchema.index({ companyId: 1, employmentType: 1 });

export const Job = mongoose.model('jobs', jobSchema);
```

**Status:** ✅ Basic structure exists  
**Missing:** 
- Candidate tracking
- Application workflow
- Interview scheduling  
**Priority:** 🔴 HIGH - Needs enhancement

---

### 3.4 PERFORMANCE MANAGEMENT SCHEMAS ✅ EXISTS

#### 3.4.1 Performance Appraisal Schema

**File:** `models/performance/performanceAppraisal.model.js`

```javascript
const performanceAppraisalSchema = new mongoose.Schema({
  appraisalId: {
    type: String,
    required: true,
    unique: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  
  // Review Period
  reviewPeriod: {
    from: Date,
    to: Date
  },
  
  // Ratings
  overallRating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Pending', 'Completed', 'Acknowledged'],
    default: 'Draft',
    index: true
  },
  
  // Reviewers
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

performanceAppraisalSchema.index({ companyId: 1, employeeId: 1 });
performanceAppraisalSchema.index({ companyId: 1, status: 1 });

export const PerformanceAppraisal = mongoose.model('performanceappraisals', performanceAppraisalSchema);
```

**Status:** ✅ Exists  
**Has REST API:** ✅ Yes  
**Priority:** 🟡 Enhancement needed (add detailed criteria)

---

## 4. MISSING CRITICAL SCHEMAS

### 4.1 EMPLOYEE SCHEMA 🔴 CRITICAL - MISSING

**File to create:** `models/employee/employee.schema.js`

```javascript
const employeeSchema = new mongoose.Schema({
  // Primary Keys
  employeeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  clerkUserId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  
  // Personal Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  phone: String,
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'Prefer not to say']
  },
  
  // Address
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  
  // Employment Details
  employeeNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  designation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Designation'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    index: true
  },
  
  // Reporting Structure
  reportsTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // Dates
  dateOfJoining: {
    type: Date,
    required: true,
    index: true
  },
  probationEndDate: Date,
  confirmationDate: Date,
  resignationDate: Date,
  lastWorkingDate: Date,
  
  // Employment Type
  employmentType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Intern'],
    default: 'Full-time',
    index: true
  },
  workLocation: {
    type: String,
    enum: ['Office', 'Remote', 'Hybrid'],
    default: 'Office'
  },
  
  // Salary
  salary: {
    basic: Number,
    hra: Number,
    allowances: Number,
    total: Number,
    currency: { type: String, default: 'USD' },
    effectiveFrom: Date
  },
  
  // Bank Details
  bankDetails: {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    branch: String
  },
  
  // Documents
  documents: [{
    type: {
      type: String,
      enum: ['Resume', 'ID Proof', 'Address Proof', 'Education', 'Experience Letter', 'Other']
    },
    filename: String,
    url: String,
    uploadedAt: Date
  }],
  
  // Emergency Contact
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    email: String
  },
  
  // Status
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'On Leave', 'Terminated', 'Resigned'],
    default: 'Active',
    index: true
  },
  
  // Access Control
  role: {
    type: String,
    enum: ['super-admin', 'admin', 'manager', 'employee', 'hr'],
    default: 'employee',
    index: true
  },
  permissions: [String],
  
  // Metadata
  profilePicture: String,
  bio: String,
  skills: [String],
  
  // Soft Delete
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  
  // Audit Trail
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound Indexes
employeeSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, status: 1, isDeleted: 1 });
employeeSchema.index({ companyId: 1, department: 1, status: 1 });
employeeSchema.index({ companyId: 1, role: 1 });
employeeSchema.index({ companyId: 1, email: 1 }, { unique: true });

// Text search
employeeSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  employeeNumber: 'text'
});

// Virtual: fullName
employeeSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual: age
employeeSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const ageDiff = Date.now() - this.dateOfBirth.getTime();
  const ageDate = new Date(ageDiff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
});

// Virtual: tenure (in months)
employeeSchema.virtual('tenureMonths').get(function() {
  const diff = Date.now() - this.dateOfJoining.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
});

// Middleware: Generate employee number
employeeSchema.pre('save', async function(next) {
  if (!this.employeeNumber) {
    const count = await this.constructor.countDocuments({ companyId: this.companyId });
    this.employeeNumber = `EMP${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

export const Employee = mongoose.model('employees', employeeSchema);
```

**Priority:** 🔴 CRITICAL  
**Deadline:** Create IMMEDIATELY  
**Dependencies:** Department, Designation schemas

---

### 4.2 ATTENDANCE SCHEMA 🔴 CRITICAL - MISSING

**File to create:** `models/attendance/attendance.schema.js`

```javascript
const attendanceSchema = new mongoose.Schema({
  attendanceId: {
    type: String,
    required: true,
    unique: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  
  // Date
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  // Clock In/Out
  clockIn: Date,
  clockInLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  clockOut: Date,
  clockOutLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  
  // Calculated Fields
  workHours: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  breakHours: { type: Number, default: 0 },
  
  // Status
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Half Day', 'On Leave', 'Holiday', 'Weekend', 'Work From Home'],
    default: 'Absent',
    index: true
  },
  
  // Shift
  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift'
  },
  expectedClockIn: Date,
  expectedClockOut: Date,
  
  // Late/Early
  isLate: { type: Boolean, default: false },
  lateBy: { type: Number, default: 0 }, // In minutes
  isEarlyLeave: { type: Boolean, default: false },
  earlyBy: { type: Number, default: 0 }, // In minutes
  
  // Regularization
  isRegularized: { type: Boolean, default: false },
  regularizationReason: String,
  regularizedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  regularizedAt: Date,
  
  // Notes
  notes: String,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound Indexes - CRITICAL for performance
attendanceSchema.index({ companyId: 1, employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ companyId: 1, date: 1, status: 1 });
attendanceSchema.index({ companyId: 1, employeeId: 1, createdAt: -1 });

// Virtual: actualWorkHours
attendanceSchema.virtual('actualWorkHours').get(function() {
  if (!this.clockIn || !this.clockOut) return 0;
  const diff = this.clockOut - this.clockIn;
  return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
});

// Middleware: Calculate work hours
attendanceSchema.pre('save', function(next) {
  if (this.clockIn && this.clockOut) {
    const diff = this.clockOut - this.clockIn;
    this.workHours = Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
    
    // Calculate late/early
    if (this.expectedClockIn && this.clockIn > this.expectedClockIn) {
      this.isLate = true;
      this.lateBy = Math.round((this.clockIn - this.expectedClockIn) / (1000 * 60));
    }
    
    if (this.expectedClockOut && this.clockOut < this.expectedClockOut) {
      this.isEarlyLeave = true;
      this.earlyBy = Math.round((this.expectedClockOut - this.clockOut) / (1000 * 60));
    }
  }
  next();
});

export const Attendance = mongoose.model('attendance', attendanceSchema);
```

**Priority:** 🔴 CRITICAL  
**Deadline:** Week 1  
**REST API:** MUST create immediately

---

### 4.3 LEAVE SCHEMA 🔴 CRITICAL - MISSING

**File to create:** `models/leave/leave.schema.js`

```javascript
const leaveSchema = new mongoose.Schema({
  leaveId: {
    type: String,
    required: true,
    unique: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  
  // Leave Type
  leaveTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveType',
    required: true
  },
  leaveTypeName: String, // Denormalized for quick access
  
  // Duration
  fromDate: {
    type: Date,
    required: true,
    index: true
  },
  toDate: {
    type: Date,
    required: true,
    index: true
  },
  numberOfDays: {
    type: Number,
    required: true
  },
  
  // Half Day
  isHalfDay: { type: Boolean, default: false },
  halfDaySession: {
    type: String,
    enum: ['First Half', 'Second Half']
  },
  
  // Reason
  reason: {
    type: String,
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
    default: 'Pending',
    index: true
  },
  
  // Approval Flow
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  approvedAt: Date,
  rejectedReason: String,
  
  // Cancellation
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  cancelledAt: Date,
  cancellationReason: String,
  
  // Attachments (for medical leaves, etc.)
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: Date
  }],
  
  // Contact During Leave
  contactNumber: String,
  emergencyContact: String,
  
  // Leave Balance Impact
  leaveBalanceBefore: Number,
  leaveBalanceAfter: Number,
  
  // Timestamps
  appliedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound Indexes
leaveSchema.index({ companyId: 1, employeeId: 1, status: 1 });
leaveSchema.index({ companyId: 1, fromDate: 1, toDate: 1 });
leaveSchema.index({ companyId: 1, approvedBy: 1 });
leaveSchema.index({ companyId: 1, leaveTypeId: 1, status: 1 });

// Middleware: Calculate number of days
leaveSchema.pre('save', function(next) {
  if (this.fromDate && this.toDate) {
    const diff = this.toDate - this.fromDate;
    let days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    
    if (this.isHalfDay) {
      days = 0.5;
    }
    
    this.numberOfDays = days;
  }
  next();
});

export const Leave = mongoose.model('leaves', leaveSchema);
```

**Priority:** 🔴 CRITICAL  
**Deadline:** Week 1  
**REST API:** MUST create

---

### 4.4 PAYROLL SCHEMA 🔴 CRITICAL - MISSING

**File to create:** `models/payroll/payroll.schema.js`

```javascript
const payrollSchema = new mongoose.Schema({
  payrollId: {
    type: String,
    required: true,
    unique: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  
  // Period
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true
  },
  
  // Salary Components - Earnings
  earnings: {
    basicSalary: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    conveyanceAllowance: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    incentive: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    arrears: { type: Number, default: 0 }
  },
  
  // Deductions
  deductions: {
    professionalTax: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    providentFund: { type: Number, default: 0 },
    esi: { type: Number, default: 0 },
    loanDeduction: { type: Number, default: 0 },
    advanceDeduction: { type: Number, default: 0 },
    lateDeduction: { type: Number, default: 0 },
    absentDeduction: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 }
  },
  
  // Calculated Totals
  grossSalary: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 },
  
  // Attendance Data
  workingDays: { type: Number, default: 0 },
  presentDays: { type: Number, default: 0 },
  absentDays: { type: Number, default: 0 },
  paidLeaveDays: { type: Number, default: 0 },
  unpaidLeaveDays: { type: Number, default: 0 },
  weekendDays: { type: Number, default: 0 },
  holidayDays: { type: Number, default: 0 },
  
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Generated', 'Approved', 'Paid', 'Rejected', 'Hold'],
    default: 'Draft',
    index: true
  },
  
  // Payment Details
  paymentDate: Date,
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'Cash', 'Cheque', 'UPI']
  },
  transactionId: String,
  paymentReference: String,
  
  // Approval Workflow
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  generatedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  approvedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  rejectedAt: Date,
  rejectionReason: String,
  
  // Documents
  payslipUrl: String,
  
  // Notes
  notes: String,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound Indexes - CRITICAL
payrollSchema.index({ companyId: 1, employeeId: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ companyId: 1, status: 1 });
payrollSchema.index({ companyId: 1, month: 1, year: 1, status: 1 });
payrollSchema.index({ companyId: 1, paymentDate: 1 });

// Middleware: Calculate totals
payrollSchema.pre('save', function(next) {
  // Calculate total earnings
  const earnings = this.earnings;
  this.totalEarnings = Object.values(earnings).reduce((sum, val) => sum + (val || 0), 0);
  this.grossSalary = this.totalEarnings;
  
  // Calculate total deductions
  const deductions = this.deductions;
  this.totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);
  
  // Calculate net salary
  this.netSalary = this.totalEarnings - this.totalDeductions;
  
  next();
});

export const Payroll = mongoose.model('payroll', payrollSchema);
```

**Priority:** 🔴 CRITICAL  
**Deadline:** Week 2  
**Complexity:** HIGH (needs calculation engine)

---

### 4.5 OTHER CRITICAL MISSING SCHEMAS

#### Summary Table

| Schema | Priority | Purpose | Deadline |
|--------|----------|---------|----------|
| **Department** | 🔴 CRITICAL | Organization structure | Week 1 |
| **Designation** | 🔴 CRITICAL | Job roles/titles | Week 1 |
| **LeaveType** | 🔴 CRITICAL | Leave configuration | Week 1 |
| **Shift** | 🔴 CRITICAL | Work shifts | Week 1 |
| **Holiday** | 🟠 HIGH | Holiday calendar | Week 2 |
| **Lead** | 🔴 CRITICAL | CRM leads | Week 2 |
| **Activity** | 🔴 CRITICAL | CRM activity tracking | Week 2 |
| **EmailLog** | 🔴 CRITICAL | Email tracking | Week 3 |
| **CallLog** | 🟠 HIGH | Call tracking | Week 3 |
| **Notification** | 🟠 HIGH | User notifications | Week 3 |
| **AuditLog** | 🟠 HIGH | System audit trail | Week 4 |

---

## 5. RELATIONSHIPS & FOREIGN KEYS

### 5.1 Relationship Diagram

```
Company (Multi-tenant root)
  │
  ├─> Employee
  │     ├─> Department (ref)
  │     ├─> Designation (ref)
  │     ├─> reportsTo: Employee (ref)
  │     ├─> Attendance (1:many)
  │     ├─> Leave (1:many)
  │     ├─> Payroll (1:many)
  │     └─> Performance (1:many)
  │
  ├─> Project
  │     ├─> Client (ref)
  │     ├─> teamMembers: Employee[] (ref)
  │     ├─> Task (1:many)
  │     ├─> ProjectNote (1:many)
  │     └─> Invoice (1:many)
  │
  ├─> Task
  │     ├─> Project (ref)
  │     └─> assignedTo: Employee[] (ref)
  │
  ├─> Client
  │     ├─> accountManager: Employee (ref)
  │     ├─> Project (1:many)
  │     └─> Invoice (1:many)
  │
  ├─> Deal
  │     ├─> Pipeline (ref)
  │     ├─> owner: Employee (ref)
  │     └─> Contact (ref)
  │
  ├─> Ticket
  │     ├─> Client (ref)
  │     ├─> createdBy: Employee (ref)
  │     └─> assignedTo: Employee (ref)
  │
  └─> Leave
        ├─> Employee (ref)
        ├─> LeaveType (ref)
        └─> approvedBy: Employee (ref)
```

### 5.2 Referential Integrity Rules

**Mongoose Cascading (MUST IMPLEMENT):**

```javascript
// When deleting an Employee, soft delete related records
employeeSchema.pre('remove', async function(next) {
  await Attendance.updateMany(
    { employeeId: this._id },
    { isDeleted: true, deletedAt: new Date() }
  );
  
  await Leave.updateMany(
    { employeeId: this._id },
    { isDeleted: true, deletedAt: new Date() }
  );
  
  await Payroll.updateMany(
    { employeeId: this._id },
    { isDeleted: true, deletedAt: new Date() }
  );
  
  next();
});

// When deleting a Project, cascade to Tasks
projectSchema.pre('remove', async function(next) {
  await Task.updateMany(
    { projectId: this.projectId },
    { isDeleted: true, deletedAt: new Date() }
  );
  
  next();
});
```

---

## 6. INDEXES STRATEGY

### 6.1 Index Analysis

**Current State:** ~50% of necessary indexes missing

**Missing Indexes (CRITICAL):**

```javascript
// Employee - CRITICAL MISSING INDEXES
employeeSchema.index({ companyId: 1, department: 1, status: 1 });
employeeSchema.index({ companyId: 1, reportsTo: 1 });

// Attendance - CRITICAL MISSING INDEXES
attendanceSchema.index({ companyId: 1, employeeId: 1, date: 1 }, { unique: true });

// Leave - CRITICAL MISSING INDEXES
leaveSchema.index({ companyId: 1, employeeId: 1, fromDate: 1, toDate: 1 });

// Payroll - CRITICAL MISSING INDEXES
payrollSchema.index({ companyId: 1, month: 1, year: 1, status: 1 });
```

### 6.2 Index Creation Script

**File to create:** `backend/scripts/create-indexes.js`

```javascript
import mongoose from 'mongoose';
import { Project } from '../models/project/project.schema.js';
import { Task } from '../models/task/task.schema.js';
import { Employee } from '../models/employee/employee.schema.js';
import { Attendance } from '../models/attendance/attendance.schema.js';
import { Leave } from '../models/leave/leave.schema.js';
import { Payroll } from '../models/payroll/payroll.schema.js';

async function createIndexes() {
  try {
    console.log('Creating indexes...');
    
    // Employee indexes
    await Employee.createIndexes();
    console.log('✅ Employee indexes created');
    
    // Project indexes
    await Project.createIndexes();
    console.log('✅ Project indexes created');
    
    // Task indexes
    await Task.createIndexes();
    console.log('✅ Task indexes created');
    
    // Attendance indexes
    await Attendance.createIndexes();
    console.log('✅ Attendance indexes created');
    
    // Leave indexes
    await Leave.createIndexes();
    console.log('✅ Leave indexes created');
    
    // Payroll indexes
    await Payroll.createIndexes();
    console.log('✅ Payroll indexes created');
    
    console.log('🎉 All indexes created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  }
}

createIndexes();
```

**Run:** `node backend/scripts/create-indexes.js`

---

## 7. DATA MIGRATION GUIDE

### 7.1 Migration from Clerk to MongoDB Users

**Step 1: Export Clerk Users**

```javascript
// backend/scripts/export-clerk-users.js
import { clerkClient } from '@clerk/clerk-sdk-node';
import fs from 'fs';

async function exportClerkUsers() {
  const users = await clerkClient.users.getUserList();
  
  const mappedUsers = users.map(user => ({
    clerkUserId: user.id,
    email: user.emailAddresses[0].emailAddress,
    firstName: user.firstName,
    lastName: user.lastName,
    companyId: user.publicMetadata.companyId,
    role: user.publicMetadata.role,
    createdAt: new Date(user.createdAt)
  }));
  
  fs.writeFileSync(
    './clerk-users-export.json',
    JSON.stringify(mappedUsers, null, 2)
  );
  
  console.log(`✅ Exported ${mappedUsers.length} users`);
}

exportClerkUsers();
```

**Step 2: Import to MongoDB**

```javascript
// backend/scripts/import-users-to-mongodb.js
import fs from 'fs';
import { Employee } from '../models/employee/employee.schema.js';

async function importUsers() {
  const users = JSON.parse(fs.readFileSync('./clerk-users-export.json'));
  
  for (const user of users) {
    await Employee.create({
      employeeId: `EMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      clerkUserId: user.clerkUserId,
      companyId: user.companyId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: 'Active',
      dateOfJoining: user.createdAt
    });
  }
  
  console.log(`✅ Imported ${users.length} employees`);
}

importUsers();
```

---

## 8. INTEGRATION PATTERNS

### 8.1 Socket.IO to REST API Migration

**Current Problem:** 90% operations use Socket.IO  
**Solution:** Create REST endpoints for all CRUD operations

**Template for REST API Controllers:**

```javascript
// controllers/rest/employee.controller.js
import { Employee } from '../../models/employee/employee.schema.js';

export const employeeController = {
  // GET /api/employees
  async getAll(req, res) {
    try {
      const { companyId } = req.user;
      const employees = await Employee.find({ 
        companyId, 
        isDeleted: false 
      })
      .populate('department', 'name')
      .populate('designation', 'title')
      .sort({ createdAt: -1 });
      
      res.json({ success: true, data: employees });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
  
  // GET /api/employees/:id
  async getById(req, res) {
    try {
      const { companyId } = req.user;
      const { id } = req.params;
      
      const employee = await Employee.findOne({ 
        _id: id, 
        companyId, 
        isDeleted: false 
      })
      .populate('department')
      .populate('designation')
      .populate('reportsTo', 'firstName lastName email');
      
      if (!employee) {
        return res.status(404).json({ 
          success: false, 
          error: 'Employee not found' 
        });
      }
      
      res.json({ success: true, data: employee });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
  
  // POST /api/employees
  async create(req, res) {
    try {
      const { companyId, userId } = req.user;
      const employeeData = {
        ...req.body,
        companyId,
        createdBy: userId
      };
      
      const employee = await Employee.create(employeeData);
      
      res.status(201).json({ success: true, data: employee });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  
  // PUT /api/employees/:id
  async update(req, res) {
    try {
      const { companyId, userId } = req.user;
      const { id } = req.params;
      
      const employee = await Employee.findOneAndUpdate(
        { _id: id, companyId, isDeleted: false },
        { ...req.body, updatedBy: userId, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
      
      if (!employee) {
        return res.status(404).json({ 
          success: false, 
          error: 'Employee not found' 
        });
      }
      
      res.json({ success: true, data: employee });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  
  // DELETE /api/employees/:id (soft delete)
  async delete(req, res) {
    try {
      const { companyId, userId } = req.user;
      const { id } = req.params;
      
      const employee = await Employee.findOneAndUpdate(
        { _id: id, companyId, isDeleted: false },
        { 
          isDeleted: true, 
          deletedAt: new Date(),
          deletedBy: userId
        },
        { new: true }
      );
      
      if (!employee) {
        return res.status(404).json({ 
          success: false, 
          error: 'Employee not found' 
        });
      }
      
      res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
```

**Route Definition:**

```javascript
// routes/api/employees.js
import express from 'express';
import { employeeController } from '../../controllers/rest/employee.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = express.Router();

router.use(requireAuth); // Apply auth to all routes

router.get('/', employeeController.getAll);
router.get('/:id', employeeController.getById);
router.post('/', employeeController.create);
router.put('/:id', employeeController.update);
router.delete('/:id', employeeController.delete);

export default router;
```

---

## 9. QUERY OPTIMIZATION

### 9.1 Common Query Patterns

**Pattern 1: Paginated Employee List**

```javascript
// ❌ BAD: No pagination, loads everything
const employees = await Employee.find({ companyId });

// ✅ GOOD: Paginated with lean()
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 20;
const skip = (page - 1) * limit;

const employees = await Employee
  .find({ companyId, isDeleted: false })
  .select('firstName lastName email department status')
  .populate('department', 'name')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit)
  .lean(); // 🔥 50% faster!

const total = await Employee.countDocuments({ companyId, isDeleted: false });

res.json({
  data: employees,
  pagination: {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit)
  }
});
```

**Pattern 2: Attendance Report (Aggregation)**

```javascript
// ❌ BAD: Multiple queries
const employees = await Employee.find({ companyId });
const attendanceData = [];

for (const emp of employees) {
  const attendance = await Attendance.find({ employeeId: emp._id });
  attendanceData.push({ employee: emp, attendance });
}

// ✅ GOOD: Single aggregation pipeline
const attendanceReport = await Attendance.aggregate([
  { $match: { companyId, date: { $gte: startDate, $lte: endDate } } },
  {
    $group: {
      _id: '$employeeId',
      presentDays: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
      absentDays: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
      totalWorkHours: { $sum: '$workHours' }
    }
  },
  {
    $lookup: {
      from: 'employees',
      localField: '_id',
      foreignField: '_id',
      as: 'employee'
    }
  },
  { $unwind: '$employee' },
  {
    $project: {
      employeeName: { 
        $concat: ['$employee.firstName', ' ', '$employee.lastName'] 
      },
      presentDays: 1,
      absentDays: 1,
      totalWorkHours: 1
    }
  }
]);
```

---

## 10. BACKUP & RECOVERY

### 10.1 Automated Backup Script

**File:** `backend/scripts/backup-mongodb.sh`

```bash
#!/bin/bash

# Configuration
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="/backup/mongodb"
DB_NAME="managertc"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
mongodump \
  --uri="mongodb://localhost:27017/$DB_NAME" \
  --out="$BACKUP_DIR/backup-$DATE" \
  --gzip

# Create compressed archive
tar -czf "$BACKUP_DIR/backup-$DATE.tar.gz" "$BACKUP_DIR/backup-$DATE"

# Remove uncompressed backup
rm -rf "$BACKUP_DIR/backup-$DATE"

# Delete backups older than retention period
find $BACKUP_DIR -name "backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Upload to S3 (optional)
# aws s3 cp "$BACKUP_DIR/backup-$DATE.tar.gz" s3://your-bucket/mongodb-backups/

echo "✅ Backup completed: backup-$DATE.tar.gz"
```

**Cron Job:** Run daily at 2 AM
```bash
0 2 * * * /usr/local/bin/backup-mongodb.sh
```

### 10.2 Recovery Procedure

```bash
# Restore from backup
mongorestore \
  --uri="mongodb://localhost:27017/$DB_NAME" \
  --gzip \
  --archive="/backup/mongodb/backup-2026-01-27.tar.gz" \
  --drop
```

---

## 📊 SUMMARY & NEXT STEPS

### Implementation Priority

| Week | Tasks | Schemas to Create |
|------|-------|-------------------|
| **Week 1** | Critical HRMS schemas | Employee, Attendance, Department, Designation, LeaveType |
| **Week 2** | Leave & Payroll | Leave, Payroll, Shift, Holiday |
| **Week 3** | CRM missing pieces | Lead, Activity, EmailLog, CallLog |
| **Week 4** | Infrastructure | AuditLog, Notification, Migration scripts |

### Critical Actions

1. **🔴 IMMEDIATE:** Create Employee schema
2. **🔴 IMMEDIATE:** Create Attendance schema
3. **🔴 IMMEDIATE:** Create all missing indexes
4. **🟠 Week 1:** Create REST APIs for all modules
5. **🟠 Week 2:** Implement payroll calculation engine
6. **🟡 Week 3:** Set up automated backups
7. **🟡 Week 4:** Complete data migration scripts

---

**Document End**

*This database schema guide should serve as the single source of truth for all database-related decisions in the manageRTC platform.*
