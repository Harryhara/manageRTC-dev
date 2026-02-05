# Leave Module - Phase-by-Phase Implementation Plan

**Generated:** 2026-02-04
**Module:** HRM - Leave Management
**Estimated Duration:** 4-6 weeks

---

## Executive Summary

This implementation plan transforms the Leave module from a mock-data UI into a fully functional, production-ready leave management system. The backend infrastructure is 95% complete, so the focus is on frontend integration, authorization enforcement, and real-time features.

**Overall Timeline:**
- **Phase 1:** 1 week - Critical API Integration
- **Phase 2:** 1 week - Employee & Leave Type Data
- **Phase 3:** 1 week - Real-time & Notifications
- **Phase 4:** 1 week - Advanced Features
- **Phase 5:** 1 week - Testing & Bug Fixes
- **Phase 6:** 1 week - Documentation & Deployment

---

## Phase 1: Critical API Integration (Week 1)

**Goal:** Connect frontend to backend REST APIs

### Tasks

#### 1.1 Update leaveAdmin.tsx
**File:** `react/src/feature-module/hrm/attendance/leaves/leaveAdmin.tsx`

**Changes:**
```typescript
// Remove mock import
- import { leaveadmin_details } from "../../../../core/data/json/leaveadmin_details";

// Add hook import
+ import { useLeaveREST } from "../../../../hooks/useLeaveREST";

// Use hook in component
const LeaveAdmin = () => {
+  const { leaves, loading, fetchLeaves, approveLeave, rejectLeave } = useLeaveREST();

+  useEffect(() => {
+    fetchLeaves({ page: 1, limit: 20 });
+  }, []);

   // Replace mock data
-  const data = leaveadmin_details;
+  const data = leaves;

   // Add loading state
+  if (loading) return <LoadingSpinner />;

   // ... rest of component
};
```

**Acceptance Criteria:**
- [ ] Displays real leave data from backend
- [ ] Loading spinner shown during fetch
- [ ] Error message displayed on failure
- [ ] Pagination works correctly
- [ ] Filtering by status works

#### 1.2 Update leaveEmployee.tsx
**File:** `react/src/feature-module/hrm/attendance/leaves/leaveEmployee.tsx`

**Changes:** Similar to leaveAdmin.tsx but for employee view

**Acceptance Criteria:**
- [ ] Displays current user's leave requests
- [ ] Balance cards show real data from API
- [ ] Create leave modal submits to API
- [ ] Status badges match backend values

#### 1.3 Fix Status Value Mismatch
**Files:** Multiple components

**Change:** Standardize status values

```typescript
// Create status mapper
const statusMap = {
  'pending': { label: 'Pending', color: 'warning' },
  'approved': { label: 'Approved', color: 'success' },
  'rejected': { label: 'Rejected', color: 'danger' },
  'cancelled': { label: 'Cancelled', color: 'secondary' }
};

// Use in components
const getStatusBadge = (status: string) => {
  return statusMap[status] || { label: status, color: 'default' };
};
```

#### 1.4 Fix Field Name Mismatches
**Files:** `useLeaveREST.ts`

**Change:** Map backend field names to frontend expectations

```typescript
// In useLeaveREST.ts
const mapLeaveData = (leave: any): Leave => ({
  ...leave,
  LeaveType: leave.leaveType,
  NoOfDays: leave.duration,
  Employee: leave.employeeName,
  // ... other mappings
});
```

### Testing Checklist

- [ ] Unit tests for useLeaveREST hook
- [ ] Integration test for API calls
- [ ] Error handling test cases
- [ ] Loading state verification

---

## Phase 2: Employee & Leave Type Data (Week 2)

**Goal:** Implement real employee selection and leave type management

### Tasks

#### 2.1 Employee Selection Dropdown
**Files:** `leaveAdmin.tsx`, leave modal forms

**Implementation:**
```typescript
// Create new hook
// src/hooks/useEmployees.ts
export const useEmployees = () => {
  const [employees, setEmployees] = useState([]);

  const fetchEmployees = async () => {
    const response = await get('/employees');
    setEmployees(response.data);
  };

  return { employees, fetchEmployees };
};

// In component
const { employees } = useEmployees();
useEffect(() => {
  fetchEmployees();
}, []);

// Dropdown options
const employeeOptions = [
  { value: "Select", label: "Select" },
  ...employees.map((emp) => ({
    value: emp.employeeId,
    label: `${emp.firstName} ${emp.lastName}`
  }))
];
```

**Acceptance Criteria:**
- [ ] Dropdown populated from database
- [ ] Search/filter works
- [ ] Shows employee avatar
- [ ] Includes department/role info

#### 2.2 Leave Type Management API
**New File:** `backend/controllers/rest/leaveType.controller.js`

**Implementation:**
```javascript
// Get all leave types
export const getLeaveTypes = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const collections = getTenantCollections(user.companyId);

  const leaveTypes = await collections.leaveTypes
    .find({ isActive: true, isDeleted: false })
    .toArray();

  return sendSuccess(res, leaveTypes);
});

// Create leave type
export const createLeaveType = asyncHandler(async (req, res) => {
  // Implementation
});

// Update leave type
export const updateLeaveType = asyncHandler(async (req, res) => {
  // Implementation
});

// Delete leave type
export const deleteLeaveType = asyncHandler(async (req, res) => {
  // Implementation
});
```

**Add Routes:**
```javascript
// backend/routes/api/leaveType.js
router.get('/', leaveTypeController.getLeaveTypes);
router.post('/', leaveTypeController.createLeaveType);
router.put('/:id', leaveTypeController.updateLeaveType);
router.delete('/:id', leaveTypeController.deleteLeaveType);
```

#### 2.3 Update Leave Type Settings Page
**File:** `react/src/feature-module/settings/appSettings/leave-type.tsx`

**Changes:**
```typescript
// Add hook
import { useLeaveTypes } from '../../../hooks/useLeaveTypes';

const LeaveType = () => {
  const { leaveTypes, fetchLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType } = useLeaveTypes();

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  // Use real data instead of hardcoded
  // ... implement CRUD operations
};
```

**Acceptance Criteria:**
- [ ] Display leave types from database
- [ ] Add new leave type
- [ ] Edit existing leave type
- [ ] Delete leave type (soft delete)
- [ ] Form validation works

### Testing Checklist

- [ ] Employee dropdown loads correctly
- [ ] Leave type CRUD operations work
- [ ] Form validation prevents invalid data
- [ ] API error handling

---

## Phase 3: Real-time & Notifications (Week 3)

**Goal:** Implement Socket.IO for real-time updates

### Tasks

#### 3.1 Socket.IO Client Setup
**New File:** `react/src/services/socket.ts`

**Implementation:**
```typescript
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string, companyId: string) {
    this.socket = io(process.env.REACT_APP_API_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.setupEventListeners();
    this.joinRooms(companyId);
  }

  private setupEventListeners() {
    this.socket?.on('leave:approved', (data) => {
      // Handle approval
    });

    this.socket?.on('leave:rejected', (data) => {
      // Handle rejection
    });

    this.socket?.on('leave:balance_updated', (data) => {
      // Update balance
    });
  }

  private joinRooms(companyId: string) {
    this.socket?.emit('join', companyId);
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

export default new SocketService();
```

**Acceptance Criteria:**
- [ ] Socket connects successfully
- [ ] Reconnects on disconnect
- [ ] Authentication works
- [ ] Rooms joined correctly

#### 3.2 React Socket Hook
**New File:** `react/src/hooks/useSocket.ts`

**Implementation:**
```typescript
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import socketService from '../services/socket';

export const useSocket = () => {
  const { token, companyId } = useSelector(state => state.auth);

  useEffect(() => {
    if (token && companyId) {
      socketService.connect(token, companyId);
    }

    return () => {
      socketService.disconnect();
    };
  }, [token, companyId]);
};
```

#### 3.3 Update Components for Real-time
**Files:** `leaveAdmin.tsx`, `leaveEmployee.tsx`

**Changes:**
```typescript
// Add to App.tsx or root component
import { useSocket } from './hooks/useSocket';

function App() {
  useSocket(); // Initialize socket
  // ... rest of app
}

// In leave components, add event listeners
useEffect(() => {
  const handleApproved = (data) => {
    if (data._id === leave._id) {
      setLeave({ ...leave, status: 'approved' });
      message.success('Leave approved!');
    }
  };

  socket.on('leave:your_leave_approved', handleApproved);
  return () => socket.off('leave:your_leave_approved', handleApproved);
}, [leave]);
```

**Acceptance Criteria:**
- [ ] UI updates instantly on approval
- [ ] UI updates instantly on rejection
- [ ] Balance cards update automatically
- [ ] Notifications shown to user
- [ ] Admin sees new requests instantly

#### 3.4 Notification System
**New Component:** `react/src/components/Notifications/NotificationCenter.tsx`

**Implementation:**
```typescript
import { useNotification } from '../../hooks/useNotifications';

const NotificationCenter = () => {
  const { notifications, markAsRead } = useNotification();

  return (
    <Dropdown>
      <Badge count={notifications.length}>
        <BellIcon />
      </Badge>
      <Menu>
        {notifications.map(n => (
          <Menu.Item key={n.id} onClick={() => markAsRead(n.id)}>
            {n.message}
          </Menu.Item>
        ))}
      </Menu>
    </Dropdown>
  );
};
```

### Testing Checklist

- [ ] Socket connection stable
- [ ] Events received correctly
- [ ] UI updates without refresh
- [ ] Reconnection works
- [ ] Notifications display correctly

---

## Phase 4: Advanced Features (Week 4)

**Goal:** Implement advanced features and validations

### Tasks

#### 4.1 File Upload for Attachments
**Files:** Backend + Frontend

**Backend:**
```javascript
// backend/utils/fileUpload.js
export const uploadAttachment = async (file, companyId) => {
  const uploadPath = `uploads/${companyId}/leaves`;
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${uploadPath}/${fileName}`;

  // Upload to S3 or local storage
  // Return file metadata
};
```

**Frontend:**
```typescript
// In leave form
const [attachments, setAttachments] = useState([]);

const handleFileUpload = async (file) => {
  const uploaded = await uploadFile(file);
  setAttachments([...attachments, uploaded]);
};

// UI
<Upload
  beforeUpload={handleFileUpload}
  fileList={attachments}
  onChange={setAttachments}
>
  <Button icon={<UploadIcon />}>Upload Document</Button>
</Upload>
```

**Acceptance Criteria:**
- [ ] Upload medical certificates
- [ ] File preview available
- [ ] Delete uploaded files
- [ ] File size validation
- [ ] File type validation

#### 4.2 Enhanced Validations
**Files:** Backend controllers

**Implementations:**

**Self-Approval Prevention:**
```javascript
// In approveLeave controller
if (leave.employeeId === user.employeeId) {
  throw buildConflictError('Cannot approve your own leave request');
}
```

**Past Date Prevention:**
```javascript
// In createLeave controller
const today = new Date();
today.setHours(0, 0, 0, 0);
if (new Date(leaveData.startDate) < today) {
  throw buildValidationError('startDate', 'Cannot apply for past dates');
}
```

**Business Day Validation:**
```javascript
// Helper to check holidays
const isBusinessDay = async (date, companyId) => {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  // Check holidays
  const holiday = await Holiday.findOne({
    companyId,
    date: {
      $gte: startOfDay(date),
      $lte: endOfDay(date)
    }
  });

  return !holiday;
};
```

#### 4.3 Calendar View
**New Component:** `react/src/components/Calendar/LeaveCalendar.tsx`

**Implementation:**
```typescript
import { Calendar } from 'antd';

const LeaveCalendar = () => {
  const [leaves, setLeaves] = useState([]);

  const fetchData = async (date) => {
    const start = date.startOf('month');
    const end = date.endOf('month');
    const data = await getLeavesByDateRange(start, end);
    setLeaves(data);
  };

  const cellRender = (date) => {
    const dayLeaves = leaves.filter(l =>
      date.isBetween(l.startDate, l.endDate, null, '[]')
    );

    return (
      <div>
        {dayLeaves.map(leave => (
          <Tag color={getStatusColor(leave.status)}>
            {leave.employeeName}
          </Tag>
        ))}
      </div>
    );
  };

  return <Calendar cellRender={cellRender} onPanelChange={fetchData} />;
};
```

**Acceptance Criteria:**
- [ ] Calendar shows all leaves
- [ ] Click to see details
- [ ] Filter by department/employee
- [ ] Month navigation works

#### 4.4 Dashboard Stats
**File:** Update dashboard components

**Implementation:**
```typescript
// Fetch real stats
const fetchDashboardStats = async () => {
  const [total, pending, approved, rejected] = await Promise.all([
    getLeaves({ status: 'all' }).then(r => r.length),
    getLeaves({ status: 'pending' }).then(r => r.length),
    getLeaves({ status: 'approved' }).then(r => r.length),
    getLeaves({ status: 'rejected' }).then(r => r.length)
  ]);

  return { total, pending, approved, rejected };
};
```

### Testing Checklist

- [ ] File upload works correctly
- [ ] Validations prevent invalid requests
- [ ] Calendar displays correctly
- [ ] Dashboard stats accurate

---

## Phase 5: Testing & Bug Fixes (Week 5)

**Goal:** Comprehensive testing and bug resolution

### Tasks

#### 5.1 Unit Tests

**Backend Tests:**
```javascript
// backend/tests/controllers/leave.controller.test.js
describe('Leave Controller', () => {
  test('createLeave should create a leave request', async () => {
    // Test implementation
  });

  test('approveLeave should deduct balance', async () => {
    // Test implementation
  });

  test('checkOverlap should detect overlapping leaves', async () => {
    // Test implementation
  });
});
```

**Frontend Tests:**
```typescript
// src/hooks/__tests__/useLeaveREST.test.ts
describe('useLeaveREST', () => {
  test('fetchLeaves should return leave data', async () => {
    // Test implementation
  });

  test('createLeave should handle errors', async () => {
    // Test implementation
  });
});
```

#### 5.2 Integration Tests

```typescript
// E2E test scenarios
describe('Leave Flow E2E', () => {
  test('Employee applies for leave -> Manager approves', async () => {
    // 1. Login as employee
    // 2. Navigate to leave page
    // 3. Fill leave form
    // 4. Submit
    // 5. Verify in database
    // 6. Login as manager
    // 7. Approve leave
    // 8. Verify balance deduction
  });
});
```

#### 5.3 Edge Case Testing

| Test Case | Expected Behavior |
|-----------|------------------|
| Overlapping dates | Error: "Overlapping leave exists" |
| Insufficient balance | Error: "Insufficient leave balance" |
| Past date application | Error: "Cannot apply for past dates" |
| Self-approval attempt | Error: "Cannot approve own leave" |
| Manager approves non-reporting employee | Error: "Not your reporting employee" |
| Delete approved leave | Error: "Cannot delete approved leave" |
| Cancel after approval | Success with reason |
| Half-day duration | Duration = 0.5 |
| Weekend dates | Excluded from working days |

#### 5.4 Performance Testing

```javascript
// Load testing scenarios
describe('Performance Tests', () => {
  test('Handle 1000 concurrent leave requests', async () => {
    // Test implementation
  });

  test('Get leaves with pagination < 200ms', async () => {
    // Test implementation
  });
});
```

### Testing Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Edge cases handled
- [ ] Performance benchmarks met
- [ ] No console errors
- [ ] Memory leaks fixed

---

## Phase 6: Documentation & Deployment (Week 6)

**Goal:** Complete documentation and deploy to production

### Tasks

#### 6.1 API Documentation

**Generate OpenAPI/Swagger docs:**
```yaml
# api-docs/swagger.yaml
openapi: 3.0.0
info:
  title: Leave Management API
  version: 1.0.0
paths:
  /api/leaves:
    get:
      summary: Get all leave requests
      tags: [Leaves]
      security:
        - bearerAuth: []
      responses:
        200:
          description: Success
    post:
      summary: Create leave request
      # ... complete documentation
```

#### 6.2 User Documentation

**Create user guides:**
- Employee Guide: How to apply for leave
- Manager Guide: How to approve/reject leave
- Admin Guide: How to manage leave types
- FAQ Document

#### 6.3 Developer Documentation

**Create developer docs:**
- Architecture overview
- Database schema diagrams
- API endpoint reference
- Socket.IO event reference
- Contribution guidelines

#### 6.4 Deployment Checklist

**Backend:**
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Indexes created
- [ ] Socket.IO server configured
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Error tracking setup (Sentry)

**Frontend:**
- [ ] Environment variables configured
- [ ] API endpoints configured
- [ ] Socket.IO URL configured
- [ ] Build optimized
- [ ] Assets uploaded to CDN

**Database:**
- [ ] Collections created
- [ ] Initial leave types seeded
- [ ] Sample data (if needed)
- [ ] Backup strategy in place

#### 6.5 Monitoring Setup

**Metrics to Track:**
- API response times
- Socket.IO connection count
- Database query performance
- Error rates
- User activity

**Alerts:**
- High error rate
- Slow API responses
- Database connection issues
- Socket.IO disconnections

---

## Summary Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1 | Week 1 | Frontend connected to REST APIs |
| 2 | Week 2 | Employee & leave type management |
| 3 | Week 3 | Real-time Socket.IO updates |
| 4 | Week 4 | Advanced features (attachments, calendar) |
| 5 | Week 5 | Testing & bug fixes |
| 6 | Week 6 | Documentation & deployment |

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| API breaking changes | High | Low | Version APIs, thorough testing |
| Socket connection issues | Medium | Medium | Fallback to REST, reconnection logic |
| Database performance | Medium | Low | Proper indexing, caching |
| Security vulnerabilities | High | Low | Code review, penetration testing |
| User adoption issues | Medium | Medium | Training, good documentation |

---

## Success Criteria

The Leave module will be considered complete when:

- [ ] All CRUD operations work via REST API
- [ ] Real-time updates work via Socket.IO
- [ ] Leave balance is accurate and updates automatically
- [ ] Approval workflow functions correctly
- [ ] All validations prevent invalid operations
- [ ] Role-based access is enforced
- [ ] File upload works for attachments
- [ ] Reports generate correctly
- [ ] Unit tests cover critical paths
- [ ] Documentation is complete
- [ ] Performance benchmarks are met

---

**Report End**
