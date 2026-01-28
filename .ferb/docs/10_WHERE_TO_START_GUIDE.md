# 🚀 WHERE TO START - STEP-BY-STEP GUIDE
## manageRTC Platform - Your First 30 Days

**Document Version:** 1.0  
**Date:** January 27, 2026  
**Platform:** manageRTC (MERN Stack)  
**Purpose:** Exact starting point and order of operations

---

## 📋 TABLE OF CONTENTS

1. [Pre-Start Checklist](#1-pre-start-checklist)
2. [Day 1: Setup & Orientation](#2-day-1-setup--orientation)
3. [Week 1: Foundation](#3-week-1-foundation)
4. [Week 2: Core Schemas](#4-week-2-core-schemas)
5. [Week 3: REST APIs](#5-week-3-rest-apis)
6. [Week 4: Testing & Polish](#6-week-4-testing--polish)
7. [Quick Reference Commands](#7-quick-reference-commands)

---

## 1. PRE-START CHECKLIST

### 1.1 Required Reading (Do This First!)

**MUST READ - In This Order:**

```
Day -1 (Before Starting):
├─ 00_MASTER_INDEX.md                    [20 min] - Overview
├─ 01_BRUTAL_VALIDATION_REPORT.md        [30 min] - Current state
└─ 06_IMPLEMENTATION_PLAN_PART1.md       [1 hour] - Database schemas

Day 0 (First Day Morning):
├─ 09_SOCKETIO_VS_REST_GUIDE.md          [45 min] - Architecture
├─ 08_DB_SCHEMA_INTEGRATION_GUIDE.md     [2 hours] - Schema reference
└─ 04_COMPREHENSIVE_TODO_LIST.md         [30 min] - Tasks

Total Reading: ~5 hours
```

**Why This Order:**
1. Master Index → Understand what you have
2. Brutal Report → Understand current problems
3. Implementation Plan → Know the target
4. Socket/REST Guide → Understand architecture
5. Schema Guide → Reference for implementation
6. TODO List → Daily tasks

---

### 1.2 Team Assembly

**Required Team (Minimum):**

```
✅ 1 Full-stack Developer (Backend focus)
✅ 1 Full-stack Developer (Frontend focus)
✅ 1 QA Engineer (Part-time initially)
✅ 1 Technical Lead (Part-time oversight)
```

**Optional but Helpful:**
- DevOps Engineer (25% time)
- Product Owner (25% time)
- UI/UX Designer (25% time)

---

### 1.3 Environment Setup

**Before Day 1:**

```bash
# 1. Install Node.js 20 LTS
node --version  # Should be v20.x.x

# 2. Install MongoDB 6.13
mongod --version  # Should be v6.13.x

# 3. Install Git
git --version

# 4. Install VS Code
code --version

# 5. Clone repository
git clone https://github.com/amasQIS-ai/manageRTC.git
cd manageRTC

# 6. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 7. Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# 8. Start local MongoDB
mongod --dbpath ~/data/db

# 9. Test the build
cd backend && npm start
cd frontend && npm start
```

---

## 2. DAY 1: SETUP & ORIENTATION

### Morning (9 AM - 12 PM)

#### Hour 1: Repository Analysis

```bash
# 1. Explore the codebase structure
tree -L 2 backend/
tree -L 2 frontend/src/

# 2. Count files
find backend -name "*.js" | wc -l    # ~175 files
find frontend -name "*.tsx" | wc -l  # ~633 files

# 3. Identify key files
backend/
├── server.js                  # Entry point
├── socket/router.js           # Socket.IO routing ❌ PROBLEM
├── controllers/               # 54 controllers (mostly socket)
├── models/                    # 21 model files
└── routes/                    # Only 6 route files ❌ PROBLEM

# 4. Run the application
npm start  # Backend on port 5000
npm start  # Frontend on port 3000
```

**Action Items:**
- [ ] Clone repository
- [ ] Install dependencies
- [ ] Run local build successfully
- [ ] Document any errors encountered

---

#### Hour 2-3: Document Review

**Read in detail:**

1. **01_BRUTAL_VALIDATION_REPORT.md** (30 min)
   - Focus on: Critical Issues (pages 3-8)
   - Note: Over-reliance on Socket.IO
   - Note: Missing features list

2. **09_SOCKETIO_VS_REST_GUIDE.md** (45 min)
   - Focus on: Current vs Target Architecture
   - Focus on: Module-by-Module Breakdown
   - Note: Which modules need REST APIs

3. **08_DB_SCHEMA_INTEGRATION_GUIDE.md** (45 min)
   - Focus on: Missing Critical Schemas
   - Note: Employee, Attendance, Leave, Payroll

---

### Afternoon (1 PM - 5 PM)

#### Hour 4: Team Kickoff Meeting

**Agenda:**
1. Present current state (use Brutal Report)
2. Review 16-week timeline
3. Discuss budget ($177k)
4. Assign initial roles
5. Set up daily standups (9:30 AM daily)
6. Set up Slack channel: #managertc-dev

**Decisions Needed:**
- [ ] Go/No-Go decision
- [ ] Budget approval
- [ ] Team commitment
- [ ] Timeline acceptance

---

#### Hour 5-7: Development Environment

```bash
# 1. Set up development database
mongosh
> use managertc_dev
> db.createUser({
    user: "managertc_dev",
    pwd: "dev_password",
    roles: ["readWrite"]
  })

# 2. Update .env
MONGODB_URI=mongodb://managertc_dev:dev_password@localhost:27017/managertc_dev

# 3. Set up Git branches
git checkout -b feature/rest-api-foundation
git checkout -b feature/employee-schema
git checkout -b feature/attendance-schema

# 4. Install development tools
npm install -D eslint prettier husky jest supertest

# 5. Set up ESLint
npx eslint --init

# 6. Set up Prettier
echo '{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}' > .prettierrc

# 7. Test everything works
npm test  # Should show "no tests found"
npm run lint  # Should run ESLint
```

**End of Day 1 Checklist:**
- [ ] Repository cloned and running
- [ ] Documentation read
- [ ] Team meeting completed
- [ ] Dev environment set up
- [ ] Git branches created
- [ ] Ready to code tomorrow

---

## 3. WEEK 1: FOUNDATION

### Day 2: Employee Schema (CRITICAL)

**Priority:** 🔴 CRITICAL - This blocks everything else

**Morning (9 AM - 12 PM): Create Schema**

```bash
# 1. Create directory structure
mkdir -p backend/models/employee

# 2. Create schema file
touch backend/models/employee/employee.schema.js

# 3. Implement schema (copy from 08_DB_SCHEMA_INTEGRATION_GUIDE.md)
```

**Employee Schema Implementation:**

```javascript
// File: backend/models/employee/employee.schema.js
import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  // Copy complete schema from 08_DB_SCHEMA_INTEGRATION_GUIDE.md
  // Section 4.1: Employee Schema
  
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
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    required: true, 
    lowercase: true,
    trim: true,
    index: true 
  },
  
  // ... (copy rest from guide)
}, { timestamps: true });

// Add indexes
employeeSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, status: 1, isDeleted: 1 });

// Add virtuals
employeeSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

export const Employee = mongoose.model('employees', employeeSchema);
```

**Afternoon (1 PM - 5 PM): Test Schema**

```bash
# 1. Create test file
touch backend/tests/schemas/employee.test.js

# 2. Write tests
# 3. Test schema creation
# 4. Test validations
# 5. Test indexes
```

**Day 2 Deliverables:**
- [ ] Employee schema created
- [ ] All indexes defined
- [ ] Validation rules working
- [ ] Tests passing
- [ ] Committed to Git

---

### Day 3: Department & Designation Schemas

**Morning: Department Schema**

```javascript
// File: backend/models/organization/department.schema.js
const departmentSchema = new mongoose.Schema({
  departmentId: {
    type: String,
    required: true,
    unique: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  headOfDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

departmentSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const Department = mongoose.model('departments', departmentSchema);
```

**Afternoon: Designation Schema**

```javascript
// File: backend/models/organization/designation.schema.js
const designationSchema = new mongoose.Schema({
  designationId: {
    type: String,
    required: true,
    unique: true
  },
  companyId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  level: {
    type: String,
    enum: ['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'VP', 'C-Level'],
    default: 'Mid'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

designationSchema.index({ companyId: 1, title: 1 }, { unique: true });

export const Designation = mongoose.model('designations', designationSchema);
```

**Day 3 Deliverables:**
- [ ] Department schema created
- [ ] Designation schema created
- [ ] Relationships defined
- [ ] Tests passing

---

### Day 4: Attendance Schema (CRITICAL)

**Full Day: Attendance Implementation**

```javascript
// File: backend/models/attendance/attendance.schema.js
// Copy complete schema from 08_DB_SCHEMA_INTEGRATION_GUIDE.md
// Section 4.2: Attendance Schema

const attendanceSchema = new mongoose.Schema({
  attendanceId: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  date: { type: Date, required: true, index: true },
  clockIn: Date,
  clockOut: Date,
  workHours: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Half Day', 'On Leave', 'Holiday'],
    default: 'Absent',
    index: true
  },
  // ... (copy rest from guide)
}, { timestamps: true });

// CRITICAL: Compound index
attendanceSchema.index({ companyId: 1, employeeId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model('attendance', attendanceSchema);
```

**Day 4 Deliverables:**
- [ ] Attendance schema complete
- [ ] Compound index working
- [ ] Auto-calculation middleware
- [ ] Tests passing

---

### Day 5: Leave & LeaveType Schemas

**Morning: LeaveType Schema**

```javascript
// File: backend/models/leave/leaveType.schema.js
const leaveTypeSchema = new mongoose.Schema({
  leaveTypeId: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  annualQuota: { type: Number, default: 0 },
  isPaid: { type: Boolean, default: true },
  requiresApproval: { type: Boolean, default: true },
  // ... (copy from guide)
}, { timestamps: true });

export const LeaveType = mongoose.model('leavetypes', leaveTypeSchema);
```

**Afternoon: Leave Schema**

```javascript
// File: backend/models/leave/leave.schema.js
// Copy complete schema from 08_DB_SCHEMA_INTEGRATION_GUIDE.md
// Section 4.3: Leave Schema
```

**Day 5 Deliverables:**
- [ ] LeaveType schema complete
- [ ] Leave schema complete
- [ ] Approval workflow ready
- [ ] Tests passing

---

### Week 1 Summary

**What You've Built:**
```
✅ Employee schema (with all fields)
✅ Department schema
✅ Designation schema
✅ Attendance schema (with calculations)
✅ Leave schema
✅ LeaveType schema

Total: 6 critical schemas
Lines of code: ~1,500
Tests: ~50 test cases
```

**Checklist:**
- [ ] All schemas created
- [ ] All indexes defined
- [ ] Relationships working
- [ ] Validations working
- [ ] Tests passing (>80% coverage)
- [ ] Code reviewed
- [ ] Committed to Git

---

## 4. WEEK 2: CORE SCHEMAS

### Day 6-7: Payroll Schema

**2 Full Days** (Complex schema with calculations)

```javascript
// File: backend/models/payroll/payroll.schema.js
// Copy from 08_DB_SCHEMA_INTEGRATION_GUIDE.md
// Section 4.4: Payroll Schema

// This includes:
- Salary components (earnings)
- Deductions
- Tax calculations
- Auto-calculation middleware
```

---

### Day 8: Shift & Holiday Schemas

**Morning: Shift Schema**

```javascript
const shiftSchema = new mongoose.Schema({
  shiftId: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  startTime: { type: String, required: true },  // "09:00"
  endTime: { type: String, required: true },    // "18:00"
  workingDays: [{
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  }],
  breakDuration: { type: Number, default: 60 }, // minutes
}, { timestamps: true });
```

**Afternoon: Holiday Schema**

```javascript
const holidaySchema = new mongoose.Schema({
  holidayId: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  date: { type: Date, required: true },
  isOptional: { type: Boolean, default: false },
}, { timestamps: true });
```

---

### Day 9-10: Index Creation & Optimization

**Full Focus: Performance**

```bash
# 1. Create index creation script
touch backend/scripts/create-indexes.js

# 2. Implement (copy from 08_DB_SCHEMA_INTEGRATION_GUIDE.md)
# Section 6: Indexes Strategy

# 3. Run script
node backend/scripts/create-indexes.js

# 4. Verify indexes
mongosh
> use managertc_dev
> db.employees.getIndexes()
> db.attendance.getIndexes()
> db.leaves.getIndexes()

# 5. Test query performance
# Run explain() on common queries
```

**Week 2 Summary:**
```
✅ Payroll schema (complex)
✅ Shift schema
✅ Holiday schema
✅ All indexes created
✅ Performance optimized

Total schemas: 9
Total indexes: 50+
```

---

## 5. WEEK 3: REST APIs

### Day 11-12: Employee REST API

**Priority:** 🔴 CRITICAL

**Day 11 Morning: Setup REST Structure**

```bash
# 1. Create directory structure
mkdir -p backend/routes/api
mkdir -p backend/controllers/rest
mkdir -p backend/middleware

# 2. Create files
touch backend/routes/api/employees.js
touch backend/controllers/rest/employee.controller.js
touch backend/middleware/auth.js
touch backend/middleware/validate.js
```

**Day 11 Afternoon: Implement CRUD**

```javascript
// File: backend/controllers/rest/employee.controller.js
// Copy template from 09_SOCKETIO_VS_REST_GUIDE.md
// Section 7.1: REST API Controller Template

export const employeeController = {
  async getAll(req, res) { /* ... */ },
  async getById(req, res) { /* ... */ },
  async create(req, res) { /* ... */ },
  async update(req, res) { /* ... */ },
  async delete(req, res) { /* ... */ }
};
```

**Day 12: Testing & Frontend Integration**

```bash
# 1. Create Postman collection
# 2. Test all endpoints
# 3. Update frontend to use REST instead of Socket
# 4. Test end-to-end
```

---

### Day 13: Attendance REST API

```javascript
// File: backend/routes/api/attendance.js
GET    /api/attendance
POST   /api/attendance/clock-in
PUT    /api/attendance/:id/clock-out
POST   /api/attendance/:id/regularize
GET    /api/attendance/reports
```

---

### Day 14: Leave REST API

```javascript
// File: backend/routes/api/leaves.js
GET    /api/leaves
POST   /api/leaves
PUT    /api/leaves/:id
POST   /api/leaves/:id/approve
POST   /api/leaves/:id/reject
GET    /api/leaves/balance/:employeeId
```

---

### Day 15: Projects & Tasks REST API

**High Impact Day**

```javascript
// File: backend/routes/api/projects.js
// File: backend/routes/api/tasks.js

// Migrate from Socket.IO to REST
// Keep Socket.IO for kanban drag & drop only
```

---

### Week 3 Summary

```
✅ Employee REST API (5 endpoints)
✅ Attendance REST API (5 endpoints)
✅ Leave REST API (6 endpoints)
✅ Projects REST API (5 endpoints)
✅ Tasks REST API (5 endpoints)

Total: 26 new REST endpoints
Postman collection: 26 requests
Frontend migrated: 50%
```

---

## 6. WEEK 4: TESTING & POLISH

### Day 16-17: Unit Tests

```bash
# Install Jest
npm install -D jest supertest

# Create tests for all schemas
touch tests/schemas/employee.test.js
touch tests/schemas/attendance.test.js
touch tests/schemas/leave.test.js

# Create tests for all APIs
touch tests/api/employees.test.js
touch tests/api/attendance.test.js
touch tests/api/leaves.test.js

# Run tests
npm test

# Aim for 80% coverage
npm run test:coverage
```

---

### Day 18: Integration Tests

```javascript
// tests/integration/employee-flow.test.js
describe('Employee Flow', () => {
  test('Create employee → Clock in → Apply leave', async () => {
    // 1. Create employee
    const employee = await createEmployee();
    
    // 2. Clock in
    const attendance = await clockIn(employee.id);
    
    // 3. Apply leave
    const leave = await applyLeave(employee.id);
    
    // 4. Verify leave balance
    expect(leave.status).toBe('Pending');
  });
});
```

---

### Day 19: CI/CD Setup

```bash
# 1. Create GitHub Actions workflow
mkdir -p .github/workflows
touch .github/workflows/ci.yml

# 2. Configure CI
# - Run tests on PR
# - Check code quality
# - Run linting
# - Build verification

# 3. Test CI pipeline
git push origin feature/rest-api-foundation
```

---

### Day 20: Documentation & Review

```bash
# 1. Generate API documentation
npm install -D swagger-jsdoc swagger-ui-express

# 2. Add Swagger comments to endpoints

# 3. Generate docs
npm run docs

# 4. Review with team

# 5. Plan Week 5
```

---

## 7. QUICK REFERENCE COMMANDS

### Daily Commands

```bash
# Start development
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Check database
mongosh
> use managertc_dev
> show collections
> db.employees.countDocuments()

# Git workflow
git checkout -b feature/your-feature
git add .
git commit -m "feat: your feature"
git push origin feature/your-feature
```

---

### Useful Queries

```javascript
// Count all documents
db.employees.countDocuments({ companyId: 'your-company' })

// Find with filters
db.employees.find({ 
  companyId: 'your-company',
  status: 'Active',
  isDeleted: false 
})

// Check indexes
db.employees.getIndexes()

// Explain query performance
db.employees.find({ email: 'test@example.com' }).explain('executionStats')
```

---

## 8. SUCCESS METRICS

### Week 1 Goals
- [ ] 6 schemas created
- [ ] All indexes defined
- [ ] 50+ tests passing
- [ ] 80% test coverage

### Week 2 Goals
- [ ] Payroll schema complete
- [ ] All indexes optimized
- [ ] Query performance <50ms

### Week 3 Goals
- [ ] 26 REST endpoints live
- [ ] Postman collection complete
- [ ] 50% frontend migrated

### Week 4 Goals
- [ ] 80% test coverage
- [ ] CI/CD pipeline working
- [ ] API documentation complete

---

## 9. TROUBLESHOOTING

### Common Issues

**Issue 1: MongoDB Connection Error**
```bash
# Solution: Check if MongoDB is running
ps aux | grep mongod

# If not, start it
mongod --dbpath ~/data/db
```

**Issue 2: Port Already in Use**
```bash
# Solution: Kill process on port
lsof -ti:5000 | xargs kill -9
```

**Issue 3: Module Not Found**
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## 10. FINAL CHECKLIST

**Before Moving to Month 2:**

- [ ] All Week 1-4 schemas created
- [ ] All Week 1-4 REST APIs implemented
- [ ] Test coverage >80%
- [ ] CI/CD pipeline operational
- [ ] API documentation complete
- [ ] Team trained on new architecture
- [ ] No critical bugs
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Stakeholder demo completed

---

**YOU ARE NOW READY TO START!**

**First Action:** Read 00_MASTER_INDEX.md  
**Second Action:** Read this document again  
**Third Action:** Start Day 1 tomorrow morning 9 AM

Good luck! 🚀

---

**END OF GUIDE**
