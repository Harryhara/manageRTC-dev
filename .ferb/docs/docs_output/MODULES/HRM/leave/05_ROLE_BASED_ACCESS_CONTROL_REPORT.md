# Leave Module - Role-Based Access Control (RBAC) Report

**Generated:** 2026-02-04
**Module:** HRM - Leave Management

---

## Executive Summary

The Leave module implements role-based access control across multiple user roles (Employee, Manager, HR, Admin, Superadmin). The current implementation has authorization checks defined in comments but requires enforcement. This document outlines the complete RBAC design and implementation requirements.

---

## 1. User Roles & Hierarchy

### 1.1 Role Definitions

| Role | Level | Description |
|------|-------|-------------|
| `Employee` | 1 | Standard employee, can only manage own leaves |
| `Manager` | 2 | Can approve leaves of reporting employees |
| `HR` | 3 | Full access to all leaves, can override decisions |
| `Admin` | 4 | Company administrator, full access |
| `Superadmin` | 5 | Platform administrator, cross-company access |

### 1.2 Role Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                      Superadmin                              │
│                  (Platform Level)                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        Admin                                 │
│                     (Company Level)                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                          HR                                   │
│                    (Department Level)                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Manager                                │
│                    (Team Level)                              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Employee                                │
│                   (Individual Level)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. API Endpoint Authorization Matrix

### 2.1 Access Control Summary

| Endpoint | Employee | Manager | HR | Admin | Superadmin |
|----------|----------|---------|-------|-------|------------|
| **GET /api/leaves** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **GET /api/leaves/my** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **GET /api/leaves/:id** | ✅ Own | ✅ Team | ✅ All | ✅ All | ✅ All |
| **GET /api/leaves/status/:status** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **GET /api/leaves/balance** | ✅ Self | ✅ Self | ✅ All | ✅ All | ✅ All |
| **POST /api/leaves** | ✅ Self | ✅ Self | ✅ Self | ✅ Any | ✅ Any |
| **PUT /api/leaves/:id** | ✅ Own | ✅ Team | ✅ All | ✅ All | ✅ All |
| **DELETE /api/leaves/:id** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **POST /api/leaves/:id/approve** | ❌ | ✅ Team | ✅ All | ✅ All | ✅ All |
| **POST /api/leaves/:id/reject** | ❌ | ✅ Team | ✅ All | ✅ All | ✅ All |
| **GET /api/reports/** | ❌ | ❌ | ✅ | ✅ | ✅ |

### 2.2 Detailed Authorization Rules

#### GET /api/leaves (Get All Leaves)

**Current Implementation:**
```javascript
// Route comment (not enforced)
// @access Private (Admin, HR, Superadmin)
```

**Required Middleware:**
```javascript
export const getLeaves = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  // Authorization check
  if (!['Admin', 'HR', 'Superadmin'].includes(user.role)) {
    throw buildForbiddenError('Insufficient permissions');
  }

  // ... existing code
});
```

#### POST /api/leaves (Create Leave)

**Authorization Rules:**
| Role | Can Create For | Notes |
|------|----------------|-------|
| Employee | Self only | Automatically set employee = current user |
| Manager | Self only | Same as employee |
| HR | Any employee | Specify employee in request body |
| Admin | Any employee | Specify employee in request body |
| Superadmin | Any employee | Cross-company |

**Required Implementation:**
```javascript
export const createLeave = asyncHandler(async (req, res) => {
  const user = extractUser(req);

  // Non-HR/Admin can only create for themselves
  if (!['HR', 'Admin', 'Superadmin'].includes(user.role)) {
    if (req.body.employeeId && req.body.employeeId !== user.employeeId) {
      throw buildForbiddenError('Can only create leave for yourself');
    }
    req.body.employeeId = user.employeeId;
  }

  // ... existing code
});
```

#### POST /api/leaves/:id/approve (Approve Leave)

**Authorization Rules:**
| Role | Can Approve | Restrictions |
|------|-------------|--------------|
| Employee | ❌ No | - |
| Manager | ✅ Reporting employees only | Cannot approve own leave |
| HR | ✅ All employees | Cannot approve own leave |
| Admin | ✅ All employees | Cannot approve own leave |
| Superadmin | ✅ All employees | Cannot approve own leave |

**Required Implementation:**
```javascript
export const approveLeave = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const leave = await getLeave(req.params.id);

  // Role check
  if (!['Manager', 'HR', 'Admin', 'Superadmin'].includes(user.role)) {
    throw buildForbiddenError('Insufficient permissions to approve leave');
  }

  // Manager can only approve reporting employees
  if (user.role === 'Manager') {
    const employee = await getEmployee(leave.employeeId);
    if (employee.reportingTo !== user.userId) {
      throw buildForbiddenError('Can only approve reporting employees');
    }
  }

  // Self-approval prevention
  if (leave.employeeId === user.employeeId) {
    throw buildConflictError('Cannot approve your own leave request');
  }

  // ... existing approval code
});
```

#### POST /api/leaves/:id/reject (Reject Leave)

Same authorization rules as approve.

---

## 3. Frontend Role-Based UI

### 3.1 UI Components by Role

#### Leave Admin Page (`leaveAdmin.tsx`)

**Current State:** Shows mock data for all employees

**Required Role-Based Features:**
| Feature | Employee | Manager | HR | Admin |
|---------|----------|---------|-------|-------|
| View all leaves | ❌ | ❌ | ✅ | ✅ |
| View team leaves | ❌ | ✅ | ✅ | ✅ |
| Create for others | ❌ | ❌ | ✅ | ✅ |
| Edit any leave | ❌ | ❌ | ✅ | ✅ |
| Delete leave | ❌ | ❌ | ✅ | ✅ |
| Approve/Reject | ❌ | ✅ Team | ✅ All | ✅ All |
| Export report | ❌ | ❌ | ✅ | ✅ |

#### Leave Employee Page (`leaveEmployee.tsx`)

**Current State:** Shows mock data for current user

**Required Features:**
| Feature | Employee | Manager | HR | Admin |
|---------|----------|---------|-------|-------|
| View own leaves | ✅ | ✅ | ✅ | ✅ |
| Create own leave | ✅ | ✅ | ✅ | ✅ |
| Edit own leave | ✅ Pending only | ✅ Pending only | ✅ All | ✅ All |
| Cancel own leave | ✅ | ✅ | ✅ | ✅ |
| View own balance | ✅ | ✅ | ✅ | ✅ |

### 3.2 Conditional Rendering Examples

```typescript
// Example: Show approve/reject buttons for managers
const LeaveActions = ({ leave, userRole }) => {
  const canApprove = ['Manager', 'HR', 'Admin'].includes(userRole);
  const isTeamMember = leave.employeeId === user.reportingTo;

  return (
    <>
      {canApprove && leave.status === 'pending' && (
        <>
          <Button onClick={() => approveLeave(leave._id)}>Approve</Button>
          <Button onClick={() => rejectLeave(leave._id)}>Reject</Button>
        </>
      )}
    </>
  );
};
```

---

## 4. Permission Scoping

### 4.1 Data Scoping Rules

| Role | Data Scope | Filter |
|------|------------|--------|
| Employee | Own data only | `employeeId = currentUser.employeeId` |
| Manager | Own + Team data | `employeeId IN (currentUser.employeeId, team.employeeIds)` |
| HR | All company data | `companyId = currentUser.companyId` |
| Admin | All company data | `companyId = currentUser.companyId` |
| Superadmin | All data | No filter (cross-company) |

### 4.2 Scoping Implementation

```javascript
// Middleware to apply data scoping
export const applyLeaveScope = (req, res, next) => {
  const user = extractUser(req);

  switch (user.role) {
    case 'Employee':
      req.scope = { employeeId: user.employeeId };
      break;
    case 'Manager':
      // Get team members
      const team = await getTeamMembers(user.userId);
      req.scope = { employeeId: { $in: [user.employeeId, ...team] } };
      break;
    case 'HR':
    case 'Admin':
      req.scope = { companyId: user.companyId };
      break;
    case 'Superadmin':
      req.scope = {}; // No restriction
      break;
  }

  next();
};

// Use in controller
export const getLeaves = asyncHandler(async (req, res) => {
  const filter = { ...req.scope, isDeleted: false };
  const leaves = await collections.leaves.find(filter).toArray();
  // ...
});
```

---

## 5. Reporting Manager Structure

### 5.1 Employee-Manager Relationship

```javascript
// In Employee schema
{
  employeeId: "EMP001",
  firstName: "John",
  lastName: "Doe",
  reportingTo: ObjectId("65cd34e56f7a8b9c0d1e2f3a"),  // Manager's employee ID
  // ...
}
```

### 5.2 Manager Approval Scope

```javascript
// Get manager's team members
async function getTeamMembers(managerEmployeeId) {
  const employees = await Employee.find({
    reportingTo: managerEmployeeId,
    isDeleted: false
  });
  return employees.map(e => e.employeeId);
}
```

### 5.3 Approval Chain

```
                ┌─────────────┐
                │   Superadmin│
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │    Admin     │
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │      HR      │
                └──────┬──────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
  ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
  │Manager A│    │Manager B│    │Manager C│
  └────┬────┘    └────┬────┘    └────┬────┘
       │              │              │
  ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
  │ Team A  │    │ Team B  │    │ Team C  │
  └─────────┘    └─────────┘    └─────────┘
```

---

## 6. Permission Matrix Summary

### 6.1 Action-Based Permissions

| Action | Employee | Manager | HR | Admin | Superadmin |
|--------|----------|---------|-------|-------|------------|
| **View Own Leaves** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Team Leaves** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **View All Leaves** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Create Own Leave** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Create for Others** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Edit Own Pending** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Edit Any Leave** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Cancel Own Leave** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Delete Leave** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Approve Team Leave** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Approve Any Leave** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Reject Team Leave** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Reject Any Leave** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **View Own Balance** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Any Balance** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Run Reports** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Export Data** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Manage Leave Types** | ❌ | ❌ | ✅ | ✅ | ✅ |

### 6.2 Cross-Company Access (Superadmin Only)

| Action | Superadmin |
|--------|------------|
| View leaves across companies | ✅ |
| Approve leave across companies | ✅ |
| Generate cross-company reports | ✅ |
| Manage leave types globally | ✅ |

---

## 7. Current Implementation Gaps

### 7.1 Missing Authorization Checks

| Endpoint | Current | Required |
|----------|---------|----------|
| GET /api/leaves | Comment only | Role check in middleware |
| POST /api/leaves | No employee validation | Force employee = current user |
| PUT /api/leaves/:id | No ownership check | Verify ownership or role |
| DELETE /api/leaves/:id | No ownership check | Verify admin HR or owner |
| POST /api/leaves/:id/approve | No manager check | Verify reporting relationship |
| POST /api/leaves/:id/reject | No manager check | Verify reporting relationship |

### 7.2 Required Middleware

```javascript
// Check if user can access specific leave
export const canAccessLeave = (action) => {
  return asyncHandler(async (req, res, next) => {
    const user = extractUser(req);
    const leave = await getLeave(req.params.id);

    // Owner can access
    if (leave.employeeId === user.employeeId) {
      if (['view', 'cancel', 'edit-pending'].includes(action)) {
        return next();
      }
    }

    // Managers can access team leaves
    if (user.role === 'Manager') {
      const employee = await getEmployee(leave.employeeId);
      if (employee.reportingTo === user.userId) {
        if (['view', 'approve', 'reject'].includes(action)) {
          return next();
        }
      }
    }

    // HR/Admin can access all
    if (['HR', 'Admin', 'Superadmin'].includes(user.role)) {
      return next();
    }

    throw buildForbiddenError('Insufficient permissions');
  });
};
```

---

## 8. Role-Based UI Components

### 8.1 Navigation Menu

```typescript
const renderNavItems = (userRole) => {
  const items = [
    { label: 'My Leaves', path: '/leaves-employee', roles: ['All'] },
    { label: 'All Leaves', path: '/leaves', roles: ['Manager', 'HR', 'Admin'] },
    { label: 'Leave Settings', path: '/leave-settings', roles: ['HR', 'Admin'] },
    { label: 'Leave Types', path: '/app-settings/leave-type', roles: ['HR', 'Admin'] },
    { label: 'Leave Reports', path: '/leave-report', roles: ['HR', 'Admin'] },
  ];

  return items.filter(item =>
    item.roles.includes('All') || item.roles.includes(userRole)
  );
};
```

### 8.2 Action Buttons

```typescript
const LeaveRowActions = ({ leave, user }) => {
  const isOwner = leave.employeeId === user.employeeId;
  const canApprove = ['Manager', 'HR', 'Admin'].includes(user.role);
  const isTeamMember = leave.reportingManager === user.userId;
  const isPending = leave.status === 'pending';

  return (
    <div className="actions">
      {/* Edit: Owner only, pending status */}
      {isOwner && isPending && (
        <IconButton onClick={() => editLeave(leave._id)}>
          <EditIcon />
        </IconButton>
      )}

      {/* Approve: Manager/HR/Admin, team members only */}
      {canApprove && isTeamMember && isPending && (
        <IconButton onClick={() => approveLeave(leave._id)}>
          <CheckIcon />
        </IconButton>
      )}

      {/* Reject: Manager/HR/Admin, team members only */}
      {canApprove && isTeamMember && isPending && (
        <IconButton onClick={() => rejectLeave(leave._id)}>
          <CloseIcon />
        </IconButton>
      )}

      {/* Delete: HR/Admin only */}
      {['HR', 'Admin'].includes(user.role) && (
        <IconButton onClick={() => deleteLeave(leave._id)}>
          <DeleteIcon />
        </IconButton>
      )}
    </div>
  );
};
```

---

## 9. Security Considerations

### 9.1 IDOR Prevention

**Insecure Direct Object Reference (IDOR)** vulnerabilities occur when users can access any record by guessing IDs.

**Mitigation:**
```javascript
// Always apply scope filter
const getLeave = async (leaveId, user) => {
  const scope = getScopeForUser(user);
  const leave = await Leave.findOne({ _id: leaveId, ...scope });

  if (!leave) {
    throw buildNotFoundError('Leave request', leaveId);
  }

  return leave;
};
```

### 9.2 Privilege Escalation Prevention

```javascript
// Validate role on every request
export const validateRole = (allowedRoles) => {
  return (req, res, next) => {
    const user = extractUser(req);

    if (!allowedRoles.includes(user.role)) {
      throw buildForbiddenError(`Role '${user.role}' not authorized`);
    }

    next();
  };
};

// Usage
router.post('/:id/approve',
  authenticate,
  validateRole(['Manager', 'HR', 'Admin', 'Superadmin']),
  leaveController.approveLeave
);
```

### 9.3 Audit Logging

```javascript
// Log all privileged actions
logger.info('Leave approved', {
  leaveId: leave.leaveId,
  approvedBy: user.userId,
  approverRole: user.role,
  employeeId: leave.employeeId,
  timestamp: new Date()
});
```

---

## 10. Implementation Checklist

### Phase 1: Backend Authorization

- [ ] Create authorization middleware
- [ ] Add role checks to all endpoints
- [ ] Implement manager scoping for team access
- [ ] Add self-approval prevention
- [ ] Implement audit logging

### Phase 2: Frontend Role-Based UI

- [ ] Store user role in context/state
- [ ] Conditionally render navigation items
- [ ] Implement permission-based action buttons
- [ ] Add role checking in API calls
- [ ] Show appropriate error messages

### Phase 3: Testing

- [ ] Test each role's access to endpoints
- [ ] Test manager team scoping
- [ ] Test cross-role access prevention
- [ ] Test IDOR prevention
- [ ] Test audit log generation

---

**Report End**
