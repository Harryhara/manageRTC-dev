# Leave Module - Business Logic & Validation Rules Report

**Generated:** 2026-02-04
**Module:** HRM - Leave Management

---

## Executive Summary

This document outlines all business logic and validation rules for the Leave module. The system implements comprehensive validation at multiple levels (schema, controller, middleware) to ensure data integrity and business rule compliance.

---

## 1. Core Business Logic

### 1.1 Leave Request Flow

```
┌──────────────┐     Apply     ┌──────────────┐
│   Employee   │ ─────────────▶ │   Pending    │
└──────────────┘                └──────┬───────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
              ┌──────────┐      ┌──────────┐      ┌──────────┐
              │ Approve  │      │ Reject   │      │ On Hold  │
              └────┬─────┘      └──────────┘      └────┬─────┘
                   │                                  │
                   ▼                                  │
            ┌──────────┐                              │
            │ Approved │                              │
            └────┬─────┘                              │
                 │                                  │
                 │            ┌──────────────────────┘
                 ▼            ▼
            ┌─────────────────────────┐
            │     Cancelled           │
            └─────────────────────────┘
```

### 1.2 Status Transition Rules

| From | To | Allowed | Conditions |
|------|-----|---------|------------|
| `pending` | `approved` | ✅ Yes | Manager/HR/Admin, sufficient balance |
| `pending` | `rejected` | ✅ Yes | Manager/HR/Admin, reason required |
| `pending` | `on-hold` | ✅ Yes | HR/Admin only |
| `pending` | `cancelled` | ✅ Yes | Employee/Owner only |
| `approved` | `cancelled` | ✅ Yes | Employee/Owner/Admin (with reason) |
| `rejected` | - | ❌ No | Terminal state |
| `cancelled` | - | ❌ No | Terminal state |
| `on-hold` | `pending` | ✅ Yes | HR/Admin |
| `on-hold` | `approved` | ✅ Yes | Manager/HR/Admin |
| `on-hold` | `rejected` | ✅ Yes | Manager/HR/Admin |

---

## 2. Validation Rules

### 2.1 Request Validation

#### Create Leave Request (`POST /api/leaves`)

| Field | Validation | Error Message |
|-------|------------|---------------|
| `leaveType` | Required, enum: sick, casual, earned, maternity, paternity, bereavement, compensatory, unpaid, special | "Leave type is required" |
| `startDate` | Required, valid date, not in past (configurable) | "Start date is required" |
| `endDate` | Required, valid date, >= startDate | "End date must be after start date" |
| `reason` | Required, max 500 characters | "Reason is required (max 500 chars)" |
| `detailedReason` | Optional, max 2000 characters | "Detailed reason too long (max 2000 chars)" |

#### Validation Code (from controller)

```javascript
// Date validation
if (endDate < startDate) {
  throw buildValidationError('endDate', 'End date must be after start date');
}

// Overlap check (executed for every request)
const overlapping = await checkOverlap(collections, employeeId, startDate, endDate);
if (overlapping.length > 0) {
  throw buildConflictError('Overlapping leave requests exist');
}

// Balance check (optional - enforced by leave type)
const balance = await getEmployeeLeaveBalance(collections, employeeId, leaveType);
if (balance.balance < duration) {
  throw buildConflictError('Insufficient leave balance');
}
```

### 2.2 Update Validation

#### Update Leave Request (`PUT /api/leaves/:id`)

| Rule | Description |
|------|-------------|
| Status Check | Cannot update approved/rejected leaves |
| Overlap Check | Re-validate for date changes |
| Ownership Check | Only Admin, HR, or owner can update |

```javascript
// Status validation
if (leave.status === 'approved' || leave.status === 'rejected') {
  throw buildConflictError(`Cannot update ${leave.status} leave request`);
}

// Overlap check for date changes
if (updateData.startDate || updateData.endDate) {
  const overlapping = await checkOverlap(
    collections, leave.employeeId,
    newStartDate, newEndDate,
    excludeLeaveId: id  // Exclude current leave
  );
  if (overlapping.length > 0) {
    throw buildConflictError('Overlapping leave requests exist');
  }
}
```

### 2.3 Approval Validation

#### Approve Leave (`POST /api/leaves/:id/approve`)

| Rule | Description |
|------|-------------|
| Status Check | Only pending leaves can be approved |
| Balance Deduction | Deduct duration from employee balance |
| Manager Check | Cannot approve own leave (not implemented) |

```javascript
// Status validation
if (leave.status !== 'pending') {
  throw buildConflictError('Can only approve pending leave requests');
}

// Balance update
employee.leaveBalances[balanceIndex].used += leave.duration;
employee.leaveBalances[balanceIndex].balance -= leave.duration;
```

### 2.4 Rejection Validation

#### Reject Leave (`POST /api/leaves/:id/reject`)

| Rule | Description |
|------|-------------|
| Reason Required | Rejection reason is mandatory |
| Status Check | Only pending leaves can be rejected |

```javascript
// Reason validation
if (!reason || !reason.trim()) {
  throw buildValidationError('reason', 'Rejection reason is required');
}

// Status validation
if (leave.status !== 'pending') {
  throw buildConflictError('Can only reject pending leave requests');
}
```

### 2.5 Deletion Validation

#### Delete Leave (`DELETE /api/leaves/:id`)

| Rule | Description |
|------|-------------|
| Status Check | Cannot delete approved leaves (must cancel) |
| Soft Delete | Sets isDeleted flag, preserves record |

```javascript
// Status validation
if (leave.status === 'approved') {
  throw buildConflictError('Cannot delete approved leave request. Cancel it instead.');
}
```

---

## 3. Overlap Detection Logic

### 3.1 Overlap Query

The system checks for overlapping leaves using the following logic:

```javascript
leaveSchema.statics.checkOverlap = async function(employeeId, startDate, endDate, excludeLeaveId = null) {
  const query = {
    employee: employeeId,
    status: { $in: ['pending', 'approved'] },
    isDeleted: false,
    $or: [
      // Case 1: New leave starts during existing leave
      { startDate: { $lte: new Date(startDate) }, endDate: { $gte: new Date(startDate) } },
      // Case 2: New leave ends during existing leave
      { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(endDate) } },
      // Case 3: New leave completely covers existing leave
      { startDate: { $gte: new Date(startDate) }, endDate: { $lte: new Date(endDate) } }
    ]
  };

  if (excludeLeaveId) {
    query._id = { $ne: excludeLeaveId };
  }

  return this.find(query);
};
```

### 3.2 Overlap Scenarios

```
Scenario 1: New leave starts during existing leave
Existing:  |===========|
New:              |=======|

Scenario 2: New leave ends during existing leave
Existing:        |===========|
New:       |=======|

Scenario 3: New leave covers existing leave
Existing:    |=====|
New:      |===========|

Scenario 4: Exact match (prevented)
Existing: |===========|
New:       |===========|
```

---

## 4. Leave Balance Calculation

### 4.1 Balance Structure

```javascript
{
  type: "CASUAL",
  total: 12,      // Annual quota
  used: 5,        // Used (approved leaves)
  balance: 7,     // Remaining (total - used)
  pending: 2,     // Pending requests (calculated)
  lastUpdated: Date
}
```

### 4.2 Balance Deduction Logic

When leave is **approved**:

```javascript
// Current implementation (leave.controller.js:594)
employee.leaveBalances[balanceIndex].used += leave.duration;
employee.leaveBalances[balanceIndex].balance -= leave.duration;
```

### 4.3 Pending Balance Calculation

The system calculates pending leaves separately:

```javascript
// Aggregation pipeline for pending leaves
db.leaves.aggregate([
  {
    $match: {
      employee: employeeId,
      leaveType,
      status: 'pending',
      isDeleted: false
    }
  },
  {
    $group: {
      _id: null,
      totalPending: { $sum: '$duration' }
    }
  }
]);
```

### 4.4 Balance Response Format

```json
{
  "type": "casual",
  "total": 12,
  "used": 5,
  "balance": 7,
  "pending": 2
}
```

**Effective Balance** = `balance - pending` = 7 - 2 = 5 days available

---

## 5. Duration Calculation

### 5.1 Pre-Save Middleware Logic

```javascript
leaveSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    // 1. Calculate total days (inclusive)
    const diffTime = Math.abs(end - start);
    this.totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // 2. Calculate working days (exclude weekends)
    let workingDays = 0;
    let nonWorkingDays = 0;

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        nonWorkingDays++;
      } else {
        workingDays++;
      }
    }

    this.workingDays = workingDays;
    this.nonWorkingDays = nonWorkingDays;

    // 3. Set duration
    if (this.isHalfDay) {
      this.duration = 0.5;
    } else {
      this.duration = this.workingDays;
    }
  }
  next();
});
```

### 5.2 Duration Examples

| Start Date | End Date | Total Days | Working Days | Weekends | Duration |
|------------|----------|------------|--------------|----------|----------|
| 2026-02-10 (Mon) | 2026-02-10 (Mon) | 1 | 1 | 0 | 1 |
| 2026-02-10 (Mon) | 2026-02-12 (Wed) | 3 | 3 | 0 | 3 |
| 2026-02-10 (Mon) | 2026-02-15 (Sat) | 6 | 5 | 1 | 5 |
| 2026-02-08 (Sat) | 2026-02-13 (Thu) | 6 | 4 | 2 | 4 |
| Half day | Half day | 1 | - | - | 0.5 |

---

## 6. Multi-Level Approval Logic

### 6.1 Additional Approvers Structure

```javascript
additionalApprovers: [{
  approver: ObjectId,
  status: 'pending' | 'approved' | 'rejected',
  comments: String,
  approvedAt: Date,
  rejectedAt: Date
}]
```

### 6.2 Approval Workflow (Not Fully Implemented)

The schema supports multi-level approval but the controller doesn't enforce it:

**Current State:**
- Schema defines `additionalApprovers` array
- Controller directly approves (bypasses multi-level)

**Required Implementation:**
```javascript
// Pseudo-code for multi-level approval
async function approveLeave(req, res) {
  const leave = await getLeave(req.params.id);

  // Check if additional approvers exist
  if (leave.additionalApprovers && leave.additionalApprovers.length > 0) {
    // Update current approver status
    const currentApprover = leave.additionalApprovers.find(a => a.approver === req.user.userId);
    currentApprover.status = 'approved';
    currentApprover.approvedAt = new Date();

    // Check if all approvers approved
    const allApproved = leave.additionalApprovers.every(a => a.status === 'approved');

    if (allApproved) {
      // Final approval
      leave.status = 'approved';
      leave.approvedBy = req.user.userId;
      leave.approvedAt = new Date();
      // Deduct balance...
    }
  } else {
    // Direct approval (current implementation)
    leave.status = 'approved';
  }
}
```

---

## 7. HR Review Logic

### 7.1 HR Review Structure

```javascript
hrReview: {
  required: Boolean,      // Does this leave need HR review?
  reviewedBy: ObjectId,
  reviewedAt: Date,
  comments: String
}
```

### 7.2 Long Leave Rules (Not Implemented)

**Recommendation:**
```javascript
// Require HR review for leaves > X days
const LONG_LEAVE_THRESHOLD = 5; // Configurable per leave type

if (duration > LONG_LEAVE_THRESHOLD) {
  leave.hrReview.required = true;
}
```

---

## 8. Half-Day Logic

### 8.1 Half-Day Fields

```javascript
{
  isHalfDay: Boolean,
  halfDayType: 'first-half' | 'second-half'
}
```

### 8.2 Duration Calculation

```javascript
if (this.isHalfDay) {
  this.duration = 0.5;
  // workingDays still calculated for record
}
```

### 8.3 Half-Day Validation (Not Implemented)

**Required Rules:**
| Rule | Description |
|------|-------------|
| Date Range | Half-day only if startDate === endDate |
| Duration | Duration must be 1 day or less |
| Time | Need time fields for first/second half |

---

## 9. Carry Forward Logic

### 9.1 Carry Forward Fields

```javascript
{
  isCarryForward: Boolean,
  carryForwardYear: Number,
  balanceAtRequest: Number
}
```

### 9.2 Carry Forward Rules (Schema Only)

The LeaveType schema defines carry forward rules:

```javascript
{
  carryForwardAllowed: Boolean,
  maxCarryForwardDays: Number,
  carryForwardExpiry: Number  // Days before expiry
}
```

### 9.3 Year-End Processing (Not Implemented)

**Required Automation:**
```javascript
// Run on Dec 31 or Jan 1
async function processCarryForward(companyId, year) {
  const employees = await Employee.find({ companyId });

  for (const employee of employees) {
    for (const balance of employee.leaveBalances) {
      const leaveType = await LeaveType.findOne({ code: balance.type });

      if (leaveType.carryForwardAllowed && balance.balance > 0) {
        const carryForwardAmount = Math.min(
          balance.balance,
          leaveType.maxCarryForwardDays
        );

        // Create carry-forward record for next year
        // Update new year's balance
      }
    }
  }
}
```

---

## 10. Validation Summary Matrix

| Validation | Create | Update | Approve | Reject | Delete |
|------------|--------|--------|---------|--------|--------|
| Authentication | ✅ | ✅ | ✅ | ✅ | ✅ |
| Authorization | ✅ | ✅ | ✅ | ✅ | ✅ |
| Required fields | ✅ | - | - | reason | - |
| Date validity | ✅ | ✅ (dates) | - | - | - |
| Overlap check | ✅ | ✅ (dates) | - | - | - |
| Balance check | ⚠️ Optional | - | - | - | - |
| Status check | - | ✅ | ✅ | ✅ | ✅ |
| Ownership check | - | ✅ | - | - | ✅ |

---

## 11. Missing Validations

### 11.1 Critical Missing Validations

| Validation | Priority | Description |
|------------|----------|-------------|
| Self-approval prevention | High | Manager cannot approve own leave |
| Past date prevention | Medium | Cannot apply for past dates |
| Business day validation | Medium | Consider holidays, not just weekends |
| Max consecutive days | Medium | Enforce leave type.maxConsecutiveDays |
| Min notice days | Low | Enforce leave type.minNoticeDays |
| Document requirement | Low | Require documents for certain leave types |

### 11.2 Recommended Implementation

#### Self-Approval Prevention

```javascript
// In approveLeave controller
if (leave.employeeId.toString() === req.user.userId) {
  throw buildConflictError('Cannot approve your own leave request');
}
```

#### Past Date Prevention

```javascript
// In createLeave controller
const today = new Date();
today.setHours(0, 0, 0, 0);
if (new Date(leaveData.startDate) < today) {
  throw buildValidationError('startDate', 'Cannot apply for past dates');
}
```

---

## 12. Edge Cases & Abuse Prevention

### 12.1 Edge Cases Handled

| Case | Handled | Method |
|------|---------|--------|
| Overlapping dates | ✅ Yes | checkOverlap() |
| Negative duration | ✅ Yes | Date validation |
| Approved update | ✅ Yes | Status check |
| Delete after approval | ✅ Yes | Must cancel instead |

### 12.2 Edge Cases NOT Handled

| Case | Risk | Mitigation Needed |
|------|------|-------------------|
| Rapid apply-cancel-apply | Low | Rate limiting |
| Balance exploitation | Medium | Transaction-style operations |
| Concurrent approvals | Low | Optimistic locking |
| Holiday manipulation | Medium | Holiday calendar integration |

### 12.3 Abuse Prevention Recommendations

```javascript
// 1. Rate limiting
{
  endpoint: 'POST /api/leaves',
  limit: 5 per user per hour
}

// 2. Balance locking (for concurrent requests)
async function createLeaveWithLock(req, res) {
  const lock = await acquireLock(`employee:${employeeId}:leave_balance`);
  try {
    // Create leave and update balance atomically
  } finally {
    await releaseLock(lock);
  }
}

// 3. Audit logging
logger.info('Leave request created', {
  employeeId,
  leaveType,
  duration,
  userAgent,
  ipAddress
});
```

---

**Report End**
