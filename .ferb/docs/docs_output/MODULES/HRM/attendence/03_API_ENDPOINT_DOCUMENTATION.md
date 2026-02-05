# API Endpoint Documentation - Attendance Module

**Project:** manageRTC
**Module:** Attendance Management System
**Base URL:** `http://localhost:5000`
**API Version:** 1.0.0
**Authentication:** JWT (Clerk)

---

## Overview

The Attendance module provides **10 REST API endpoints** for complete attendance management including clock-in/clock-out, statistics, reporting, and bulk operations.

---

## Authentication

All endpoints require JWT authentication via Clerk.

**Header:**
```
Authorization: Bearer {token}
```

**Token Payload:**
```json
{
  "userId": "user_123abc",
  "companyId": "68443081dcdfe43152aebf80",
  "role": "admin|hr|employee|superadmin"
}
```

---

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Detailed error message",
    "details": { ... }
  }
}
```

---

## Endpoints

### 1. Get All Attendance Records

**Endpoint:** `GET /api/attendance`

**Description:** Retrieve paginated attendance records with filtering and sorting.

**Access Control:** Admin, HR, Superadmin

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | Number | No | 1 | Page number |
| `limit` | Number | No | 20 | Records per page (max 100) |
| `search` | String | No | - | Search in notes/managerNotes |
| `status` | String | No | - | Filter by status (present/absent/late/etc.) |
| `employee` | String | No | - | Filter by employeeId |
| `startDate` | Date | No | - | Filter start date (ISO 8601) |
| `endDate` | Date | No | - | Filter end date (ISO 8601) |
| `sortBy` | String | No | date | Sort field |
| `order` | String | No | desc | Sort order (asc/desc) |

**Example Request:**
```bash
GET /api/attendance?page=1&limit=10&status=present&startDate=2026-01-01&endDate=2026-01-31&sortBy=date&order=desc
```

**Example Response:**
```json
{
  "success": true,
  "message": "Attendance records retrieved successfully",
  "data": [
    {
      "_id": "67a1b2c3d4e5f67890abcdef",
      "attendanceId": "att_1736035200000_abc123",
      "employeeId": "EMP001",
      "employeeName": "John Doe",
      "date": "2026-01-04T09:00:00.000Z",
      "clockIn": {
        "time": "2026-01-04T09:00:00.000Z",
        "location": { "type": "office" }
      },
      "clockOut": {
        "time": "2026-01-04T18:45:00.000Z",
        "location": { "type": "office" }
      },
      "hoursWorked": 9.25,
      "regularHours": 8,
      "overtimeHours": 1.25,
      "status": "present"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `403` - Forbidden (insufficient role)

---

### 2. Get Single Attendance Record

**Endpoint:** `GET /api/attendance/:id`

**Description:** Retrieve a single attendance record by ID.

**Access Control:** All authenticated users

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | ObjectId | Yes | Attendance record ID |

**Example Request:**
```bash
GET /api/attendance/67a1b2c3d4e5f67890abcdef
```

**Example Response:**
```json
{
  "success": true,
  "message": "Attendance record found",
  "data": {
    "_id": "67a1b2c3d4e5f67890abcdef",
    "attendanceId": "att_1736035200000_abc123",
    "employeeId": "EMP001",
    "date": "2026-01-04T09:00:00.000Z",
    "clockIn": { "time": "2026-01-04T09:00:00.000Z" },
    "clockOut": { "time": "2026-01-04T18:45:00.000Z" },
    "hoursWorked": 9.25,
    "status": "present"
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `404` - Attendance record not found

---

### 3. Create Attendance (Clock In)

**Endpoint:** `POST /api/attendance`

**Description:** Clock in an employee. Creates a new attendance record.

**Access Control:** All authenticated users

**Request Body:**

```json
{
  "clockIn": {
    "time": "2026-01-04T09:00:00.000Z",
    "location": {
      "type": "office",
      "coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "ipAddress": "192.168.1.100",
      "deviceId": "device-uuid-123"
    },
    "notes": "Working from main office"
  },
  "shiftId": "67a1f2e3d4c5b6a7890def01"
}
```

**Field Validation:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `clockIn.time` | Date | No | Defaults to now |
| `clockIn.location.type` | String | No | office/remote/client-site/other |
| `clockIn.location.coordinates` | Object | No | Must have latitude/longitude |
| `clockIn.location.ipAddress` | String | No | Valid IP format |
| `clockIn.location.deviceId` | String | No | Device identifier |
| `clockIn.notes` | String | No | Max 500 characters |
| `shiftId` | String | No | Valid shift ObjectId |

**Business Rules:**
- Employee is automatically resolved from JWT token
- Cannot clock in if already clocked in today
- `attendanceId` auto-generated
- Status set to 'present'
- Socket.IO event broadcasted

**Example Response:**
```json
{
  "success": true,
  "message": "Clocked in successfully",
  "data": {
    "_id": "67a1b2c3d4e5f67890abcdef",
    "attendanceId": "att_1736035200000_abc123xyz",
    "employeeId": "EMP001",
    "employeeName": "John Doe",
    "date": "2026-01-04T09:00:00.000Z",
    "clockIn": {
      "time": "2026-01-04T09:00:00.000Z",
      "location": { "type": "office" }
    },
    "status": "present",
    "createdAt": "2026-01-04T09:00:00.000Z"
  }
}
```

**Status Codes:**
- `201` - Created successfully
- `400` - Validation error
- `409` - Already clocked in
- `401` - Unauthorized

---

### 4. Update Attendance (Clock Out)

**Endpoint:** `PUT /api/attendance/:id`

**Description:** Clock out an employee. Updates an existing attendance record.

**Access Control:** All authenticated users

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | ObjectId | Yes | Attendance record ID |

**Request Body:**

```json
{
  "clockOut": {
    "time": "2026-01-04T18:45:00.000Z",
    "location": {
      "type": "office",
      "coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "ipAddress": "192.168.1.100",
      "deviceId": "device-uuid-123"
    },
    "notes": "Completed all tasks"
  },
  "breakDuration": 45
}
```

**Business Rules:**
- Cannot clock out without clocking in
- Cannot clock out twice
- Hours calculated automatically
- Regular/overtime hours calculated
- Late/early departure detection
- Socket.IO event broadcasted

**Example Response:**
```json
{
  "success": true,
  "message": "Clocked out successfully",
  "data": {
    "_id": "67a1b2c3d4e5f67890abcdef",
    "attendanceId": "att_1736035200000_abc123xyz",
    "clockIn": { "time": "2026-01-04T09:00:00.000Z" },
    "clockOut": { "time": "2026-01-04T18:45:00.000Z" },
    "hoursWorked": 9.25,
    "regularHours": 8,
    "overtimeHours": 1.25,
    "isLate": false,
    "lateMinutes": 0,
    "status": "present"
  }
}
```

**Status Codes:**
- `200` - Updated successfully
- `400` - Validation error
- `404` - Attendance not found
- `409` - Already clocked out / Not clocked in

---

### 5. Delete Attendance (Soft Delete)

**Endpoint:** `DELETE /api/attendance/:id`

**Description:** Soft delete an attendance record.

**Access Control:** Admin, Superadmin

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | ObjectId | Yes | Attendance record ID |

**Business Rules:**
- Sets `isDeleted: true`
- Records `deletedAt` timestamp
- Records `deletedBy` user
- Socket.IO event broadcasted

**Example Response:**
```json
{
  "success": true,
  "message": "Attendance record deleted successfully",
  "data": {
    "_id": "67a1b2c3d4e5f67890abcdef",
    "attendanceId": "att_1736035200000_abc123xyz",
    "isDeleted": true
  }
}
```

**Status Codes:**
- `200` - Deleted successfully
- `401` - Unauthorized
- `403` - Forbidden (HR not allowed)
- `404` - Attendance not found

---

### 6. Get My Attendance

**Endpoint:** `GET /api/attendance/my`

**Description:** Get current user's attendance records.

**Access Control:** All authenticated users

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | Number | No | 1 | Page number |
| `limit` | Number | No | 31 | Records per page |
| `startDate` | Date | No | - | Filter start date |
| `endDate` | Date | No | - | Filter end date |
| `status` | String | No | - | Filter by status |

**Example Request:**
```bash
GET /api/attendance/my?startDate=2026-01-01&endDate=2026-01-31
```

**Example Response:**
```json
{
  "success": true,
  "message": "My attendance records retrieved successfully",
  "data": [
    {
      "_id": "67a1b2c3d4e5f67890abcdef",
      "employeeId": "EMP001",
      "date": "2026-01-04T09:00:00.000Z",
      "clockIn": { "time": "2026-01-04T09:00:00.000Z" },
      "clockOut": { "time": "2026-01-04T18:45:00.000Z" },
      "hoursWorked": 9.25,
      "status": "present"
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized

---

### 7. Get Attendance by Date Range

**Endpoint:** `GET /api/attendance/daterange`

**Description:** Get attendance records within a date range.

**Access Control:** Admin, HR, Superadmin

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | Date | Yes | Start date (ISO 8601) |
| `endDate` | Date | Yes | End date (ISO 8601) |
| `page` | Number | No | Page number (default: 1) |
| `limit` | Number | No | Records per page (default: 31) |

**Example Request:**
```bash
GET /api/attendance/daterange?startDate=2026-01-01&endDate=2026-01-31&page=1&limit=31
```

**Example Response:**
```json
{
  "success": true,
  "message": "Attendance records retrieved successfully",
  "data": [
    { "_id": "...", "date": "2026-01-01T...", "status": "present" },
    { "_id": "...", "date": "2026-01-02T...", "status": "present" }
  ],
  "pagination": {
    "page": 1,
    "limit": 31,
    "total": 22,
    "totalPages": 1
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Missing startDate/endDate
- `401` - Unauthorized
- `403` - Forbidden

---

### 8. Get Attendance by Employee

**Endpoint:** `GET /api/attendance/employee/:employeeId`

**Description:** Get all attendance records for a specific employee.

**Access Control:** Admin, HR, Superadmin

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `employeeId` | String | Yes | Employee ID |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | Number | No | 1 | Page number |
| `limit` | Number | No | 31 | Records per page |
| `startDate` | Date | No | - | Filter start date |
| `endDate` | Date | No | - | Filter end date |

**Example Request:**
```bash
GET /api/attendance/employee/EMP001?page=1&limit=10
```

**Example Response:**
```json
{
  "success": true,
  "message": "Employee attendance records retrieved successfully",
  "data": [
    {
      "_id": "67a1b2c3d4e5f67890abcdef",
      "employeeId": "EMP001",
      "employeeName": "John Doe",
      "date": "2026-01-04T09:00:00.000Z",
      "clockIn": { "time": "2026-01-04T09:00:00.000Z" },
      "status": "present"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 22,
    "totalPages": 3
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid employeeId format
- `401` - Unauthorized
- `403` - Forbidden

---

### 9. Get Attendance Statistics

**Endpoint:** `GET /api/attendance/stats`

**Description:** Get aggregated attendance statistics.

**Access Control:** Admin, HR, Superadmin

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | Date | No | Filter start date |
| `endDate` | Date | No | Filter end date |
| `employee` | String | No | Filter by employeeId |

**Example Request:**
```bash
GET /api/attendance/stats?startDate=2026-01-01&endDate=2026-01-31
```

**Example Response:**
```json
{
  "success": true,
  "message": "Attendance statistics retrieved successfully",
  "data": {
    "total": 500,
    "present": 450,
    "absent": 20,
    "late": 25,
    "halfDay": 5,
    "totalHoursWorked": "3850.50",
    "averageHoursPerDay": "7.70",
    "attendanceRate": "90.00",
    "lateRate": "5.00"
  }
}
```

**Statistics Calculated:**

| Field | Formula | Description |
|-------|---------|-------------|
| `total` | Count of all records | Total attendance records |
| `present` | Count where status='present' | Present days |
| `absent` | Count where status='absent' | Absent days |
| `late` | Count where status='late' | Late arrivals |
| `halfDay` | Count where status='half-day' | Half-days |
| `totalHoursWorked` | Sum(workHours) | Total hours |
| `averageHoursPerDay` | totalHoursWorked / total | Daily average |
| `attendanceRate` | (present / total) * 100 | Attendance % |
| `lateRate` | (late / total) * 100 | Late arrival % |

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `403` - Forbidden

---

### 10. Bulk Attendance Actions

**Endpoint:** `POST /api/attendance/bulk`

**Description:** Perform bulk operations on multiple attendance records.

**Access Control:** Admin, HR, Superadmin

**Request Body:**

```json
{
  "action": "approve-regularization",
  "attendanceIds": [
    "67a1b2c3d4e5f67890abcdef",
    "67a1b2c3d4e5f67890abcdeg"
  ],
  "data": {
    "status": "present",
    "reason": "Manager approved"
  }
}
```

**Supported Actions:**

| Action | Description | Required `data` |
|--------|-------------|-----------------|
| `approve-regularization` | Approve regularization requests | None |
| `reject-regularization` | Reject regularization requests | `reason` (string) |
| `update-status` | Update attendance status | `status` (string) |
| `bulk-delete` | Soft delete multiple records | None |

**Example Request (Approve Regularization):**
```bash
POST /api/attendance/bulk
{
  "action": "approve-regularization",
  "attendanceIds": ["67a1b2c3d4e5f67890abcdef"]
}
```

**Example Request (Reject Regularization):**
```bash
POST /api/attendance/bulk
{
  "action": "reject-regularization",
  "attendanceIds": ["67a1b2c3d4e5f67890abcdef"],
  "data": {
    "reason": "Insufficient justification provided"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Bulk action completed: 2 of 2 attendance records updated",
  "data": {
    "action": "approve-regularization",
    "requested": 2,
    "updated": 2,
    "results": [
      {
        "attendanceId": "att_1736035200000_abc123",
        "_id": "67a1b2c3d4e5f67890abcdef",
        "success": true
      },
      {
        "attendanceId": "att_1736035200000_def456",
        "_id": "67a1b2c3d4e5f67890abcdeg",
        "success": true
      }
    ]
  }
}
```

**Status Codes:**
- `200` - Bulk action completed
- `400` - Invalid action or missing parameters
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Attendance records not found

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTHENTICATION_ERROR` | 401 | Invalid or missing token |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT_ERROR` | 409 | Resource conflict (duplicate, etc.) |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

**Current:** No rate limiting implemented

**Recommended Limits:**

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| Clock In/Out | 10 requests | 1 minute |
| List Endpoints | 100 requests | 1 minute |
| Statistics | 30 requests | 1 minute |

---

## Socket.IO Real-Time Events

All CRUD operations trigger Socket.IO events:

| Event | Trigger |
|-------|---------|
| `attendance:created` | New attendance created |
| `attendance:updated` | Attendance updated |
| `attendance:clock_in` | Employee clocked in |
| `attendance:clock_out` | Employee clocked out |
| `attendance:deleted` | Attendance deleted |
| `attendance:bulk_updated` | Bulk action completed |

**Event Payload:**
```javascript
{
  companyId: "68443081dcdfe43152aebf80",
  attendance: { ... },
  performedBy: "user_123abc"
}
```

---

## Testing with Postman

**Collection:** `postman/Phase2_Attendance_Leave_APIs.json`

**Environment Variables:**
```json
{
  "baseUrl": "http://localhost:5000",
  "token": "your_jwt_token_here",
  "companyId": "68443081dcdfe43152aebf80"
}
```

**Example Collection Structure:**
```
├── Attendance
│   ├── GET All Attendance
│   ├── GET My Attendance
│   ├── GET Attendance by Date Range
│   ├── GET Attendance by Employee
│   ├── GET Attendance Statistics
│   ├── POST Clock In
│   ├── PUT Clock Out
│   ├── DELETE Attendance
│   └── POST Bulk Actions
```

---

## Summary

| Endpoint | Method | Access | Status |
|----------|--------|--------|--------|
| `/api/attendance` | GET | Admin, HR, Superadmin | ✅ Ready |
| `/api/attendance/my` | GET | All | ✅ Ready |
| `/api/attendance/daterange` | GET | Admin, HR, Superadmin | ✅ Ready |
| `/api/attendance/stats` | GET | Admin, HR, Superadmin | ✅ Ready |
| `/api/attendance/employee/:id` | GET | Admin, HR, Superadmin | ✅ Ready |
| `/api/attendance/:id` | GET | All | ✅ Ready |
| `/api/attendance` | POST | All | ✅ Ready |
| `/api/attendance/:id` | PUT | All | ✅ Ready |
| `/api/attendance/:id` | DELETE | Admin, Superadmin | ✅ Ready |
| `/api/attendance/bulk` | POST | Admin, HR, Superadmin | ✅ Ready |

**All 10 endpoints are fully implemented and production-ready.**
