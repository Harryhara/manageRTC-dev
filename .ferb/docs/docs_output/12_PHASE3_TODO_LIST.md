# 📋 PHASE 3 TODO LIST: Assets & Training REST APIs
## manageRTC Platform - Socket.IO to REST Migration

**Phase:** 3 of 6
**Start Date:** January 29, 2026
**Estimated Duration:** 2-3 days
**Dependencies:** Phase 2 (Complete)

---

## 🎯 PHASE 3 OBJECTIVES

Build REST APIs for Assets and Training management modules following the same pattern established in Phase 1 and Phase 2:
- 80% REST for CRUD operations
- 20% Socket.IO for real-time updates only
- Socket.IO broadcasters integrated with REST controllers

---

## 📊 PHASE 3 DELIVERABLES

| Module | REST Endpoints | Socket.IO Events |
|--------|---------------|------------------|
| **Assets** | 8 endpoints | 5 events |
| **Training** | 7 endpoints | 4 events |

**Total:** 15 REST endpoints + 9 Socket.IO events

---

## 📝 DETAILED TASK LIST

### 1. ASSETS REST API (8 endpoints)

#### 1.1 Create Asset Schema
- [ ] Create `backend/models/asset/asset.schema.js`
- [ ] Define fields: name, type, category, serialNumber, purchaseDate, value, status, location, assignedTo, maintenanceSchedule
- [ ] Add indexes: name, category, status, companyId
- [ ] Add virtuals: isUnderMaintenance, depreciationValue, ageInYears
- [ ] Add middleware: pre-save for depreciation calculation

#### 1.2 Create Asset REST Controller
- [ ] Create `backend/controllers/rest/asset.controller.js`
- [ ] Implement getAssets (list with pagination)
- [ ] Implement getAssetById (detail)
- [ ] Implement createAsset (create)
- [ ] Implement updateAsset (update)
- [ ] Implement deleteAsset (soft delete)
- [ ] Implement getAssetsByCategory (by category)
- [ ] Implement getAssetsByStatus (by status)
- [ ] Implement getAssetStats (statistics)

#### 1.3 Create Asset REST Routes
- [ ] Create `backend/routes/api/assets.js`
- [ ] Wire up all 8 endpoints to controller
- [ ] Add authentication middleware
- [ ] Add validation middleware (Joi)
- [ ] Add role-based access control

#### 1.4 Create Asset Socket.IO Broadcasters
- [ ] Add to `backend/utils/socketBroadcaster.js`:
  - [ ] `broadcastAssetEvents.created`
  - [ ] `broadcastAssetEvents.updated`
  - [ ] `broadcastAssetEvents.assigned`
  - [ ] `broadcastAssetEvents.maintenanceScheduled`
  - [ ] `broadcastAssetEvents.deleted`

#### 1.5 Integrate Broadcasters with Controller
- [ ] Add `getSocketIO` import to asset.controller.js
- [ ] Add broadcaster calls in createAsset
- [ ] Add broadcaster calls in updateAsset
- [ ] Add broadcaster calls in deleteAsset

---

### 2. TRAINING REST API (7 endpoints)

#### 2.1 Create Training Schema
- [ ] Create `backend/models/training/training.schema.js`
- [ ] Define fields: name, type, category, startDate, endDate, instructor, maxParticipants, status, budget
- [ ] Add indexes: name, type, status, companyId
- [ ] Add virtuals: duration, isUpcoming, isCompleted, availableSlots
- [ ] Add middleware: pre-save for duration calculation

#### 2.2 Create Training REST Controller
- [ ] Create `backend/controllers/rest/training.controller.js`
- [ ] Implement getTrainings (list with pagination)
- [ ] Implement getTrainingById (detail)
- [ ] Implement createTraining (create)
- [ ] Implement updateTraining (update)
- [ ] Implement deleteTraining (soft delete)
- [ ] Implement getTrainingByType (by type)
- [ ] Implement getTrainingStats (statistics)

#### 2.3 Create Training REST Routes
- [ ] Create `backend/routes/api/training.js`
- [ ] Wire up all 7 endpoints to controller
- [ ] Add authentication middleware
- [ ] Add validation middleware (Joi)
- [ ] Add role-based access control

#### 2.4 Create Training Socket.IO Broadcasters
- [ ] Add to `backend/utils/socketBroadcaster.js`:
  - [ ] `broadcastTrainingEvents.created`
  - [ ] `broadcastTrainingEvents.updated`
  - [ ] `broadcastTrainingEvents.enrollmentOpened`
  - [ ] `broadcastTrainingEvents.deleted`

#### 2.5 Integrate Broadcasters with Controller
- [ ] Add `getSocketIO` import to training.controller.js
- [ ] Add broadcaster calls in createTraining
- [ ] Add broadcaster calls in updateTraining
- [ ] Add broadcaster calls in deleteTraining

---

### 3. POSTMAN COLLECTION

#### 3.1 Create Postman Collection
- [ ] Create `postman/Phase3_Assets_Training_APIs.json`
- [ ] Add all 8 Assets endpoints
- [ ] Add all 7 Training endpoints
- [ ] Add environment variables
- [ ] Add authentication setup
- [ ] Add sample requests
- [ ] Add test scripts

---

### 4. DOCUMENTATION

#### 4.1 Update Documentation
- [ ] Update progress tracker with Phase 3 tasks
- [ ] Update comprehensive TODO list
- [ ] Create Phase 3 validation report

#### 4.2 API Documentation
- [ ] Document all 15 endpoints
- [ ] Add request/response examples
- [ ] Add authentication requirements
- [ ] Add error codes

---

## 🎯 PHASE 3 SUCCESS CRITERIA

### Must Have (Mandatory)
- [ ] All 8 Assets REST endpoints working
- [ ] All 7 Training REST endpoints working
- [ ] Socket.IO broadcasters integrated for both controllers
- [ ] Postman collection with all endpoints tested
- [ ] Phase 3 validation report completed

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

## 📅 PHASE 3 TIMELINE

| Day | Tasks | Deliverables |
|-----|-------|--------------|
| **Day 1** | Assets schema, controller, routes | Assets REST API (8 endpoints) |
| **Day 2** | Training schema, controller, routes | Training REST API (7 endpoints) |
| **Day 3** | Socket.IO broadcasters, integration, Postman, docs | Phase 3 complete |

---

## 🚀 NEXT PHASES

After Phase 3 completion:
- **Phase 4:** Payroll REST API (most complex)
- **Phase 5:** Recruitment REST API
- **Phase 6:** Frontend integration with REST APIs

---

## 📞 SUPPORT & REFERENCES

**Documentation:**
- [`.ferb/docs/06_IMPLEMENTATION_PLAN_PART1.md`](../../06_IMPLEMENTATION_PLAN_PART1.md) - Schema designs
- [`.ferb/docs/08_DB_SCHEMA_INTEGRATION_GUIDE.md`](../../08_DB_SCHEMA_INTEGRATION_GUIDE.md) - Database reference
- [`.ferb/docs/09_SOCKETIO_VS_REST_GUIDE.md`](../../09_SOCKETIO_VS_REST_GUIDE.md) - Architecture guide

**Phase References:**
- [`docs_output/10_PHASE1_COMPLETION_CONFIRMATION.md`](./10_PHASE1_COMPLETION_CONFIRMATION.md) - Phase 1 validation
- [`docs_output/11_PHASE2_COMPLETION_CONFIRMATION.md`](./11_PHASE2_COMPLETION_CONFIRMATION.md) - Phase 2 validation

---

**Phase 3 Status:** 🟡 **READY TO START**
**Phase 2 Status:** ✅ **COMPLETE**
**Phase 1 Status:** ✅ **COMPLETE**
