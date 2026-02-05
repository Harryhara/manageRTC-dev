# Attendance System Architecture Report

**Project:** manageRTC
**Module:** Attendance Management System
**Analysis Date:** 2026-02-04
**Status:** Backend Complete | Frontend Needs Integration

---

## Executive Summary

The Attendance module in manageRTC is a **hybrid architecture system** with:
- **80% REST API** foundation (complete backend implementation)
- **20% Socket.IO** real-time events (implemented but underutilized)
- **0% Frontend-Backend Integration** (critical gap identified)

The backend is production-ready with comprehensive business logic, multi-tenant support, and role-based access control. However, the frontend components are currently using **mock data only** and are not connected to the backend APIs.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ATTENDANCE SYSTEM ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   FRONTEND   │     │  BACKEND     │     │  DATABASE    │                │
│  │   (React)    │────▶│  (Node.js)   │────▶│ (MongoDB)    │                │
│  │              │     │              │     │              │                │
│  │ ⚠️ MOCK DATA │     │ ✅ COMPLETE  │     │ ✅ COMPLETE  │                │
│  │   ONLY       │     │              │     │              │                │
│  └──────────────┘     └──────┬───────┘     └──────────────┘                │
│                               │                                             │
│                       ┌───────┴────────┐                                   │
│                       │  Socket.IO     │                                   │
│                       │  (Real-time)   │                                   │
│                       └────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Frontend Components (React)

| Component | File Path | Current State | Integration Status |
|-----------|-----------|---------------|-------------------|
| Admin Attendance View | `react/src/feature-module/hrm/attendance/attendanceadmin.tsx` | **Mock Data Only** | ❌ Not Connected |
| Employee Attendance View | `react/src/feature-module/hrm/attendance/attendance_employee.tsx` | **Mock Data Only** | ❌ Not Connected |
| Timesheet Component | `react/src/feature-module/hrm/attendance/timesheet.tsx` | **Mock Data Only** | ❌ Not Connected |
| Attendance Report Page | `react/src/feature-module/administration/reports/attendencereport.tsx` | **Mock Data Only** | ❌ Not Connected |
| REST API Hook | `react/src/hooks/useAttendanceREST.ts` | ✅ Implemented | ⚠️ Not Used by Components |

**Critical Finding:** The `useAttendanceREST` hook exists with complete API integration but is **not imported or used** by any frontend component.

### 2. Backend Controllers (Node.js)

| Controller | File Path | Status | Endpoints |
|------------|-----------|--------|-----------|
| Attendance Controller | `backend/controllers/rest/attendance.controller.js` | ✅ Complete | 10 endpoints |
| Reports Controller | `backend/controllers/reports/attendanceReports.controller.js` | ✅ Complete | 3 endpoints |
| Admin Dashboard | `backend/controllers/admin/admin.controller.js` | ✅ Complete | 2 endpoints |
| Employee Dashboard | `backend/controllers/employee/dashboard.controller.js` | ✅ Complete | 2 endpoints |

### 3. Backend Routes

| Route File | Path Prefix | Status | Middleware |
|------------|-------------|--------|------------|
| `backend/routes/api/attendance.js` | `/api/attendance` | ✅ Complete | JWT Auth + RBAC |

### 4. Database Schema

| Model | File Path | Status | Fields |
|-------|-----------|--------|--------|
| Attendance | `backend/models/attendance/attendance.schema.js` | ✅ Complete | 30+ fields |

### 5. Real-Time Events (Socket.IO)

| Event Type | Status | Usage |
|------------|--------|-------|
| `attendance:created` | ✅ Implemented | Not consumed by frontend |
| `attendance:updated` | ✅ Implemented | Not consumed by frontend |
| `attendance:clock_in` | ✅ Implemented | Not consumed by frontend |
| `attendance:clock_out` | ✅ Implemented | Not consumed by frontend |
| `attendance:deleted` | ✅ Implemented | Not consumed by frontend |

---

## Data Flow Analysis

### Current Data Flow (Mock Data)

```
┌────────────────┐
│  React Component│
│  (attendanceadmin.tsx)
└────────┬───────┘
         │
         ▼
┌────────────────────────────────────┐
│  import attendance_admin_details    │
│  from "../../../core/data/json/..." │
└────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  const data = attendance_admin_details│
│  (Static JSON array)                │
└────────────────────────────────────┘
```

### Required Data Flow (Backend Integration)

```
┌─────────────────────────────────────────────────────────────────┐
│  React Component                                                │
│  (attendanceadmin.tsx)                                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  useAttendanceREST Hook                                         │
│  - fetchAttendance()                                            │
│  - clockIn()                                                    │
│  - clockOut()                                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  REST API                                                       │
│  GET /api/attendance                                            │
│  POST /api/attendance (clock in)                                │
│  PUT /api/attendance/:id (clock out)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Attendance Controller                                          │
│  (backend/controllers/rest/attendance.controller.js)            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  MongoDB Collections (Multi-tenant)                             │
│  - attendance_{companyId}                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Version/Status |
|-------|------------|----------------|
| **Frontend Framework** | React | ✅ Active |
| **State Management** | React Hooks | ✅ Active |
| **UI Components** | Ant Design | ✅ Active |
| **Backend Runtime** | Node.js | ✅ Active |
| **Backend Framework** | Express.js | ✅ Active |
| **Database** | MongoDB | ✅ Active |
| **Multi-tenancy** | Custom Collection-per-Company | ✅ Active |
| **Authentication** | Clerk (JWT) | ✅ Active |
| **Real-time** | Socket.IO | ✅ Active (underutilized) |
| **API Documentation** | Postman Collection | ✅ Available |

---

## Integration Gaps Identified

### Gap 1: Frontend-Backend Disconnection
**Severity:** CRITICAL
**Description:** Frontend components import and use mock JSON data instead of REST API hooks.
**Impact:** No real attendance data is displayed or captured.
**Files Affected:**
- [attendanceadmin.tsx](react/src/feature-module/hrm/attendance/attendanceadmin.tsx)
- [attendance_employee.tsx](react/src/feature-module/hrm/attendance/attendance_employee.tsx)
- [timesheet.tsx](react/src/feature-module/hrm/attendance/timesheet.tsx)
- [attendencereport.tsx](react/src/feature-module/administration/reports/attendencereport.tsx)

### Gap 2: Unused REST Hook
**Severity:** HIGH
**Description:** `useAttendanceREST.ts` hook is implemented but not imported by any component.
**Impact:** Development effort wasted; duplicate implementation needed if not fixed.
**File:** [useAttendanceREST.ts](react/src/hooks/useAttendanceREST.ts)

### Gap 3: Hardcoded Statistics
**Severity:** MEDIUM
**Description:** Dashboard statistics are hardcoded values (e.g., "250 present", "45 late")
**Impact:** No real-time visibility into attendance metrics.
**Files:**
- [attendanceadmin.tsx:277-278](react/src/feature-module/hrm/attendance/attendanceadmin.tsx#L277)
- [attendance_employee.tsx:220-270](react/src/feature-module/hrm/attendance/attendance_employee.tsx#L220)

### Gap 4: Non-functional Export
**Severity:** MEDIUM
**Description:** Export buttons (PDF/Excel) are UI-only without backend implementation.
**Impact:** Cannot generate actual reports.
**Files:**
- [attendanceadmin.tsx:176-193](react/src/feature-module/hrm/attendance/attendanceadmin.tsx#L176)
- [attendance_employee.tsx:125-147](react/src/feature-module/hrm/attendance/attendance_employee.tsx#L125)

### Gap 5: Missing Real-time Consumption
**Severity:** LOW
**Description:** Socket.IO events are broadcast but not consumed by frontend.
**Impact:** No live updates when attendance changes occur.
**File:** [socketBroadcaster.js](backend/utils/socketBroadcaster.js)

---

## Multi-Tenant Architecture

The attendance system uses a **collection-per-company** multi-tenant pattern:

```
MongoDB Database Structure:
├── company_68443081dcdfe43152aebf80/
│   ├── employees
│   ├── attendance
│   ├── leaves
│   └── shifts
├── company_{companyId2}/
│   ├── employees
│   ├── attendance
│   └── ...
```

**Benefits:**
- Complete data isolation between companies
- Single database for all tenants
- Efficient querying per company

**Implementation:**
- `getTenantCollections(companyId)` utility function
- Automatic collection resolution via middleware
- Company ID extracted from JWT token

---

## Security Architecture

### Authentication Flow
```
1. User Login (Clerk)
   ↓
2. JWT Token Generated
   ↓
3. Token sent with API requests
   ↓
4. authenticate middleware validates token
   ↓
5. User info extracted (userId, companyId, role)
   ↓
6. Access control check (requireRole middleware)
   ↓
7. Request processed
```

### Role-Based Access Control (RBAC)

| Role | Access Level | Permissions |
|------|--------------|-------------|
| **Superadmin** | Full System Access | All attendance operations, cross-company views |
| **Admin** | Company Admin | All attendance operations within company |
| **HR** | HR Management | View, edit, bulk operations, reports |
| **Employee** | Self-Service | Clock in/out, view own attendance only |

---

## Performance Considerations

### Database Indexes
The attendance schema includes optimized indexes:
- `{ employee: 1, date: -1 }` - Employee daily attendance queries
- `{ companyId: 1, date: -1 }` - Company-wide date range queries
- `{ companyId: 1, status: 1 }` - Status-based filtering
- `{ employee: 1, isDeleted: 1 }` - Soft delete filtering
- `{ date: 1, status: 1, isDeleted: 1 }` - Complex queries

### Pagination
All list endpoints support pagination:
- Default limit: 20 records
- Maximum limit: 100 records (configurable)
- Response includes: total count, current page, total pages

### Caching Strategy
**Current:** No caching implemented
**Recommendation:** Implement Redis caching for:
- Today's attendance statistics
- Monthly attendance summaries
- Employee clock-in status

---

## Scalability Assessment

### Current Capacity
- **Horizontal Scaling:** Supported (stateless REST API)
- **Database Scaling:** Limited (single MongoDB instance)
- **Real-time Scaling:** Limited (single Socket.IO server)

### Recommendations
1. **Database:** Implement sharding for large-scale deployments
2. **Socket.IO:** Use Redis adapter for multi-server Socket.IO
3. **Load Balancing:** Add Nginx/HAProxy for API load balancing
4. **CDN:** Serve static assets via CDN

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Production Environment                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │  Nginx/CDN   │────│  React Build │────│  Static Files │     │
│  │  (Port 80)   │    │  (Frontend)  │    │  (Assets)    │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              Node.js Backend (Express)                   ││
│  │  - REST API (Port 5000)                                  ││
│  │  - Socket.IO (Port 5000)                                 ││
│  └────────────────────────┬─────────────────────────────────┘│
│                           │                                   │
│                           ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              MongoDB (Port 27017)                        ││
│  │  - Multi-tenant collections                             ││
│  └──────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Monitoring & Logging

### Current Implementation
- Console logging for API requests
- Error logging via error handler middleware
- Socket.IO event broadcasting

### Recommended Additions
1. **Application Logging:** Winston or Pino for structured logs
2. **Request Tracing:** Distributed tracing (Jaeger/Zipkin)
3. **Metrics:** Prometheus/Grafana for performance monitoring
4. **Error Tracking:** Sentry for error aggregation

---

## Configuration Management

### Environment Variables Required
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/manageRTC

# Authentication
CLERK_SECRET_KEY=your_clerk_secret_key

# Server
PORT=5000
NODE_ENV=production

# Socket.IO (if using Redis adapter)
REDIS_URL=redis://localhost:6379

# Multi-tenancy
DEFAULT_COMPANY_ID=68443081dcdfe43152aebf80
```

---

## Dependency Map

```
attendanceadmin.tsx
    ├── attendanceadmin.tsx (mock data)
    ├── all_routes.tsx (routing)
    ├── PredefinedDateRanges (date picker)
    ├── Table component
    └── ImageWithBasePath
    └── ❌ NOT using: useAttendanceREST.ts

attendance_employee.tsx
    ├── attendanceemployee.tsx (mock data)
    ├── all_routes.tsx (routing)
    ├── PredefinedDateRanges
    ├── Table component
    └── ❌ NOT using: useAttendanceREST.ts

useAttendanceREST.ts (unused)
    ├── api service (get, post, put)
    ├── message (antd)
    └── Attendance interface

attendance.controller.js
    ├── getTenantCollections
    ├── errorHandler middleware
    ├── apiResponse utilities
    └── socketBroadcaster
```

---

## Summary & Next Steps

### What Works ✅
1. Complete backend REST API with 10+ endpoints
2. Comprehensive database schema with business logic
3. Role-based access control implementation
4. Multi-tenant architecture
5. Socket.IO real-time events
6. REST API hook ready for use

### What Needs Work ⚠️
1. **CRITICAL:** Connect frontend components to REST API
2. **HIGH:** Implement real-time Socket.IO consumption in frontend
3. **MEDIUM:** Add PDF/Excel export functionality
4. **LOW:** Add caching layer for performance

### Immediate Action Items
1. Replace mock data imports with `useAttendanceREST` hook
2. Wire up statistics endpoints to dashboard cards
3. Implement live attendance updates via Socket.IO
4. Connect export buttons to backend report generation
