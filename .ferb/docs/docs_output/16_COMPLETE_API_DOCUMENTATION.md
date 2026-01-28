# 📚 manageRTC REST API Documentation
## Complete API Reference - All 128 Endpoints

**Generated:** January 28, 2026
**Version:** 1.0.0
**Base URL:** `http://localhost:5000/api`

---

## 📋 TABLE OF CONTENTS

1. [Authentication](#authentication)
2. [Phase 1: Foundation APIs](#phase-1-foundation-apis)
3. [Phase 2: HRMS APIs](#phase-2-hrms-apis)
4. [Phase 3: Asset & Training APIs](#phase-3-asset--training-apis)
5. [Phase 4: CRM & Extended APIs](#phase-4-crm--extended-apis)
6. [Common Patterns](#common-patterns)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## 🔑 AUTHENTICATION

All API endpoints require authentication via Clerk JWT bearer token.

### Headers

```http
Authorization: Bearer <clerk_jwt_token>
Content-Type: application/json
```

### Authentication Flow

1. Frontend authenticates with Clerk
2. Clerk returns JWT token
3. Include token in Authorization header
4. Backend validates token and extracts user metadata

### User Metadata Structure

```javascript
{
  userId: string,
  companyId: string,
  role: 'admin' | 'hr' | 'employee' | 'superadmin'
}
```

---

## 📊 PHASE 1: FOUNDATION APIS

### Employees API (11 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/employees` | List all employees with pagination | Admin, HR, Superadmin |
| GET | `/api/employees/:id` | Get single employee by ID | All authenticated |
| POST | `/api/employees` | Create new employee | Admin, HR, Superadmin |
| PUT | `/api/employees/:id` | Update employee | Admin, HR, Superadmin |
| DELETE | `/api/employees/:id` | Soft delete employee | Admin, Superadmin |
| GET | `/api/employees/search` | Search employees | All authenticated |
| GET | `/api/employees/dashboard` | Employee dashboard stats | All authenticated |

**Sample Request:**
```http
GET /api/employees?page=1&limit=20&department=IT&status=active
Authorization: Bearer <token>
```

**Sample Response:**
```json
{
  "success": true,
  "data": [...],
  "message": "Employees retrieved successfully",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Projects API (8 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/projects` | List all projects | All authenticated |
| GET | `/api/projects/:id` | Get single project | All authenticated |
| POST | `/api/projects` | Create project | Admin, Superadmin |
| PUT | `/api/projects/:id` | Update project | Admin, Superadmin |
| DELETE | `/api/projects/:id` | Soft delete project | Admin, Superadmin |
| GET | `/api/projects/team/:teamId` | Get projects by team | All authenticated |
| GET | `/api/projects/stats` | Project statistics | Admin, Superadmin |
| PUT | `/api/projects/:id/progress` | Update project progress | Project members |

### Tasks API (9 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/tasks` | List all tasks | All authenticated |
| GET | `/api/tasks/:id` | Get single task | All authenticated |
| POST | `/api/tasks` | Create task | Admin, Superadmin |
| PUT | `/api/tasks/:id` | Update task | Admin, Superadmin |
| DELETE | `/api/tasks/:id` | Soft delete task | Admin, Superadmin |
| GET | `/api/tasks/project/:projectId` | Get tasks by project | All authenticated |
| GET | `/api/tasks/assignee/:userId` | Get tasks by assignee | All authenticated |
| PUT | `/api/tasks/:id/status` | Update task status | Task assignee |
| GET | `/api/tasks/stats` | Task statistics | Admin, Superadmin |

### Leads API (11 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/leads` | List all leads | All authenticated |
| GET | `/api/leads/:id` | Get single lead | All authenticated |
| POST | `/api/leads` | Create lead | Admin, Superadmin |
| PUT | `/api/leads/:id` | Update lead | Admin, Superadmin |
| DELETE | `/api/leads/:id` | Soft delete lead | Admin, Superadmin |
| GET | `/api/stage/:stage` | Get leads by stage | All authenticated |
| GET | `/api/leads/source/:source` | Get leads by source | All authenticated |
| GET | `/api/leads/convert` | Get conversion stats | Admin, Superadmin |
| PUT | `/api/leads/:id/stage` | Move lead to next stage | Admin, Superadmin |
| PUT | `/api/leads/:id/convert` | Convert lead to client | Admin, Superadmin |
| GET | `/api/leads/stats` | Lead statistics | Admin, Superadmin |

### Clients API (11 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/clients` | List all clients | All authenticated |
| GET | `/api/clients/:id` | Get single client | All authenticated |
| POST | `/api/clients` | Create client | Admin, Superadmin |
| PUT | `/api/clients/:id` | Update client | Admin, Superadmin |
| DELETE | `/api/clients/:id` | Soft delete client | Admin, Superadmin |
| GET | `/api/clients/tier/:tier` | Get clients by tier | All authenticated |
| GET | `/apilients/type/:type` | Get clients by type | All authenticated |
| GET | `/api/clients/account/:accountId` | Get clients by account manager | All authenticated |
| GET | `/api/contacts` | Get all client contacts | All authenticated |
| PUT | `/api/clients/:id/tier` | Update client tier | Admin, Superadmin |
| GET | `/api/clients/stats` | Client statistics | Admin, Superadmin |

**Phase 1 Total: 49 endpoints ✅**

---

## 📊 PHASE 2: HRMS APIS

### Attendance API (10 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/attendance` | List all attendance records | Admin, HR |
| GET | `/api/attendance/:id` | Get single attendance record | Admin, HR, Employee (own) |
| POST | `/api/attendance/clock-in` | Clock in | All authenticated |
| POST | `/api/attendance/clock-out` | Clock out | All authenticated |
| POST | `/api/attendance/clock-out/:id` | Clock out by ID | All authenticated |
| PUT | `/api/attendance/:id` | Update attendance record | Admin, HR |
| DELETE | `/api/attendance/:id` | Delete attendance record | Admin, Superadmin |
| GET | `/api/attendance/employee/:employeeId` | Get attendance by employee | Admin, HR, Employee (own) |
| GET | `/api/attendance/stats` | Attendance statistics | Admin, HR |
| POST | `/api/attendance/bulk-create` | Bulk create attendance | Admin, HR |

### Leave API (10 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/leaves` | List all leave requests | Admin, HR |
| GET | `/api/leaves/:id` | Get single leave request | Admin, HR, Employee (own) |
| POST | `/api/leaves` | Create leave request | All authenticated |
| PUT | `/api/leaves/:id` | Update leave request | Admin, HR, Employee (own) |
| DELETE | `/api/leaves/:id` | Cancel leave request | Admin, Superadmin |
| PUT | `/api/leaves/:id/approve` | Approve leave request | Admin, HR |
| PUT | `/api/leaves/:id/reject` | Reject leave request | Admin, HR |
| PUT | `/api/leaves/:id/submit` | Submit leave for approval | All authenticated |
| GET | `/api/leaves/balance/:employeeId` | Get leave balance | Admin, HR, Employee (own) |
| GET | `/api/leaves/stats` | Leave statistics | Admin, HR |

**Phase 2 Total: 20 endpoints ✅**

---

## 📊 PHASE 3: ASSET & TRAINING APIS

### Assets API (8 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/assets` | List all assets | Admin, HR |
| GET | `/api/assets/:id` | Get single asset | All authenticated |
| POST | `/api/assets` | Create asset | Admin, HR |
| PUT | `/api/assets/:id` | Update asset | Admin, HR |
| DELETE | `/api/assets/:id` | Delete asset | Admin, Superadmin |
| GET | `/api/assets/category/:category` | Get assets by category | All authenticated |
| GET | `/api/assets/status/:status` | Get assets by status | All authenticated |
| GET | `/api/assets/stats` | Asset statistics | Admin, HR |

### Training API (7 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/trainings` | List all training programs | Admin, HR |
| GET | `/api/trainings/:id` | Get single training | All authenticated |
| POST | `/api/trainings` | Create training | Admin, HR |
| PUT | `/api/trainings/:id` | Update training | Admin, HR |
| DELETE | `/api/trainings/:id` | Delete training | Admin, Superadmin |
| GET | `/api/trainings/type/:type` | Get trainings by type | All authenticated |
| GET | `/api/trainings/stats` | Training statistics | Admin, HR |

**Phase 3 Total: 15 endpoints ✅**

---

## 📊 PHASE 4: CRM & EXTENDED APIS

### Activities API (12 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/activities` | List all activities with pagination | All authenticated |
| GET | `/api/activities/type/:type` | Get activities by type | All authenticated |
| GET | `/api/activities/stats` | Activity statistics | Admin, HR |
| GET | `/api/activities/owners` | Get activity owners | All authenticated |
| GET | `/api/activities/upcoming` | Get upcoming activities (24hrs) | All authenticated |
| GET | `/api/activities/overdue` | Get overdue activities | All authenticated |
| GET | `/api/activities/:id` | Get single activity | All authenticated |
| POST | `/api/activities` | Create activity | All authenticated |
| PUT | `/api/activities/:id` | Update activity | All authenticated |
| PUT | `/api/activities/:id/complete` | Mark activity as complete | All authenticated |
| PUT | `/api/activities/:id/postpone` | Postpone activity | All authenticated |
| DELETE | `/api/activities/:id` | Delete activity | Admin, Superadmin |

**Activity Types:** call, email, meeting, task, follow-up, demo, site-visit, other

### Pipelines API (13 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/pipelines` | List all pipelines | All authenticated |
| GET | `/api/pipelines/type/:type` | Get pipelines by type | All authenticated |
| GET | `/api/pipelines/stats` | Pipeline statistics | Admin, Superadmin |
| GET | `/api/pipelines/overdue` | Get overdue pipelines | Admin, Superadmin |
| GET | `/api/pipelines/closing-soon` | Get pipelines closing soon (7 days) | All authenticated |
| GET | `/api/pipelines/:id` | Get single pipeline | All authenticated |
| POST | `/api/pipelines` | Create pipeline | Admin, Superadmin |
| PUT | `/api/pipelines/:id` | Update pipeline | Admin, Superadmin |
| PUT | `/api/pipelines/:id/move-stage` | Move pipeline to next stage | Admin, Superadmin |
| PUT | `/api/pipelines/:id/won` | Mark pipeline as won | Admin, Superadmin |
| PUT | `/api/pipelines/:id/lost` | Mark pipeline as lost | Admin, Superadmin |
| DELETE | `/api/pipelines/:id` | Delete pipeline | Admin, Superadmin |

**Pipeline Types:** sales, recruitment, support, project, custom

### Holiday Types API (6 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/holiday-types` | Get all holiday types | All authenticated |
| GET | `/api/holiday-types/:id` | Get single holiday type | All authenticated |
| POST | `/api/holiday-types` | Create holiday type | Admin, HR |
| PUT | `/api/holiday-types/:id` | Update holiday type | Admin, HR |
| DELETE | `/api/holiday-types/:id` | Delete holiday type | Admin, Superadmin |
| POST | `/api/holiday-types/initialize` | Initialize default holiday types | Admin, HR |

**Default Holiday Types:** Annual Leave, Sick Leave, Casual Leave, Maternity Leave, Paternity Leave, Unpaid Leave

### Promotions API (9 endpoints)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/promotions` | List all promotions | Admin, HR |
| GET | `/api/promotions/departments` | Get departments for selection | Admin, HR |
| GET | `/api/promotions/designations` | Get designations for selection | Admin, HR |
| GET | `/api/promotions/:id` | Get single promotion | Admin, HR |
| POST | `/api/promotions` | Create promotion | Admin, HR |
| PUT | `/api/promotions/:id` | Update promotion | Admin, HR |
| PUT | `/api/promotions/:id/apply` | Apply promotion | Admin, HR |
| PUT | `/api/promotions/:id/cancel` | Cancel promotion | Admin, HR |
| DELETE | `/api/promotions/:id` | Delete promotion | Admin, Superadmin |

**Promotion Status:** pending, applied, cancelled

**Phase 4 Total: 44 endpoints ✅**

---

## 🔧 COMMON PATTERNS

### Pagination

All list endpoints support pagination:

```http
GET /api/employees?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Filtering

Most endpoints support filtering:

```http
GET /api/employees?department=IT&status=active&search=john
```

### Sort Order

```http
GET /api/employees?sortBy=firstName&order=asc
```

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Resource retrieved successfully"
}
```

**Created Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Resource created successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": { ... }
  }
}
```

---

## ❌ ERROR HANDLING

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| VALIDATION_ERROR | 400 | Invalid input data |
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict (duplicate, etc.) |
| INTERNAL_ERROR | 500 | Server error |

### Sample Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

---

## ⚡ RATE LIMITING

Rate limiting is configured per user (not per IP) and can be adjusted based on user role.

| Role | Limit | Window |
|------|-------|--------|
| Admin | 1000 requests | 15 minutes |
| HR | 500 requests | 15 minutes |
| Employee | 200 requests | 15 minutes |

**Rate Limit Response:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later"
  }
}
```

---

## 📊 ENDPOINT SUMMARY

| Phase | Module | Endpoints |
|-------|--------|-----------|
| **Phase 1** | Foundation | 49 |
| Phase 1 | Employees | 11 |
| Phase 1 | Projects | 8 |
| Phase 1 | Tasks | 9 |
| Phase 1 | Leads | 11 |
| Phase 1 | Clients | 11 |
| **Phase 2** | HRMS | 20 |
| Phase 2 | Attendance | 10 |
| Phase 2 | Leave | 10 |
| **Phase 3** | Assets & Training | 15 |
| Phase 3 | Assets | 8 |
| Phase 3 | Training | 7 |
| **Phase 4** | Extended | 44 |
| Phase 4 | Activities | 12 |
| Phase 4 | Pipelines | 13 |
| Phase 4 | Holiday Types | 6 |
| Phase 4 | Promotions | 9 |
| **TOTAL** | **All Modules** | **128** |

---

## 📚 SOCKET.IO EVENTS (Real-time Updates)

All REST operations broadcast Socket.IO events for real-time updates.

### Activity Events
- `activity:created` - New activity created
- `activity:updated` - Activity updated
- `activity:completed` - Activity marked complete
- `activity:deleted` - Activity deleted

### Pipeline Events
- `pipeline:created` - New pipeline created
- `pipeline:updated` - Pipeline updated
- `pipeline:stage_changed` - Pipeline stage changed
- `pipeline:won` - Pipeline marked as won
- `pipeline:lost` - Pipeline marked as lost

---

**Last Updated:** January 28, 2026
**Total Endpoints:** 128 REST APIs + 66 Socket.IO Events
**Architecture:** 80% REST + 20% Socket.IO

---

## 📞 SUPPORT

For questions or issues, please contact the development team or refer to:
- [Postman Collections](../../postman/)
- [Migration Progress](../02_PROGRESS_TRACKER.md)
- [Phase Completion Reports](../docs_output/)
