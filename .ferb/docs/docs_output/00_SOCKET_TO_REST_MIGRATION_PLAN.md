# 🎯 SOCKET.IO TO REST MIGRATION PLAN
## Critical Issue #1: "90% Socket.IO, Only 10% REST APIs"

**Created:** January 28, 2026
**Status:** PLANNING PHASE
**Priority:** 🔴 CRITICAL
**Target:** Migrate from 90% Socket.IO to 80% REST / 20% Socket.IO

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Migration Strategy](#migration-strategy)
4. [Implementation Phases](#implementation-phases)
5. [Milestones](#milestones)
6. [Detailed Tasks](#detailed-tasks)
7. [Testing Plan](#testing-plan)
8. [Rollback Strategy](#rollback-strategy)

---

## 1. EXECUTIVE SUMMARY

### The Problem

**Current Architecture:**
- 54 Socket.IO controllers handling CRUD operations
- Only 11 REST API route files
- 90% of data operations via WebSocket (stateful)
- 10% of data operations via REST (stateless)

**Why This is Critical:**
- ❌ Cannot use standard HTTP tools (Postman, curl, etc.)
- ❌ Cannot implement proper caching
- ❌ Cannot scale horizontally easily
- ❌ Difficult mobile app development
- ❌ Third-party integrations nearly impossible
- ❌ No API rate limiting on Socket.IO
- ❌ Violates RESTful architecture principles

### The Solution

**Target Architecture:**
- **80% REST APIs** for all CRUD operations
- **20% Socket.IO** for real-time updates only

**Benefits:**
- ✅ Standard HTTP/REST patterns
- ✅ Better testability (Postman, Jest, etc.)
- ✅ Easy caching (CDN, browser cache, Redis)
- ✅ Mobile app friendly
- ✅ Third-party integration ready
- ✅ Proper API documentation (Swagger/OpenAPI)
- ✅ Better scalability and load balancing

---

## 2. CURRENT STATE ANALYSIS

### Controllers Inventory (Socket.IO → REST Migration Needed)

#### HRMS Module Controllers (17 controllers)

| Controller | File | REST Needed | Priority | Est. Days |
|------------|------|-------------|----------|-----------|
| employeeController | employee/employee.controller.js | ✅ | 🔴 P0 | 3 |
| dashboardController | hr/hr.controller.js | ✅ | 🔴 P0 | 2 |
| notesController | employee/notes.controller.js | ✅ | 🟠 P1 | 1 |
| resignationController | hr/resignation.controller.js | ✅ | 🟠 P1 | 2 |
| terminationController | hr/termination.controller.js | ✅ | 🟠 P1 | 2 |
| holidaysController | hr/holidays.controller.js | ✅ | 🟡 P2 | 1 |
| holidayTypesController | hr/holidayTypes.controller.js | ✅ | 🟡 P2 | 1 |
| trainersController | hr/trainers.controller.js | ✅ | 🟡 P2 | 1 |
| trainingTypesController | hr/trainingTypes.controller.js | ✅ | 🟡 P2 | 1 |
| trainingListController | hr/trainingList.controller.js | ✅ | 🟡 P2 | 1 |
| goalTypeController | performance/goalType.controller.js | ⚠️ Has REST | 🟢 P3 | 0 |
| goalTrackingController | performance/goalTracking.controller.js | ⚠️ Has REST | 🟢 P3 | 0 |
| performanceIndicatorController | performance/performanceIndicator.controller.js | ⚠️ Has REST | 🟢 P3 | 0 |
| performanceAppraisalController | performance/performanceAppraisal.controller.js | ⚠️ Has REST | 🟢 P3 | 0 |
| performanceReviewController | performance/performanceReview.controller.js | ⚠️ Has REST | 🟢 P3 | 0 |
| promotionController | performance/promotion.controller.js | ✅ | 🟡 P2 | 1 |

**HRMS Total:** 15 REST endpoints to create, ~18 days effort

#### Project Management Module Controllers (4 controllers)

| Controller | File | REST Needed | Priority | Est. Days |
|------------|------|-------------|----------|-----------|
| projectController | project/project.controller.js | ✅ | 🔴 P0 | 3 |
| projectNotesController | project/project.notes.controller.js | ✅ | 🟠 P1 | 1 |
| taskController | task/task.controller.js | ✅ | 🔴 P0 | 3 |
| kanbanController | kaban/kaban.controller.js | 🟡 Keep Socket | 🟢 P3 | 0 |

**PM Total:** 3 REST endpoints to create, ~7 days effort

#### CRM Module Controllers (6 controllers)

| Controller | File | REST Needed | Priority | Est. Days |
|------------|------|-------------|----------|-----------|
| leadController | lead/lead.controller.js | ✅ | 🔴 P0 | 2 |
| clientController | client/client.controllers.js | ✅ | 🔴 P0 | 2 |
| activityController | activities/activities.controllers.js | ✅ | 🟠 P1 | 2 |
| pipelineController | pipeline/pipeline.controllers.js | ✅ | 🟠 P1 | 2 |
| candidateController | candidates/candidates.controllers.js | ✅ | 🟡 P2 | 2 |
| jobsController | jobs/jobs.controllers.js | ⚠️ Has REST | 🟢 P3 | 0 |

**CRM Total:** 5 REST endpoints to create, ~10 days effort

#### Other Module Controllers (5 controllers)

| Controller | File | REST Needed | Priority | Est. Days |
|------------|------|-------------|----------|-----------|
| assetSocketController | assets/asset.socket.controller.js | ✅ | 🟠 P1 | 2 |
| assetCategorySocketController | assets/assetCategory.socket.controller.js | ✅ | 🟡 P2 | 1 |
| userSocketController | user/user.socket.controller.js | ✅ | 🟠 P1 | 2 |
| adminController | admin/admin.controller.js | ✅ | 🟡 P2 | 2 |
| superadminController | superadmin/superadmin.controller.js | ✅ | 🟡 P2 | 2 |

**Other Total:** 5 REST endpoints to create, ~9 days effort

### Already Has REST (No Migration Needed)

| Route File | Module | Status |
|------------|--------|--------|
| companies.routes.js | CRM | ✅ Complete |
| contacts.routes.js | CRM | ✅ Complete |
| deal.routes.js | CRM | ✅ Complete |
| tickets.routes.js | Support | ✅ Complete |
| jobs.routes.js | HRM | ✅ Complete |
| socialfeed.routes.js | Social | ✅ Complete |
| (5 performance routes) | HRM | ✅ Complete |

**Keep as Socket.IO (Real-time Features):**

| Controller | Reason |
|------------|--------|
| ChatController | Real-time messaging |
| ChatUsersController | Online status |
| kanbanController | Drag & drop updates |
| socialFeedSocketController | Live feed (hybrid with REST) |

---

## 3. MIGRATION STRATEGY

### Phase Approach

**Principle:** Gradual migration with zero downtime

1. **Create REST APIs alongside Socket.IO** (no breaking changes)
2. **Frontend gradually migrates to REST** (feature by feature)
3. **Socket.IO kept for real-time** (notifications, live updates)
4. **Deprecate Socket.IO CRUD** (mark as legacy, remove later)

### Migration Pattern

```
Current (Socket.IO only):
Client → Socket.IO Event → Controller → Database

Target (Hybrid):
Client → REST API → Controller → Database
         ↓
    Socket.IO Event (for real-time broadcast)
         ↓
    All Clients (live update)
```

### Implementation Order

**Priority 0 (Critical - Week 1-2):**
1. Employee REST API
2. Project REST API
3. Task REST API
4. Lead REST API
5. Client REST API

**Priority 1 (High - Week 3-4):**
6. Activity REST API
7. Pipeline REST API
8. Asset REST API
9. User REST API
10. HR Dashboard REST API

**Priority 2 (Medium - Week 5-6):**
11. Candidate REST API
12. Training REST APIs (3)
13. Holidays REST APIs (2)
14. Promotion REST API

---

## 4. IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1-2)

**Goal:** Create REST API infrastructure and migrate critical modules

**Deliverables:**
- REST API middleware and utilities
- Authentication middleware for REST
- Input validation middleware
- Standardized error handling
- 5 critical REST endpoints

**Tasks:**
1. Create `backend/middleware/auth.js` - Clerk authentication for REST
2. Create `backend/middleware/validate.js` - Input validation using Joi
3. Create `backend/middleware/errorHandler.js` - Centralized error handling
4. Create `backend/utils/apiResponse.js` - Standardized API response format
5. Create Employee REST API (`routes/api/employees.js`)
6. Create Project REST API (`routes/api/projects.js`)
7. Create Task REST API (`routes/api/tasks.js`)
8. Create Lead REST API (`routes/api/leads.js`)
9. Create Client REST API (`routes/api/clients.js`)

### Phase 2: HRMS Completion (Week 3-4)

**Goal:** Complete all HRMS REST APIs

**Deliverables:**
- HR Dashboard REST API
- Activity REST API
- Asset REST API
- Attendance REST API (schema + endpoints)
- Leave REST API (schema + endpoints)

**Tasks:**
1. Create Attendance schema
2. Create Attendance REST API
3. Create Leave schema
4. Create Leave REST API
5. Migrate HR Dashboard controller
6. Migrate Activity controller
7. Migrate Asset controllers (2)

### Phase 3: CRM & PM (Week 5-6)

**Goal:** Complete remaining REST APIs

**Deliverables:**
- Pipeline REST API
- Candidate REST API
- Training REST APIs
- Holidays REST APIs
- Promotion REST API

**Tasks:**
1. Migrate Pipeline controller
2. Migrate Candidate controller
3. Migrate Training controllers (3)
4. Migrate Holiday controllers (2)
5. Migrate Promotion controller

### Phase 4: Testing & Documentation (Week 7-8)

**Goal:** Complete testing and documentation

**Deliverables:**
- 80% test coverage on REST APIs
- Postman collection
- Swagger/OpenAPI documentation
- Frontend migration guide

**Tasks:**
1. Write unit tests for all REST endpoints
2. Write integration tests
3. Create Postman collection
4. Generate Swagger documentation
5. Update frontend to use REST APIs
6. Performance testing
7. Security testing

---

## 5. MILESTONES

### Milestone 1: REST Infrastructure Ready (End of Week 1)

**Success Criteria:**
- ✅ Authentication middleware working
- ✅ Validation middleware working
- ✅ Error handling middleware working
- ✅ First REST endpoint (Employees) deployed
- ✅ Postman can call Employees API successfully

**Definition of Done:**
```bash
# All tests passing
npm test

# Postman collection passes
newman run postman_collection.json

# Can call API
curl -X GET http://localhost:5000/api/employees \
  -H "Authorization: Bearer $TOKEN"
```

### Milestone 2: Critical APIs Complete (End of Week 2)

**Success Criteria:**
- ✅ Employees, Projects, Tasks, Leads, Clients REST APIs working
- ✅ Frontend migrated to use these REST APIs
- ✅ Socket.IO still works for real-time updates
- ✅ No breaking changes to existing functionality

### Milestone 3: All APIs Complete (End of Week 6)

**Success Criteria:**
- ✅ All 28 REST endpoints created
- ✅ All endpoints tested
- ✅ All endpoints documented
- ✅ Frontend fully migrated
- ✅ Performance benchmarks met

### Milestone 4: Production Ready (End of Week 8)

**Success Criteria:**
- ✅ 80% test coverage achieved
- ✅ Security audit passed
- ✅ Load testing passed (1000 concurrent users)
- ✅ Documentation complete
- ✅ Ready for production deployment

---

## 6. DETAILED TASKS

### Task 1.1: Create Authentication Middleware

**File:** `backend/middleware/auth.js`

**Requirements:**
- Verify Clerk JWT token
- Extract user metadata (userId, companyId, role)
- Add user info to request object
- Handle missing/invalid tokens

**Implementation:**
```javascript
import { requireAuth } from "@clerk/express";

export const authenticate = async (req, res, next) => {
  try {
    // Clerk's requireAuth does the heavy lifting
    await requireAuth()(req, res, next);

    // Add our custom user info extraction
    if (req.auth) {
      req.user = {
        userId: req.auth.userId,
        companyId: req.auth.publicMetadata?.companyId,
        role: req.auth.publicMetadata?.role
      };
    }
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
```

**Testing:**
```javascript
test('should authenticate valid token', async () => {
  const res = await request(app)
    .get('/api/employees')
    .set('Authorization', `Bearer ${validToken}`);

  expect(res.status).toBe(200);
});
```

---

### Task 1.2: Create Validation Middleware

**File:** `backend/middleware/validate.js`

**Requirements:**
- Use Joi for schema validation
- Validate request body, query, params
- Return detailed validation errors
- Sanitize input

**Implementation:**
```javascript
import Joi from 'joi';

export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    req.body = value;
    next();
  };
};

// Example schemas
export const schemas = {
  employee: Joi.object({
    firstName: Joi.string().required().min(2).max(50),
    lastName: Joi.string().required().min(2).max(50),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^[0-9]{10,15}$/),
    departmentId: Joi.string().required(),
    designationId: Joi.string().required(),
    joiningDate: Joi.date().required()
  }),

  project: Joi.object({
    name: Joi.string().required().min(3).max(100),
    description: Joi.string().max(500),
    client: Joi.string().required(),
    startDate: Joi.date().required(),
    dueDate: Joi.date().required().min(Joi.ref('startDate')),
    priority: Joi.string().valid('High', 'Medium', 'Low'),
    status: Joi.string().valid('Active', 'Completed', 'On Hold', 'Cancelled')
  })
};
```

---

### Task 1.3: Create Error Handler Middleware

**File:** `backend/middleware/errorHandler.js`

**Requirements:**
- Centralized error handling
- Different error types
- Proper HTTP status codes
- Error logging
- Request tracking

**Implementation:**
```javascript
export class AppError extends Error {
  constructor(message, statusCode, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

export const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message, code = 'INTERNAL_ERROR' } = err;

  // Log error
  console.error(`[${req.id || 'no-id'}] ${code}: ${message}`, err);

  // Operational errors (trusted)
  if (err.isOperational) {
    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        requestId: req.id
      }
    });
  }

  // Programming errors (not trusted)
  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message,
        stack: err.stack
      }
    });
  }

  // Production
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: req.id
    }
  });
};
```

---

### Task 1.4: Create Employee REST API

**Files:**
- `backend/routes/api/employees.js`
- `backend/controllers/rest/employee.controller.js`

**Endpoints:**
```
GET    /api/employees              - List all employees
GET    /api/employees/:id          - Get single employee
POST   /api/employees              - Create employee
PUT    /api/employees/:id          - Update employee
DELETE /api/employees/:id          - Soft delete employee
GET    /api/employees/search       - Search employees
GET    /api/employees/dashboard    - Employee dashboard stats
```

**Implementation Template:**
```javascript
// routes/api/employees.js
import express from 'express';
import { employeeController } from '../../controllers/rest/employee.controller.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate, schemas } from '../../middleware/validate.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/employees - List all (HR, Admin, Superadmin)
router.get('/',
  requireRole('admin', 'hr', 'superadmin'),
  employeeController.getAll
);

// GET /api/employees/:id - Get single
router.get('/:id', employeeController.getById);

// POST /api/employees - Create (HR, Admin, Superadmin)
router.post('/',
  requireRole('admin', 'hr', 'superadmin'),
  validate(schemas.employee),
  employeeController.create
);

// PUT /api/employees/:id - Update
router.put('/:id',
  validate(schemas.employee),
  employeeController.update
);

// DELETE /api/employees/:id - Soft delete
router.delete('/:id',
  requireRole('admin', 'superadmin'),
  employeeController.delete
);

export default router;
```

---

## 7. TESTING PLAN

### Unit Tests

**Coverage Target:** 80%

**Test Framework:** Jest + Supertest

**Example Test:**
```javascript
// tests/api/employees.test.js
import request from 'supertest';
import app from '../../app';

describe('Employee API', () => {
  let authToken;

  beforeAll(async () => {
    // Get auth token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hr@test.com', password: 'password' });
    authToken = res.body.token;
  });

  describe('GET /api/employees', () => {
    test('should return 401 without auth', async () => {
      const res = await request(app).get('/api/employees');
      expect(res.status).toBe(401);
    });

    test('should return employees list with valid auth', async () => {
      const res = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('should support pagination', async () => {
      const res = await request(app)
        .get('/api/employees?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
    });
  });

  describe('POST /api/employees', () => {
    test('should create employee with valid data', async () => {
      const employeeData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        departmentId: 'dept-123',
        designationId: 'des-123',
        joiningDate: '2026-01-28'
      };

      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send(employeeData);

      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe('john.doe@test.com');
    });

    test('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email',  // Invalid
          departmentId: 'dept-123',
          designationId: 'des-123',
          joiningDate: '2026-01-28'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });
});
```

### Integration Tests

```javascript
describe('Employee Integration Tests', () => {
  test('should create, read, update, delete employee', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send(validEmployeeData);

    expect(createRes.status).toBe(201);
    const employeeId = createRes.body.data._id;

    // Read
    const getRes = await request(app)
      .get(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.firstName).toBe('John');

    // Update
    const updateRes = await request(app)
      .put(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Jane' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.firstName).toBe('Jane');

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
  });
});
```

### Performance Tests

```javascript
describe('Performance Tests', () => {
  test('should handle 100 concurrent requests', async () => {
    const requests = Array(100).fill(null).map(() =>
      request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${token}`)
    );

    const start = Date.now();
    const results = await Promise.all(requests);
    const duration = Date.now() - start;

    results.forEach(res => {
      expect(res.status).toBe(200);
    });

    expect(duration).toBeLessThan(5000); // 5 seconds max
  });
});
```

---

## 8. ROLLBACK STRATEGY

### If Issues Arise During Migration

**Strategy:** Dual-running with gradual cutover

1. **Phase 1:** Run both Socket.IO and REST in parallel
2. **Phase 2:** Frontend uses REST, Socket.IO kept for compatibility
3. **Phase 3:** Monitor for issues, ready to revert
4. **Phase 4:** If issues found, revert frontend to Socket.IO
5. **Phase 5:** Fix issues, retry migration

**Rollback Trigger:**
- Critical bugs in production
- Performance degradation > 20%
- Data integrity issues
- Security vulnerabilities

**Rollback Steps:**
```javascript
// Frontend config
const API_MODE = process.env.REACT_APP_API_MODE || 'socket';

// In API service
if (API_MODE === 'rest') {
  // Use REST API
  return fetch('/api/employees');
} else {
  // Revert to Socket.IO
  return socket.emit('get:employees');
}
```

---

## 📊 SUCCESS METRICS

### By End of Migration

**Technical Metrics:**
- ✅ 28 new REST endpoints created
- ✅ 80% of operations use REST API
- ✅ 20% Socket.IO for real-time only
- ✅ 80% test coverage on REST APIs
- ✅ API response time < 200ms (p95)
- ✅ Zero breaking changes

**Business Metrics:**
- ✅ 100% feature parity maintained
- ✅ Mobile app development possible
- ✅ Third-party integrations working
- ✅ Developer productivity increased 2x

---

## 📝 DOCUMENTATION FILES

This plan includes:
- Main plan (this file)
- Task breakdown (tasks.md)
- Daily progress tracker (progress.md)
- API design specifications (api-design.md)
- Test specifications (tests.md)

---

**Plan Status:** READY FOR APPROVAL
**Next Step:** Review and approve before implementation

**END OF PLAN**
