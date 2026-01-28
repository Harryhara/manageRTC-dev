# 🤖 CLAUDE CODE PROMPT
## Complete Development Instructions for manageRTC Platform

---

## 📋 PROJECT OVERVIEW

You are tasked with developing **manageRTC**, a comprehensive MERN stack platform combining HRMS, Project Management, and CRM functionality. The platform is currently **45% complete** and requires significant development to reach production-ready state (**95% target**).

**Repository:** https://github.com/amasQIS-ai/manageRTC  
**Current State:** 45% complete, 10 critical issues, 0% test coverage  
**Target State:** 95% complete, production-ready in 16 weeks  
**Tech Stack:** React 18, Node.js, Express 5, MongoDB 6.13, Socket.IO, Clerk

---

## 📚 DOCUMENTATION REFERENCE

You have access to comprehensive documentation (283 pages). **Read these files in order:**

### Phase 0: Understanding (MUST READ FIRST)

1. **00_MASTER_INDEX.md**
   - Complete overview of all documentation
   - Navigation guide for 283 pages
   - Quick reference summaries
   - **READ THIS FIRST!**

2. **01_BRUTAL_VALIDATION_REPORT.md**
   - Current state analysis (Score: 4.5/10)
   - 10 critical issues identified
   - Architecture violations
   - Technical debt: 3-4 months
   - **Understand the problems**

3. **09_SOCKETIO_VS_REST_GUIDE.md**
   - Current architecture: 90% Socket.IO (WRONG)
   - Target architecture: 80% REST, 20% Socket.IO (CORRECT)
   - Module-by-module breakdown
   - Migration strategy
   - **Critical for architecture decisions**

4. **10_WHERE_TO_START_GUIDE.md**
   - Day-by-day implementation guide
   - First 30 days detailed
   - Exact starting point
   - **Your roadmap for first month**

---

### Phase 1: Database Foundation

5. **08_DB_SCHEMA_INTEGRATION_GUIDE.md** (53 pages)
   - Complete database schema reference
   - 10+ schemas with full code
   - Missing critical schemas (Employee, Attendance, Leave, Payroll)
   - Index strategies
   - Migration patterns
   - **Use this as schema reference**

---

### Phase 2: Implementation Planning

6. **06_IMPLEMENTATION_PLAN_PART1.md**
   - Database schemas and design principles
   - Multi-tenancy patterns
   - Soft delete implementation

7. **06_IMPLEMENTATION_PLAN_PART2.md**
   - Complete feature matrix (150+ features)
   - Implementation phases (4 phases, 16 weeks)
   - Technical architecture
   - API design patterns

8. **06_IMPLEMENTATION_PLAN_PART3.md**
   - Detailed milestones and timeline
   - Resource requirements
   - Risk management
   - Success metrics

---

### Supporting Documentation

9. **02_COMPLETION_STATUS_REPORT.md**
   - Feature-by-feature status
   - What's complete vs pending
   - Organized by module

10. **03_ISSUES_BUGS_ERRORS_REPORT.md**
    - All bugs and errors cataloged
    - Prioritized by severity

11. **04_COMPREHENSIVE_TODO_LIST.md**
    - 200+ actionable tasks
    - Organized by priority

12. **05_INTEGRATION_ISSUES_REPORT.md**
    - What's not properly wired
    - Frontend-backend disconnects

13. **07_PAID_SERVICES_ANALYSIS.md**
    - Cost optimization opportunities
    - Free alternatives
    - Save $1,200-5,500/year

---

## 🎯 YOUR MISSION

### Phase 0: Week 1 - Database Foundation (CURRENT PHASE)

**Objective:** Create all critical database schemas with proper validation, indexes, and relationships.

#### Day 1-2: Employee Schema (HIGHEST PRIORITY)

**File to create:** `backend/models/employee/employee.schema.js`

**Instructions:**
1. Reference `08_DB_SCHEMA_INTEGRATION_GUIDE.md` Section 4.1
2. Copy the complete Employee schema code
3. Ensure all fields are included:
   - Primary keys (employeeId, clerkUserId, companyId)
   - Personal information (firstName, lastName, email, phone, etc.)
   - Employment details (designation, department, dateOfJoining)
   - Salary information
   - Bank details
   - Documents array
   - Emergency contact
   - Status and role fields

**Critical Requirements:**
```javascript
// MUST include these indexes
employeeSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, status: 1, isDeleted: 1 });
employeeSchema.index({ companyId: 1, department: 1, status: 1 });
employeeSchema.index({ companyId: 1, email: 1 }, { unique: true });

// MUST include text search index
employeeSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  employeeNumber: 'text'
});

// MUST include virtuals
employeeSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

employeeSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const ageDiff = Date.now() - this.dateOfBirth.getTime();
  const ageDate = new Date(ageDiff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
});

// MUST include pre-save middleware for employee number
employeeSchema.pre('save', async function(next) {
  if (!this.employeeNumber) {
    const count = await this.constructor.countDocuments({ companyId: this.companyId });
    this.employeeNumber = `EMP${String(count + 1).padStart(5, '0')}`;
  }
  next();
});
```

**Testing:**
```javascript
// Create test file: tests/schemas/employee.test.js
describe('Employee Schema', () => {
  test('should create employee with auto-generated employeeNumber', async () => {
    const employee = await Employee.create({
      clerkUserId: 'user_123',
      companyId: 'comp_123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      dateOfJoining: new Date()
    });
    
    expect(employee.employeeNumber).toMatch(/^EMP\d{5}$/);
    expect(employee.fullName).toBe('John Doe');
  });
});
```

---

#### Day 3: Department & Designation Schemas

**Files to create:**
- `backend/models/organization/department.schema.js`
- `backend/models/organization/designation.schema.js`

**Reference:** `08_DB_SCHEMA_INTEGRATION_GUIDE.md` Section 4.1

**Department Schema Requirements:**
```javascript
const departmentSchema = new mongoose.Schema({
  departmentId: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: String,
  headOfDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// MUST include compound index
departmentSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const Department = mongoose.model('departments', departmentSchema);
```

**Designation Schema Requirements:**
```javascript
const designationSchema = new mongoose.Schema({
  designationId: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  level: {
    type: String,
    enum: ['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'VP', 'C-Level'],
    default: 'Mid'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  description: String,
  responsibilities: [String],
  requiredSkills: [String],
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// MUST include compound index
designationSchema.index({ companyId: 1, title: 1 }, { unique: true });

export const Designation = mongoose.model('designations', designationSchema);
```

---

#### Day 4: Attendance Schema (CRITICAL)

**File to create:** `backend/models/attendance/attendance.schema.js`

**Reference:** `08_DB_SCHEMA_INTEGRATION_GUIDE.md` Section 4.2

**Critical Requirements:**
```javascript
// MUST include compound unique index
attendanceSchema.index({ companyId: 1, employeeId: 1, date: 1 }, { unique: true });

// MUST include auto-calculation middleware
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
```

---

#### Day 5: Leave & LeaveType Schemas

**Files to create:**
- `backend/models/leave/leaveType.schema.js`
- `backend/models/leave/leave.schema.js`

**Reference:** `08_DB_SCHEMA_INTEGRATION_GUIDE.md` Section 4.3

**Leave Schema Critical Middleware:**
```javascript
// MUST calculate number of days automatically
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
```

---

### Week 1 Success Criteria

**By end of Week 1, you MUST have:**
- [ ] Employee schema created and tested
- [ ] Department schema created and tested
- [ ] Designation schema created and tested
- [ ] Attendance schema created and tested
- [ ] Leave schema created and tested
- [ ] LeaveType schema created and tested
- [ ] All indexes created (50+ indexes)
- [ ] All relationships working
- [ ] All validations working
- [ ] Test coverage >80%
- [ ] All committed to Git

**Verification Commands:**
```bash
# Count schemas
ls backend/models/**/*.schema.js | wc -l  # Should be 6

# Check MongoDB
mongosh
> use managertc_dev
> show collections  # Should show 6 new collections
> db.employees.getIndexes()  # Should show all indexes

# Run tests
npm test  # Should show >50 tests passing

# Check coverage
npm run test:coverage  # Should show >80%
```

---

## 🔧 DEVELOPMENT GUIDELINES

### Code Quality Standards

**1. Always use async/await (never callbacks)**
```javascript
// ✅ GOOD
async function createEmployee(data) {
  const employee = await Employee.create(data);
  return employee;
}

// ❌ BAD
function createEmployee(data, callback) {
  Employee.create(data, callback);
}
```

**2. Always handle errors properly**
```javascript
// ✅ GOOD
try {
  const employee = await Employee.create(data);
  res.json({ success: true, data: employee });
} catch (error) {
  console.error('Error creating employee:', error);
  res.status(400).json({ 
    success: false, 
    error: error.message 
  });
}

// ❌ BAD
const employee = await Employee.create(data);
res.json({ success: true, data: employee });
```

**3. Always filter by companyId (multi-tenancy)**
```javascript
// ✅ GOOD
const employees = await Employee.find({ 
  companyId, 
  isDeleted: false 
});

// ❌ BAD
const employees = await Employee.find();
```

**4. Always use soft deletes**
```javascript
// ✅ GOOD
await Employee.findByIdAndUpdate(id, { 
  isDeleted: true, 
  deletedAt: new Date() 
});

// ❌ BAD
await Employee.findByIdAndDelete(id);
```

**5. Always add indexes for query fields**
```javascript
// If you query by field, it MUST have an index
employeeSchema.index({ companyId: 1, status: 1 });
employeeSchema.index({ companyId: 1, department: 1 });
```

---

### Testing Requirements

**Every schema MUST have tests:**

```javascript
// tests/schemas/employee.test.js
describe('Employee Schema', () => {
  describe('Creation', () => {
    test('should create employee with required fields', async () => {
      const employee = await Employee.create({
        clerkUserId: 'user_123',
        companyId: 'comp_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        dateOfJoining: new Date()
      });
      
      expect(employee._id).toBeDefined();
      expect(employee.employeeNumber).toBeDefined();
    });
    
    test('should fail without required fields', async () => {
      await expect(Employee.create({})).rejects.toThrow();
    });
    
    test('should generate unique employee number', async () => {
      const emp1 = await Employee.create({ /* ... */ });
      const emp2 = await Employee.create({ /* ... */ });
      
      expect(emp1.employeeNumber).not.toBe(emp2.employeeNumber);
    });
  });
  
  describe('Validations', () => {
    test('should validate email format', async () => {
      await expect(Employee.create({
        clerkUserId: 'user_123',
        companyId: 'comp_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        dateOfJoining: new Date()
      })).rejects.toThrow();
    });
    
    test('should not allow duplicate email in same company', async () => {
      await Employee.create({ /* ... */ email: 'john@example.com' });
      
      await expect(Employee.create({ 
        /* ... */ 
        email: 'john@example.com' 
      })).rejects.toThrow();
    });
  });
  
  describe('Indexes', () => {
    test('should have required indexes', async () => {
      const indexes = await Employee.collection.getIndexes();
      
      expect(indexes).toHaveProperty('companyId_1_employeeId_1');
      expect(indexes).toHaveProperty('companyId_1_email_1');
    });
  });
  
  describe('Virtuals', () => {
    test('should return fullName', async () => {
      const employee = await Employee.create({ 
        firstName: 'John', 
        lastName: 'Doe',
        /* ... */
      });
      
      expect(employee.fullName).toBe('John Doe');
    });
    
    test('should calculate age from dateOfBirth', async () => {
      const employee = await Employee.create({
        dateOfBirth: new Date('1990-01-01'),
        /* ... */
      });
      
      expect(employee.age).toBeGreaterThan(30);
    });
  });
  
  describe('Middleware', () => {
    test('should auto-generate employee number', async () => {
      const employee = await Employee.create({ /* ... */ });
      
      expect(employee.employeeNumber).toMatch(/^EMP\d{5}$/);
    });
    
    test('should update updatedAt on save', async () => {
      const employee = await Employee.create({ /* ... */ });
      const oldUpdatedAt = employee.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      employee.firstName = 'Jane';
      await employee.save();
      
      expect(employee.updatedAt).not.toEqual(oldUpdatedAt);
    });
  });
});
```

---

## 📝 RESPONSE FORMAT

When completing tasks, structure your response like this:

```markdown
## Task: [Task Name]

### Analysis
[Brief analysis of what needs to be done]

### Implementation

#### File: backend/models/employee/employee.schema.js
```javascript
[Complete code]
```

#### File: tests/schemas/employee.test.js
```javascript
[Complete test code]
```

### Verification
[Commands to verify the implementation works]

### Next Steps
[What should be done next]
```

---

## ⚠️ CRITICAL WARNINGS

**DO NOT:**
- ❌ Use callbacks (always use async/await)
- ❌ Skip error handling
- ❌ Forget companyId filtering (multi-tenancy)
- ❌ Use hard deletes (always soft delete)
- ❌ Skip writing tests
- ❌ Create schemas without indexes
- ❌ Use Socket.IO for CRUD operations
- ❌ Copy code without understanding it

**ALWAYS:**
- ✅ Read the documentation first
- ✅ Follow the implementation guide
- ✅ Write tests for everything
- ✅ Add proper indexes
- ✅ Use TypeScript types where possible
- ✅ Handle errors gracefully
- ✅ Validate input data
- ✅ Document your code

---

## 🎯 SUCCESS METRICS

**Week 1 Goals:**
- 6 schemas created
- 50+ tests passing
- >80% test coverage
- All indexes working
- All relationships working

**Week 2 Goals:**
- Payroll schema complete
- 9 total schemas
- 100+ tests passing
- Performance optimized

**Week 3 Goals:**
- 26 REST endpoints live
- API documentation complete
- 50% frontend migrated

---

## 📞 SUPPORT

**When you need clarification:**
1. First, check the relevant .md file
2. Look for code examples in the documentation
3. Check the troubleshooting section
4. Ask specific questions with context

**Documentation Priority:**
1. Always reference `08_DB_SCHEMA_INTEGRATION_GUIDE.md` for schemas
2. Always reference `09_SOCKETIO_VS_REST_GUIDE.md` for architecture
3. Always reference `10_WHERE_TO_START_GUIDE.md` for order of operations

---

## 🚀 START NOW

**Your immediate task:**

1. Read `00_MASTER_INDEX.md` (20 minutes)
2. Read `10_WHERE_TO_START_GUIDE.md` (30 minutes)
3. Read `08_DB_SCHEMA_INTEGRATION_GUIDE.md` Section 4.1 (20 minutes)
4. Create `backend/models/employee/employee.schema.js`
5. Create `tests/schemas/employee.test.js`
6. Run tests and verify everything works

**Begin with Employee Schema creation. This is the foundation for everything else.**

Good luck! 🎯
