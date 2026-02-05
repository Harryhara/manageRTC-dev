# Database Schema Design - Attendance Module

**Project:** manageRTC
**Module:** Attendance Management System
**Database:** MongoDB
**Schema Version:** 1.0.0

---

## Overview

The Attendance module uses a comprehensive MongoDB schema designed to track employee clock-in/clock-out events, calculate work hours, manage overtime, and support attendance regularization workflows.

---

## Collections

### Primary Collection
```
attendance_{companyId}
```

**Note:** The system uses a collection-per-company multi-tenant pattern. Each company has its own attendance collection isolated by `{companyId}` suffix.

---

## Complete Schema Definition

### Field Reference

| Field Name | Type | Required | Indexed | Default | Description |
|------------|------|----------|---------|---------|-------------|
| `_id` | ObjectId | Auto | Yes | - | Primary key (auto-generated) |
| `attendanceId` | String | No | Yes (sparse) | Auto | Unique human-readable identifier |
| `employeeId` | String | Yes | Yes | - | Reference to employee |
| `employeeName` | String | No | No | - | Cached employee name |
| `companyId` | String | Yes | Yes | - | Company identifier (multi-tenant) |
| `date` | Date | Yes | Yes | - | Attendance date |
| `clockIn.time` | Date | Yes | No | Now | Clock-in timestamp |
| `clockIn.location.type` | String | No | No | 'office' | Location type |
| `clockIn.location.coordinates` | Object | No | No | null | Geo-coordinates |
| `clockIn.location.ipAddress` | String | No | No | null | IP address |
| `clockIn.location.deviceId` | String | No | No | null | Device identifier |
| `clockIn.notes` | String | No | No | null | Clock-in notes |
| `clockOut.time` | Date | No | No | null | Clock-out timestamp |
| `clockOut.location.type` | String | No | No | 'office' | Location type |
| `clockOut.location.coordinates` | Object | No | No | null | Geo-coordinates |
| `clockOut.location.ipAddress` | String | No | No | null | IP address |
| `clockOut.location.deviceId` | String | No | No | null | Device identifier |
| `clockOut.notes` | String | No | No | null | Clock-out notes |
| `hoursWorked` | Number | No | No | 0 | Total hours worked |
| `workHours` | Number | No | No | 0 | Alias for hoursWorked |
| `regularHours` | Number | No | No | 0 | Regular hours (up to 8) |
| `overtimeHours` | Number | No | No | 0 | Overtime hours |
| `status` | String | No | Yes | 'present' | Attendance status |
| `isLate` | Boolean | No | No | false | Late arrival flag |
| `lateMinutes` | Number | No | No | 0 | Minutes late |
| `isEarlyDeparture` | Boolean | No | No | false | Early departure flag |
| `earlyDepartureMinutes` | Number | No | No | 0 | Minutes early |
| `breakDuration` | Number | No | No | 0 | Break time in minutes |
| `breakStartTime` | Date | No | No | null | Break start timestamp |
| `breakEndTime` | Date | No | No | null | Break end timestamp |
| `shiftId` | ObjectId | No | No | null | Reference to shift |
| `scheduledStart` | Date | No | No | null | Scheduled start time |
| `scheduledEnd` | Date | No | No | null | Scheduled end time |
| `isRegularized` | Boolean | No | No | false | Regularization status |
| `regularizationRequest.requested` | Boolean | No | No | false | Request submitted |
| `regularizationRequest.reason` | String | No | No | null | Reason for request |
| `regularizationRequest.requestedBy` | ObjectId | No | No | null | Requester reference |
| `regularizationRequest.requestedAt` | Date | No | No | null | Request timestamp |
| `regularizationRequest.approvedBy` | ObjectId | No | No | null | Approver reference |
| `regularizationRequest.approvedAt` | Date | No | No | null | Approval timestamp |
| `regularizationRequest.status` | String | No | No | 'pending' | Request status |
| `regularizationRequest.rejectionReason` | String | No | No | null | Rejection reason |
| `notes` | String | No | No | null | Employee notes (max 500 chars) |
| `managerNotes` | String | No | No | null | Manager notes (max 500 chars) |
| `isActive` | Boolean | No | No | true | Active status |
| `isDeleted` | Boolean | No | Yes | false | Soft delete flag |
| `createdBy` | ObjectId | No | No | null | Creator reference |
| `updatedBy` | ObjectId | No | No | null | Updater reference |
| `deletedBy` | ObjectId | No | No | null | Deleter reference |
| `deletedAt` | Date | No | No | null | Deletion timestamp |
| `createdAt` | Date | Auto | Yes | Now | Creation timestamp |
| `updatedAt` | Date | Auto | Yes | Now | Update timestamp |

---

## Enums

### Status Enum
```javascript
[
  'present',        // Normal attendance
  'absent',         // No attendance recorded
  'half-day',       // Half day attendance
  'late',           // Late arrival
  'early-departure',// Early departure
  'on-leave',       // Employee on leave
  'holiday',        // Company holiday
  'weekend'         // Weekend day
]
```

### Location Type Enum
```javascript
[
  'office',       // Working from office
  'remote',       // Working from home/remote
  'client-site',  // Working at client location
  'other'         // Other location
]
```

### Regularization Status Enum
```javascript
[
  'pending',   // Awaiting approval
  'approved',  // Request approved
  'rejected'   // Request rejected
]
```

---

## Compound Indexes

| Index Pattern | Purpose | Query Optimization |
|---------------|---------|-------------------|
| `{ employee: 1, date: -1 }` | Employee daily attendance | `getEmployeeAttendance()` |
| `{ companyId: 1, date: -1 }` | Company-wide date queries | `getAttendances()` |
| `{ companyId: 1, status: 1 }` | Status-based filtering | Statistics queries |
| `{ employee: 1, isDeleted: 1 }` | Soft delete filtering | All employee queries |
| `{ date: 1, status: 1, isDeleted: 1 }` | Complex filtering | Report generation |

---

## Virtual Properties

### `totalDuration`
```javascript
// Calculates total duration from clockIn to clockOut in hours
totalDuration = (clockOut.time - clockIn.time) / (1000 * 60 * 60)
```

### `workSession`
```javascript
// Returns structured work session data
workSession = {
  start: clockIn.time,
  end: clockOut.time,
  duration: hoursWorked,
  breakDuration: breakDuration
}
```

---

## Pre-Save Middleware (Business Logic)

### Automatic Calculations

The schema pre-save hook automatically calculates:

1. **Hours Worked:**
   ```javascript
   hoursWorked = (clockOut.time - clockIn.time) - breakDuration
   ```

2. **Regular vs Overtime Hours:**
   ```javascript
   regularHours = Math.min(hoursWorked, 8)
   overtimeHours = Math.max(hoursWorked - 8, 0)
   ```

3. **Late Detection:**
   ```javascript
   isLate = (clockIn.time > 9:30 AM)
   lateMinutes = clockIn.time - 9:30 AM (in minutes)
   ```

4. **Early Departure Detection:**
   ```javascript
   isEarlyDeparture = (clockOut.time < 6:00 PM) AND !isLate
   earlyDepartureMinutes = 6:00 PM - clockOut.time (in minutes)
   ```

5. **Attendance ID Generation:**
   ```javascript
   attendanceId = `att_${timestamp}_${randomString}`
   ```

---

## Instance Methods

### `performClockIn(locationData, notes)`
Records clock-in for an employee.

**Parameters:**
- `locationData` - Object containing location info
- `notes` - Optional notes

**Returns:** Saved attendance document

**Example:**
```javascript
await attendance.performClockIn(
  {
    type: 'office',
    coordinates: { latitude: 40.7128, longitude: -74.0060 },
    ipAddress: '192.168.1.1',
    deviceId: 'device-uuid-123'
  },
  'Working from main office'
)
```

### `performClockOut(locationData, notes)`
Records clock-out for an employee.

**Parameters:**
- `locationData` - Object containing location info
- `notes` - Optional notes

**Returns:** Saved attendance document

**Example:**
```javascript
await attendance.performClockOut(
  { type: 'office' },
  'Completed all tasks'
)
```

### `startBreak()`
Starts break time tracking.

**Returns:** Saved attendance document with `breakStartTime` set

### `endBreak()`
Ends break time and calculates break duration.

**Returns:** Saved attendance document with `breakDuration` calculated

### `requestRegularization(reason, requestedBy)`
Submits a regularization request.

**Parameters:**
- `reason` - String explaining reason for regularization
- `requestedBy` - Employee ObjectId

**Returns:** Saved attendance document with regularization request

---

## Static Methods

### `isClockedIn(employeeId, date)`
Checks if employee is currently clocked in.

**Parameters:**
- `employeeId` - Employee identifier
- `date` - Date to check (default: today)

**Returns:** Boolean

**Query:**
```javascript
{
  employee: employeeId,
  date: { $gte: startOfDay, $lte: endOfDay },
  clockIn: { $exists: true },
  clockOut: { $exists: false },
  isDeleted: false
}
```

### `getMonthlyAttendance(employeeId, year, month)`
Gets all attendance records for a specific month.

**Parameters:**
- `employeeId` - Employee identifier
- `year` - Year (e.g., 2026)
- `month` - Month (0-11)

**Returns:** Array of attendance documents sorted by date

### `getStats(companyId, filters)`
Aggregates attendance statistics.

**Parameters:**
- `companyId` - Company identifier
- `filters` - Optional filter object

**Returns:** Statistics object with:
- `total` - Total records
- `present` - Present count
- `absent` - Absent count
- `halfDay` - Half-day count
- `late` - Late count
- `onLeave` - On-leave count
- `totalHoursWorked` - Sum of hours worked
- `totalOvertimeHours` - Sum of overtime hours

---

## Document Structure Example

### Complete Attendance Document
```json
{
  "_id": {
    "$oid": "67a1b2c3d4e5f67890abcdef"
  },
  "attendanceId": "att_1736035200000_abc123xyz",
  "employeeId": "EMP001",
  "employeeName": "John Doe",
  "companyId": "68443081dcdfe43152aebf80",
  "date": {
    "$date": "2026-01-04T09:00:00.000Z"
  },
  "clockIn": {
    "time": {
      "$date": "2026-01-04T09:00:00.000Z"
    },
    "location": {
      "type": "office",
      "coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "ipAddress": "192.168.1.100",
      "deviceId": "chrome-laptop-12345"
    },
    "notes": "Regular day at office"
  },
  "clockOut": {
    "time": {
      "$date": "2026-01-04T18:45:00.000Z"
    },
    "location": {
      "type": "office"
    },
    "notes": "Completed all tasks"
  },
  "hoursWorked": 9.25,
  "regularHours": 8,
  "overtimeHours": 1.25,
  "status": "present",
  "isLate": false,
  "lateMinutes": 0,
  "isEarlyDeparture": false,
  "earlyDepartureMinutes": 0,
  "breakDuration": 45,
  "breakStartTime": {
    "$date": "2026-01-04T13:00:00.000Z"
  },
  "breakEndTime": {
    "$date": "2026-01-04T13:45:00.000Z"
  },
  "shiftId": {
    "$oid": "67a1f2e3d4c5b6a7890def01"
  },
  "scheduledStart": {
    "$date": "2026-01-04T09:00:00.000Z"
  },
  "scheduledEnd": {
    "$date": "2026-01-04T18:00:00.000Z"
  },
  "isRegularized": false,
  "regularizationRequest": {
    "requested": false,
    "reason": null,
    "requestedBy": null,
    "requestedAt": null,
    "approvedBy": null,
    "approvedAt": null,
    "status": "pending",
    "rejectionReason": null
  },
  "notes": null,
  "managerNotes": null,
  "isActive": true,
  "isDeleted": false,
  "createdBy": {
    "$oid": "67a1b2c3d4e5f67890abcdef"
  },
  "updatedBy": null,
  "deletedBy": null,
  "deletedAt": null,
  "createdAt": {
    "$date": "2026-01-04T09:00:00.000Z"
  },
  "updatedAt": {
    "$date": "2026-01-04T18:45:00.000Z"
  }
}
```

---

## Relationship Diagram

```
┌──────────────────┐
│    Employee      │
│  (employees)     │
├──────────────────┤
│ _id              │───┐
│ employeeId       │   │
│ firstName        │   │
│ lastName         │   │
│ ...              │   │
└──────────────────┘   │
                        │
                        │ references
                        │
                        ▼
┌──────────────────────────────────────┐
│           Attendance                 │
│       (attendance_{companyId})       │
├──────────────────────────────────────┤
│ _id                                  │
│ employeeId      ─────────────────────┘
│ companyId                             │
│ employeeName                          │
│ clockIn.time                          │
│ clockOut.time                         │
│ ...                                  │
├──────────────────────────────────────┤
│ shiftId  ──────────────────────┐     │
└─────────────────────────────────│     │
                                      │
                                      │ references
                                      │
                                      ▼
                           ┌──────────────────┐
                           │      Shift       │
                           │    (shifts)      │
                           ├──────────────────┤
                           │ _id              │
                           │ name             │
                           │ startTime        │
                           │ endTime          │
                           │ ...              │
                           └──────────────────┘
```

---

## Soft Delete Pattern

The schema uses soft delete instead of hard delete:

```javascript
// Soft delete an attendance record
{
  isDeleted: true,
  deletedAt: new Date(),
  deletedBy: userId
}
```

**Benefits:**
- Audit trail preservation
- Data recovery capability
- Statistical accuracy
- Compliance requirements

---

## Data Integrity Rules

### Validation Rules

1. **Clock-in before Clock-out:**
   - Cannot have clockOut.time without clockIn.time
   - clockOut.time must be after clockIn.time

2. **No Duplicate Clock-in:**
   - Only one active clock-in per employee per day
   - Cannot clock-in if already clocked in without clock-out

3. **Break Time Validation:**
   - Cannot end break before starting it
   - breakDuration must be positive

4. **Regularization Workflow:**
   - Cannot approve own regularization request
   - Rejected requests cannot be re-approved

---

## Scalability Considerations

### Document Size Estimation
- Average document size: ~1.5 KB
- Monthly records per employee: ~22 documents
- Yearly records per employee: ~264 documents
- 100 employees: ~26,400 documents/year (~40 MB)

### Collection Growth
| Employees | Records/Year | Collection Size |
|-----------|--------------|-----------------|
| 10 | 2,640 | ~4 MB |
| 50 | 13,200 | ~20 MB |
| 100 | 26,400 | ~40 MB |
| 500 | 132,000 | ~200 MB |
| 1,000 | 264,000 | ~400 MB |

### Archival Strategy (Recommended)
- Archive records older than 2 years to separate collection
- Implement TTL index for automatic archival
- Keep recent 2 years in active collection for performance

---

## Migration Notes

### From Mock to Real Data

**Current Mock Data Location:**
- [attendanceadmin.tsx](react/src/core/data/json/attendanceadmin.tsx)
- [attendanceemployee.tsx](react/src/core/data/json/attendanceemployee.tsx)

**Migration Strategy:**
1. Create initial data seed script
2. Import mock data via MongoDB import tool
3. Generate proper ObjectIds and timestamps
4. Link to real employee records
5. Validate all relationships

---

## Summary

The Attendance schema is **production-ready** with:
- ✅ Comprehensive field coverage
- ✅ Automatic business logic calculations
- ✅ Multi-tenant support
- ✅ Soft delete implementation
- ✅ Optimized indexes
- ✅ Rich instance and static methods
- ✅ Data validation and integrity rules

**No schema changes required** - ready for immediate frontend integration.
