# 🔌 API DESIGN SPECIFICATIONS
## REST API Endpoints - Complete Design Reference

**Version:** 1.0
**Last Updated:** January 28, 2026

---

## 📋 TABLE OF CONTENTS

1. [API Standards](#api-standards)
2. [Common Response Format](#common-response-format)
3. [Error Codes](#error-codes)
4. [HRMS Endpoints](#hrms-endpoints)
5. [Project Management Endpoints](#project-management-endpoints)
6. [CRM Endpoints](#crm-endpoints)

---

## 1. API STANDARDS

### 1.1 Base URL

```
Development: http://localhost:5000/api
Production:  https://api.manage-rtc.com/api
```

### 1.2 HTTP Methods

| Method | Usage | Idempotent |
|--------|-------|-----------|
| GET | Retrieve resources | ✅ Yes |
| POST | Create new resource | ❌ No |
| PUT | Update entire resource | ✅ Yes |
| PATCH | Partial update | ❌ No |
| DELETE | Soft delete resource | ✅ Yes |

### 1.3 Authentication

All endpoints require Clerk JWT token:

```
Authorization: Bearer <clerk_jwt_token>
```

### 1.4 Rate Limiting

```
Default: 100 requests per 15 minutes per IP
Authenticated: 1000 requests per 15 minutes per user
```

---

## 2. COMMON RESPONSE FORMAT

### 2.1 Success Response

```json
{
  "success": true,
  "data": {
    // Resource data
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  },
  "requestId": "abc-123"
}
```

### 2.2 Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable error message",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "requestId": "abc-123"
  }
}
```

---

## 3. ERROR CODES

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid input data |
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists |
| INTERNAL_ERROR | 500 | Server error |

---

## 4. HRMS ENDPOINTS

### 4.1 Employees API

#### GET /api/employees

**Description:** List all employees with pagination and filtering

**Authentication:** Required (Admin, HR, Superadmin)

**Query Parameters:**
```
page: integer (default: 1)
limit: integer (default: 20, max: 100)
search: string (searches in name, email, employeeCode)
department: string (department ID filter)
status: string (Active, Probation, Resigned, etc.)
designation: string (designation ID filter)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f5d1234567890abcdef",
      "employeeId": "EMP-2026-001",
      "firstName": "John",
      "lastName": "Doe",
      "fullName": "John Doe",
      "email": "john.doe@company.com",
      "phone": "+1234567890",
      "employeeCode": "EMP001",
      "department": {
        "_id": "dept-123",
        "name": "Engineering"
      },
      "designation": {
        "_id": "des-123",
        "title": "Senior Developer"
      },
      "status": "Active",
      "joiningDate": "2024-01-15T00:00:00.000Z",
      "reportingTo": {
        "_id": "emp-456",
        "fullName": "Jane Smith"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

#### GET /api/employees/:id

**Description:** Get single employee by ID

**Authentication:** Required

**URL Parameters:**
```
id: string (employee MongoDB _id)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f5d1234567890abcdef",
    "employeeId": "EMP-2026-001",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "phone": "+1234567890",
    "dateOfBirth": "1990-05-15T00:00:00.000Z",
    "gender": "Male",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "country": "USA",
      "postalCode": "10001"
    },
    "employeeCode": "EMP001",
    "joiningDate": "2024-01-15T00:00:00.000Z",
    "confirmationDate": "2024-02-15T00:00:00.000Z",
    "department": {
      "_id": "dept-123",
      "name": "Engineering"
    },
    "designation": {
      "_id": "des-123",
      "title": "Senior Developer",
      "level": "Senior"
    },
    "reportingTo": {
      "_id": "emp-456",
      "fullName": "Jane Smith"
    },
    "employmentType": "Full-time",
    "employmentStatus": "Active",
    "salary": {
      "basic": 5000,
      "hra": 2000,
      "allowances": 1000,
      "currency": "USD"
    },
    "leaveBalance": {
      "casual": 10,
      "sick": 10,
      "earned": 15,
      "compOff": 2
    },
    "documents": [
      {
        "type": "Resume",
        "fileName": "john_doe_resume.pdf",
        "fileUrl": "https://s3.bucket/...",
        "uploadedAt": "2024-01-15T10:00:00.000Z"
      }
    ],
    "skills": ["JavaScript", "React", "Node.js"],
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-20T14:30:00.000Z"
  }
}
```

---

#### POST /api/employees

**Description:** Create new employee

**Authentication:** Required (Admin, HR, Superadmin)

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "phone": "+1234567890",
  "dateOfBirth": "1990-05-15",
  "gender": "Male",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "postalCode": "10001"
  },
  "departmentId": "dept-123",
  "designationId": "des-123",
  "reportingTo": "emp-456",
  "employmentType": "Full-time",
  "salary": {
    "basic": 5000,
    "hra": 2000,
    "allowances": 1000
  }
}
```

**Validation Rules:**
```
firstName: required, 2-50 characters
lastName: required, 2-50 characters
email: required, valid email format, unique
phone: optional, 10-15 digits
departmentId: required, must exist
designationId: required, must exist
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f5d1234567890abcdef",
    "employeeId": "EMP-2026-001",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "createdAt": "2024-01-28T10:00:00.000Z"
  }
}
```

**Error Responses:**
```json
// Validation error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}

// Duplicate email
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Employee with this email already exists"
  }
}
```

---

#### PUT /api/employees/:id

**Description:** Update employee

**Authentication:** Required (Admin, HR, Superadmin)

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+1234567890",
  "designationId": "des-456"
}
```

**Response:** Same structure as POST

---

#### DELETE /api/employees/:id

**Description:** Soft delete employee

**Authentication:** Required (Admin, Superadmin only)

**Response:**
```json
{
  "success": true,
  "message": "Employee deleted successfully",
  "data": {
    "_id": "64f5d1234567890abcdef",
    "isDeleted": true,
    "deletedAt": "2024-01-28T10:00:00.000Z"
  }
}
```

---

### 4.2 Attendance API

#### POST /api/attendance/clock-in

**Description:** Clock in for work

**Authentication:** Required (All employees)

**Request Body:**
```json
{
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "New York, NY"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f5d1234567890abcdef",
    "employeeId": "emp-123",
    "date": "2026-01-28T00:00:00.000Z",
    "clockIn": "2026-01-28T09:00:00.000Z",
    "clockInLocation": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "New York, NY"
    },
    "status": "Present"
  }
}
```

---

#### PUT /api/attendance/:id/clock-out

**Description:** Clock out

**Authentication:** Required (All employees)

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f5d1234567890abcdef",
    "clockOut": "2026-01-28T18:00:00.000Z",
    "workHours": 9.0,
    "overtimeHours": 1.0
  }
}
```

---

### 4.3 Leave API

#### POST /api/leaves

**Description:** Apply for leave

**Authentication:** Required (All employees)

**Request Body:**
```json
{
  "leaveTypeId": "type-annual",
  "fromDate": "2026-02-01",
  "toDate": "2026-02-05",
  "numberOfDays": 5,
  "reason": "Family vacation",
  "isHalfDay": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f5d1234567890abcdef",
    "leaveId": "LEAVE-2026-001",
    "employeeId": "emp-123",
    "status": "Pending",
    "appliedAt": "2026-01-28T10:00:00.000Z"
  }
}
```

---

#### POST /api/leaves/:id/approve

**Description:** Approve leave request

**Authentication:** Required (Admin, HR)

**Request Body:**
```json
{
  "comments": "Approved, enjoy your vacation!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64f5d1234567890abcdef",
    "status": "Approved",
    "approvedBy": "hr-456",
    "approvedAt": "2026-01-28T10:30:00.000Z"
  }
}
```

---

## 5. PROJECT MANAGEMENT ENDPOINTS

### 5.1 Projects API

#### GET /api/projects

**Description:** List all projects

**Authentication:** Required (Admin, HR, Employee)

**Query Parameters:**
```
page: integer
limit: integer
search: string
status: string (Active, Completed, On Hold, Cancelled)
priority: string (High, Medium, Low)
client: string (client ID filter)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f5d1234567890abcdef",
      "projectId": "PRJ-2026-001",
      "name": "Website Redesign",
      "description": "Complete website overhaul",
      "client": "Acme Corp",
      "startDate": "2026-01-01T00:00:00.000Z",
      "dueDate": "2026-06-30T00:00:00.000Z",
      "priority": "High",
      "status": "Active",
      "progress": 45,
      "teamLeader": {
        "_id": "emp-123",
        "fullName": "John Doe"
      },
      "teamMembers": [
        { "_id": "emp-123", "fullName": "John Doe" },
        { "_id": "emp-456", "fullName": "Jane Smith" }
      ],
      "isOverdue": false
    }
  ],
  "pagination": { }
}
```

---

#### POST /api/projects

**Description:** Create new project

**Authentication:** Required (Admin, HR)

**Request Body:**
```json
{
  "name": "Website Redesign",
  "description": "Complete website overhaul",
  "client": "Acme Corp",
  "startDate": "2026-01-01",
  "dueDate": "2026-06-30",
  "priority": "High",
  "teamLeader": "emp-123",
  "teamMembers": ["emp-123", "emp-456"],
  "projectValue": 50000
}
```

**Validation Rules:**
```
name: required, 3-100 characters
client: required
startDate: required, must be before dueDate
dueDate: required, must be after startDate
teamLeader: required, must exist
```

---

### 5.2 Tasks API

#### GET /api/tasks

**Description:** List all tasks

**Query Parameters:**
```
project: string (project ID filter)
assignee: string (employee ID filter)
status: string (To Do, In Progress, Review, Completed)
priority: string (High, Medium, Low)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f5d1234567890abcdef",
      "taskId": "TSK-2026-001",
      "title": "Design homepage",
      "description": "Create mockups",
      "projectId": "proj-123",
      "projectName": "Website Redesign",
      "assignedTo": [
        { "_id": "emp-123", "fullName": "John Doe" }
      ],
      "status": "In Progress",
      "priority": "High",
      "progress": 60,
      "startDate": "2026-01-15",
      "dueDate": "2026-01-20",
      "estimatedHours": 8,
      "actualHours": 5
    }
  ]
}
```

---

## 6. CRM ENDPOINTS

### 6.1 Leads API

#### GET /api/leads

**Description:** List all leads

**Query Parameters:**
```
page: integer
limit: integer
search: string
status: string (New, Contacted, Qualified, Proposal, Won, Lost)
source: string (Website, Referral, Cold Call, etc.)
assignee: string (employee ID filter)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f5d1234567890abcdef",
      "leadId": "LD-2026-001",
      "name": "Acme Corp",
      "company": "Acme Corporation",
      "email": "contact@acme.com",
      "phone": "+1234567890",
      "status": "Qualified",
      "source": "Website",
      "assignee": {
        "_id": "emp-123",
        "fullName": "John Doe"
      },
      "estimatedValue": 50000,
      "probability": 60,
      "createdAt": "2026-01-15T10:00:00.000Z"
    }
  ]
}
```

---

#### POST /api/leads

**Description:** Create new lead

**Request Body:**
```json
{
  "name": "Acme Corp",
  "company": "Acme Corporation",
  "email": "contact@acme.com",
  "phone": "+1234567890",
  "source": "Website",
  "assigneeId": "emp-123",
  "estimatedValue": 50000,
  "notes": "Interested in enterprise plan"
}
```

---

### 6.2 Deals API

#### GET /api/deals

**Description:** List all deals

**Query Parameters:**
```
pipeline: string (pipeline ID filter)
stage: string (stage filter)
status: string (Open, Won, Lost)
assignee: string (employee ID filter)
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f5d1234567890abcdef",
      "dealId": "DEAL-2026-001",
      "title": "Enterprise Contract",
      "contactId": "contact-123",
      "companyId": "company-123",
      "value": 100000,
      "pipelineId": "pipe-123",
      "stage": "Proposal",
      "probability": 60,
      "expectedCloseDate": "2026-03-31",
      "status": "Open"
    }
  ]
}
```

---

## 7. PAGINATION STANDARD

### 7.1 Request Format

```
GET /api/employees?page=1&limit=20&search=john
```

### 7.2 Response Format

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 7.3 Pagination Rules

- `page` starts at 1
- `limit` max value is 100
- `total` is total number of records
- `pages` is total pages calculated as `Math.ceil(total/limit)`
- `hasNext` is true if `page < pages`
- `hasPrev` is true if `page > 1`

---

## 8. FILTERING & SEARCH

### 8.1 Text Search

```
GET /api/employees?search=john
```

Searches in: firstName, lastName, email, employeeCode

### 8.2 Exact Filter

```
GET /api/employees?department=dept-123&status=Active
```

### 8.3 Date Range

```
GET /api/employees?joiningDateFrom=2024-01-01&joiningDateTo=2024-12-31
```

---

## 9. SOCKET.IO EVENTS (For Real-time)

### 9.1 Employee Events

```
employee:created    → Broadcast to HR users
employee:updated    → Broadcast to viewers
employee:deleted    → Broadcast to HR users
employee:status     → Online/offline status
```

### 9.2 Project Events

```
project:created     → Broadcast to team
project:updated     → Broadcast to team
project:progress    → Live progress updates
```

### 9.3 Task Events

```
task:created        → Broadcast to project team
task:updated        → Broadcast to project team
task:moved          → Kanban board updates
task:assigned       → Notify assignee
```

---

## 10. POSTMAN COLLECTION STRUCTURE

### Collection Folders

```
manageRTC API Collection
├── 01. Authentication
│   └── Login
├── 02. Employees
│   ├── List Employees
│   ├── Get Employee
│   ├── Create Employee
│   ├── Update Employee
│   └── Delete Employee
├── 03. Projects
│   ├── List Projects
│   ├── Get Project
│   ├── Create Project
│   ├── Update Project
│   └── Delete Project
├── 04. Tasks
│   ├── List Tasks
│   ├── Get Task
│   ├── Create Task
│   ├── Update Task
│   └── Delete Task
├── 05. Attendance
│   ├── Clock In
│   ├── Clock Out
│   └── Get Attendance
├── 06. Leaves
│   ├── Apply Leave
│   ├── Approve Leave
│   ├── Reject Leave
│   └── Get Leaves
└── 07. Leads
    ├── List Leads
    ├── Get Lead
    ├── Create Lead
    └── Update Lead
```

---

**END OF API DESIGN SPECIFICATIONS**
