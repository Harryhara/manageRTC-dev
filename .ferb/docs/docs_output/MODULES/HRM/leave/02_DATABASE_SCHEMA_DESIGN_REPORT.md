# Leave Module - Database Schema Design Report

**Generated:** 2026-02-04
**Module:** HRM - Leave Management
**Database:** MongoDB (Multi-tenant)

---

## Executive Summary

The Leave module uses **two main schemas** designed for comprehensive leave management with multi-tenant architecture. The schemas are well-designed with proper indexing, relationships, and business logic support.

**Schema Files:**
1. `leave.schema.js` (512 lines) - Main leave request schema
2. `leaveType.schema.js` (275 lines) - Leave type configuration schema

---

## 1. Leave Schema (`leave.schema.js`)

### 1.1 Schema Overview

```javascript
{
  leaveId: String,           // Unique identifier (e.g., "leave_1738452342_abc123")
  employee: ObjectId,        // Reference to Employee
  companyId: String,         // Multi-tenant isolation
  leaveType: String,         // Enum: sick, casual, earned, maternity, etc.
  startDate: Date,
  endDate: Date,
  duration: Number,          // Calculated duration
  // ... 40+ fields total
}
```

### 1.2 Complete Field Listing

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **Primary Keys** |
| `leaveId` | String | No | Auto-generated | Unique leave identifier |
| **Employee References** |
| `employee` | ObjectId | ✅ Yes | - | Reference to Employee collection |
| `companyId` | String | ✅ Yes | - | Company/tenant identifier |
| `reportingManager` | ObjectId | No | - | Employee's manager for approval |
| **Leave Details** |
| `leaveType` | String | ✅ Yes | - | sick, casual, earned, maternity, paternity, bereavement, compensatory, unpaid, special |
| `startDate` | Date | ✅ Yes | - | Leave start date |
| `endDate` | Date | ✅ Yes | - | Leave end date |
| `duration` | Number | ✅ Yes | - | Duration in days (min 0.5) |
| `totalDays` | Number | No | 0 | Total calendar days |
| `workingDays` | Number | No | 0 | Working days (excludes weekends) |
| `nonWorkingDays` | Number | No | 0 | Weekends/holidays |
| `isHalfDay` | Boolean | No | false | Is this a half-day leave? |
| `halfDayType` | String | No | - | 'first-half' or 'second-half' |
| **Reason Fields** |
| `reason` | String | ✅ Yes (max 500) | - | Primary reason for leave |
| `detailedReason` | String | No | - | Detailed explanation (max 2000) |
| **Status & Workflow** |
| `status` | String | No | 'pending' | pending, approved, rejected, cancelled, on-hold |
| `approvedBy` | ObjectId | No | - | Manager who approved |
| `approvedAt` | Date | No | - | Approval timestamp |
| `approvalComments` | String | No | - | Approval notes (max 500) |
| `rejectedBy` | ObjectId | No | - | Manager who rejected |
| `rejectedAt` | Date | No | - | Rejection timestamp |
| `rejectionReason` | String | No | - | Reason for rejection (max 500) |
| `cancelledBy` | ObjectId | No | - | User who cancelled |
| `cancelledAt` | Date | No | - | Cancellation timestamp |
| `cancellationReason` | String | No | - | Reason for cancellation (max 500) |
| **Multi-level Approval** |
| `additionalApprovers` | Array | No | [] | Additional approval levels |
| `hrReview` | Object | No | {required: false} | HR review for long leaves |
| **Attachments** |
| `attachments` | Array | No | [] | File references (medical certificates) |
| **Contact During Leave** |
| `contactInfo.phone` | String | No | - | Phone during leave |
| `contactInfo.email` | String | No | - | Email during leave |
| `contactInfo.address` | String | No | - | Address during leave |
| `emergencyContact.name` | String | No | - | Emergency contact name |
| `emergencyContact.phone` | String | No | - | Emergency contact phone |
| `emergencyContact.relationship` | String | No | - | Emergency contact relationship |
| **Handover** |
| `handoverTo` | ObjectId | No | - | Employee covering duties |
| `handoverNotes` | String | No | - | Handover instructions |
| **Balance Tracking** |
| `balanceAtRequest` | Number | No | 0 | Balance when request was made |
| `isCarryForward` | Boolean | No | false | From previous year? |
| `carryForwardYear` | Number | No | - | Year of carry forward |
| **Notifications** |
| `notificationsSent.employee` | Boolean | No | false | Notified employee? |
| `notificationsSent.manager` | Boolean | No | false | Notified manager? |
| `notificationsSent.team` | Boolean | No | false | Notified team? |
| `autoApproved` | Boolean | No | false | Auto-approved? |
| `autoApprovalReason` | String | No | - | Reason for auto-approval |
| **Admin Fields** |
| `notes` | String | No | - | Admin notes (max 500) |
| `adminNotes` | String | No | - | Additional admin notes (max 500) |
| **Audit Trail** |
| `isActive` | Boolean | No | true | Active record flag |
| `isDeleted` | Boolean | No | false | Soft delete flag |
| `createdBy` | ObjectId | No | - | Creator reference |
| `updatedBy` | ObjectId | No | - | Updater reference |
| `deletedBy` | ObjectId | No | - | Deleter reference |
| `deletedAt` | Date | No | - | Deletion timestamp |
| `timestamps` | - | - | true | Mongoose timestamps (createdAt, updatedAt) |

### 1.3 Indexes

| Index | Fields | Type | Purpose |
|-------|--------|------|---------|
| Primary | `leaveId` | Unique sparse | Leave identifier |
| Single | `employee` | Single | Employee queries |
| Single | `companyId` | Single | Tenant isolation |
| Single | `leaveType` | Single | Leave type filtering |
| Single | `startDate` | Single | Date range queries |
| Single | `endDate` | Single | Date range queries |
| Single | `isDeleted` | Single | Soft delete filtering |
| Compound | `employee + status` | Compound | Employee leave by status |
| Compound | `companyId + status` | Compound | Company leaves by status |
| Compound | `companyId + leaveType` | Compound | Company leaves by type |
| Compound | `startDate + endDate` | Compound | Date range queries |
| Compound | `employee + isDeleted` | Compound | Employee active leaves |
| Compound | `companyId + startDate` | Compound | Company leaves by date |

### 1.4 Static Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `checkOverlap()` | employeeId, startDate, endDate, excludeLeaveId | Array | Find overlapping leave requests |
| `getLeaveBalance()` | employeeId, leaveType | Object | Get balance info (total, used, balance, pending) |
| `getStats()` | companyId, filters | Object | Aggregate statistics |

### 1.5 Instance Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `approve()` | approvedBy, comments | Document | Approve leave request |
| `reject()` | rejectedBy, reason | Document | Reject leave request |
| `cancel()` | cancelledBy, reason | Document | Cancel leave request |

### 1.6 Pre-Save Middleware

```javascript
leaveSchema.pre('save', function(next) {
  // 1. Calculate totalDays (inclusive)
  // 2. Calculate workingDays (exclude weekends)
  // 3. Calculate nonWorkingDays (Saturdays, Sundays)
  // 4. Set duration based on isHalfDay or workingDays
  // 5. Generate leaveId if not present
});
```

### 1.7 Relationship Diagram

```
┌──────────────────┐
│     Employee     │
│  ─────────────   │
│  _id: ObjectId   │
│  employeeId: Str │
│  leaveBalances   │
└────────┬─────────┘
         │ 1
         │
         │ N
┌────────▼─────────┐     ┌──────────────┐
│      Leave       │     │  LeaveType   │
│  ─────────────   │     │  ─────────   │
│  _id: ObjectId   │     │  code: enum  │
│  leaveId: Str    │     │  annualQuota │
│  employee: Ref   │←────│  isPaid      │
│  leaveType: Str  │     │  ...         |
│  companyId: Str  │     └──────────────┘
│  approvedBy: Ref │──┐
│  rejectedBy: Ref │  │
│  handoverTo: Ref │──┘
└──────────────────┘
```

---

## 2. LeaveType Schema (`leaveType.schema.js`)

### 2.1 Schema Overview

```javascript
{
  leaveTypeId: String,      // Unique identifier (e.g., "LT-CASUAL")
  companyId: String,        // Multi-tenant isolation
  name: String,             // Display name
  code: String,             // Short code for calculations
  annualQuota: Number,      // Days per year
  isPaid: Boolean,          // Paid leave?
  // ... 25+ fields total
}
```

### 2.2 Complete Field Listing

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **Primary Keys** |
| `leaveTypeId` | String | ✅ Yes | - | Unique type identifier (LT-CASUAL) |
| `companyId` | String | ✅ Yes | - | Company/tenant identifier |
| **Basic Info** |
| `name` | String | ✅ Yes | - | Display name (Casual Leave) |
| `code` | String | ✅ Yes | - | Short code (CASUAL, SICK, EARNED) |
| **Quota Configuration** |
| `annualQuota` | Number | No | 0 | Annual quota in days (0-365) |
| `isPaid` | Boolean | No | true | Paid leave? |
| `requiresApproval` | Boolean | No | true | Manager approval required? |
| **Carry Forward Rules** |
| `carryForwardAllowed` | Boolean | No | false | Can carry forward to next year? |
| `maxCarryForwardDays` | Number | No | 0 | Maximum days to carry forward |
| `carryForwardExpiry` | Number | No | 90 | Days before carried leaves expire |
| **Encashment Rules** |
| `encashmentAllowed` | Boolean | No | false | Can encash unused leaves? |
| `maxEncashmentDays` | Number | No | 0 | Maximum days to encash |
| `encashmentRatio` | Number | No | 0 | Encashment ratio (0-1) |
| **Restrictions** |
| `minNoticeDays` | Number | No | 0 | Minimum notice before applying |
| `maxConsecutiveDays` | Number | No | 0 | Maximum consecutive days |
| `requiresDocument` | Boolean | No | false | Document required? |
| `acceptableDocuments` | Array | No | [] | Allowed document types |
| **Accrual Rules** |
| `accrualRate` | Number | No | 0 | Days accrued per month |
| `accrualMonth` | Number | No | 1 | Month of accrual (1-12) |
| `accrualWaitingPeriod` | Number | No | 0 | Days before accrual starts |
| **Display** |
| `color` | String | No | #808080 | UI color code |
| `icon` | String | No | - | Icon name |
| `description` | String | No | - | Detailed description |
| **Audit** |
| `isActive` | Boolean | No | true | Active status |
| `isDeleted` | Boolean | No | false | Soft delete |
| `timestamps` | - | - | true | CreatedAt, UpdatedAt |

### 2.3 Indexes

| Index | Fields | Type | Purpose |
|-------|--------|------|---------|
| Primary | `leaveTypeId` | Unique | Type identifier |
| Unique | `companyId + code` | Unique | Company-specific code |
| Unique | `companyId + name` | Unique | Company-specific name |
| Single | `code` | Single | Code lookup |
| Single | `name` | Single | Name lookup |
| Compound | `companyId + isActive + isDeleted` | Compound | Active types by company |

### 2.4 Static Methods

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getActiveTypes()` | companyId | Array | Get all active leave types |
| `getByCode()` | companyId, code | Document | Get type by code |
| `getAutoApprovalTypes()` | companyId | Array | Get types that don't require approval |

---

## 3. Employee Schema Integration

### 3.1 Leave Balances in Employee Schema

The Employee schema contains a `leaveBalances` array:

```javascript
leaveBalances: [{
  type: String,          // Leave type code (CASUAL, SICK, etc.)
  total: Number,         // Total allocated
  used: Number,          // Used leaves
  balance: Number,       // Remaining balance
  pending: Number,       // Pending requests
  lastUpdated: Date      // Last update timestamp
}]
```

### 3.2 Leave Balance Structure

```
Employee.leaveBalances = [
  {
    type: "CASUAL",
    total: 12,
    used: 5,
    balance: 7,
    pending: 2,
    lastUpdated: ISODate("2026-02-04")
  },
  {
    type: "SICK",
    total: 12,
    used: 3,
    balance: 9,
    pending: 0,
    lastUpdated: ISODate("2026-02-04")
  },
  ...
]
```

---

## 4. Multi-Tenant Architecture

### 4.1 Tenant Isolation

| Schema | Tenant Field | Index Type |
|--------|--------------|------------|
| Leave | `companyId` | Compound indexes |
| LeaveType | `companyId` | Unique per company |
| Employee | `companyId` | Compound indexes |

### 4.2 Collection Naming

```
{tenant_db}.leaves        // Leave requests
{tenant_db}.leavetypes    // Leave type configurations
{tenant_db}.employees     // Employee records with balances
```

---

## 5. Data Validation Rules

### 5.1 Leave Schema Validation

| Field | Validation |
|-------|------------|
| `duration` | min: 0.5 |
| `reason` | maxlength: 500, required |
| `detailedReason` | maxlength: 2000 |
| `approvalComments` | maxlength: 500 |
| `rejectionReason` | maxlength: 500 |
| `cancellationReason` | maxlength: 500 |
| `notes` | maxlength: 500 |
| `adminNotes` | maxlength: 500 |

### 5.2 LeaveType Schema Validation

| Field | Validation |
|-------|------------|
| `code` | uppercase, trim |
| `annualQuota` | min: 0, max: 365 |
| `maxCarryForwardDays` | min: 0 |
| `carryForwardExpiry` | min: 1 |
| `encashmentRatio` | min: 0, max: 1 |
| `accrualRate` | min: 0, max: 31 |
| `accrualMonth` | min: 1, max: 12 |
| `accrualWaitingPeriod` | min: 0 |

---

## 6. Workflow States

### 6.1 Leave Status State Machine

```
                    ┌──────────────────┐
                    │     pending      │◄─────┐
                    └────────┬─────────┘      │
                             │               │
                ┌────────────┼────────────┐   │
                │            │            │   │
                ▼            ▼            │   │
          ┌──────────┐  ┌──────────┐     │   │
          │ approved │  │ rejected │     │   │
          └────┬─────┘  └──────────┘     │   │
               │                         │   │
               │                         │   │
               ▼                         │   │
          ┌─────────┐                    │   │
          │cancelled│                    │   │
          └─────────┘                    │   │
                                        │   │
           ┌─────────────────────────────┘   │
           │                                 │
           ▼                                 │
    ┌────────────┐  ┌─────────────────┐     │
    │  on-hold   │  │ additional      │     │
    └────────────┘  │ approvers pending │─────┘
                    └─────────────────┘
```

### 6.2 Status Transition Rules

| Current Status | Can Transition To | Notes |
|----------------|-------------------|-------|
| `pending` | `approved`, `rejected`, `on-hold`, `cancelled` | Default state |
| `approved` | `cancelled` | After approval, can only cancel |
| `rejected` | - | Terminal state |
| `cancelled` | - | Terminal state |
| `on-hold` | `pending`, `approved`, `rejected`, `cancelled` | Intermediate state |

---

## 7. Sample Documents

### 7.1 Leave Document Example

```javascript
{
  _id: ObjectId("65bc12d34e5f6a78b0c1d2e3"),
  leaveId: "leave_1738452342_abc123xyz",
  employee: ObjectId("65ab12d34e5f6a78b0c1d2e3"),
  companyId: "COMP001",
  leaveType: "casual",
  startDate: ISODate("2026-02-10T00:00:00Z"),
  endDate: ISODate("2026-02-12T00:00:00Z"),
  duration: 3,
  totalDays: 3,
  workingDays: 3,
  nonWorkingDays: 0,
  isHalfDay: false,
  reason: "Personal family function",
  status: "pending",
  reportingManager: ObjectId("65cd34e56f7a8b9c0d1e2f3a"),
  balanceAtRequest: 9,
  createdAt: ISODate("2026-02-04T10:30:00Z"),
  updatedAt: ISODate("2026-02-04T10:30:00Z"),
  isActive: true,
  isDeleted: false
}
```

### 7.2 LeaveType Document Example

```javascript
{
  _id: ObjectId("65bc12d34e5f6a78b0c1d2e4"),
  leaveTypeId: "LT-CASUAL",
  companyId: "COMP001",
  name: "Casual Leave",
  code: "CASUAL",
  annualQuota: 12,
  isPaid: true,
  requiresApproval: true,
  carryForwardAllowed: true,
  maxCarryForwardDays: 3,
  carryForwardExpiry: 90,
  encashmentAllowed: false,
  minNoticeDays: 1,
  maxConsecutiveDays: 5,
  requiresDocument: false,
  color: "#FF6B6B",
  description: "Leave for personal reasons",
  isActive: true,
  isDeleted: false,
  createdAt: ISODate("2026-01-01T00:00:00Z"),
  updatedAt: ISODate("2026-01-01T00:00:00Z")
}
```

---

## 8. Performance Considerations

### 8.1 Query Optimization

| Query | Index Used | Notes |
|-------|------------|-------|
| Find employee leaves | `employee + status` | Efficient employee queries |
| Find company leaves | `companyId + status` | Company-wide filtering |
| Date range queries | `startDate + endDate` | Efficient range scans |
| Overlap checking | Compound on dates | Pre-save middleware |

### 8.2 Aggregation Pipelines

```javascript
// Leave balance calculation
db.leaves.aggregate([
  { $match: { employee: ObjectId(...), status: 'approved' } },
  { $group: { _id: '$leaveType', totalDays: { $sum: '$duration' } } }
])

// Statistics
db.leaves.aggregate([
  { $match: { companyId: '...', isDeleted: false } },
  { $group: {
      _id: null,
      total: { $sum: 1 },
      pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
      approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }
    }
  }
])
```

---

## 9. Data Migration Considerations

### 9.1 New Field Additions

When adding new fields to existing documents:

```javascript
// Migration script example
db.leaves.updateMany(
  { isDeleted: false },
  {
    $setOnInsert: {
      notificationsSent: { employee: false, manager: false, team: false },
      autoApproved: false
    }
  }
)
```

### 9.2 Index Creation

```javascript
// Create compound indexes
db.leaves.createIndex({ companyId: 1, status: 1 })
db.leaves.createIndex({ employee: 1, isDeleted: 1 })
```

---

## 10. Schema Recommendations

### 10.1 Strengths

✅ Comprehensive field coverage
✅ Proper indexing strategy
✅ Multi-tenant architecture
✅ Soft delete implementation
✅ Audit trail support
✅ Workflow state management
✅ Balance tracking integration
✅ Pre-save middleware for calculations

### 10.2 Potential Improvements

| Issue | Recommendation |
|-------|----------------|
| Holiday Integration | Add `holidays` array for non-weekend holidays |
| Pro-rata Calculation | Add `proRatedBalance` for mid-year joiners |
| Leave Encashment | Add `encashmentHistory` array |
| Compensatory Leave | Link to overtime records |
| Calendar Integration | Add `eventId` for external calendar sync |

---

**Report End**
