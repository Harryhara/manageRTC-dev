# 📋 PHASE 2 TODO LIST: Attendance & Leave REST APIs
## manageRTC Platform - Socket.IO to REST Migration

**Phase:** 2 of 6
**Start Date:** January 29, 2026
**Estimated Duration:** 3-4 days
**Dependencies:** Phase 1 (Complete)

---

## 🎯 PHASE 2 OBJECTIVES

Build REST APIs for Attendance and Leave management modules following the same pattern established in Phase 1:
- 80% REST for CRUD operations
- 20% Socket.IO for real-time updates only
- Socket.IO broadcasters integrated with REST controllers

---

## 📊 PHASE 2 DELIVERABLES

| Module | REST Endpoints | Socket.IO Events |
|--------|---------------|------------------|
| **Attendance** | 10 endpoints | 6 events |
| **Leave** | 11 endpoints | 7 events |

**Total:** 21 REST endpoints + 13 Socket.IO events

---

## 📝 DETAILED TASK LIST

### 1. ATTENDANCE REST API (10 endpoints)

#### 1.1 Create Attendance Schema
- [ ] Create `backend/models/attendance/attendance.schema.js`
- [ ] Define fields: employee, date, clockIn, clockOut, status, hoursWorked, overtime, location, deviceId
- [ ] Add indexes: employee+date compound, status, companyId
- [ ] Add virtuals: isLate, isEarlyDeparture, regularHours
- [ ] Add middleware: pre-save for hours calculation

#### 1.2 Create Attendance REST Controller
- [ ] Create `backend/controllers/rest/attendance.controller.js`
- [ ] Implement getAttendances (list with pagination)
- [ ] Implement getAttendanceById (detail)
- [ ] Implement createAttendance (clock in)
- [ ] Implement updateAttendance (clock out/update)
- [ ] Implement deleteAttendance (soft delete)
- [ ] Implement getMyAttendance (current user's records)
- [ ] Implement getAttendanceByDateRange (date range filter)
- [ ] Implement getAttendanceByEmployee (employee records)
- [ ] Implement getAttendanceStats (statistics)
- [ ] Implement bulkAttendanceAction (bulk update)

#### 1.3 Create Attendance REST Routes
- [ ] Create `backend/routes/api/attendance.js`
- [ ] Wire up all 10 endpoints to controller
- [ ] Add authentication middleware
- [ ] Add validation middleware (Joi)
- [ ] Add role-based access control

#### 1.4 Create Attendance Socket.IO Broadcasters
- [ ] Add to `backend/utils/socketBroadcaster.js`:
  - [ ] `broadcastAttendanceEvents.created`
  - [ ] `broadcastAttendanceEvents.updated`
  - [ ] `broadcastAttendanceEvents.clockIn`
  - [ ] `broadcastAttendanceEvents.clockOut`
  - [ ] `broadcastAttendanceEvents.deleted`
  - [ ] `broadcastAttendanceEvents.bulkUpdated`

#### 1.5 Integrate Broadcasters with Controller
- [ ] Add `getSocketIO` import to attendance.controller.js
- [ ] Add broadcaster calls in createAttendance
- [ ] Add broadcaster calls in updateAttendance
- [ ] Add broadcaster calls in deleteAttendance
- [ ] Add broadcaster calls in bulkAttendanceAction

---

### 2. LEAVE REST API (11 endpoints)

#### 2.1 Create Leave Schema
- [ ] Create `backend/models/leave/leave.schema.js`
- [ ] Define fields: employee, leaveType, startDate, endDate, reason, status, approvedBy, attachments
- [ ] Add indexes: employee+status, leaveType, companyId
- [ ] Add virtuals: duration, approvalChain
- [ ] Add middleware: pre-save for duration calculation

#### 2.2 Create Leave REST Controller
- [ ] Create `backend/controllers/rest/leave.controller.js`
- [ ] Implement getLeaves (list with pagination)
- [ ] Implement getLeaveById (detail)
- [ ] Implement createLeave (apply for leave)
- [ ] Implement updateLeave (update leave request)
- [ ] Implement deleteLeave (cancel/soft delete)
- [ ] Implement getMyLeaves (current user's requests)
- [ ] Implement approveLeave (approve action)
- [ ] Implement rejectLeave (reject action)
- [ ] Implement getLeavesByStatus (status filter)
- [ ] Implement getLeavesByEmployee (employee requests)
- [ ] Implement getLeaveBalance (calculate balance)

#### 2.3 Create Leave REST Routes
- [ ] Create `backend/routes/api/leave.js`
- [ ] Wire up all 11 endpoints to controller
- [ ] Add authentication middleware
- [ ] Add validation middleware (Joi)
- [ ] Add role-based access control

#### 2.4 Create Leave Socket.IO Broadcasters
- [ ] Add to `backend/utils/socketBroadcaster.js`:
  - [ ] `broadcastLeaveEvents.created`
  - [ ] `broadcastLeaveEvents.updated`
  - [ ] `broadcastLeaveEvents.approved`
  - [ ] `broadcastLeaveEvents.rejected`
  - [ ] `broadcastLeaveEvents.cancelled`
  - [ ] `broadcastLeaveEvents.deleted`
  - [ ] `broadcastLeaveEvents.balanceUpdated`

#### 2.5 Integrate Broadcasters with Controller
- [ ] Add `getSocketIO` import to leave.controller.js
- [ ] Add broadcaster calls in createLeave
- [ ] Add broadcaster calls in updateLeave
- [ ] Add broadcaster calls in approveLeave
- [ ] Add broadcaster calls in rejectLeave
- [ ] Add broadcaster calls in deleteLeave

---

### 3. POSTMAN COLLECTION

#### 3.1 Create Postman Collection
- [ ] Create `postman/Phase2_Attendance_Leave_APIs.json`
- [ ] Add all 10 Attendance endpoints
- [ ] Add all 11 Leave endpoints
- [ ] Add environment variables
- [ ] Add authentication setup
- [ ] Add sample requests
- [ ] Add test scripts

---

### 4. DOCUMENTATION

#### 4.1 Update Documentation
- [ ] Update progress tracker with Phase 2 tasks
- [ ] Update comprehensive TODO list
- [ ] Create Phase 2 validation report

#### 4.2 API Documentation
- [ ] Document all 21 endpoints
- [ ] Add request/response examples
- [ ] Add authentication requirements
- [ ] Add error codes

---

## 🎯 PHASE 2 SUCCESS CRITERIA

### Must Have (Mandatory)
- [ ] All 10 Attendance REST endpoints working
- [ ] All 11 Leave REST endpoints working
- [ ] Socket.IO broadcasters integrated for both controllers
- [ ] Postman collection with all endpoints tested
- [ ] Phase 2 validation report completed

### Should Have (High Priority)
- [ ] Input validation with Joi for all endpoints
- [ ] Error handling with custom error classes
- [ ] Audit fields (createdBy, updatedBy) populated
- [ ] Soft delete implemented

### Could Have (Nice to Have)
- [ ] Unit tests for controllers
- [ ] Integration tests for routes
- [ ] API documentation with Swagger

---

## 📅 PHASE 2 TIMELINE

| Day | Tasks | Deliverables |
|-----|-------|--------------|
| **Day 1** | Attendance schema, controller, routes | Attendance REST API (10 endpoints) |
| **Day 2** | Leave schema, controller, routes | Leave REST API (11 endpoints) |
| **Day 3** | Socket.IO broadcasters, integration | Broadcasters integrated |
| **Day 4** | Postman collection, testing, documentation | Phase 2 complete |

---

## 🚀 NEXT PHASES

After Phase 2 completion:
- **Phase 3:** Asset & Training REST APIs
- **Phase 4:** Payroll REST API (most complex)
- **Phase 5:** Remaining HRMS REST APIs
- **Phase 6:** Frontend integration with REST APIs

---

## 📞 SUPPORT & REFERENCES

**Documentation:**
- [`.ferb/docs/06_IMPLEMENTATION_PLAN_PART1.md`](../../06_IMPLEMENTATION_PLAN_PART1.md) - Schema designs
- [`.ferb/docs/08_DB_SCHEMA_INTEGRATION_GUIDE.md`](../../08_DB_SCHEMA_INTEGRATION_GUIDE.md) - Database reference
- [`.ferb/docs/09_SOCKETIO_VS_REST_GUIDE.md`](../../09_SOCKETIO_VS_REST_GUIDE.md) - Architecture guide

**Phase 1 Reference:**
- [`docs_output/08_PHASE1_BRUTAL_VALIDATION_REPORT.md`](./08_PHASE1_BRUTAL_VALIDATION_REPORT.md) - Phase 1 validation

---

**Phase 2 Status:** 🟡 **READY TO START**
**Phase 1 Status:** ✅ **COMPLETE**
