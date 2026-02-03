# HRM MODULE - IMPLEMENTATION PHASES & TODOs

**Project:** manageRTC-my HRM Module Validation & Fixes
**Start Date:** February 2, 2026
**Total Duration:** 10 Weeks
**Overall Goal:** Resolve all validation issues and achieve production-ready HRM module

---

## PHASE 1: CRITICAL SECURITY FIXES
**Duration:** Week 1-2 | **Priority:** P0 | **Status:** ⏳ Not Started

### Critical Security Fixes - Detailed Tasks

```markdown
## Phase 1.1: SQL Injection & Input Validation Fixes
- [ ] 1.1.1: Fix Clerk email query injection (hrm.employee.js:1001)
  - Location: backend/services/hr/hrm.employee.js:1001-1003
  - Action: Add email validation before Clerk API call
  - Effort: 4 hours

- [ ] 1.1.2: Add email format validation middleware
  - Location: backend/middleware/validate.js
  - Action: Create reusable email validator
  - Effort: 2 hours

- [ ] 1.1.3: Sanitize all search inputs
  - Location: backend/controllers/rest/employee.controller.js
  - Action: Apply sanitizeMongoQuery to all search endpoints
  - Effort: 3 hours

## Phase 1.2: Fix Undefined Variable Bug
- [ ] 1.2.1: Fix undefined 'employee' variable in updateBankStatutory
  - Location: backend/services/hr/hrm.employee.js:1617-1622
  - Action: Uncomment employee lookup or fix the validation logic
  - Effort: 2 hours

- [ ] 1.2.2: Fix undefined 'employee' variable in updateFamilyInfo
  - Location: backend/services/hr/hrm.employee.js:1455-1496
  - Action: Fix ternary operator logic error
  - Effort: 1 hour

- [ ] 1.2.3: Fix undefined 'employee' variable in getBankStatutory
  - Location: backend/services/hr/hrm.employee.js:1387-1454
  - Action: Fix the validation logic error
  - Effort: 1 hour

## Phase 1.3: Authorization & Access Control
- [ ] 1.3.1: Add authorization check on employee deletion
  - Location: backend/controllers/rest/employee.controller.js:255-293
  - Action: Validate user can delete (check assignments)
  - Effort: 6 hours

- [ ] 1.3.2: Add role check on employee detail view
  - Location: backend/routes/api/employees.js:112-117
  - Action: Require hr/admin role for viewing other employees
  - Effort: 2 hours

- [ ] 1.3.3: Implement department-level access control
  - Location: backend/middleware/auth.js
  - Action: Add department-based access control middleware
  - Effort: 8 hours

## Phase 1.4: Environment & Configuration
- [ ] 1.4.1: Fix hardcoded DOMAIN environment variable
  - Location: backend/services/hr/hrm.employee.js:1275
  - Action: Add default value and validation for DOMAIN env var
  - Effort: 2 hours

- [ ] 1.4.2: Add environment variable validation
  - Location: backend/config/env.js (create if not exists)
  - Action: Create env validation schema
  - Effort: 3 hours

## Phase 1.5: Data Integrity Fixes
- [ ] 1.5.1: Fix circular reference in reportingTo
  - Location: backend/models/employee/employee.schema.js
  - Action: Add validation to prevent self-reference
  - Effort: 4 hours

- [ ] 1.5.2: Add department/designation existence validation
  - Location: backend/controllers/rest/employee.controller.js:131-175
  - Action: Validate refs exist before creating employee
  - Effort: 6 hours

- [ ] 1.5.3: Fix deletedBy field type mismatch
  - Location: backend/models/employee/employee.schema.js:362
  - Action: Change ref to match service layer (string vs ObjectId)
  - Effort: 2 hours

## Phase 1.6: Testing & Validation
- [ ] 1.6.1: Write unit tests for security fixes
  - Location: backend/tests/unit/security/
  - Action: Test all P0 fixes
  - Effort: 8 hours

- [ ] 1.6.2: Run security scan
  - Action: Run npm audit & snyk scan
  - Effort: 1 hour

- [ ] 1.6.3: Create security fix documentation
  - Location: docs/security-fixes.md
  - Action: Document all changes
  - Effort: 2 hours

**Phase 1 Total Effort:** ~60 hours
**Deliverables:** All P0 issues resolved, security scan passed
```

---

## PHASE 2: DATA MODEL MIGRATION
**Duration:** Week 3-4 | **Priority:** P1 | **Status:** ⏳ Not Started

```markdown
## Phase 2.1: Migration Planning
- [ ] 2.1.1: Analyze legacy MongoDB collection pattern
  - Action: Document all differences between legacy and Mongoose
  - Effort: 4 hours

- [ ] 2.1.2: Create migration plan document
  - Location: docs/migration-plan.md
  - Action: Detail step-by-step migration
  - Effort: 4 hours

- [ ] 2.1.3: Create rollback strategy
  - Action: Plan rollback if migration fails
  - Effort: 2 hours

## Phase 2.2: Field Name Standardization
- [ ] 2.2.1: Standardize employee fields
  - Action: Map legacy fields to Mongoose schema fields
  - Map: dateOfJoining → joiningDate
  - Map: status → employmentStatus
  - Map: departmentId → department (ObjectId)
  - Map: designationId → designation (ObjectId)
  - Map: reportingManager → reportingTo
  - Effort: 8 hours

- [ ] 2.2.2: Standardize department fields
  - Action: Align department controller with schema
  - Fix: department → name field
  - Effort: 4 hours

- [ ] 2.2.3: Standardize leave balance structure
  - Action: Change from object to array structure
  - Effort: 6 hours

## Phase 2.3: Service Layer Migration
- [ ] 2.3.1: Rewrite hrm.employee.js using Mongoose
  - Location: backend/services/hr/employee.service.js (new)
  - Action: Create new service using Mongoose models
  - Effort: 16 hours

- [ ] 2.3.2: Update hrm.department.js
  - Action: Use Mongoose instead of direct collection access
  - Effort: 6 hours

- [ ] 2.3.3: Update hrm.designation.js
  - Action: Use Mongoose instead of direct collection access
  - Effort: 6 hours

- [ ] 2.3.4: Update leave services
  - Action: Standardize leave operations
  - Effort: 8 hours

## Phase 2.4: Database Migration Script
- [ ] 2.4.1: Create data migration script
  - Location: backend/scripts/migrate-to-mongoose.js
  - Action: Script to migrate existing data
  - Effort: 8 hours

- [ ] 2.4.2: Create migration validation script
  - Action: Verify data integrity after migration
  - Effort: 4 hours

- [ ] 2.4.3: Test migration on staging
  - Action: Run full migration test
  - Effort: 4 hours

## Phase 2.5: TypeScript Interface Updates
- [ ] 2.5.1: Update Employee interface
  - Location: react/src/types/employee.ts
  - Action: Match new schema structure
  - Effort: 4 hours

- [ ] 2.5.2: Update Department interface
  - Location: react/src/types/department.ts
  - Action: Match new schema structure
  - Effort: 2 hours

- [ ] 2.5.3: Update all components using old types
  - Action: Fix TypeScript errors
  - Effort: 6 hours

## Phase 2.6: Testing
- [ ] 2.6.1: Integration tests for migrated services
  - Location: backend/tests/integration/migration/
  - Effort: 8 hours

- [ ] 2.6.2: Performance comparison tests
  - Action: Benchmark old vs new implementation
  - Effort: 4 hours

**Phase 2 Total Effort:** ~90 hours
**Deliverables:** Unified Mongoose-based data model
```

---

## PHASE 3: API IMPROVEMENTS
**Duration:** Week 5-6 | **Priority:** P1-P2 | **Status:** ⏳ Not Started

```markdown
## Phase 3.1: Atomic Operations
- [ ] 3.1.1: Implement atomic leave balance updates
  - Location: backend/controllers/rest/leave.controller.js
  - Action: Use findOneAndUpdate with atomic operators
  - Effort: 8 hours

- [ ] 3.1.2: Add database transactions
  - Location: backend/utils/transaction.js
  - Action: Create transaction wrapper for multi-step operations
  - Effort: 6 hours

## Phase 3.2: Rate Limiting
- [ ] 3.2.1: Install and configure express-rate-limit
  - Action: Add rate limiting middleware
  - Effort: 4 hours

- [ ] 3.2.2: Configure rate limits per endpoint
  - Location: backend/config/rateLimits.js
  - Action: Set appropriate limits for each endpoint type
  - Effort: 2 hours

## Phase 3.3: Response Standardization
- [ ] 3.3.1: Standardize success response format
  - Action: All endpoints return { success, data, message }
  - Effort: 6 hours

- [ ] 3.3.2: Standardize error response format
  - Action: All errors return { success, error: { code, message } }
  - Effort: 4 hours

- [ ] 3.3.3: Add proper HTTP status codes
  - Action: 201 for create, 200 for update, 404 for not found
  - Effort: 4 hours

## Phase 3.4: API Versioning
- [ ] 3.4.1: Add v1 prefix to all routes
  - Action: Change /api/employees to /api/v1/employees
  - Effort: 3 hours

- [ ] 3.4.2: Create API versioning middleware
  - Location: backend/middleware/apiVersion.js
  - Action: Handle version negotiation
  - Effort: 3 hours

- [ ] 3.4.3: Update API documentation
  - Location: backend/config/swagger.js
  - Action: Document versioned endpoints
  - Effort: 4 hours

## Phase 3.5: Pagination
- [ ] 3.5.1: Standardize pagination format
  - Action: Use { page, limit, total, totalPages } consistently
  - Effort: 4 hours

- [ ] 3.5.2: Add cursor-based pagination option
  - Action: Implement for large datasets
  - Effort: 6 hours

## Phase 3.6: Search Improvements
- [ ] 3.6.1: Fix search to use text indexes
  - Location: backend/controllers/rest/employee.controller.js
  - Action: Replace regex with $text search
  - Effort: 4 hours

- [ ] 3.6.2: Add advanced search filters
  - Action: Support complex queries (AND, OR, ranges)
  - Effort: 6 hours

**Phase 3 Total Effort:** ~65 hours
**Deliverables:** Production-ready REST API
```

---

## PHASE 4: ENHANCED SECURITY
**Duration:** Week 7 | **Priority:** P1-P2 | **Status:** ⏳ Not Started

```markdown
## Phase 4.1: CSRF Protection
- [ ] 4.1.1: Install csurf middleware
  - Action: npm install csurf @types/csurf
  - Effort: 1 hour

- [ ] 4.1.2: Configure CSRF tokens
  - Location: backend/middleware/csrf.js
  - Action: Generate and validate tokens
  - Effort: 4 hours

- [ ] 4.1.3: Update frontend to send CSRF tokens
  - Location: react/src/services/api.ts
  - Action: Include token in headers
  - Effort: 2 hours

## Phase 4.2: Account Lockout
- [ ] 4.2.1: Implement failed login tracking
  - Location: backend/models/loginAttempt.schema.js
  - Action: Track failed attempts per IP/email
  - Effort: 4 hours

- [ ] 4.2.2: Add account lockout logic
  - Location: backend/middleware/auth.js
  - Action: Lock account after 5 failed attempts
  - Effort: 4 hours

- [ ] 4.2.3: Implement unlock mechanism
  - Action: Admin unlock + timed unlock
  - Effort: 2 hours

## Phase 4.3: Password Security
- [ ] 4.3.1: Change email flow for credentials
  - Location: backend/services/hr/hrm.employee.js:1272
  - Action: Send password reset link instead of password
  - Effort: 6 hours

- [ ] 4.3.2: Fix password generation bias
  - Location: backend/services/hr/hrm.employee.js:1110
  - Action: Use rejection sampling for uniform distribution
  - Effort: 2 hours

- [ ] 4.3.3: Add password complexity requirements
  - Location: backend/utils/passwordValidator.js
  - Action: Enforce strong passwords
  - Effort: 2 hours

## Phase 4.4: File Upload Security
- [ ] 4.4.1: Add file size limits
  - Location: backend/middleware/upload.js
  - Action: Limit to 5MB per file
  - Effort: 2 hours

- [ ] 4.4.2: Add file type validation
  - Action: Only allow PDF, JPG, PNG
  - Effort: 2 hours

- [ ] 4.4.3: Virus scanning integration
  - Action: Integrate ClamAV or similar
  - Effort: 4 hours

## Phase 4.5: Query Projection
- [ ] 4.5.1: Add projection to sensitive queries
  - Location: backend/controllers/rest/employee.controller.js
  - Action: Exclude salary/bank at query level
  - Effort: 4 hours

**Phase 4 Total Effort:** ~40 hours
**Deliverables:** Enhanced security measures
```

---

## PHASE 5: CODE QUALITY & DOCUMENTATION
**Duration:** Week 8 | **Priority:** P2-P3 | **Status:** ⏳ Not Started

```markdown
## Phase 5.1: Code Cleanup
- [ ] 5.1.1: Remove all console.log statements
  - Action: Replace with proper logger
  - Effort: 3 hours

- [ ] 5.1.2: Remove commented-out code
  - Location: backend/services/hr/hrm.employee.js
  - Action: Delete or move to version history
  - Effort: 2 hours

- [ ] 5.1.3: Remove unused imports
  - Location: react/src/hooks/useEmployeesREST.ts
  - Action: Clean up imports
  - Effort: 1 hour

- [ ] 5.1.4: Standardize naming conventions
  - Action: Consistent function/variable naming
  - Effort: 4 hours

## Phase 5.2: Logging
- [ ] 5.2.1: Implement structured logging
  - Location: backend/utils/logger.js
  - Action: Use Winston with consistent format
  - Effort: 4 hours

- [ ] 5.2.2: Add request logging middleware
  - Action: Log all API requests with timing
  - Effort: 2 hours

- [ ] 5.2.3: Add error tracking
  - Action: Integrate Sentry or similar
  - Effort: 4 hours

## Phase 5.3: Documentation
- [ ] 5.3.1: Complete JSDoc comments
  - Action: Document all public functions
  - Effort: 8 hours

- [ ] 5.3.2: Create API documentation
  - Location: docs/api/README.md
  - Action: Document all endpoints with examples
  - Effort: 6 hours

- [ ] 5.3.3: Create developer guide
  - Location: docs/developer-guide.md
  - Action: Setup, architecture, contribution guide
  - Effort: 4 hours

## Phase 5.4: Internationalization
- [ ] 5.4.1: Install i18next
  - Action: npm install i18next react-i18next
  - Effort: 1 hour

- [ ] 5.4.2: Create translation files
  - Location: react/src/locales/
  - Action: English, Spanish, French, German
  - Effort: 6 hours

- [ ] 5.4.3: Replace hardcoded strings
  - Action: Use t() function for all UI text
  - Effort: 8 hours

**Phase 5 Total Effort:** ~53 hours
**Deliverables:** Clean, documented, production-ready code
```

---

## PHASE 6: FRONTEND IMPROVEMENTS
**Duration:** Week 9 | **Priority:** P2-P3 | **Status:** ⏳ Not Started

```markdown
## Phase 6.1: Type Safety
- [ ] 6.1.1: Fix TypeScript type mismatches
  - Location: react/src/types/employee.ts
  - Action: Update interfaces to match API responses
  - Effort: 6 hours

- [ ] 6.1.2: Add strict null checks
  - Action: Enable strict mode in tsconfig
  - Effort: 4 hours

- [ ] 6.1.3: Fix all TypeScript errors
  - Action: Zero TypeScript errors goal
  - Effort: 4 hours

## Phase 6.2: User Experience
- [ ] 6.2.1: Implement optimistic updates
  - Location: react/src/hooks/useEmployeesREST.ts
  - Action: Update UI immediately, rollback on error
  - Effort: 8 hours

- [ ] 6.2.2: Add per-operation loading states
  - Action: Separate loading for each operation
  - Effort: 4 hours

- [ ] 6.2.3: Improve error messages
  - Action: User-friendly error messages
  - Effort: 4 hours

## Phase 6.3: Request Management
- [ ] 6.3.1: Implement request cancellation
  - Location: react/src/services/api.ts
  - Action: Use AbortController
  - Effort: 4 hours

- [ ] 6.3.2: Implement retry logic
  - Action: Retry failed requests with exponential backoff
  - Effort: 4 hours

- [ ] 6.3.3: Implement token refresh
  - Location: react/src/services/api.ts
  - Action: Auto-refresh expired tokens
  - Effort: 6 hours

## Phase 6.4: Offline Support
- [ ] 6.4.1: Add service worker
  - Location: react/public/sw.js
  - Action: Cache API responses
  - Effort: 6 hours

- [ ] 6.4.2: Implement offline detection
  - Action: Show offline banner
  - Effort: 2 hours

- [ ] 6.4.3: Queue offline actions
  - Action: Execute when connection restored
  - Effort: 6 hours

**Phase 6 Total Effort:** ~52 hours
**Deliverables:** Improved user experience
```

---

## PHASE 7: TESTING & VALIDATION
**Duration:** Week 10 | **Priority:** All | **Status:** ⏳ Not Started

```markdown
## Phase 7.1: Unit Tests
- [ ] 7.1.1: Model unit tests
  - Location: backend/tests/unit/models/
  - Action: Test all Mongoose models
  - Effort: 8 hours

- [ ] 7.1.2: Service unit tests
  - Location: backend/tests/unit/services/
  - Action: Test all service functions
  - Effort: 12 hours

- [ ] 7.1.3: Controller unit tests
  - Location: backend/tests/unit/controllers/
  - Action: Test all controllers with mocks
  - Effort: 8 hours

## Phase 7.2: Integration Tests
- [ ] 7.2.1: API integration tests
  - Location: backend/tests/integration/api/
  - Action: Test all API endpoints
  - Effort: 12 hours

- [ ] 7.2.2: Database integration tests
  - Action: Test database operations
  - Effort: 4 hours

- [ ] 7.2.3: Authentication flow tests
  - Action: Test complete auth flow
  - Effort: 4 hours

## Phase 7.3: E2E Tests
- [ ] 7.3.1: Critical user flows
  - Location: react/tests/e2e/
  - Action: Employee CRUD, leave requests, etc.
  - Effort: 8 hours

- [ ] 7.3.2: Cross-browser testing
  - Action: Test on Chrome, Firefox, Safari
  - Effort: 4 hours

## Phase 7.4: Performance Testing
- [ ] 7.4.1: Load testing
  - Action: 1000 concurrent users
  - Effort: 4 hours

- [ ] 7.4.2: Database query optimization
  - Action: Analyze and optimize slow queries
  - Effort: 4 hours

## Phase 7.5: Quality Gates
- [ ] 7.5.1: Set up code coverage reporting
  - Action: Target > 80% coverage
  - Effort: 2 hours

- [ ] 7.5.2: Set up CI/CD pipeline
  - Action: Automated tests on push
  - Effort: 4 hours

- [ ] 7.5.3: Create pre-commit hooks
  - Action: Run linting and tests before commit
  - Effort: 2 hours

**Phase 7 Total Effort:** ~70 hours
**Deliverables:** Fully tested, production-ready code
```

---

## SUMMARY OF IMPLEMENTATION PHASES

| Phase | Duration | Effort | Priority | Status |
|-------|----------|--------|----------|--------|
| Phase 1: Critical Security Fixes | 2 weeks | 60h | P0 | ⏳ Not Started |
| Phase 2: Data Model Migration | 2 weeks | 90h | P1 | ⏳ Not Started |
| Phase 3: API Improvements | 2 weeks | 65h | P1-P2 | ⏳ Not Started |
| Phase 4: Enhanced Security | 1 week | 40h | P1-P2 | ⏳ Not Started |
| Phase 5: Code Quality & Docs | 1 week | 53h | P2-P3 | ⏳ Not Started |
| Phase 6: Frontend Improvements | 1 week | 52h | P2-P3 | ⏳ Not Started |
| Phase 7: Testing & Validation | 1 week | 70h | All | ⏳ Not Started |
| **TOTAL** | **10 weeks** | **430 hours** | | |

---

## CHECKPOINT CRITERIA

### Phase 1 Completion Criteria
- [ ] All P0 security vulnerabilities resolved
- [ ] Security scan passes (0 critical, 0 high)
- [ ] All undefined variable bugs fixed
- [ ] Unit tests written and passing
- [ ] Code review approved

### Phase 2 Completion Criteria
- [ ] All services migrated to Mongoose
- [ ] Legacy MongoDB collection access removed
- [ ] Field names standardized across codebase
- [ ] Data migration script tested
- [ ] Zero data loss in migration

### Phase 3 Completion Criteria
- [ ] All endpoints follow REST conventions
- [ ] Rate limiting implemented
- [ ] API documentation complete
- [ ] Response format consistent
- [ ] Performance benchmarks met

### Phase 4 Completion Criteria
- [ ] CSRF protection implemented
- [ ] Account lockout working
- [ ] Password flow improved
- [ ] Penetration test passed
- [ ] Security audit passed

### Phase 5 Completion Criteria
- [ ] Zero console.log statements
- [ ] All code documented
- [ ] Linter passes with 0 errors
- [ ] Developer guide complete
- [ ] i18n implemented

### Phase 6 Completion Criteria
- [ ] Zero TypeScript errors
- [ ] Optimistic updates implemented
- [ ] Token refresh working
- [ ] Offline mode functional
- [ ] UX review passed

### Phase 7 Completion Criteria
- [ ] > 80% code coverage
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] E2E tests passing
- [ ] Production deployment ready

---

**Document Version:** 1.0
**Last Updated:** February 2, 2026
**Next Review:** After Phase 1 completion
