# Leave Module - Backend API Design Report

**Generated:** 2026-02-04
**Module:** HRM - Leave Management
**API Type:** RESTful + Socket.IO Hybrid

---

## Executive Summary

The Leave module implements a **RESTful API** with **10 endpoints** covering full CRUD operations, approval workflow, and reporting. The API follows REST principles with proper HTTP methods, status codes, and error handling. Socket.IO events complement the API for real-time updates.

**API Architecture:** 80% REST + 20% Socket.IO

---

## 1. API Endpoints Overview

### 1.1 Endpoint Summary

| Method | Endpoint | Controller | Access | Description |
|--------|----------|------------|--------|-------------|
| GET | `/api/leaves` | `getLeaves()` | Admin, HR, Superadmin | Get all leaves with filtering |
| GET | `/api/leaves/my` | `getMyLeaves()` | All users | Get current user's leaves |
| GET | `/api/leaves/status/:status` | `getLeavesByStatus()` | Admin, HR, Superadmin | Filter by status |
| GET | `/api/leaves/balance` | `getLeaveBalance()` | All users | Get leave balance |
| GET | `/api/leaves/:id` | `getLeaveById()` | All users | Get single leave |
| POST | `/api/leaves` | `createLeave()` | All users | Create leave request |
| PUT | `/api/leaves/:id` | `updateLeave()` | Admin, HR, Owner | Update leave request |
| DELETE | `/api/leaves/:id` | `deleteLeave()` | Admin, Superadmin, Owner | Soft delete leave |
| POST | `/api/leaves/:id/approve` | `approveLeave()` | Admin, HR, Manager | Approve leave |
| POST | `/api/leaves/:id/reject` | `rejectLeave()` | Admin, HR, Manager | Reject leave |

### 1.2 Report Endpoints

| Method | Endpoint | Controller | Access | Description |
|--------|----------|------------|--------|-------------|
| GET | `/api/reports/leaves` | `generateLeaveReport()` | Admin, HR | Leave summary report |
| GET | `/api/reports/leave-balance` | `generateLeaveBalanceReport()` | Admin, HR | Balance report |
| GET | `/api/reports/leaves/monthly-summary` | `generateMonthlyLeaveSummary()` | Admin, HR | Monthly summary |
| GET | `/api/reports/leaves/export` | `exportLeaveReport()` | Admin, HR | CSV export |

---

## 2. Detailed API Specifications

### 2.1 GET /api/leaves

Get all leave requests with pagination and filtering.

**Access Control:**
- Roles: Admin, HR, Superadmin
- Authentication: Required (Bearer token)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | Number | No | 1 | Page number |
| `limit` | Number | No | 20 | Items per page |
| `search` | String | No | - | Search in reason, detailedReason |
| `status` | String | No | - | Filter by status |
| `leaveType` | String | No | - | Filter by leave type |
| `employee` | String | No | - | Filter by employee ID |
| `startDate` | Date | No | - | Filter by date range (start) |
| `endDate` | Date | No | - | Filter by date range (end) |
| `sortBy` | String | No | createdAt | Sort field |
| `order` | String | No | desc | Sort order (asc/desc) |

**Request Example:**
```http
GET /api/leaves?page=1&limit=20&status=pending&leaveType=casual&sortBy=createdAt&order=desc
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response Example:**
```json
{
  "success": true,
  "message": "Leave requests retrieved successfully",
  "data": [
    {
      "_id": "65bc12d34e5f6a78b0c1d2e3",
      "leaveId": "leave_1738452342_abc123",
      "employeeId": "EMP001",
      "employeeName": "John Doe",
      "leaveType": "casual",
      "startDate": "2026-02-10T00:00:00Z",
      "endDate": "2026-02-12T00:00:00Z",
      "duration": 3,
      "reason": "Family function",
      "status": "pending",
      "createdAt": "2026-02-04T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

**Error Responses:**
| Code | Description |
|------|-------------|
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 500 | Internal server error |

---

### 2.2 GET /api/leaves/my

Get the current user's leave requests.

**Access Control:**
- Roles: All authenticated users
- Authentication: Required

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | Number | No | 1 | Page number |
| `limit` | Number | No | 20 | Items per page |
| `status` | String | No | - | Filter by status |
| `leaveType` | String | No | - | Filter by leave type |

**Request Example:**
```http
GET /api/leaves/my?page=1&status=pending
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response Example:**
```json
{
  "success": true,
  "message": "My leave requests retrieved successfully",
  "data": [
    {
      "_id": "65bc12d34e5f6a78b0c1d2e3",
      "leaveId": "leave_1738452342_abc123",
      "leaveType": "casual",
      "startDate": "2026-02-10T00:00:00Z",
      "endDate": "2026-02-12T00:00:00Z",
      "duration": 3,
      "status": "pending",
      "balanceAtRequest": 9
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

---

### 2.3 GET /api/leaves/balance

Get leave balance for the current user.

**Access Control:**
- Roles: All authenticated users
- Authentication: Required

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `leaveType` | String | No | - | Specific leave type (if omitted, returns all) |

**Request Example (Single Type):**
```http
GET /api/leaves/balance?leaveType=casual
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Example (All Types):**
```http
GET /api/leaves/balance
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response Example (Single Type):**
```json
{
  "success": true,
  "message": "Leave balance retrieved successfully",
  "data": {
    "type": "casual",
    "balance": 9,
    "used": 3,
    "total": 12
  }
}
```

**Response Example (All Types):**
```json
{
  "success": true,
  "message": "All leave balances retrieved successfully",
  "data": {
    "sick": { "type": "sick", "balance": 10, "used": 2, "total": 12 },
    "casual": { "type": "casual", "balance": 9, "used": 3, "total": 12 },
    "earned": { "type": "earned", "balance": 5, "used": 7, "total": 12 }
  }
}
```

---

### 2.4 POST /api/leaves

Create a new leave request.

**Access Control:**
- Roles: All authenticated users
- Authentication: Required

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `leaveType` | String | ✅ Yes | Leave type (sick, casual, earned, etc.) |
| `startDate` | Date | ✅ Yes | Start date of leave |
| `endDate` | Date | ✅ Yes | End date of leave |
| `reason` | String | ✅ Yes | Reason for leave (max 500 chars) |
| `detailedReason` | String | No | Detailed explanation (max 2000 chars) |
| `handoverTo` | ObjectId | No | Employee covering duties |
| `attachments` | Array | No | File attachments |

**Request Example:**
```http
POST /api/leaves
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "leaveType": "casual",
  "startDate": "2026-02-10",
  "endDate": "2026-02-12",
  "reason": "Attending sister's wedding",
  "detailedReason": "Need to attend family wedding function out of station",
  "handoverTo": "65ab12d34e5f6a78b0c1d2e4"
}
```

**Response Example (Success):**
```json
{
  "success": true,
  "message": "Leave request created successfully",
  "data": {
    "_id": "65bc12d34e5f6a78b0c1d2e3",
    "leaveId": "leave_1738452342_abc123",
    "employeeId": "EMP001",
    "employeeName": "John Doe",
    "leaveType": "casual",
    "startDate": "2026-02-10T00:00:00Z",
    "endDate": "2026-02-12T00:00:00Z",
    "duration": 3,
    "reason": "Attending sister's wedding",
    "status": "pending",
    "reportingManagerId": "65cd34e56f7a8b9c0d1e2f3a",
    "balanceAtRequest": 9,
    "createdAt": "2026-02-04T10:30:00Z"
  }
}
```

**Error Responses:**
| Code | Description |
|------|-------------|
| 400 | Validation error (dates, required fields) |
| 409 | Overlapping leave request exists |
| 400 | Insufficient leave balance |

**Validation Error Example:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "End date must be after start date",
    "field": "endDate"
  }
}
```

**Overlap Error Example:**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "You have overlapping leave requests for the same period"
  }
}
```

---

### 2.5 PUT /api/leaves/:id

Update an existing leave request.

**Access Control:**
- Roles: Admin, HR, Owner
- Authentication: Required

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | ObjectId | ✅ Yes | Leave request ID |

**Request Body:**
Same as POST /api/leaves (all fields optional)

**Request Example:**
```http
PUT /api/leaves/65bc12d34e5f6a78b0c1d2e3
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "endDate": "2026-02-13",
  "reason": "Attending sister's wedding - extended by one day"
}
```

**Response Example:**
```json
{
  "success": true,
  "message": "Leave request updated successfully",
  "data": {
    "_id": "65bc12d34e5f6a78b0c1d2e3",
    "leaveId": "leave_1738452342_abc123",
    "endDate": "2026-02-13T00:00:00Z",
    "duration": 4,
    "reason": "Attending sister's wedding - extended by one day",
    "updatedAt": "2026-02-04T11:00:00Z"
  }
}
```

**Error Responses:**
| Code | Description |
|------|-------------|
| 400 | Invalid leave ID format |
| 404 | Leave request not found |
| 409 | Cannot update approved/rejected leave |
| 409 | Overlapping leave requests exist |

---

### 2.6 POST /api/leaves/:id/approve

Approve a leave request.

**Access Control:**
- Roles: Admin, HR, Manager
- Authentication: Required

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | ObjectId | ✅ Yes | Leave request ID |

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comments` | String | No | Approval comments (max 500 chars) |

**Request Example:**
```http
POST /api/leaves/65bc12d34e5f6a78b0c1d2e3/approve
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "comments": "Approved. Ensure handover is completed."
}
```

**Response Example:**
```json
{
  "success": true,
  "message": "Leave request approved successfully",
  "data": {
    "_id": "65bc12d34e5f6a78b0c1d2e3",
    "leaveId": "leave_1738452342_abc123",
    "status": "approved",
    "approvedBy": "65ab12d34e5f6a78b0c1d2e5",
    "approvedAt": "2026-02-04T11:30:00Z",
    "approvalComments": "Approved. Ensure handover is completed."
  }
}
```

**Side Effects:**
- Employee leave balance is deducted
- Socket.IO event `leave:approved` is broadcast
- Socket.IO event `leave:balance_updated` sent to employee

**Error Responses:**
| Code | Description |
|------|-------------|
| 400 | Invalid leave ID format |
| 404 | Leave request not found |
| 409 | Can only approve pending leave requests |

---

### 2.7 POST /api/leaves/:id/reject

Reject a leave request.

**Access Control:**
- Roles: Admin, HR, Manager
- Authentication: Required

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | ObjectId | ✅ Yes | Leave request ID |

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | String | ✅ Yes | Rejection reason (required) |

**Request Example:**
```http
POST /api/leaves/65bc12d34e5f6a78b0c1d2e3/reject
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "reason": "Insufficient staff coverage during this period."
}
```

**Response Example:**
```json
{
  "success": true,
  "message": "Leave request rejected successfully",
  "data": {
    "_id": "65bc12d34e5f6a78b0c1d2e3",
    "leaveId": "leave_1738452342_abc123",
    "status": "rejected",
    "rejectedBy": "65ab12d34e5f6a78b0c1d2e5",
    "rejectedAt": "2026-02-04T11:30:00Z",
    "rejectionReason": "Insufficient staff coverage during this period."
  }
}
```

**Side Effects:**
- Socket.IO event `leave:rejected` is broadcast
- Socket.IO event `leave:your_leave_rejected` sent to employee

**Error Responses:**
| Code | Description |
|------|-------------|
| 400 | Rejection reason is required |
| 400 | Invalid leave ID format |
| 404 | Leave request not found |
| 409 | Can only reject pending leave requests |

---

### 2.8 DELETE /api/leaves/:id

Soft delete a leave request.

**Access Control:**
- Roles: Admin, Superadmin, Owner
- Authentication: Required

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | ObjectId | ✅ Yes | Leave request ID |

**Request Example:**
```http
DELETE /api/leaves/65bc12d34e5f6a78b0c1d2e3
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response Example:**
```json
{
  "success": true,
  "message": "Leave request deleted successfully",
  "data": {
    "_id": "65bc12d34e5f6a78b0c1d2e3",
    "leaveId": "leave_1738452342_abc123",
    "isDeleted": true
  }
}
```

**Error Responses:**
| Code | Description |
|------|-------------|
| 400 | Invalid leave ID format |
| 404 | Leave request not found |
| 409 | Cannot delete approved leave (use cancel instead) |

---

## 3. Report API Specifications

### 3.1 GET /api/reports/leaves

Generate comprehensive leave report.

**Access Control:** Admin, HR

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `employeeId` | String | No | Filter by employee |
| `leaveType` | String | No | Filter by leave type |
| `status` | String | No | Filter by status |
| `startDate` | Date | No | Report period start |
| `endDate` | Date | No | Report period end |
| `department` | String | No | Filter by department |

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "summary": {
      "totalLeaves": 45,
      "pendingCount": 12,
      "approvedCount": 28,
      "rejectedCount": 3,
      "cancelledCount": 2,
      "totalLeaveDays": 156,
      "approvedLeaveDays": 98
    },
    "byLeaveType": {
      "Casual Leave": {
        "count": 18,
        "totalDays": 54,
        "approved": 12,
        "pending": 4,
        "rejected": 2
      }
    },
    "byStatus": {
      "Pending": 12,
      "Approved": 28,
      "Rejected": 3,
      "Cancelled": 2
    },
    "leaveRecords": [...]
  }
}
```

### 3.2 GET /api/reports/leave-balance

Generate employee leave balance report.

**Access Control:** Admin, HR

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "leaveTypeStats": [
      {
        "leaveType": "Casual Leave",
        "code": "CASUAL",
        "totalQuota": 144,
        "totalUsed": 54,
        "totalBalance": 90,
        "avgUsedPerEmployee": "4.50"
      }
    ],
    "employeeBalances": [
      {
        "employeeId": "EMP001",
        "name": "John Doe",
        "department": "Engineering",
        "email": "john@example.com",
        "leaveBalances": [
          {
            "leaveType": "Casual Leave",
            "code": "CASUAL",
            "annualQuota": 12,
            "used": 5,
            "balance": 7,
            "isPaid": true
          }
        ]
      }
    ]
  }
}
```

---

## 4. Socket.IO Events

### 4.1 Leave Events

| Event | Trigger | Target | Payload |
|-------|---------|--------|---------|
| `leave:created` | New leave request | Company | `{ leaveId, employee, leaveType, startDate, endDate, status }` |
| `leave:updated` | Leave modified | Company | `{ leaveId, employee, leaveType, status }` |
| `leave:approved` | Leave approved | Company + Employee | `{ leaveId, employee, leaveType, approvedBy }` |
| `leave:rejected` | Leave rejected | Company + Employee | `{ leaveId, employee, leaveType, rejectedBy, reason }` |
| `leave:cancelled` | Leave cancelled | Company | `{ leaveId, employee, leaveType, cancelledBy }` |
| `leave:deleted` | Leave deleted | Company | `{ leaveId, deletedBy }` |
| `leave:balance_updated` | Balance changed | Employee | `{ employeeId, balances }` |

### 4.2 Event Flow Diagram

```
┌─────────────────┐     POST /api/leaves      ┌─────────────────┐
│   Frontend      │ ──────────────────────────▶ │   Backend       │
│   Component     │                            │   Controller    │
└─────────────────┘                            └────────┬────────┘
                                                       │
                                                       ▼
                                                ┌──────────────┐
                                                │ Database CRUD│
                                                └──────┬───────┘
                                                       │
                                                       ▼
                                                ┌──────────────┐
                                                │ Socket.Emit  │
                                                └──────┬───────┘
                                                       │
                            ┌─────────────────────────┼─────────────────────────┐
                            │                         │                         │
                            ▼                         ▼                         ▼
                    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
                    │  Company     │         │  Manager     │         │  Employee    │
                    │  Room        │         │  Notification│         │  Notification│
                    └──────────────┘         └──────────────┘         └──────────────┘
```

---

## 5. Error Handling

### 5.1 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "field": "fieldName",
    "details": {}
  }
}
```

### 5.2 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Field validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Business rule violation |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `INTERNAL_ERROR` | 500 | Server error |

### 5.3 Validation Error Builders

```javascript
// From errorHandler.js
buildValidationError('endDate', 'End date must be after start date')
// → { success: false, error: { code: 'VALIDATION_ERROR', field: 'endDate', ... } }

buildNotFoundError('Leave request', 'leaveId')
// → { success: false, error: { code: 'NOT_FOUND', message: 'Leave request not found', ... } }

buildConflictError('You have overlapping leave requests')
// → { success: false, error: { code: 'CONFLICT', message: '...', ... } }
```

---

## 6. Rate Limiting Recommendations

| Endpoint | Recommended Limit | Window |
|----------|-------------------|--------|
| POST /api/leaves | 5 per user | 1 hour |
| POST /api/leaves/:id/approve | 20 per manager | 1 hour |
| GET /api/leaves | 100 per user | 1 minute |
| GET /api/reports/* | 10 per user | 1 minute |

---

## 7. API Security

### 7.1 Authentication

```javascript
// Middleware: authenticate
router.use(authenticate);

// Extract user from JWT
const user = extractUser(req);
// { userId, companyId, role }
```

### 7.2 Authorization Matrix

| Endpoint | Employee | Manager | HR | Admin |
|----------|----------|---------|-------|-------|
| GET /api/leaves | ❌ | ❌ | ✅ | ✅ |
| GET /api/leaves/my | ✅ | ✅ | ✅ | ✅ |
| POST /api/leaves | ✅ | ✅ | ✅ | ✅ |
| PUT /api/leaves/:id | Owner only | ✅ | ✅ | ✅ |
| DELETE /api/leaves/:id | ❌ | ❌ | ✅ | ✅ |
| POST /api/leaves/:id/approve | ❌ | ✅ | ✅ | ✅ |
| POST /api/leaves/:id/reject | ❌ | ✅ | ✅ | ✅ |

---

## 8. API Testing Examples

### 8.1 cURL Examples

```bash
# Create leave request
curl -X POST http://localhost:3000/api/leaves \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leaveType": "casual",
    "startDate": "2026-02-10",
    "endDate": "2026-02-12",
    "reason": "Family function"
  }'

# Get my leaves
curl -X GET http://localhost:3000/api/leaves/my \
  -H "Authorization: Bearer $TOKEN"

# Approve leave
curl -X POST http://localhost:3000/api/leaves/65bc12d34e5f6a78b0c1d2e3/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comments": "Approved"}'

# Get balance
curl -X GET http://localhost:3000/api/leaves/balance \
  -H "Authorization: Bearer $TOKEN"
```

---

## 9. API Versioning

The current API is version 1 (implicit). Future considerations:

```
/api/v1/leaves     - Current version
/api/v2/leaves     - Future version with breaking changes
```

---

## 10. Postman Collection

### 10.1 Environment Variables

```json
{
  "baseUrl": "http://localhost:3000",
  "token": "{{auth_token}}",
  "companyId": "COMP001",
  "leaveId": "{{created_leave_id}}"
}
```

### 10.2 Collection Structure

```
Leave Management
├── Authentication
│   └── Login
├── Leave CRUD
│   ├── Get All Leaves
│   ├── Get My Leaves
│   ├── Get Leave by ID
│   ├── Create Leave
│   ├── Update Leave
│   └── Delete Leave
├── Leave Actions
│   ├── Approve Leave
│   └── Reject Leave
├── Balance
│   └── Get Leave Balance
└── Reports
    ├── Leave Summary Report
    ├── Leave Balance Report
    └── Monthly Summary
```

---

**Report End**
