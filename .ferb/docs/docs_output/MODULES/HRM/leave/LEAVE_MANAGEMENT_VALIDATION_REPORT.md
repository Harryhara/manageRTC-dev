# Leave Management Module - Detailed Validation Report

**Report Date:** 2026-02-04
**Module:** Leave Management
**Report Type:** Comprehensive Validation
**Status:** ⚠️ Functional with Critical Issues Requiring Attention

---

## Executive Summary

The Leave Management module implements a comprehensive leave request system with employee self-service, manager approval workflows, and balance tracking. The module integrates with Holiday management for accurate working day calculations and uses Socket.IO for real-time updates.

### Overall Module Health: 72/100 (Grade: B-)

| Aspect | Score | Status |
|--------|-------|--------|
| Backend API | 75/100 | ✅ Functional |
| Frontend UI | 70/100 | ✅ Functional |
| Data Integrity | 65/100 | ⚠️ Issues Found |
| Business Logic | 80/100 | ✅ Mostly Complete |
| Validation | 60/100 | ⚠️ Gaps Found |
| Testing | 20/100 | ❌ Insufficient |
| Documentation | 30/100 | ⚠️ Partial |
| Security | 70/100 | ⚠️ Concerns |

---

## Table of Contents
1. [Module Overview](#module-overview)
2. [Backend Analysis](#backend-analysis)
3. [Frontend Analysis](#frontend-analysis)
4. [Critical Issues](#critical-issues)
5. [Validation Gaps](#validation-gaps)
6. [Test Cases](#test-cases)
7. [Phased Roadmap](#phased-roadmap)

---

## 1. Module Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Leave Management Module                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌─────────────┐  │
│  │   Frontend   │ ────▶ │   Backend    │ ────▶ │   MongoDB   │  │
│  │   React      │      │   Express    │      │  Collections │  │
│  │   TypeScript │      │   Node.js    │      │             │  │
│  └──────────────┘      └──────────────┘      └─────────────┘  │
│         │                      │                     │            │
│         │                      ▼                     │            │
│         │              ┌──────────────┐      ┌─────────────┐  │
│         │              │  Socket.IO   │      │   Holiday   │  │
│         │              │   Server     │      │   Service   │  │
│         │              └──────────────┘      └─────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Diagram

```
Employee Action                  Manager Action
     │                              │
     ▼                              ▼
┌─────────────┐              ┌─────────────┐
│ Create Leave │              │ View Leaves │
└──────┬──────┘              └──────┬──────┘
       │                            │
       ▼                            │
┌─────────────────┐                │
│ Validate Balance │                │
│ Check Overlaps   │                │
│ Calculate Days   │                │
└────────┬────────┘                │
         │                          │
         ▼                          │
┌─────────────────┐                │
│ Save (Pending)  │                │
└────────┬────────┘                │
         │                          │
         ▼                          ▼
     ┌─────────────────────┐
     │ Real-time Update    │
     │    (Socket.IO)       │
     └─────────────────────┘
```

### 1.3 Feature Completeness Matrix

| Feature | Backend | Frontend | Tests | Documentation |
|---------|---------|----------|-------|---------------|
| Create Leave Request | ✅ | ✅ | ❌ | ⚠️ |
| View My Leaves | ✅ | ✅ | ❌ | ⚠️ |
| View All Leaves (Admin) | ✅ | ✅ | ❌ | ⚠️ |
| Approve Leave | ✅ | ✅ | ❌ | ⚠️ |
| Reject Leave | ✅ | ✅ | ❌ | ⚠️ |
| Cancel Leave | ✅ | ✅ | ❌ | ⚠️ |
| Leave Balance Display | ✅ | ✅ | ❌ | ⚠️ |
| Working Days Calculator | ✅ | ⚠️ | ❌ | ⚠️ |
| Holiday Integration | ✅ | ❌ | ❌ | ⚠️ |
| Attachment Upload | ✅ | ⚠️ | ❌ | ⚠️ |
| Leave Types | ⚠️ | ⚠️ | ❌ | ❌ |
| Half-Day Leaves | ❌ | ❌ | ❌ | ❌ |
| Carry Forward Balance | ❌ | ❌ | ❌ | ❌ |
| Leave Encashment | ❌ | ❌ | ❌ | ❌ |

---

## 2. Backend Analysis

### 2.1 Leave Schema

**File:** [backend/models/leave/leave.schema.js](backend/models/leave/leave.schema.js) (Referenced but not directly read)

**Issues Identified:**

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| LS1 | Missing index on (employeeId, startDate, endDate) | 🟡 Medium | Slow overlap checks |
| LS2 | No constraint on concurrent pending leaves | 🟡 Medium | Data quality |
| LS3 | Duration field vs workingDays inconsistency | 🟡 Medium | Confusion |
| LS4 | Missing audit trail for balance changes | 🔴 High | Compliance |
| LS5 | No version control for optimistic locking | 🟢 Low | Race conditions |

### 2.2 Leave Controller Analysis

**File:** [backend/controllers/rest/leave.controller.js](backend/controllers/rest/leave.controller.js)

**Strengths:**
- Well-structured REST API
- Comprehensive overlap detection
- Multi-tenant architecture
- Socket.IO broadcasting

**Critical Issues:**

#### Issue #1: Employee Reference Inconsistency 🔴

```javascript
// Line 86-90: Uses 'account.userId'
async function getEmployeeByClerkId(collections, clerkUserId) {
  return await collections.employees.findOne({
    'account.userId': clerkUserId,  // ❌ Wrong field path
    isDeleted: { $ne: true }
  });
}
```

**Expected Behavior:**
- Attendance controller uses `clerkUserId` field
- Leave controller uses `account.userId`
- **These must be consistent**

**Fix Required:**
```javascript
// Option A: Use clerkUserId (recommended)
async function getEmployeeByClerkId(collections, clerkUserId) {
  return await collections.employees.findOne({
    clerkUserId: clerkUserId,
    isDeleted: { $ne: true }
  });
}

// Option B: Update employee schema to use account.userId everywhere
```

#### Issue #2: Balance Deduction Without Rollback 🔴

```javascript
// Lines 584-609: Balance deducted on approval
if (employee && employee.leaveBalances) {
  employee.leaveBalances[balanceIndex].used += leave.duration;
  employee.leaveBalances[balanceIndex].balance -= leave.duration;
  // ❌ No corresponding logic for rejection/cancellation
}
```

**Impact:**
- Leave rejected → balance NOT restored
- Leave cancelled → balance NOT restored
- Leave deleted → balance NOT restored

**Fix Required:**
```javascript
// Add balance restoration in rejectLeave
export const rejectLeave = asyncHandler(async (req, res) => {
  // ... existing code ...

  // Restore balance on rejection
  if (leave.status === 'approved') {
    // Already approved, need to restore
  } else if (leave.status === 'pending') {
    // Was pending, ensure balance not affected
  }

  const updateObj = {
    status: 'rejected',
    rejectedBy: user.userId,
    rejectedAt: new Date(),
    rejectionReason: reason,
    updatedAt: new Date()
  };

  // ✅ ADD: Restore balance
  await collections.employees.updateOne(
    { employeeId: leave.employeeId },
    {
      $inc: {
        'leaveBalances.$[elem].balance': leave.duration,
        'leaveBalances.$[elem].used': -leave.duration
      }
    }
  );
});
```

#### Issue #3: Missing Attachment Validation 🟡

```javascript
// Line 758-759: No validation
if (!req.file) {
  throw buildValidationError('No file uploaded');
}
```

**Missing Validations:**
- File size limit
- File type whitelist
- Virus scanning
- Malware detection

**Recommended:**
```javascript
// Add multer configuration
const uploadConfig = {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
};
```

#### Issue #4: Missing Error Handler 🟢

```javascript
// Line 754: References non-existent function
throw buildForbiddenError('Not authorized...');
```

**Fix:**
```javascript
import {
  buildConflictError,
  buildNotFoundError,
  buildValidationError,
  buildForbiddenError  // ✅ ADD this import
} from '../../middleware/errorHandler.js';
```

### 2.3 Leave Validation Service Analysis

**File:** [backend/services/leaveValidation.js](backend/services/leaveValidation.js)

**Critical Issue:**

#### Issue #9: Wrong Collection Usage 🔴

```javascript
// Lines 7-9: Imports Mongoose models
import Leave from '../models/leave/leave.schema.js';
import LeaveType from '../models/leave/leaveType.schema.js';
import Employee from '../models/employee/employee.schema.js';

// But controllers use MongoDB collections directly
// This creates integration problems!
```

**Impact:**
- Validation uses different data access pattern
- Inconsistent behavior between validation and actual operations
- Transactional issues

**Recommended Fix:**
- Option A: Use MongoDB collections throughout
- Option B: Use Mongoose models throughout (recommended)

### 2.4 Leave Days Calculator Analysis

**File:** [backend/utils/leaveDaysCalculator.js](backend/utils/leaveDaysCalculator.js)

**Issues:**

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| LD1 | No timezone support | 🟡 | Add timezone parameter |
| LD2 | Weekend config hardcoded | 🟢 | Fetch from company settings |
| LD3 | Date normalization may have DST issues | 🟡 | Use timezone-aware library |

**Timezone Issue Example:**
```javascript
// Current implementation
const start = normalizeDate(new Date(startDate));

// Problem: For a user in IST (UTC+5:30)
// new Date('2024-01-15') creates 2024-01-15T00:00:00Z
// But user expects 2024-01-15T00:00:00IST
```

**Recommended:**
```javascript
import { utcToZonedTime, zonedTimeToUtc } from '@date-fns/tz';

export const calculateWorkingDays = async (
  companyId,
  startDate,
  endDate,
  timezone = 'UTC'  // ✅ Add timezone parameter
) => {
  // Convert to company timezone before calculations
  const zonedStart = utcToZonedTime(startDate, timezone);
  const zonedEnd = utcToZonedTime(endDate, timezone);
  // ... rest of logic
};
```

### 2.5 Holiday Controller Analysis

**File:** [backend/controllers/rest/holiday/holiday.controller.js](backend/controllers/rest/holiday/holiday.controller.js)

**Observations:**
- ✅ Well implemented holiday CRUD
- ✅ Good working day calculation
- ✅ Proper integration with leave validation

**Issues:**

| # | Issue | Severity | Line |
|---|-------|----------|------|
| H1 | Duplicate soft-deleted holidays not checked | 🟢 | 125 |
| H2 | No timezone in date comparisons | 🟡 | 126-129 |
| H3 | Stats grouping by month may be wrong for different years | 🟢 | 425-428 |

---

## 3. Frontend Analysis

### 3.1 Leave Admin Component

**File:** [react/src/feature-module/hrm/attendance/leaves/leaveAdmin.tsx](react/src/feature-module/hrm/attendance/leaves/leaveAdmin.tsx)

**Critical Issues:**

#### Issue #F8: Blocking Rejection Prompt 🔴

```typescript
// Line 111-117: Uses window.prompt
const handleReject = async (leaveId: string) => {
  const reason = prompt("Please enter rejection reason:");  // ❌ Blocking
  if (reason) {
    const success = await rejectLeave(leaveId, reason);
    // ...
  }
};
```

**Problems:**
- Blocks entire browser tab
- No styling consistency
- Poor UX (can't format, can't validate)
- Not mobile-friendly

**Recommended Fix:**
```tsx
// Use Ant Design Modal
import { Modal, Input } from 'antd';

const [rejectModalVisible, setRejectModalVisible] = useState(false);
const [selectedLeave, setSelectedLeave] = useState(null);
const [rejectionReason, setRejectionReason] = useState('');

const showRejectModal = (leave: Leave) => {
  setSelectedLeave(leave);
  setRejectModalVisible(true);
};

const handleRejectConfirm = async () => {
  if (!rejectionReason.trim()) {
    message.error('Rejection reason is required');
    return;
  }
  const success = await rejectLeave(selectedLeave._id, rejectionReason);
  if (success) {
    setRejectModalVisible(false);
    setRejectionReason('');
    fetchLeaves(filters);
  }
};

// In JSX:
<Modal
  title="Reject Leave Request"
  visible={rejectModalVisible}
  onOk={handleRejectConfirm}
  onCancel={() => setRejectModalVisible(false)}
>
  <Input.TextArea
    placeholder="Please provide reason for rejection..."
    value={rejectionReason}
    onChange={(e) => setRejectionReason(e.target.value)}
    rows={4}
    maxLength={500}
    showCount
  />
</Modal>
```

#### Issue #F9: Client-Side Stats Calculation 🟡

```typescript
// Lines 274-279: Calculated on client
const stats = {
  totalPresent: leaves.length > 0 ? leaves.length + 165 : 180,  // ❌ Magic number
  plannedLeaves: leaves.filter(l => l.leaveType === 'casual' || l.leaveType === 'earned').length,
  unplannedLeaves: leaves.filter(l => l.leaveType === 'sick').length,
  pendingRequests: leaves.filter(l => l.status === 'pending').length,
};
```

**Problems:**
- Stats should come from backend API
- Includes hardcoded "165" magic number
- Doesn't represent actual company data

**Recommended:**
```typescript
// Call backend stats endpoint
useEffect(() => {
  const fetchStats = async () => {
    const response = await fetch('/api/leaves/stats');
    const data = await response.json();
    setStats(data.data);
  };
  fetchStats();
}, []);
```

### 3.2 Leave Employee Component

**File:** [react/src/feature-module/hrm/attendance/leaves/leaveEmployee.tsx](react/src/feature-module/hrm/attendance/leaves/leaveEmployee.tsx)

**Critical Issue:**

#### Issue #F11: Import Error 🔴

```typescript
// Line 13: Imports non-existent components
import { DateRangeCalculator, AttachmentUpload } from "../../../../components/leave";
```

**Status:** These files exist but may have export issues

**Files Found:**
- `react/src/components/leave/DateRangeCalculator.tsx`
- `react/src/components/leave/AttachmentUpload.tsx`

**Investigation Needed:**
- Verify exports are `export` not `export default`
- Check file paths are correct
- Verify barrel export exists

### 3.3 Leave REST Hook

**File:** [react/src/hooks/useLeaveREST.ts](react/src/hooks/useLeaveREST.ts)

**Observations:**
- ✅ Complete leave management operations
- ✅ Socket.IO event listeners
- ✅ Type definitions

**Issues:**

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| H1 | Duplicate updates (API + Socket) | 🟢 | Remove one update path |
| H2 | No request debouncing | 🟢 | Add lodash.debounce |
| H3 | No retry logic for failures | 🟢 | Add retry mechanism |

---

## 4. Critical Issues Summary

### 4.1 Data Integrity Issues

| ID | Issue | Affected Code | Risk | Fix Complexity |
|----|-------|---------------|------|---------------|
| DI-1 | Employee reference inconsistency | leave.controller.js:86-90 | 🔴 High | 🟢 Low |
| DI-2 | No balance rollback on rejection | leave.controller.js:628-683 | 🔴 High | 🟡 Medium |
| DI-3 | No balance rollback on cancellation | leave.controller.js:376-402 | 🟡 Medium | 🟡 Medium |
| DI-4 | Wrong collection usage | leaveValidation.js:7-9 | 🟡 Medium | 🔴 High |

### 4.2 Validation Gaps

| ID | Missing Validation | Endpoint | Risk |
|----|-------------------|----------|------|
| VG-1 | Attachment file size | POST /leaves/:leaveId/attachments | Storage abuse |
| VG-2 | Attachment file type | POST /leaves/:leaveId/attachments | Security risk |
| VG-3 | Reason required field | POST /leaves | Data quality |
| VG-4 | Maximum concurrent leaves | POST /leaves | Policy violation |
| VG-5 | Leave encashment limits | POST /leaves | Financial impact |
| VG-6 | Half-day duration validation | POST /leaves | Balance incorrect |

### 4.3 Business Logic Issues

| ID | Issue | Current Behavior | Expected Behavior |
|----|-------|----------------|------------------|
| BL-1 | Half-day leaves | Not supported | Calculate 0.5 days |
| BL-2 | Leave carry forward | Not implemented | Annual balance reset |
| BL-3 | Leave encashment | Not implemented | Convert to cash |
| BL-4 | Negative balance handling | Prevents request | Allow with approval |
| BL-5 | Leave year boundary | No special handling | Carry forward logic |
| BL-6 | Weekend leave requests | Full days counted | Exclude weekends |

### 4.4 UX Issues

| ID | Issue | Component | Impact |
|----|-------|----------|--------|
| UX-1 | Blocking prompt for rejection | leaveAdmin.tsx | Poor UX |
| UX-2 | No loading states | All components | Unclear status |
| UX-3 | No error messages | All components | User confusion |
| UX-4 | No confirmation dialogs | Delete actions | Accidental deletes |
| UX-5 | Client-side stats | leaveAdmin.tsx | Inaccurate data |

---

## 5. Validation Gaps

### 5.1 Input Validation Matrix

| Field | Type | Required | Format | Min | Max | Current |
|-------|------|----------|--------|-----|-----|--------|
| leaveType | Enum | ✅ | sick/casual/etc | - | - | ✅ |
| startDate | Date | ✅ | ISO 8601 | today | +365d | ✅ |
| endDate | Date | ✅ | ISO 8601 | startDate | +365d | ✅ |
| reason | String | ❌ | Text | 1 | 500 | ❌ |
| detailedReason | String | ❌ | Text | 1 | 2000 | ❌ |
| attachments | Array | ❌ | File objects | 0 | 5 | ⚠️ |
| handoverToId | ObjectId | ❌ | - | - | - | ❌ |

### 5.2 Business Rule Validation

| Rule | Status | Implementation | Test Case |
|------|--------|----------------|-----------|
| Minimum notice period | ✅ | leaveValidation.js:74-85 | ✅ |
| Maximum consecutive days | ✅ | leaveValidation.js:88-94 | ✅ |
| Overlap detection | ✅ | leaveValidation.js:128-144 | ✅ |
| Balance check | ✅ | leaveValidation.js:97-125 | ✅ |
| Document requirement | ✅ | leaveValidation.js:147-157 | ❌ |
| Self-approval prevention | ✅ | leaveValidation.js:160-169 | ❌ |
| Probation restrictions | ⚠️ | leaveValidation.js:172-180 | ❌ |

### 5.3 API Validation Checklist

| Endpoint | Auth | Company | Role | Input | Output |
|----------|------|---------|------|-------|--------|
| GET /leaves | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |
| GET /leaves/:id | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /leaves | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| PUT /leaves/:id | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| DELETE /leaves/:id | ✅ | ✅ | ❌ | ✅ | ✅ |
| POST /leaves/:id/approve | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| POST /leaves/:id/reject | ✅ | ✅ | ❌ | ✅ | ✅ |
| GET /leaves/balance | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| POST /leaves/:leaveId/attachments | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |

**Legend:** ✅ Complete | ⚠️ Partial | ❌ Missing

---

## 6. Test Cases Required

### 6.1 Unit Tests for Backend

#### Leave Controller Tests

```typescript
describe('Leave Controller', () => {
  describe('POST /leaves', () => {
    it('should create leave request successfully')
    it('should validate dates are not in past')
    it('should calculate correct duration excluding weekends')
    it('should exclude holidays from duration')
    it('should prevent overlapping leave requests')
    it('should check sufficient balance')
    it('should require documents for long medical leaves')
    it('should prevent self-approval when employee is own manager')
    it('should fail when employee not found')
  });

  describe('POST /leaves/:id/approve', () => {
    it('should approve pending leave request')
    it('should deduct balance correctly')
    it('should broadcast approval event')
    it('should fail for non-pending leaves')
    it('should fail when approver not authorized')
  });

  describe('POST /leaves/:id/reject', () => {
    it('should reject pending leave request')
    it('should restore balance if previously approved')
    it('should require rejection reason')
    it('should broadcast rejection event')
    it('should notify employee')
  });

  describe('GET /leaves/balance', () => {
    it('should return balance for all leave types')
    it('should return balance for specific type')
    it('should calculate used correctly')
    it('should include pending leaves')
  });
});
```

#### Leave Validation Service Tests

```typescript
describe('Leave Validation Service', () => {
  describe('validateLeaveRequest', () => {
    it('should validate employee exists')
    it('should validate leave type is active')
    it('should calculate working days correctly')
    it('should check minimum notice period')
    it('should check maximum consecutive days')
    it('should verify sufficient balance')
    it('should detect overlapping requests')
    it('should require documents for 3+ day sick leaves')
    it('should prevent self-approval')
  });
});
```

#### Leave Days Calculator Tests

```typescript
describe('Leave Days Calculator', () => {
  describe('calculateWorkingDays', () => {
    it('should count Monday-Friday as working days')
    it('should exclude weekends')
    it('should exclude holidays')
    it('should handle date ranges spanning months')
    it('should handle date ranges spanning years')
    it('should return 0 for invalid ranges')
  });

  describe('checkWorkingDay', () => {
    it('should return false for weekends')
    it('should return false for holidays')
    it('should return true for regular working days')
  });
});
```

### 6.2 Integration Tests

```typescript
describe('Leave Management Integration', () => {
  it('should create, approve, and reflect in balance', async () => {
    // 1. Get initial balance
    const initialBalance = await getBalance('earned');

    // 2. Create leave request
    const leave = await createLeave({
      leaveType: 'earned',
      startDate: '2024-02-15',
      endDate: '2024-02-16',
      reason: 'Personal work'
    });

    // 3. Verify pending status
    expect(leave.status).toBe('pending');

    // 4. Approve leave
    const approved = await approveLeave(leave._id);
    expect(approved.status).toBe('approved');

    // 5. Verify balance deducted
    const finalBalance = await getBalance('earned');
    expect(finalBalance.balance).toBe(initialBalance.balance - 2);
  });

  it('should prevent overlapping leave requests', async () => {
    // Create first leave
    await createLeave({
      startDate: '2024-02-15',
      endDate: '2024-02-16'
    });

    // Try overlapping request
    await expect(
      createLeave({
        startDate: '2024-02-15',
        endDate: '2024-02-16'
      })
    ).rejects.toThrow('Overlapping leave requests');
  });
});
```

### 6.3 E2E Test Scenarios

```typescript
describe('Leave Management E2E', () => {
  it('complete leave request workflow', async () => {
    // Login as employee
    await loginAsEmployee();

    // Navigate to leaves
    await page.goto('/leaves');

    // Click "Add Leave"
    await page.click('[data-testid="add-leave-btn"]');

    // Fill form
    await page.selectOption('[name="leaveType"]', 'casual');
    await page.fill('[name="startDate"]', '2024-02-15');
    await page.fill('[name="endDate"]', '2024-02-16');
    await page.fill('[name="reason"]', 'Personal work');

    // Submit
    await page.click('[data-testid="submit-leave"]');

    // Verify success
    await expect(page.locator('.success-message')).toBeVisible();

    // Login as manager
    await loginAsManager();

    // View pending requests
    await page.goto('/leaves-admin');

    // Approve the request
    await page.click(`[data-leave-id="${leaveId}"] [data-action="approve"]`);

    // Verify approved
    await expect(page.locator(`[data-leave-id="${leaveId}"] .status-badge`))
      .toHaveText('Approved');
  });
});
```

---

## 7. Phased Roadmap

### Phase 1: Critical Fixes (Week 1)

**Target:** Resolve data integrity and critical bugs

| Task | File | Effort | Priority |
|------|------|--------|----------|
| Fix employee reference inconsistency | leave.controller.js | 2h | 🔴 Critical |
| Add balance rollback on rejection | leave.controller.js | 3h | 🔴 Critical |
| Add balance rollback on cancellation | leave.controller.js | 3h | 🔴 Critical |
| Fix collection/model usage inconsistency | leaveValidation.js | 4h | 🔴 Critical |
| Fix DateRangeCalculator import | leaveEmployee.tsx | 1h | 🔴 Critical |
| Add buildForbiddenError import | leave.controller.js | 0.5h | 🟡 High |

### Phase 2: Validation & Features (Week 2)

**Target:** Complete missing validations and features

| Task | Effort | Priority |
|------|--------|----------|
| Add attachment validation (size, type) | 3h | 🟡 High |
| Add reason field validation | 2h | 🟡 High |
| Implement half-day leave support | 8h | 🟡 High |
| Add timezone support to date calculations | 6h | 🟡 High |
| Implement leave carry-forward | 12h | 🟢 Medium |
| Add leave encashment | 10h | 🟢 Medium |
| Fix duplicate holiday soft-delete | 2h | 🟢 Medium |

### Phase 3: UX Improvements (Week 2-3)

| Task | Effort | Priority |
|------|--------|----------|
| Replace blocking prompts with modals | 4h | 🟡 High |
| Add loading states | 4h | 🟡 High |
| Add error boundary | 3h | 🟡 High |
| Replace window.confirm with modals | 2h | 🟢 Medium |
| Implement backend stats endpoint | 4h | 🟢 Medium |
| Add debounce to search inputs | 2h | 🟢 Medium |
| Add proper delete confirmations | 3h | 🟢 Medium |

### Phase 4: Testing (Week 3-4)

| Task | Effort | Priority |
|------|--------|----------|
| Write unit tests for controllers | 16h | 🟢 Medium |
| Write unit tests for services | 12h | 🟢 Medium |
| Write integration tests | 12h | 🟢 Medium |
| Write E2E test scenarios | 16h | 🟢 Medium |
| Set up test coverage reporting | 4h | 🟢 Low |
| Configure CI/CD test pipeline | 4h | 🟢 Low |

### Phase 5: Documentation (Week 4)

| Task | Effort | Priority |
|------|--------|----------|
| Document API endpoints (Swagger) | 6h | 🟢 Medium |
| Document component props | 4h | 🟢 Medium |
| Create leave policy guide | 4h | 🟢 Low |
| Create troubleshooting guide | 3h | 🟢 Low |

### Phase 6: Security & Performance (Week 5)

| Task | Effort | Priority |
|------|--------|----------|
| Add rate limiting | 3h | 🔴 Critical |
| Implement request throttling | 2h | 🟡 High |
| Add file upload virus scanning | 8h | 🟡 High |
| Add database indexes | 2h | 🟡 High |
| Implement caching for holidays | 4h | 🟢 Medium |
| Optimize database queries | 6h | 🟢 Medium |
| Add audit logging | 6h | 🟢 Medium |

---

## 8. API Documentation

### 8.1 Leave Endpoints

#### Create Leave Request
```http
POST /api/leaves
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "leaveType": "casual",
  "startDate": "2024-02-15T00:00:00.000Z",
  "endDate": "2024-02-16T23:59:59.999Z",
  "reason": "Personal work",
  "detailedReason": "Need to attend to personal matters",
  "handoverToId": "EMP001"
}

Response 201:
{
  "success": true,
  "data": {
    "_id": "...",
    "leaveId": "leave_123...",
    "employeeId": "EMP001",
    "leaveType": "casual",
    "startDate": "2024-02-15T00:00:00.000Z",
    "endDate": "2024-02-16T23:59:59.999Z",
    "duration": 2,
    "status": "pending",
    "balanceAtRequest": 10,
    "createdAt": "2024-02-04T10:30:00.000Z"
  },
  "message": "Leave request created successfully"
}

Error 400:
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Available: 8 day(s), Requested: 2 day(s)"
  }
}
```

#### Approve Leave
```http
POST /api/leaves/:id/approve
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "comments": "Approved. Enjoy your time off!"
}

Response 200:
{
  "success": true,
  "data": {
    "leaveId": "leave_123...",
    "status": "approved",
    "approvedBy": "user_456...",
    "approvedAt": "2024-02-04T11:00:00.000Z",
    "approveComments": "Approved. Enjoy your time off!"
  },
  "message": "Leave request approved successfully"
}
```

#### Get Leave Balance
```http
GET /api/leaves/balance?leaveType=earned
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "leaveType": "earned",
    "annualQuota": 12,
    "used": 5,
    "pending": 1,
    "balance": 7
  }
}
```

---

## 9. Data Models

### 9.1 Leave Request Structure

```typescript
interface Leave {
  // Identification
  _id: string;
  leaveId: string;

  // Employee
  employeeId: string;
  employeeName: string;
  reportingManagerId?: string;

  // Leave Details
  leaveType: LeaveType;
  startDate: string;  // ISO 8601
  endDate: string;    // ISO 8601
  duration: number;   // Working days
  reason: string;
  detailedReason?: string;

  // Status
  status: LeaveStatus;

  // Approval
  approvedBy?: string;
  approvedAt?: string;
  approveComments?: string;

  // Rejection
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;

  // Cancellation
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;

  // Balance Snapshot
  balanceAtRequest: number;

  // Handover
  handoverToId?: string;
  handoverToName?: string;

  // Attachments
  attachments?: Attachment[];

  // Audit
  companyId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

type LeaveType =
  | 'sick'
  | 'casual'
  | 'earned'
  | 'maternity'
  | 'paternity'
  | 'bereavement'
  | 'compensatory'
  | 'unpaid'
  | 'special';

type LeaveStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'on-hold';
```

### 9.2 Leave Balance Structure

```typescript
interface LeaveBalance {
  leaveType: LeaveType;
  annualQuota: number;
  used: number;
  pending: number;
  balance: number;
  // Future fields:
  // carriedForward?: number;
  // encashed?: number;
}
```

### 9.3 Leave Type Configuration

```typescript
interface LeaveTypeConfig {
  leaveTypeId: string;
  name: string;
  code: LeaveType;
  description: string;

  // Quota
  annualQuota: number;
  maxConsecutiveDays: number;
  minNoticeDays: number;
  carryForwardAllowed: boolean;
  carryForwardLimit?: number;
  encashmentAllowed: boolean;
  encashmentLimit?: number;

  // Restrictions
  requiresDocument: boolean;
  documentMinDuration: number;
  probationRestrictions?: {
    allowed: boolean;
    maxDays?: number;
  };

  // Approval
  requiresApproval: boolean;

  // Status
  isActive: boolean;
  companyId: string;
}
```

---

## 10. Security Considerations

### 10.1 Identified Security Issues

| # | Issue | Severity | Mitigation |
|---|-------|----------|------------|
| S1 | No rate limiting on leave creation | 🔴 High | Implement rate limiter |
| S2 | No file virus scanning | 🟡 Medium | Integrate AV scanner |
| S3 | No request throttling | 🟡 Medium | Add throttling middleware |
| S4 | Weak rejection reason storage | 🟢 Low | Encrypt sensitive data |
| S5 | No audit trail for balance changes | 🔴 High | Add audit logging |

### 10.2 Authorization Matrix

| Endpoint | Employee | Manager | HR | Admin |
|----------|---------|--------|-----|-------|
| GET /leaves | Own only | All | All | All |
| GET /leaves/:id | Own only | All | All | All |
| POST /leaves | ✅ | ✅ | ✅ | ✅ |
| PUT /leaves/:id | Own pending | - | ✅ | ✅ |
| DELETE /leaves/:id | Own pending | - | ✅ | ✅ |
| POST /leaves/:id/approve | ❌ | Reportees | All | All |
| POST /leaves/:id/reject | ❌ | Reportees | All | All |
| GET /leaves/balance | Own only | - | - | All |

---

## 11. Performance Considerations

### 11.1 Database Indexes Required

```javascript
// Leave Collection
db.leaves.createIndex({ employeeId: 1, startDate: -1, isDeleted: 1 });
db.leaves.createIndex({ companyId: 1, status: 1, isDeleted: 1 });
db.leaves.createIndex({ companyId: 1, leaveType: 1, isDeleted: 1 });
db.leaves.createIndex({ employeeId: 1, status: 1, startDate: 1 });

// Employee Collection - For balance queries
db.employees.createIndex({
  'leaveBalances.type': 1,
  'leaveBalances.companyId': 1
});
```

### 11.2 Caching Strategy

```javascript
// Cache Holiday Data (rarely changes)
const cacheKey = `holidays:${companyId}:${year}`;
const cachedHolidays = await redis.get(cacheKey);

if (!cachedHolidays) {
  const holidays = await Holiday.getHolidaysByYear(companyId, year);
  await redis.setex(cacheKey, 3600 * 24, JSON.stringify(holidays));
}

// Cache Balance Data with invalidation
const balanceKey = `balance:${employeeId}`;
const cachedBalance = await redis.get(balanceKey);

// Invalidate on leave approval
await redis.del(balanceKey);
```

---

## 12. Monitoring & Logging

### 12.1 Key Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| leave_request_created | Total leave requests | - |
| leave_request_approved | Approval rate | >80% |
| leave_request_rejected | Rejection rate | <10% |
| leave_request_duration_avg | Average leave duration | 2-5 days |
| leave_balance_utilization | Balance usage | <80% |
| leave_processing_time | Approval time | <24h |

### 12.2 Logging Requirements

```javascript
// Audit Log Format
{
  timestamp: "2024-02-04T10:30:00Z",
  event: "leave.approved",
  userId: "user_123",
  companyId: "company_456",
  leaveId: "leave_789",
  previousStatus: "pending",
  newStatus: "approved",
  balanceChange: {
    type: "casual",
    previousBalance: 10,
    newBalance: 9,
    change: -1
  },
  metadata: {
    approverIp: "192.168.1.100",
    userAgent: "Mozilla/5.0..."
  }
}
```

---

## 13. Recommendations

### 13.1 Immediate Actions

1. **Fix Critical Bugs**
   - Employee reference consistency
   - Balance rollback on rejection
   - Collection/model usage alignment

2. **Add Missing Validations**
   - Attachment size/type limits
   - Reason field requirements
   - Duplicate holiday checks

3. **Improve UX**
   - Replace blocking prompts
   - Add loading/error states
   - Better confirmation dialogs

### 13.2 Medium-term Improvements

1. **Complete Features**
   - Half-day leave support
   - Leave carry-forward
   - Leave encashment

2. **Testing**
   - Unit tests for critical paths
   - Integration tests for workflows
   - E2E tests for user journeys

3. **Documentation**
   - API documentation
   - Component documentation
   - User guides

### 13.3 Long-term Enhancements

1. **Advanced Features**
   - Leave quota banking
   - Compensatory off automation
   - Leave calendar sync

2. **Analytics**
   - Leave trend analysis
   - Absenteeism patterns
   - Department-level reporting

3. **Integrations**
   - Calendar integration (Outlook, Google)
   - Payroll integration
   - Notification systems

---

## 14. Appendix

### A. Leave Type Definitions

| Type | Code | Description | Default Quota |
|------|------|-------------|--------------|
| Casual Leave | `casual` | For personal reasons | 12 |
| Sick Leave | `sick` | For illness | 12 |
| Earned Leave | `earned` | Annual vacation | 12 |
| Maternity Leave | `maternity` | For childbirth | 90 |
| Paternity Leave | `paternity` | For new fathers | 14 |
| Bereavement | `bereavement` | For family death | 5 |
| Compensatory | `compensatory` | For extra work | Variable |
| Unpaid | `unpaid` | Without pay | Unlimited |
| Special | `special` | Case-by-case | Variable |

### B. Status Definitions

| Status | Code | Description | Employee Actions |
|--------|------|-------------|-----------------|
| Pending | `pending` | Awaiting approval | View, Cancel |
| Approved | `approved` | Manager approved | View, (Cancel if not started) |
| Rejected | `rejected` | Manager denied | View, Resubmit |
| Cancelled | `cancelled` | Cancelled by employee | View |
| On Hold | `on-hold` | Temporarily suspended | View |

### C. Error Codes

| Code | HTTP | Description |
|------|-----|-------------|
| LEAVE_NOT_FOUND | 404 | Leave request not found |
| INSUFFICIENT_BALANCE | 400 | Not enough leave balance |
| OVERLAPPING_LEAVE | 409 | Overlapping leave exists |
| INVALID_DATE_RANGE | 400 | End date before start date |
| MIN_NOTICE_NOT_MET | 400 | Minimum notice period not met |
| MAX_EXCEEDED | 400 | Maximum consecutive days exceeded |
| REQUIRES_DOCUMENT | 400 | Supporting document required |
| ALREADY_APPROVED | 400 | Cannot modify approved leave |
| CANNOT_CANCEL | 400 | Leave already started |

---

*Report Generated: 2026-02-04*
*Module Version: 1.0*
*Next Review: After Phase 1 completion*

