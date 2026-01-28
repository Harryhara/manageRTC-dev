# 🔌 SOCKET.IO vs REST API ARCHITECTURE GUIDE
## manageRTC Platform - Communication Strategy

**Document Version:** 1.0  
**Date:** January 27, 2026  
**Platform:** manageRTC (MERN Stack)  
**Purpose:** Define when to use Socket.IO vs REST API for each module

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Decision Framework](#3-decision-framework)
4. [Module-by-Module Breakdown](#4-module-by-module-breakdown)
5. [Migration Priority Matrix](#5-migration-priority-matrix)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Code Examples](#7-code-examples)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. EXECUTIVE SUMMARY

### 1.1 Current State (PROBLEMATIC)

**Socket.IO Usage: 90%** ❌  
**REST API Usage: 10%** ❌

**Current Socket.IO Controllers (54 total):**
```javascript
// From socket/router.js - ALL roles get these attached
switch (role) {
  case "admin":
    - hrDashboardController (Socket)
    - adminController (Socket)
    - leadController (Socket)
    - clientController (Socket)
    - activityController (Socket)
    - projectController (Socket)
    - taskController (Socket)
    - projectNotesController (Socket)
    - employeeController (Socket)
    - pipelineController (Socket)
    - kanbanController (Socket)
    - candidateController (Socket)
    - jobsController (Socket)
    - ticketsSocketController (Socket)
    - assetSocketController (Socket)
    - trainersController (Socket)
    - trainingTypesController (Socket)
    - trainingListController (Socket)
    - performanceIndicatorController (Socket)
    - performanceAppraisalController (Socket)
    - performanceReviewController (Socket)
    - goalTypeController (Socket)
    - goalTrackingController (Socket)
    - promotionController (Socket)
    // + 30 more...
}
```

**Current REST API Routes (Only 6 files):**
```javascript
routes/
├── companies.routes.js      ✅ REST
├── contacts.routes.js       ✅ REST
├── deal.routes.js          ✅ REST
├── jobs.routes.js          ✅ REST
├── socialfeed.routes.js    ✅ REST
└── tickets.routes.js       ✅ REST
```

**Problem:** 90% of operations use Socket.IO which creates:
- ❌ Cannot use Postman/curl for testing
- ❌ Cannot implement standard caching
- ❌ Cannot use API gateways
- ❌ Cannot scale horizontally easily
- ❌ Difficult mobile app integration
- ❌ Hard to implement rate limiting

---

### 1.2 Target Architecture (CORRECT)

**Socket.IO Usage: 20%** ✅  
**REST API Usage: 80%** ✅

**Principle:**
```
Use REST API for:  Everything by default (CRUD operations)
Use Socket.IO for: Real-time updates ONLY
```

---

## 2. CURRENT ARCHITECTURE ANALYSIS

### 2.1 Existing Socket.IO Controllers (Need Migration)

**File:** `backend/socket/router.js`

#### HRMS Module (Socket - NEEDS MIGRATION)
```javascript
✅ MIGRATE TO REST:
├── hrDashboardController (Socket)      → /api/hr/dashboard
├── employeeController (Socket)         → /api/employees
├── trainersController (Socket)         → /api/hr/trainers
├── trainingTypesController (Socket)    → /api/hr/training-types
├── trainingListController (Socket)     → /api/hr/training-list
├── goalTypeController (Socket)         → /api/performance/goal-types
├── goalTrackingController (Socket)     → /api/performance/goal-tracking
├── performanceIndicatorController      → /api/performance/indicators
├── performanceAppraisalController      → /api/performance/appraisals
├── performanceReviewController         → /api/performance/reviews
└── promotionController (Socket)        → /api/performance/promotions
```

#### Project Management Module (Socket - NEEDS MIGRATION)
```javascript
✅ MIGRATE TO REST:
├── projectController (Socket)          → /api/projects
├── taskController (Socket)             → /api/tasks
├── projectNotesController (Socket)     → /api/projects/:id/notes
└── kanbanController (Socket)           → /api/kanban

🟡 KEEP SOCKET.IO (Real-time updates):
├── task:moved (event)                  → Real-time board updates
├── task:updated (event)                → Live task changes
└── project:progress (event)            → Live progress updates
```

#### CRM Module (Mixed - PARTIALLY CORRECT)
```javascript
✅ ALREADY REST (Keep):
├── deals.routes.js                     → /api/deals ✅
├── companies.routes.js                 → /api/companies ✅
├── contacts.routes.js                  → /api/contacts ✅
└── tickets.routes.js                   → /api/tickets ✅

✅ MIGRATE TO REST:
├── leadController (Socket)             → /api/leads
├── clientController (Socket)           → /api/clients
├── activityController (Socket)         → /api/activities
└── pipelineController (Socket)         → /api/pipelines

🟡 KEEP SOCKET.IO (Real-time):
├── deal:moved (event)                  → Pipeline drag & drop
├── activity:new (event)                → Live activity feed
└── notification:new (event)            → Real-time notifications
```

#### Recruitment Module (Socket - NEEDS MIGRATION)
```javascript
✅ MIGRATE TO REST:
├── jobsController (Socket)             → /api/jobs
├── candidateController (Socket)        → /api/candidates

✅ ALREADY REST (Keep):
└── jobs.routes.js                      → /api/jobs ✅ (duplicate!)
```

#### Asset Management (Socket - NEEDS MIGRATION)
```javascript
✅ MIGRATE TO REST:
├── assetSocketController (Socket)      → /api/assets
└── assetCategorySocketController       → /api/assets/categories
```

#### Chat & Social (Socket - KEEP AS IS)
```javascript
🟢 KEEP SOCKET.IO (Real-time by nature):
├── ChatController (Socket)             ✅ Real-time chat
├── ChatUsersController (Socket)        ✅ Online status
└── socialFeedSocketController (Socket) ✅ Live feed updates
```

---

### 2.2 Decision Matrix

| Feature Type | Use REST | Use Socket.IO | Example |
|--------------|----------|---------------|---------|
| **Create** | ✅ | ❌ | POST /api/employees |
| **Read** | ✅ | ❌ | GET /api/employees |
| **Update** | ✅ | ❌ | PUT /api/employees/:id |
| **Delete** | ✅ | ❌ | DELETE /api/employees/:id |
| **List** | ✅ | ❌ | GET /api/employees?page=1 |
| **Search** | ✅ | ❌ | GET /api/employees?q=john |
| **Live Updates** | ❌ | ✅ | socket.on('employee:updated') |
| **Chat** | ❌ | ✅ | socket.emit('message:send') |
| **Notifications** | ❌ | ✅ | socket.on('notification:new') |
| **Presence** | ❌ | ✅ | socket.on('user:online') |
| **Drag & Drop** | ❌ | ✅ | socket.emit('task:moved') |
| **Typing Indicator** | ❌ | ✅ | socket.emit('typing') |

---

## 3. DECISION FRAMEWORK

### 3.1 Use REST API When...

✅ **CRUD Operations**
- Creating, Reading, Updating, Deleting records
- Any database operation
- File uploads
- Report generation

✅ **Stateless Operations**
- Authentication (token generation)
- Data fetching
- Search & filtering
- Pagination

✅ **Standard HTTP Benefits Needed**
- Caching (CDN, browser cache)
- HTTP status codes (200, 404, 500)
- Standard HTTP methods (GET, POST, PUT, DELETE)
- API versioning (/api/v1, /api/v2)

✅ **Third-party Integration**
- Mobile apps
- External services
- API documentation (Swagger)
- Rate limiting

**Example:**
```javascript
// ✅ GOOD: REST API for employee CRUD
GET    /api/employees              // List all
POST   /api/employees              // Create
GET    /api/employees/:id          // Get one
PUT    /api/employees/:id          // Update
DELETE /api/employees/:id          // Delete
```

---

### 3.2 Use Socket.IO When...

✅ **Real-time Updates**
- Live notifications
- Online/offline status
- Live dashboards
- Real-time collaboration

✅ **Bidirectional Communication**
- Chat messaging
- Video calls
- Screen sharing
- Collaborative editing

✅ **Event-driven Updates**
- Task moved on kanban board
- Deal stage changed
- Project progress updated
- Someone typing indicator

✅ **Broadcast to Multiple Clients**
- Notify all team members
- Update all open dashboards
- Sync across devices

**Example:**
```javascript
// ✅ GOOD: Socket.IO for real-time features
socket.on('task:moved', (data) => {
  // Update task position in real-time
  // Notify all team members viewing the board
});

socket.on('message:new', (data) => {
  // Display new chat message immediately
  // Show notification
});

socket.on('user:online', (data) => {
  // Update online status indicator
});
```

---

### 3.3 Hybrid Approach (REST + Socket.IO)

For many features, use **BOTH**:

**Pattern:**
1. Client performs action via REST API
2. Server processes and saves to database
3. Server broadcasts update via Socket.IO
4. All clients receive real-time update

**Example: Task Update**
```javascript
// Step 1: Client updates task via REST
await fetch('/api/tasks/123', {
  method: 'PUT',
  body: JSON.stringify({ status: 'Completed' })
});

// Step 2: Server updates database and broadcasts
// Backend:
const task = await Task.findByIdAndUpdate(id, { status: 'Completed' });
io.to(`project-${task.projectId}`).emit('task:updated', task);

// Step 3: All clients receive update via Socket.IO
socket.on('task:updated', (task) => {
  updateTaskInUI(task);
  showNotification('Task completed!');
});
```

---

## 4. MODULE-BY-MODULE BREAKDOWN

### 4.1 HRMS MODULE

#### Employee Management

**REST API (Primary):**
```javascript
// File to create: routes/api/employees.js
GET    /api/employees                    // List all employees
GET    /api/employees/:id                // Get single employee
POST   /api/employees                    // Create employee
PUT    /api/employees/:id                // Update employee
DELETE /api/employees/:id                // Soft delete
POST   /api/employees/bulk-import        // Bulk import
GET    /api/employees/:id/documents      // Get documents
POST   /api/employees/:id/documents      // Upload document

// Search & Filter
GET    /api/employees?department=IT
GET    /api/employees?status=Active
GET    /api/employees?search=john
GET    /api/employees?page=1&limit=20
```

**Socket.IO (Secondary - Real-time only):**
```javascript
// File: controllers/socket/employee.socket.js
socket.on('employee:created', (employee) => {
  // Broadcast to all HR users
  io.to('hr-users').emit('employee:created', employee);
});

socket.on('employee:updated', (employee) => {
  // Broadcast to all users viewing employee
  io.to(`employee-${employee.id}`).emit('employee:updated', employee);
});

socket.on('employee:status-changed', (data) => {
  // Real-time status updates (online/offline)
  io.to('company-users').emit('employee:status-changed', data);
});
```

**Current State:**
```
❌ employeeController (Socket only) - NEEDS MIGRATION
```

**Action Required:**
```
✅ Create /api/employees REST endpoints
✅ Keep Socket.IO for real-time status updates
✅ Migrate frontend from Socket to REST for CRUD
```

---

#### Attendance Management

**REST API (Primary):**
```javascript
// File to create: routes/api/attendance.js
GET    /api/attendance                           // List attendance
POST   /api/attendance/clock-in                  // Clock in
PUT    /api/attendance/:id/clock-out             // Clock out
POST   /api/attendance/:id/regularize            // Regularize
GET    /api/attendance/reports                   // Reports
GET    /api/attendance/employee/:id              // Employee attendance
GET    /api/attendance?date=2026-01-27
GET    /api/attendance?employee=123&month=01
```

**Socket.IO (Secondary - Real-time only):**
```javascript
// File: controllers/socket/attendance.socket.js
socket.on('attendance:clock-in', (data) => {
  // Notify HR dashboard in real-time
  io.to('hr-dashboard').emit('attendance:clock-in', data);
  // Update attendance count widget
  io.to('dashboard-widgets').emit('attendance:count-updated');
});

socket.on('attendance:clock-out', (data) => {
  io.to('hr-dashboard').emit('attendance:clock-out', data);
});
```

**Current State:**
```
❌ No controller exists - NEEDS CREATION
```

**Action Required:**
```
✅ Create Attendance schema (CRITICAL)
✅ Create /api/attendance REST endpoints
✅ Add Socket.IO for live dashboard updates
```

---

#### Leave Management

**REST API (Primary):**
```javascript
// File to create: routes/api/leaves.js
GET    /api/leaves                       // List leave requests
POST   /api/leaves                       // Apply for leave
PUT    /api/leaves/:id                   // Update leave
DELETE /api/leaves/:id                   // Cancel leave
POST   /api/leaves/:id/approve           // Approve
POST   /api/leaves/:id/reject            // Reject
GET    /api/leaves/balance/:employeeId   // Get balance
GET    /api/leaves/calendar              // Leave calendar
GET    /api/leaves/pending               // Pending approvals
```

**Socket.IO (Secondary - Notifications only):**
```javascript
// File: controllers/socket/leave.socket.js
socket.on('leave:applied', (leave) => {
  // Notify manager immediately
  io.to(`manager-${leave.managerId}`).emit('leave:pending', leave);
});

socket.on('leave:approved', (leave) => {
  // Notify employee
  io.to(`employee-${leave.employeeId}`).emit('leave:approved', leave);
});
```

**Current State:**
```
❌ No controller exists - NEEDS CREATION
```

**Action Required:**
```
✅ Create Leave schema (CRITICAL)
✅ Create /api/leaves REST endpoints
✅ Add Socket.IO for approval notifications
```

---

#### Payroll Management

**REST API (Primary - 100%):**
```javascript
// File to create: routes/api/payroll.js
GET    /api/payroll                      // List payroll records
POST   /api/payroll/generate             // Generate payroll
GET    /api/payroll/:id                  // Get payslip
POST   /api/payroll/:id/approve          // Approve payroll
GET    /api/payroll/:id/pdf              // Download payslip PDF
POST   /api/payroll/process-payments     // Process bank transfers
GET    /api/payroll/reports/monthly
GET    /api/payroll/reports/yearly
```

**Socket.IO (Not needed):**
```javascript
// ❌ NO Socket.IO needed for payroll
// Payroll is batch processing, not real-time
```

**Current State:**
```
❌ No controller exists - NEEDS CREATION
```

**Action Required:**
```
✅ Create Payroll schema (CRITICAL)
✅ Create /api/payroll REST endpoints
❌ NO Socket.IO needed
```

---

### 4.2 PROJECT MANAGEMENT MODULE

#### Project Management

**REST API (Primary):**
```javascript
// File to create: routes/api/projects.js
GET    /api/projects                     // List projects
POST   /api/projects                     // Create project
GET    /api/projects/:id                 // Get project
PUT    /api/projects/:id                 // Update project
DELETE /api/projects/:id                 // Delete project
GET    /api/projects/:id/tasks           // Project tasks
GET    /api/projects/:id/team            // Team members
GET    /api/projects/:id/progress        // Progress report
POST   /api/projects/:id/notes           // Add note
GET    /api/projects/dashboard           // Dashboard stats
```

**Socket.IO (Secondary - Real-time updates):**
```javascript
// File: controllers/socket/project.socket.js
socket.on('project:updated', (project) => {
  // Update all team members viewing project
  io.to(`project-${project.id}`).emit('project:updated', project);
});

socket.on('project:progress-changed', (data) => {
  // Real-time progress updates
  io.to('pm-dashboard').emit('project:progress-changed', data);
});
```

**Current State:**
```
❌ projectController (Socket only) - NEEDS MIGRATION
```

**Action Required:**
```
✅ Create /api/projects REST endpoints
✅ Keep Socket.IO for real-time progress updates
✅ Migrate frontend from Socket to REST
```

---

#### Task Management

**REST API (Primary):**
```javascript
// File to create: routes/api/tasks.js
GET    /api/tasks                        // List tasks
POST   /api/tasks                        // Create task
GET    /api/tasks/:id                    // Get task
PUT    /api/tasks/:id                    // Update task
DELETE /api/tasks/:id                    // Delete task
POST   /api/tasks/:id/time-entry         // Log time
POST   /api/tasks/:id/comments           // Add comment
POST   /api/tasks/:id/assign             // Assign task
PUT    /api/tasks/:id/status             // Update status
GET    /api/tasks?project=123
GET    /api/tasks?assignee=456
```

**Socket.IO (Secondary - Kanban board real-time):**
```javascript
// File: controllers/socket/task.socket.js
socket.on('task:moved', (data) => {
  // Real-time kanban board updates
  io.to(`project-${data.projectId}`).emit('task:moved', data);
});

socket.on('task:assigned', (task) => {
  // Notify assignee immediately
  io.to(`user-${task.assigneeId}`).emit('task:assigned', task);
});

socket.on('task:status-changed', (task) => {
  // Update all team members viewing task
  io.to(`task-${task.id}`).emit('task:status-changed', task);
});
```

**Current State:**
```
❌ taskController (Socket only) - NEEDS MIGRATION
✅ kanbanController (Socket) - KEEP for drag & drop
```

**Action Required:**
```
✅ Create /api/tasks REST endpoints
✅ Keep Socket.IO for kanban drag & drop
✅ Hybrid: REST for CRUD, Socket for real-time
```

---

### 4.3 CRM MODULE

#### Lead Management

**REST API (Primary):**
```javascript
// File to create: routes/api/leads.js
GET    /api/leads                        // List leads
POST   /api/leads                        // Create lead
GET    /api/leads/:id                    // Get lead
PUT    /api/leads/:id                    // Update lead
DELETE /api/leads/:id                    // Delete lead
POST   /api/leads/:id/convert            // Convert to deal
POST   /api/leads/:id/assign             // Assign lead
GET    /api/leads/dashboard              // Dashboard
POST   /api/leads/import                 // Import leads
```

**Socket.IO (Secondary - Real-time assignment):**
```javascript
// File: controllers/socket/lead.socket.js
socket.on('lead:assigned', (lead) => {
  // Notify sales rep immediately
  io.to(`user-${lead.assigneeId}`).emit('lead:assigned', lead);
});

socket.on('lead:converted', (data) => {
  // Update dashboard in real-time
  io.to('sales-dashboard').emit('lead:converted', data);
});
```

**Current State:**
```
❌ leadController (Socket only) - NEEDS MIGRATION
```

**Action Required:**
```
✅ Create /api/leads REST endpoints
✅ Keep Socket.IO for assignment notifications
```

---

#### Deal Pipeline

**REST API (Primary):**
```javascript
// File: routes/api/deals.js (EXISTS!)
GET    /api/deals                        // List deals
POST   /api/deals                        // Create deal
GET    /api/deals/:id                    // Get deal
PUT    /api/deals/:id                    // Update deal
DELETE /api/deals/:id                    // Delete deal
PUT    /api/deals/:id/stage              // Move to stage
GET    /api/deals/pipeline/:id           // Pipeline view
GET    /api/deals/forecast               // Sales forecast
```

**Socket.IO (Secondary - Pipeline drag & drop):**
```javascript
// File: controllers/socket/deal.socket.js
socket.on('deal:moved', (data) => {
  // Real-time pipeline updates
  io.to('sales-pipeline').emit('deal:moved', data);
  // Update forecast widget
  io.to('sales-dashboard').emit('forecast:updated');
});

socket.on('deal:won', (deal) => {
  // Celebrate! 🎉
  io.to('company-users').emit('deal:won', deal);
});
```

**Current State:**
```
✅ deal.routes.js (REST) - ALREADY CORRECT!
❌ pipelineController (Socket) - ADD for real-time
```

**Action Required:**
```
✅ Keep REST API as is (already good)
✅ Add Socket.IO for pipeline drag & drop
```

---

#### Contact & Company Management

**REST API (Primary):**
```javascript
// Files: routes/api/contacts.js, routes/api/companies.js (EXIST!)
GET    /api/contacts                     // List contacts
POST   /api/contacts                     // Create
GET    /api/companies                    // List companies
POST   /api/companies                    // Create
```

**Socket.IO (Not needed):**
```javascript
// ❌ NO real-time updates needed for contacts/companies
```

**Current State:**
```
✅ contacts.routes.js (REST) - CORRECT!
✅ companies.routes.js (REST) - CORRECT!
```

**Action Required:**
```
✅ No changes needed - already using REST correctly
```

---

#### Tickets/Support

**REST API (Primary):**
```javascript
// File: routes/api/tickets.js (EXISTS!)
GET    /api/tickets                      // List tickets
POST   /api/tickets                      // Create ticket
GET    /api/tickets/:id                  // Get ticket
PUT    /api/tickets/:id                  // Update ticket
POST   /api/tickets/:id/reply            // Add reply
POST   /api/tickets/:id/assign           // Assign ticket
```

**Socket.IO (Secondary - Live updates):**
```javascript
// File: controllers/socket/ticket.socket.js
socket.on('ticket:new', (ticket) => {
  // Notify support team
  io.to('support-team').emit('ticket:new', ticket);
});

socket.on('ticket:replied', (data) => {
  // Notify customer and assigned agent
  io.to(`ticket-${data.ticketId}`).emit('ticket:replied', data);
});
```

**Current State:**
```
✅ tickets.routes.js (REST) - CORRECT!
✅ ticketsSocketController (Socket) - KEEP for live updates
```

**Action Required:**
```
✅ No changes needed - hybrid approach already implemented!
```

---

### 4.4 CHAT & SOCIAL FEATURES

#### Chat

**Socket.IO (Primary - 100%):**
```javascript
// File: controllers/chat/chat.controller.js (EXISTS!)
socket.on('message:send', handleSendMessage);
socket.on('message:read', handleMarkAsRead);
socket.on('typing', handleTypingIndicator);
socket.on('conversation:join', handleJoinConversation);
socket.on('conversation:leave', handleLeaveConversation);
```

**REST API (Secondary - History only):**
```javascript
// File to create: routes/api/chat.js
GET    /api/chat/conversations           // List conversations
GET    /api/chat/conversations/:id       // Get conversation
GET    /api/chat/messages/:convId        // Get message history
POST   /api/chat/conversations           // Create conversation
```

**Current State:**
```
✅ ChatController (Socket) - CORRECT! (Real-time chat)
✅ ChatUsersController (Socket) - CORRECT! (Online status)
```

**Action Required:**
```
✅ Keep Socket.IO for real-time chat
✅ Add REST API for message history retrieval
```

---

#### Social Feed

**REST API (Primary):**
```javascript
// File: routes/api/socialfeed.js (EXISTS!)
GET    /api/socialfeed                   // Get feed
POST   /api/socialfeed                   // Create post
PUT    /api/socialfeed/:id               // Update post
DELETE /api/socialfeed/:id               // Delete post
POST   /api/socialfeed/:id/like          // Like post
POST   /api/socialfeed/:id/comment       // Comment
```

**Socket.IO (Secondary - Live updates):**
```javascript
// File: controllers/socket/socialfeed.socket.js (EXISTS!)
socket.on('post:new', (post) => {
  // Push new post to all feeds
  io.to('company-feed').emit('post:new', post);
});

socket.on('post:liked', (data) => {
  // Update like count in real-time
  io.to('company-feed').emit('post:liked', data);
});
```

**Current State:**
```
✅ socialfeed.routes.js (REST) - CORRECT!
✅ socialFeedSocketController (Socket) - CORRECT!
```

**Action Required:**
```
✅ No changes needed - hybrid approach already correct!
```

---

## 5. MIGRATION PRIORITY MATRIX

### 5.1 Phase 1: Critical Foundation (Week 1-2)

**High Priority - Migrate to REST:**

| Module | Controller | Current | Target | Effort | Priority |
|--------|-----------|---------|--------|--------|----------|
| Employee | employeeController | Socket | REST | 3 days | 🔴 CRITICAL |
| HR Dashboard | hrDashboardController | Socket | REST | 2 days | 🔴 CRITICAL |
| Projects | projectController | Socket | REST | 3 days | 🔴 CRITICAL |
| Tasks | taskController | Socket | REST | 3 days | 🔴 CRITICAL |
| Leads | leadController | Socket | REST | 2 days | 🔴 CRITICAL |
| Clients | clientController | Socket | REST | 2 days | 🔴 CRITICAL |

**Total:** 15 days for 1 developer

---

### 5.2 Phase 2: HRMS Completion (Week 3-4)

**Medium Priority - Create REST:**

| Module | Controller | Current | Target | Effort | Priority |
|--------|-----------|---------|--------|--------|----------|
| Attendance | MISSING | None | REST + Socket | 4 days | 🟠 HIGH |
| Leave | MISSING | None | REST + Socket | 4 days | 🟠 HIGH |
| Payroll | MISSING | None | REST | 7 days | 🟠 HIGH |
| Assets | assetSocketController | Socket | REST | 2 days | 🟠 HIGH |
| Trainers | trainersController | Socket | REST | 2 days | 🟡 MEDIUM |
| Training | trainingListController | Socket | REST | 2 days | 🟡 MEDIUM |

**Total:** 21 days

---

### 5.3 Phase 3: Optimization (Week 5-6)

**Low Priority - Nice to have:**

| Module | Controller | Current | Target | Effort | Priority |
|--------|-----------|---------|--------|--------|----------|
| Activities | activityController | Socket | REST | 2 days | 🟡 MEDIUM |
| Pipelines | pipelineController | Socket | REST | 2 days | 🟡 MEDIUM |
| Candidates | candidateController | Socket | REST | 2 days | 🟡 MEDIUM |
| Performance | Multiple controllers | Socket | REST | 3 days | 🟡 MEDIUM |

**Total:** 9 days

---

### 5.4 Keep as Socket.IO (No Migration)

**Correct Usage - Leave as is:**

| Module | Controller | Reason | Action |
|--------|-----------|--------|--------|
| Chat | ChatController | Real-time messaging | ✅ Keep |
| Chat Users | ChatUsersController | Online status | ✅ Keep |
| Kanban | kanbanController | Drag & drop | ✅ Keep |
| Social Feed | socialFeedSocketController | Live feed | ✅ Keep (hybrid) |
| Notifications | (to be created) | Real-time alerts | ✅ Create Socket |

---

## 6. IMPLEMENTATION ROADMAP

### 6.1 Week 1: Employee & Projects (REST Migration)

**Day 1-2: Employee Module**
```bash
# Create REST endpoints
touch routes/api/employees.js
touch controllers/rest/employee.controller.js

# Implement
- GET    /api/employees
- POST   /api/employees
- GET    /api/employees/:id
- PUT    /api/employees/:id
- DELETE /api/employees/:id
```

**Day 3-4: Projects Module**
```bash
# Create REST endpoints
touch routes/api/projects.js
touch controllers/rest/project.controller.js

# Implement
- GET    /api/projects
- POST   /api/projects
- GET    /api/projects/:id
- PUT    /api/projects/:id
- DELETE /api/projects/:id
```

**Day 5: Tasks Module**
```bash
# Create REST endpoints
touch routes/api/tasks.js
touch controllers/rest/task.controller.js

# Keep Socket.IO for kanban
# Hybrid approach: REST for CRUD, Socket for drag & drop
```

---

### 6.2 Week 2: CRM & HRMS Foundation

**Day 1-2: Leads & Clients**
```bash
# Create REST endpoints
touch routes/api/leads.js
touch routes/api/clients.js

# Implement CRUD operations
```

**Day 3-4: Attendance Schema + REST**
```bash
# Create schema
touch models/attendance/attendance.schema.js

# Create REST endpoints
touch routes/api/attendance.js
touch controllers/rest/attendance.controller.js

# Add Socket.IO for live dashboard
touch controllers/socket/attendance.socket.js
```

**Day 5: Leave Schema + REST**
```bash
# Create schema
touch models/leave/leave.schema.js

# Create REST endpoints
touch routes/api/leaves.js
```

---

### 6.3 Week 3-4: Payroll & Optimization

**Week 3: Payroll Module**
```bash
# Create complete payroll system
- Payroll schema
- REST endpoints
- Calculation engine
- PDF generation
```

**Week 4: Performance & Cleanup**
```bash
# Migrate remaining Socket controllers
# Optimize existing REST endpoints
# Add caching
# Performance testing
```

---

## 7. CODE EXAMPLES

### 7.1 REST API Controller Template

**File:** `controllers/rest/employee.controller.js`

```javascript
import { Employee } from '../../models/employee/employee.schema.js';

export const employeeController = {
  // GET /api/employees
  async getAll(req, res) {
    try {
      const { companyId } = req.user;
      const { page = 1, limit = 20, search, department, status } = req.query;
      
      // Build query
      const query = { companyId, isDeleted: false };
      if (search) query.$text = { $search: search };
      if (department) query.department = department;
      if (status) query.status = status;
      
      // Execute with pagination
      const employees = await Employee
        .find(query)
        .populate('department', 'name')
        .populate('designation', 'title')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();
      
      const total = await Employee.countDocuments(query);
      
      res.json({
        success: true,
        data: employees,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },
  
  // POST /api/employees
  async create(req, res) {
    try {
      const { companyId, userId } = req.user;
      
      const employee = await Employee.create({
        ...req.body,
        companyId,
        createdBy: userId
      });
      
      // Broadcast via Socket.IO (optional)
      req.io.to('hr-users').emit('employee:created', employee);
      
      res.status(201).json({
        success: true,
        data: employee
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  // GET /api/employees/:id
  async getById(req, res) {
    try {
      const { companyId } = req.user;
      const { id } = req.params;
      
      const employee = await Employee
        .findOne({ _id: id, companyId, isDeleted: false })
        .populate('department')
        .populate('designation')
        .populate('reportsTo', 'firstName lastName');
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found'
        });
      }
      
      res.json({
        success: true,
        data: employee
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },
  
  // PUT /api/employees/:id
  async update(req, res) {
    try {
      const { companyId, userId } = req.user;
      const { id } = req.params;
      
      const employee = await Employee.findOneAndUpdate(
        { _id: id, companyId, isDeleted: false },
        {
          ...req.body,
          updatedBy: userId,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found'
        });
      }
      
      // Broadcast update
      req.io.to(`employee-${id}`).emit('employee:updated', employee);
      
      res.json({
        success: true,
        data: employee
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  },
  
  // DELETE /api/employees/:id (soft delete)
  async delete(req, res) {
    try {
      const { companyId, userId } = req.user;
      const { id } = req.params;
      
      const employee = await Employee.findOneAndUpdate(
        { _id: id, companyId, isDeleted: false },
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId
        }
      );
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Employee deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};
```

---

### 7.2 Socket.IO Controller Template

**File:** `controllers/socket/employee.socket.js`

```javascript
export const employeeSocketController = (socket, io) => {
  const { companyId, userId } = socket;
  
  // Employee status updates (online/offline)
  socket.on('employee:status-change', async (data) => {
    try {
      // Broadcast to all company users
      io.to(`company-${companyId}`).emit('employee:status-changed', {
        employeeId: userId,
        status: data.status,
        timestamp: new Date()
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  // Real-time attendance clock-in
  socket.on('attendance:clock-in', async (data) => {
    try {
      // Update HR dashboard in real-time
      io.to('hr-dashboard').emit('attendance:clock-in', {
        employeeId: userId,
        clockIn: new Date(),
        location: data.location
      });
      
      // Update attendance count widget
      const count = await getAttendanceCount(companyId);
      io.to('dashboard-widgets').emit('attendance:count-updated', count);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
  
  // Join employee room for updates
  socket.on('employee:watch', (employeeId) => {
    socket.join(`employee-${employeeId}`);
  });
  
  // Leave employee room
  socket.on('employee:unwatch', (employeeId) => {
    socket.leave(`employee-${employeeId}`);
  });
};
```

---

### 7.3 Hybrid Approach Example

**File:** `controllers/rest/task.controller.js` + `controllers/socket/task.socket.js`

```javascript
// REST API: CRUD Operations
// File: controllers/rest/task.controller.js
export const taskController = {
  async update(req, res) {
    try {
      const task = await Task.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      
      // Broadcast update via Socket.IO
      req.io.to(`project-${task.projectId}`).emit('task:updated', task);
      
      res.json({ success: true, data: task });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
};

// Socket.IO: Real-time Kanban updates
// File: controllers/socket/task.socket.js
export const taskSocketController = (socket, io) => {
  // Drag & drop on kanban board
  socket.on('task:moved', async (data) => {
    try {
      // Update position in database
      await Task.findByIdAndUpdate(data.taskId, {
        status: data.newStatus,
        position: data.newPosition
      });
      
      // Broadcast to all team members viewing board
      io.to(`project-${data.projectId}`).emit('task:moved', data);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
};
```

---

## 8. TESTING STRATEGY

### 8.1 REST API Testing

**Tool:** Postman / Jest + Supertest

```javascript
// tests/api/employees.test.js
import request from 'supertest';
import app from '../app';

describe('Employee API', () => {
  let token;
  
  beforeAll(async () => {
    // Get auth token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    token = res.body.token;
  });
  
  test('GET /api/employees - should return employees', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
  
  test('POST /api/employees - should create employee', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('john@example.com');
  });
});
```

---

### 8.2 Socket.IO Testing

**Tool:** socket.io-client

```javascript
// tests/socket/employee.socket.test.js
import io from 'socket.io-client';

describe('Employee Socket', () => {
  let socket;
  
  beforeAll((done) => {
    socket = io('http://localhost:5000', {
      auth: { token: 'test-token' }
    });
    socket.on('connect', done);
  });
  
  afterAll(() => {
    socket.close();
  });
  
  test('should receive employee:status-changed event', (done) => {
    socket.on('employee:status-changed', (data) => {
      expect(data.employeeId).toBeDefined();
      expect(data.status).toBeDefined();
      done();
    });
    
    socket.emit('employee:status-change', { status: 'online' });
  });
});
```

---

## 9. SUMMARY & RECOMMENDATIONS

### 9.1 Key Takeaways

**Current Architecture:**
- ❌ 90% Socket.IO (WRONG)
- ✅ 10% REST API (NOT ENOUGH)

**Target Architecture:**
- ✅ 80% REST API (CORRECT)
- ✅ 20% Socket.IO for real-time (CORRECT)

**Benefits of Migration:**
- ✅ Standard API patterns
- ✅ Better testing
- ✅ Easier caching
- ✅ Mobile app friendly
- ✅ Third-party integration
- ✅ Better scalability

---

### 9.2 Migration Timeline

**Total Effort:** 45 days (9 weeks) for 1 developer

```
Week 1-2:  Critical CRUD migration     (15 days)
Week 3-4:  HRMS REST APIs              (21 days)
Week 5-6:  CRM & PM optimization       (9 days)
Week 7-9:  Testing & refinement        (variable)
```

---

### 9.3 Success Criteria

**By End of Migration:**
- ✅ 80% of operations use REST API
- ✅ Socket.IO only for real-time features
- ✅ All CRUD via REST endpoints
- ✅ 100 Postman collection ready
- ✅ 70% API test coverage
- ✅ Swagger documentation complete

---

**END OF DOCUMENT**

*Use this guide as the definitive reference for Socket.IO vs REST API decisions in the manageRTC platform.*
