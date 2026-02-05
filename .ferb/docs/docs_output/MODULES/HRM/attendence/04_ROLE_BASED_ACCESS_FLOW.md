# Role-Based Access Control (RBAC) Report - Attendance Module

**Project:** manageRTC
**Module:** Attendance Management System
**Document Version:** 1.0.0

---

## Overview

The Attendance module implements a **4-tier role-based access control system** with granular permissions for each user role. Access control is enforced at both the **authentication layer** (JWT validation) and **authorization layer** (role-based middleware).

---

## Roles Hierarchy

```
                    ┌─────────────────┐
                    │   SUPERADMIN    │
                    │  (System Owner) │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼───────┐       ┌────────▼────────┐
        │     ADMIN     │       │       HR        │
        │ (Company Mgr) │       │  (HR Manager)   │
        └───────┬───────┘       └────────┬────────┘
                │                         │
                └────────────┬────────────┘
                             │
                    ┌────────▼────────┐
                    │    EMPLOYEE     │
                    │  (Self-Service) │
                    └─────────────────┘
```

---

## Role Definitions

### 1. Superadmin

**Description:** System-level administrator with full access across all companies.

**Capabilities:**
- Full access to all attendance operations
- Cross-company data access
- User management
- System configuration
- View all companies' data

**Access Level:** ⭐⭐⭐⭐⭐ (Full System Access)

**Special Permissions:**
- Bypasses company isolation check
- Can impersonate any user
- Can delete any data
- Can modify system settings

---

### 2. Admin

**Description:** Company-level administrator with full access within their company.

**Capabilities:**
- All attendance operations within company
- View and manage all employee attendance
- Bulk operations (approve/reject regularization)
- Delete attendance records
- View attendance statistics and reports
- Edit attendance records
- Manage attendance regularization requests

**Access Level:** ⭐⭐⭐⭐ (Company Admin)

**Limitations:**
- Cannot access other companies' data
- Cannot perform system-level operations
- Cannot modify system settings

---

### 3. HR (Human Resources)

**Description:** HR manager with monitoring and editing capabilities.

**Capabilities:**
- View all employee attendance
- Edit attendance records
- Bulk operations (approve/reject regularization)
- View attendance statistics and reports
- Update attendance status
- Cannot delete attendance records

**Access Level:** ⭐⭐⭐ (Management)

**Limitations:**
- Cannot delete attendance records
- Cannot access other companies' data
- Cannot perform system-level operations

---

### 4. Employee

**Description:** Regular employee with self-service access only.

**Capabilities:**
- Clock in (create own attendance)
- Clock out (update own attendance)
- View own attendance history
- Request attendance regularization
- View own statistics

**Access Level:** ⭐ (Self-Service)

**Limitations:**
- Cannot view other employees' attendance
- Cannot edit attendance (except clock out)
- Cannot delete any records
- Cannot access reports
- Cannot perform bulk operations

---

## Endpoint Access Matrix

| Endpoint | Method | Superadmin | Admin | HR | Employee |
|----------|--------|------------|-------|----|----------|
| `/api/attendance` | GET | ✅ | ✅ | ✅ | ❌ |
| `/api/attendance/my` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/attendance/daterange` | GET | ✅ | ✅ | ✅ | ❌ |
| `/api/attendance/stats` | GET | ✅ | ✅ | ✅ | ❌ |
| `/api/attendance/employee/:id` | GET | ✅ | ✅ | ✅ | ❌ |
| `/api/attendance/:id` | GET | ✅ | ✅ | ✅ | ✅* |
| `/api/attendance` | POST | ✅ | ✅ | ✅ | ✅ |
| `/api/attendance/:id` | PUT | ✅ | ✅ | ✅ | ✅* |
| `/api/attendance/:id` | DELETE | ✅ | ✅ | ❌ | ❌ |
| `/api/attendance/bulk` | POST | ✅ | ✅ | ✅ | ❌ |

*Employee can only access their own attendance records

---

## Middleware Implementation

### Authentication Middleware

**File:** [backend/middleware/auth.js](backend/middleware/auth.js)

```javascript
/**
 * authenticate - Validates JWT token
 * Extracts user info: userId, companyId, role
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  // 1. Extract token from Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw buildAuthenticationError('No token provided');
  }

  // 2. Verify token with Clerk
  const payload = await clerkClient.verifyToken(token);

  // 3. Extract user information
  req.user = {
    userId: payload.sub,
    companyId: payload.metadata.companyId || getDefaultCompanyId(),
    role: payload.metadata.role || 'employee'
  };

  next();
});
```

---

### Authorization Middleware

**File:** [backend/middleware/auth.js](backend/middleware/auth.js)

```javascript
/**
 * requireRole - Role-based access control
 * @param  {...string} roles - Allowed roles
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    const user = req.user;

    if (!roles.includes(user.role)) {
      throw buildAuthorizationError(
        `Access denied. Required role: ${roles.join(' or ')}`
      );
    }

    next();
  };
};

/**
 * requireCompany - Company membership verification
 */
export const requireCompany = asyncHandler(async (req, res, next) => {
  const user = req.user;

  // Superadmin bypasses company check
  if (user.role === 'superadmin') {
    return next();
  }

  // Verify company membership
  const employee = await collections.employees.findOne({
    'account.userId': user.userId,
    companyId: user.companyId,
    isDeleted: { $ne: true }
  });

  if (!employee) {
    throw buildAuthorizationError('Not a member of this company');
  }

  next();
});
```

---

## Route Protection Examples

### Admin/HR Only Endpoints

```javascript
// backend/routes/api/attendance.js

import express from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import attendanceController from '../../controllers/rest/attendance.controller.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/attendance
 * @access  Admin, HR, Superadmin
 */
router.get('/',
  requireRole('admin', 'hr', 'superadmin'),
  attendanceController.getAttendances
);

/**
 * @route   GET /api/attendance/stats
 * @access  Admin, HR, Superadmin
 */
router.get('/stats',
  requireRole('admin', 'hr', 'superadmin'),
  attendanceController.getAttendanceStats
);

/**
 * @route   DELETE /api/attendance/:id
 * @access  Admin, Superadmin (HR not allowed)
 */
router.delete('/:id',
  requireRole('admin', 'superadmin'),
  attendanceController.deleteAttendance
);
```

### All Authenticated Users Endpoints

```javascript
/**
 * @route   GET /api/attendance/my
 * @access  All authenticated users
 */
router.get('/my', attendanceController.getMyAttendance);

/**
 * @route   POST /api/attendance (clock in)
 * @access  All authenticated users
 */
router.post('/', attendanceController.createAttendance);

/**
 * @route   PUT /api/attendance/:id (clock out)
 * @access  All authenticated users
 */
router.put('/:id', attendanceController.updateAttendance);
```

---

## Data Access Control

### Employee-Level Isolation

**For Employee Role:** Only their own data

```javascript
// In getMyAttendance controller
export const getMyAttendance = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  // Get employee record for current user
  const employee = await collections.employees.findOne({
    'account.userId': user.userId,
    isDeleted: { $ne: true }
  });

  if (!employee) {
    return sendSuccess(res, [], 'No attendance records found');
  }

  // Only return this employee's attendance
  const filter = {
    employeeId: employee.employeeId,
    isDeleted: { $ne: true }
  };

  const attendances = await collections.attendance.find(filter).toArray();

  return sendSuccess(res, attendances);
});
```

### Company-Level Isolation

**For Admin/HR/Superadmin:** Company-wide data

```javascript
// In getAttendances controller
export const getAttendances = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  // Get tenant collections for user's company
  const collections = getTenantCollections(user.companyId);

  // Build filter - automatically scoped to company
  const filter = {
    isDeleted: { $ne: true }
  };

  // Additional filters (status, employee, date range)
  if (req.query.status) filter.status = req.query.status;
  if (req.query.employee) filter.employeeId = req.query.employee;

  const attendance = await collections.attendance.find(filter).toArray();

  return sendSuccess(res, attendance);
});
```

---

## Access Flow Diagrams

### Clock In Flow (Employee)

```
┌──────────────┐
│   Employee   │
│  Dashboard   │
└──────┬───────┘
       │
       │ 1. Click "Clock In"
       ▼
┌─────────────────────────────────┐
│  POST /api/attendance           │
│  Headers: {                     │
│    Authorization: Bearer {token}│
│  }                              │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  authenticate Middleware        │
│  - Verify JWT token             │
│  - Extract: userId, companyId,  │
│    role = 'employee'            │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  createAttendance Controller    │
│  - Get employee from userId     │
│  - Check duplicate clock-in     │
│  - Create attendance record     │
│  - Broadcast Socket.IO event    │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Response: 201 Created          │
│  {                              │
│    success: true,               │
│    message: "Clocked in...",    │
│    data: { attendance }         │
│  }                              │
└─────────────────────────────────┘
```

### View All Attendance Flow (Admin/HR)

```
┌──────────────┐
│  Admin/HR    │
│  Dashboard   │
└──────┬───────┘
       │
       │ 1. Navigate to Attendance
       ▼
┌─────────────────────────────────┐
│  GET /api/attendance            │
│  Headers: {                     │
│    Authorization: Bearer {token}│
│  }                              │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  authenticate Middleware        │
│  - Verify JWT token             │
│  - Extract: userId, companyId,  │
│    role = 'admin'               │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  requireRole Middleware         │
│  - Check if role in             │
│    ['admin', 'hr', 'superadmin']│
│  - ✅ 'admin' matches           │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  getAttendances Controller      │
│  - Get tenant collections       │
│  - Build filter (companyId)     │
│  - Apply query filters          │
│  - Return paginated results     │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Response: 200 OK               │
│  {                              │
│    success: true,               │
│    data: [attendance...],       │
│    pagination: {...}            │
│  }                              │
└─────────────────────────────────┘
```

---

## Permission Check Examples

### Example 1: Employee Cannot Delete

**Request:**
```bash
DELETE /api/attendance/67a1b2c3d4e5f67890abcdef
Authorization: Bearer {employee_token}
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Access denied. Required role: admin or superadmin"
  }
}
```

---

### Example 2: HR Cannot Bulk Delete

**Request:**
```bash
POST /api/attendance/bulk
{
  "action": "bulk-delete",
  "attendanceIds": ["67a1b2c3d4e5f67890abcdef"]
}
Authorization: Bearer {hr_token}
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Access denied. HR role cannot perform delete operations"
  }
}
```

---

### Example 3: Employee Cannot View Others

**Request:**
```bash
GET /api/attendance/employee/EMP002
Authorization: Bearer {employee_token}
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Access denied. Employees can only view their own attendance"
  }
}
```

---

## Frontend Role-Based UI

### Conditional Rendering Based on Role

**Example Implementation:**

```typescript
// attendanceadmin.tsx

const AttendanceAdmin = () => {
  const { user } = useAuth();

  return (
    <div className="attendance-admin">
      {/* All roles see attendance list */}
      <Table dataSource={attendance} columns={columns} />

      {/* Only Admin/Superadmin can delete */}
      {user.role === 'admin' || user.role === 'superadmin' ? (
        <Button onClick={handleDelete} danger>
          Delete Attendance
        </Button>
      ) : null}

      {/* Only Admin/HR/Superadmin can bulk edit */}
      {['admin', 'hr', 'superadmin'].includes(user.role) ? (
        <Button onClick={handleBulkEdit}>
          Bulk Edit
        </Button>
      ) : null}

      {/* Employees see only their attendance */}
      {user.role === 'employee' ? (
        <MyAttendanceView />
      ) : (
        <CompanyAttendanceView />
      )}
    </div>
  );
};
```

---

## Security Best Practices Implemented

### ✅ Implemented

1. **JWT Token Validation**
   - All requests require valid JWT token
   - Tokens verified with Clerk
   - Token expiration enforced

2. **Role-Based Middleware**
   - `requireRole()` middleware for route protection
   - Explicit role checks before sensitive operations

3. **Company Isolation**
   - Multi-tenant collection access
   - Automatic scoping by `companyId`
   - Superadmin bypass for cross-company access

4. **Soft Delete**
   - Records marked as deleted instead of removed
   - Audit trail preservation
   - Recovery capability

5. **Audit Logging**
   - `createdBy`, `updatedBy`, `deletedBy` fields
   - Timestamp tracking

### ⚠️ Recommended Enhancements

1. **Permission Caching**
   - Cache user permissions in Redis
   - Reduce database queries for permission checks

2. **Attribute-Based Access Control (ABAC)**
   - More granular permissions
   - Dynamic permission evaluation

3. **IP Whitelisting**
   - Restrict admin access to specific IPs
   - Additional security layer

4. **Session Management**
   - Active session tracking
   - Forced logout capability
   - Concurrent session limits

---

## Role Testing Checklist

| Test Case | Role | Endpoint | Expected Result |
|-----------|------|----------|-----------------|
| Clock in | Employee | POST /api/attendance | ✅ Success |
| Clock out | Employee | PUT /api/attendance/:id | ✅ Success (own record only) |
| View own | Employee | GET /api/attendance/my | ✅ Success |
| View all | Employee | GET /api/attendance | ❌ 403 Forbidden |
| View all | Admin | GET /api/attendance | ✅ Success |
| View all | HR | GET /api/attendance | ✅ Success |
| Delete | Admin | DELETE /api/attendance/:id | ✅ Success |
| Delete | HR | DELETE /api/attendance/:id | ❌ 403 Forbidden |
| Bulk edit | Admin | POST /api/attendance/bulk | ✅ Success |
| Bulk edit | HR | POST /api/attendance/bulk | ✅ Success |
| Bulk delete | HR | POST /api/attendance/bulk (delete) | ❌ 403 Forbidden |
| View stats | Employee | GET /api/attendance/stats | ❌ 403 Forbidden |
| View stats | HR | GET /api/attendance/stats | ✅ Success |
| Cross-company | Admin | GET /api/attendance (other company) | ❌ 404 (not found) |
| Cross-company | Superadmin | GET /api/attendance (any) | ✅ Success |

---

## Summary

The RBAC system provides:

- **4 distinct roles** with clear permission boundaries
- **Middleware-based enforcement** at the route level
- **Company-level data isolation** for multi-tenancy
- **Employee-level isolation** for self-service access
- **Audit trail** for all operations
- **Socket.IO event broadcasting** with role context

**Current Status:** ✅ Production-ready
