# 🤖 CODEX PROMPT
## Complete Code Generation Instructions for manageRTC Platform

---

## 🎯 MISSION BRIEF

Generate production-ready code for **manageRTC**, a MERN stack platform combining HRMS, Project Management, and CRM. Current completion: 45%. Target: 95% in 16 weeks.

**Tech Stack:**
- Frontend: React 18.3, TypeScript, Redux Toolkit, Ant Design
- Backend: Node.js, Express 5, MongoDB 6.13, Mongoose 8.9
- Auth: Clerk or NextAuth.js
- Real-time: Socket.IO 4.8

---

## 📚 DOCUMENTATION ACCESS

You have 283 pages of comprehensive documentation. **Priority reading order:**

### Must Read First (1 hour)
1. `00_MASTER_INDEX.md` - Overview
2. `10_WHERE_TO_START_GUIDE.md` - Day-by-day roadmap
3. `09_SOCKETIO_VS_REST_GUIDE.md` - Architecture decisions

### Primary Reference (as needed)
4. `08_DB_SCHEMA_INTEGRATION_GUIDE.md` - All schemas with code
5. `06_IMPLEMENTATION_PLAN_PART2.md` - Feature matrix
6. `03_ISSUES_BUGS_ERRORS_REPORT.md` - What to avoid

---

## 🚀 PHASE 0: WEEK 1 - DATABASE SCHEMAS

### Day 1-2: Employee Schema

**Generate:** `backend/models/employee/employee.schema.js`

**Requirements:**
```javascript
import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  // PRIMARY KEYS
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
  
  // PERSONAL INFO
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    required: true, 
    lowercase: true,
    trim: true,
    index: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  phone: { 
    type: String, 
    trim: true,
    match: /^\+?[1-9]\d{1,14}$/
  },
  dateOfBirth: Date,
  gender: { 
    type: String, 
    enum: ['Male', 'Female', 'Other', 'Prefer not to say'] 
  },
  
  // ADDRESS
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  
  // EMPLOYMENT
  employeeNumber: { type: String, unique: true, sparse: true },
  designation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Designation'
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    index: true
  },
  reportsTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  
  // DATES
  dateOfJoining: { type: Date, required: true, index: true },
  probationEndDate: Date,
  confirmationDate: Date,
  resignationDate: Date,
  lastWorkingDate: Date,
  
  // TYPE
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
  
  // SALARY
  salary: {
    basic: Number,
    hra: Number,
    allowances: Number,
    total: Number,
    currency: { type: String, default: 'USD' },
    effectiveFrom: Date
  },
  
  // BANK
  bankDetails: {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    branch: String
  },
  
  // DOCUMENTS
  documents: [{
    type: {
      type: String,
      enum: ['Resume', 'ID Proof', 'Address Proof', 'Education', 'Experience Letter', 'Other']
    },
    filename: String,
    url: String,
    uploadedAt: Date
  }],
  
  // EMERGENCY
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    email: String
  },
  
  // STATUS
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'On Leave', 'Terminated', 'Resigned'],
    default: 'Active',
    index: true
  },
  
  // ROLE
  role: {
    type: String,
    enum: ['super-admin', 'admin', 'manager', 'employee', 'hr'],
    default: 'employee',
    index: true
  },
  permissions: [String],
  
  // METADATA
  profilePicture: String,
  bio: String,
  skills: [String],
  
  // SOFT DELETE
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  
  // AUDIT
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// COMPOUND INDEXES
employeeSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, status: 1, isDeleted: 1 });
employeeSchema.index({ companyId: 1, department: 1, status: 1 });
employeeSchema.index({ companyId: 1, role: 1 });
employeeSchema.index({ companyId: 1, email: 1 }, { unique: true });

// TEXT SEARCH
employeeSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  employeeNumber: 'text'
});

// VIRTUALS
employeeSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

employeeSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const ageDiff = Date.now() - this.dateOfBirth.getTime();
  const ageDate = new Date(ageDiff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
});

employeeSchema.virtual('tenureMonths').get(function() {
  const diff = Date.now() - this.dateOfJoining.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
});

// MIDDLEWARE
employeeSchema.pre('save', async function(next) {
  if (!this.employeeNumber) {
    const count = await this.constructor.countDocuments({ companyId: this.companyId });
    this.employeeNumber = `EMP${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

export const Employee = mongoose.model('employees', employeeSchema);
```

**Also Generate:** `tests/schemas/employee.test.js`

```javascript
import { Employee } from '../../models/employee/employee.schema.js';
import mongoose from 'mongoose';

describe('Employee Schema', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_TEST_URI);
  });
  
  afterAll(async () => {
    await mongoose.connection.close();
  });
  
  afterEach(async () => {
    await Employee.deleteMany({});
  });
  
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
      expect(employee.fullName).toBe('John Doe');
    });
    
    test('should fail without required fields', async () => {
      await expect(Employee.create({})).rejects.toThrow();
    });
    
    test('should auto-generate employee number', async () => {
      const emp1 = await Employee.create({
        clerkUserId: 'user_1',
        companyId: 'comp_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john1@example.com',
        dateOfJoining: new Date()
      });
      
      const emp2 = await Employee.create({
        clerkUserId: 'user_2',
        companyId: 'comp_123',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        dateOfJoining: new Date()
      });
      
      expect(emp1.employeeNumber).toMatch(/^EMP\d{5}$/);
      expect(emp2.employeeNumber).toMatch(/^EMP\d{5}$/);
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
      await Employee.create({
        clerkUserId: 'user_1',
        companyId: 'comp_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        dateOfJoining: new Date()
      });
      
      await expect(Employee.create({
        clerkUserId: 'user_2',
        companyId: 'comp_123',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'john@example.com',
        dateOfJoining: new Date()
      })).rejects.toThrow();
    });
    
    test('should validate phone number format', async () => {
      await expect(Employee.create({
        clerkUserId: 'user_123',
        companyId: 'comp_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: 'invalid-phone',
        dateOfJoining: new Date()
      })).rejects.toThrow();
    });
  });
  
  describe('Indexes', () => {
    test('should have required compound indexes', async () => {
      const indexes = await Employee.collection.getIndexes();
      
      expect(indexes).toHaveProperty('companyId_1_employeeId_1');
      expect(indexes).toHaveProperty('companyId_1_email_1');
      expect(indexes).toHaveProperty('companyId_1_status_1_isDeleted_1');
    });
    
    test('should have text search index', async () => {
      const indexes = await Employee.collection.getIndexes();
      
      const textIndexExists = Object.values(indexes).some(
        index => index.textIndexVersion !== undefined
      );
      
      expect(textIndexExists).toBe(true);
    });
  });
  
  describe('Virtuals', () => {
    test('should calculate fullName', async () => {
      const employee = await Employee.create({
        clerkUserId: 'user_123',
        companyId: 'comp_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        dateOfJoining: new Date()
      });
      
      expect(employee.fullName).toBe('John Doe');
    });
    
    test('should calculate age from dateOfBirth', async () => {
      const employee = await Employee.create({
        clerkUserId: 'user_123',
        companyId: 'comp_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        dateOfBirth: new Date('1990-01-01'),
        dateOfJoining: new Date()
      });
      
      expect(employee.age).toBeGreaterThan(30);
    });
    
    test('should calculate tenure in months', async () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const employee = await Employee.create({
        clerkUserId: 'user_123',
        companyId: 'comp_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        dateOfJoining: oneYearAgo
      });
      
      expect(employee.tenureMonths).toBeGreaterThan(11);
    });
  });
  
  describe('Multi-tenancy', () => {
    test('should isolate employees by companyId', async () => {
      await Employee.create({
        clerkUserId: 'user_1',
        companyId: 'comp_1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@company1.com',
        dateOfJoining: new Date()
      });
      
      await Employee.create({
        clerkUserId: 'user_2',
        companyId: 'comp_2',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@company2.com',
        dateOfJoining: new Date()
      });
      
      const comp1Employees = await Employee.find({ companyId: 'comp_1' });
      const comp2Employees = await Employee.find({ companyId: 'comp_2' });
      
      expect(comp1Employees.length).toBe(1);
      expect(comp2Employees.length).toBe(1);
    });
  });
  
  describe('Soft Delete', () => {
    test('should soft delete employee', async () => {
      const employee = await Employee.create({
        clerkUserId: 'user_123',
        companyId: 'comp_123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        dateOfJoining: new Date()
      });
      
      employee.isDeleted = true;
      employee.deletedAt = new Date();
      await employee.save();
      
      expect(employee.isDeleted).toBe(true);
      expect(employee.deletedAt).toBeDefined();
    });
  });
});
```

---

### Day 3: Department & Designation

**Generate:** 
- `backend/models/organization/department.schema.js`
- `backend/models/organization/designation.schema.js`
- `tests/schemas/department.test.js`
- `tests/schemas/designation.test.js`

**Use similar pattern as Employee schema with:**
- Proper indexes
- Multi-tenancy support
- Soft delete
- Validation
- Tests

---

### Day 4: Attendance Schema

**Generate:** `backend/models/attendance/attendance.schema.js`

**Key Requirements:**
```javascript
// CRITICAL: Compound unique index
attendanceSchema.index({ companyId: 1, employeeId: 1, date: 1 }, { unique: true });

// CRITICAL: Auto-calculation middleware
attendanceSchema.pre('save', function(next) {
  if (this.clockIn && this.clockOut) {
    const diff = this.clockOut - this.clockIn;
    this.workHours = Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
    
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

### Day 5: Leave Schemas

**Generate:**
- `backend/models/leave/leaveType.schema.js`
- `backend/models/leave/leave.schema.js`
- Tests for both

**Key Middleware:**
```javascript
leaveSchema.pre('save', function(next) {
  if (this.fromDate && this.toDate) {
    const diff = this.toDate - this.fromDate;
    let days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    
    if (this.isHalfDay) days = 0.5;
    this.numberOfDays = days;
  }
  next();
});
```

---

## 🔧 CODE GENERATION STANDARDS

### 1. Always Use Modern JavaScript

```javascript
// ✅ GOOD
const employee = await Employee.findById(id);
const { firstName, lastName } = employee;

// ❌ BAD
Employee.findById(id, function(err, employee) {
  var firstName = employee.firstName;
  var lastName = employee.lastName;
});
```

### 2. Always Handle Errors

```javascript
// ✅ GOOD
try {
  const employee = await Employee.create(data);
  return { success: true, data: employee };
} catch (error) {
  console.error('Error creating employee:', error);
  return { success: false, error: error.message };
}

// ❌ BAD
const employee = await Employee.create(data);
return employee;
```

### 3. Always Use Multi-tenancy

```javascript
// ✅ GOOD
const employees = await Employee.find({ 
  companyId, 
  isDeleted: false 
});

// ❌ BAD
const employees = await Employee.find();
```

### 4. Always Use Soft Deletes

```javascript
// ✅ GOOD
await Employee.findByIdAndUpdate(id, { 
  isDeleted: true, 
  deletedAt: new Date() 
});

// ❌ BAD
await Employee.findByIdAndDelete(id);
```

### 5. Always Add Proper Indexes

```javascript
// ✅ GOOD - Query fields have indexes
schema.index({ companyId: 1, status: 1, isDeleted: 1 });
schema.index({ companyId: 1, email: 1 }, { unique: true });

// ❌ BAD - No indexes
schema = new mongoose.Schema({ /* ... */ });
```

---

## 📝 OUTPUT FORMAT

For each task, provide:

### 1. Complete File Code
```javascript
// backend/models/employee/employee.schema.js
import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  // ... complete implementation
});

export const Employee = mongoose.model('employees', employeeSchema);
```

### 2. Complete Test Code
```javascript
// tests/schemas/employee.test.js
import { Employee } from '../../models/employee/employee.schema.js';

describe('Employee Schema', () => {
  // ... complete tests
});
```

### 3. Verification Steps
```bash
# How to test the implementation
npm test
mongosh
> db.employees.getIndexes()
```

---

## ⚠️ CRITICAL RULES

**NEVER:**
- Use callbacks (always async/await)
- Skip error handling
- Forget companyId (multi-tenancy)
- Use hard deletes
- Skip tests
- Create schemas without indexes
- Use Socket.IO for CRUD

**ALWAYS:**
- Use async/await
- Handle all errors
- Filter by companyId
- Use soft deletes
- Write comprehensive tests
- Add proper indexes
- Use REST for CRUD

---

## 🎯 SUCCESS CRITERIA

**Week 1 Deliverables:**
- [ ] 6 schemas created (Employee, Department, Designation, Attendance, Leave, LeaveType)
- [ ] All schemas have proper indexes
- [ ] All schemas have validation
- [ ] All schemas have soft delete
- [ ] All schemas support multi-tenancy
- [ ] 50+ tests written
- [ ] >80% test coverage
- [ ] All tests passing

**Verification:**
```bash
# Check files created
ls backend/models/**/*.schema.js
# Should show 6 files

# Check tests
npm test
# Should show 50+ tests passing

# Check coverage
npm run test:coverage
# Should show >80%

# Check MongoDB
mongosh
> use managertc_dev
> show collections
> db.employees.getIndexes()
```

---

## 📚 REFERENCE DOCUMENTATION

**Primary References:**
1. `08_DB_SCHEMA_INTEGRATION_GUIDE.md` - Schema code examples
2. `09_SOCKETIO_VS_REST_GUIDE.md` - Architecture patterns
3. `10_WHERE_TO_START_GUIDE.md` - Step-by-step guide

**Copy patterns from:**
- Section 4.1: Employee Schema (complete code)
- Section 4.2: Attendance Schema (complete code)
- Section 4.3: Leave Schema (complete code)
- Section 7.1: Test examples

---

## 🚀 START COMMAND

**Generate in this order:**

1. `backend/models/employee/employee.schema.js` + tests
2. `backend/models/organization/department.schema.js` + tests
3. `backend/models/organization/designation.schema.js` + tests
4. `backend/models/attendance/attendance.schema.js` + tests
5. `backend/models/leave/leaveType.schema.js` + tests
6. `backend/models/leave/leave.schema.js` + tests

**Begin with Employee Schema now.**

---

**END OF PROMPT**
