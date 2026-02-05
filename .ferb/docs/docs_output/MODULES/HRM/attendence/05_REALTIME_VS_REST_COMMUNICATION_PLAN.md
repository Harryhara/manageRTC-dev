# Real-Time vs REST Communication Plan - Attendance Module

**Project:** manageRTC
**Module:** Attendance Management System
**Document Version:** 1.0.0

---

## Executive Summary

The Attendance module uses a **hybrid communication architecture**:
- **80% REST API** for standard CRUD operations
- **20% Socket.IO** for real-time event broadcasting

This document outlines which features should use REST APIs and which should use WebSockets for optimal performance and user experience.

---

## Communication Pattern Decision Matrix

| Feature | Communication Type | Rationale |
|---------|-------------------|-----------|
| Clock In/Out | REST + Socket | REST for action, Socket for notification |
| Attendance List | REST | Standard CRUD with pagination |
| Statistics | REST | Data aggregation, cacheable |
| Live Dashboard | Socket | Real-time updates for multiple users |
| Report Generation | REST | Heavy computation, one-time fetch |
| Attendance Status Changes | REST + Socket | REST for update, Socket for broadcast |
| Bulk Operations | REST + Socket | REST for action, Socket for progress |

---

## REST API Usage

### When to Use REST APIs

**REST APIs are ideal for:**

1. **CRUD Operations**
   - Create, Read, Update, Delete attendance records
   - Standard database operations
   - Idempotent operations

2. **Data Retrieval**
   - Paginated lists
   - Filtered queries
   - Search operations
   - Report generation

3. **Stateless Operations**
   - Clock in/out
   - Status updates
   - Bulk operations

4. **Cacheable Responses**
   - Statistics
   - Historical data
   - Reports

### REST Endpoints Summary

| Endpoint | Method | Purpose | Cacheable |
|----------|--------|---------|-----------|
| `/api/attendance` | GET | List attendance | ⚠️ Conditional |
| `/api/attendance/my` | GET | My attendance | ⚠️ Conditional |
| `/api/attendance/stats` | GET | Statistics | ✅ Yes (5min) |
| `/api/attendance/daterange` | GET | Date range query | ✅ Yes (1min) |
| `/api/attendance/employee/:id` | GET | Employee attendance | ⚠️ Conditional |
| `/api/attendance/:id` | GET | Single record | ✅ Yes (1min) |
| `/api/attendance` | POST | Clock in | ❌ No |
| `/api/attendance/:id` | PUT | Clock out | ❌ No |
| `/api/attendance/:id` | DELETE | Delete record | ❌ No |
| `/api/attendance/bulk` | POST | Bulk operations | ❌ No |

---

## Socket.IO Real-Time Events

### When to Use WebSockets

**Socket.IO is ideal for:**

1. **Real-Time Notifications**
   - Employee clocked in/out
   - Attendance status changes
   - Regularization requests
   - Live dashboard updates

2. **Multi-User Synchronization**
   - Live attendance count
   - Today's presence status
   - Live statistics
   - Admin dashboard updates

3. **Event Broadcasting**
   - Company-wide updates
   - Department notifications
   - Manager alerts

4. **Progress Updates**
   - Bulk operation progress
   - Long-running tasks

### Socket.IO Events Reference

| Event Name | Trigger | Target Audience | Purpose |
|------------|---------|-----------------|---------|
| `attendance:created` | New attendance created | Company room | Notify all users |
| `attendance:updated` | Attendance updated | Company room | Sync data |
| `attendance:clock_in` | Employee clocked in | Company room | Update live count |
| `attendance:you_clocked_in` | Current user clocked in | User room | Confirmation |
| `attendance:clock_out` | Employee clocked out | Company room | Update live count |
| `attendance:you_clocked_out` | Current user clocked out | User room | + hours worked |
| `attendance:deleted` | Attendance deleted | Company room | Remove from view |
| `attendance:bulk_updated` | Bulk operation completed | Company room | Refresh data |

---

## Room Structure

### Socket.IO Rooms

```
manageRTC (namespace)
│
├── company_{companyId} (room)
│   ├── All users in company
│   ├── Receives: created, updated, clock_in, clock_out, deleted
│   └── Purpose: Live dashboard updates
│
└── user_{userId} (room)
    ├── Individual user
    ├── Receives: you_clocked_in, you_clocked_out
    └── Purpose: Personal confirmations
```

### Room Implementation

**Server-side (Backend):**

```javascript
// backend/utils/socketBroadcaster.js

export const broadcastAttendanceEvents = {
  /**
   * Broadcast when attendance is created
   */
  created: (io, companyId, attendance) => {
    io.to(`company_${companyId}`).emit('attendance:created', {
      attendance,
      timestamp: new Date()
    });
  },

  /**
   * Broadcast when employee clocks in
   */
  clockIn: (io, companyId, attendance) => {
    // Broadcast to company room
    io.to(`company_${companyId}`).emit('attendance:clock_in', {
      employeeId: attendance.employeeId,
      employeeName: attendance.employeeName,
      time: attendance.clockIn.time,
      timestamp: new Date()
    });

    // Send personal confirmation
    const userId = attendance.createdBy;
    io.to(`user_${userId}`).emit('attendance:you_clocked_in', {
      message: 'You have successfully clocked in',
      time: attendance.clockIn.time
    });
  },

  /**
   * Broadcast when employee clocks out
   */
  clockOut: (io, companyId, attendance) => {
    // Broadcast to company room
    io.to(`company_${companyId}`).emit('attendance:clock_out', {
      employeeId: attendance.employeeId,
      employeeName: attendance.employeeName,
      time: attendance.clockOut.time,
      hoursWorked: attendance.hoursWorked,
      timestamp: new Date()
    });

    // Send personal confirmation
    const userId = attendance.updatedBy;
    io.to(`user_${userId}`).emit('attendance:you_clocked_out', {
      message: 'You have successfully clocked out',
      time: attendance.clockOut.time,
      hoursWorked: attendance.hoursWorked
    });
  }
};
```

**Client-side (Frontend):**

```typescript
// react/src/hooks/useAttendanceSocket.ts

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useAttendanceSocket = (companyId: string, userId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Connect to Socket.IO server
    const socketInstance = io('http://localhost:5000', {
      auth: { token: localStorage.getItem('token') }
    });

    // Join rooms
    socketInstance.emit('join', {
      companyRoom: `company_${companyId}`,
      userRoom: `user_${userId}`
    });

    // Listen for attendance events
    socketInstance.on('attendance:clock_in', (data) => {
      console.log('Employee clocked in:', data.employeeName);
      // Update live count, refresh dashboard
    });

    socketInstance.on('attendance:clock_out', (data) => {
      console.log('Employee clocked out:', data.employeeName);
      // Update live count, refresh dashboard
    });

    socketInstance.on('attendance:you_clocked_in', (data) => {
      // Show success notification
      message.success(data.message);
    });

    socketInstance.on('attendance:you_clocked_out', (data) => {
      // Show success notification with hours
      message.success(`${data.message} - ${data.hoursWorked} hours worked`);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [companyId, userId]);

  return socket;
};
```

---

## Feature-by-Feature Communication Plan

### 1. Clock In/Out

**Primary:** REST API
**Secondary:** Socket.IO (notification only)

```
User Action
    │
    ▼
POST /api/attendance (REST)
    │
    ├── Create/Update attendance
    ├── Return response
    │
    └── Broadcast Socket.IO event
        ├── attendance:clock_in (to company)
        └── attendance:you_clocked_in (to user)
```

**Why REST?**
- Reliable transaction
- Error handling
- Response data needed
- Idempotent (can retry)

**Why Socket.IO?**
- Real-time dashboard updates
- Multi-user notification
- No page refresh needed

---

### 2. Attendance List (Admin View)

**Primary:** REST API

```
Component Mount
    │
    ▼
GET /api/attendance?status=present&page=1 (REST)
    │
    └── Return paginated list
```

**Why REST?**
- Pagination required
- Filtering/sorting
- Cacheable
- Large dataset

**When to add Socket.IO:**
- New attendance created by others → refresh list
- Attendance status changed → update item
- Bulk operation completed → refresh list

---

### 3. Live Dashboard Statistics

**Primary:** REST API + Socket.IO

```
Initial Load
    │
    ▼
GET /api/attendance/stats (REST)
    │
    └── Return current stats
        ├── Present: 250
        ├── Late: 45
        └── Absent: 12

Real-Time Updates
    │
    ▼
Socket.IO Events
    ├── attendance:clock_in → increment "Present"
    ├── attendance:clock_out → update hours
    └── attendance:deleted → decrement count
```

**Hybrid Approach:**
- REST for initial load
- Socket.IO for incremental updates
- Periodic REST refresh (every 5 min) for sync

---

### 4. Report Generation

**Primary:** REST API

```
User clicks "Generate Report"
    │
    ▼
POST /api/reports/attendance (REST)
    │
    ├── Query database
    ├── Aggregate data
    ├── Generate CSV/PDF
    └── Return file or download URL
```

**Why REST?**
- Heavy computation
- One-time operation
- File download
- No need for real-time

---

### 5. Bulk Operations

**Primary:** REST API
**Secondary:** Socket.IO (progress updates)

```
User selects 100 records → Approve Regularization
    │
    ▼
POST /api/attendance/bulk (REST)
    │
    ├── Process records
    │
    └── Socket.IO progress
        ├── attendance:bulk_progress (35/100)
        ├── attendance:bulk_progress (70/100)
        └── attendance:bulk_updated (100/100 complete)
```

**Why Hybrid?**
- REST for actual operation
- Socket.IO for UX (progress bar)

---

## Performance Comparison

### REST API

| Metric | Value |
|--------|-------|
| Latency | 50-200ms |
| Overhead | HTTP headers |
| Scaling | Stateless, easy |
| Caching | Browser, CDN, Redis |
| Reliability | High (auto-retry) |

### Socket.IO

| Metric | Value |
|--------|-------|
| Latency | 10-50ms |
| Overhead | WebSocket frame |
| Scaling | Requires sticky sessions |
| Caching | Not applicable |
| Reliability | Medium (connection loss) |

---

## Recommended Architecture

### Frontend Component Communication

```
┌─────────────────────────────────────────────────────────────────┐
│                      AttendanceAdmin Component                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ useAttendanceREST│    │ useAttendanceSocket│                │
│  │                 │    │                 │                    │
│  │ - fetchAttendance│    │ - Live events   │                    │
│  │ - clockIn       │    │ - Notifications │                    │
│  │ - clockOut      │    │ - Real-time sync│                    │
│  └────────┬────────┘    └────────┬────────┘                    │
│           │                      │                             │
│           │                      │                             │
│           ▼                      ▼                             │
│  ┌─────────────────────────────────────────┐                   │
│  │         State Management                 │                   │
│  │  attendance: []                          │                   │
│  │  stats: { present: 0, late: 0 }         │                   │
│  │  liveCount: 0                            │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Implementation Example

```typescript
// attendanceadmin.tsx

import { useAttendanceREST } from '@/hooks/useAttendanceREST';
import { useAttendanceSocket } from '@/hooks/useAttendanceSocket';

const AttendanceAdmin = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({ present: 0, late: 0, absent: 0 });

  // REST API for data fetching
  const { fetchAttendance, fetchStats, loading } = useAttendanceREST();

  // Socket.IO for real-time updates
  useAttendanceSocket(user.companyId, user.userId);

  useEffect(() => {
    // Initial data load via REST
    loadAttendanceData();

    // Listen for Socket.IO events
    const socket = io('http://localhost:5000');

    socket.on('attendance:clock_in', (data) => {
      // Update live count
      setStats(prev => ({ ...prev, present: prev.present + 1 }));

      // Add to list or refresh
      setAttendance(prev => [data.attendance, ...prev]);
    });

    socket.on('attendance:clock_out', (data) => {
      // Update item in list
      setAttendance(prev =>
        prev.map(a =>
          a._id === data.attendance._id ? data.attendance : a
        )
      );
    });

    return () => socket.disconnect();
  }, []);

  const loadAttendanceData = async () => {
    const data = await fetchAttendance({ page: 1, limit: 20 });
    setAttendance(data);

    const statistics = await fetchStats();
    setStats(statistics);
  };

  return (
    <div>
      {/* Stats display */}
      <StatsCards stats={stats} />

      {/* Attendance table */}
      <Table dataSource={attendance} loading={loading} />
    </div>
  );
};
```

---

## Scalability Considerations

### Current Architecture (Single Server)

```
┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Backend     │
│  (React)     │     │  (Express)   │
└──────────────┘     └──────┬───────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   MongoDB    │    │  Socket.IO   │    │  Redis Cache │
│              │    │    (Single)  │    │  (Optional)  │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Recommended Architecture (Multi-Server)

```
┌──────────────┐     ┌─────────────────────────────────┐
│   Frontend   │────▶│       Load Balancer (Nginx)     │
│  (React)     │     └────────────────┬────────────────┘
└──────────────┘                      │
                        ┌─────────────┴─────────────┐
                        │                           │
                        ▼                           ▼
              ┌──────────────────┐       ┌──────────────────┐
              │  Backend Server 1│       │  Backend Server 2│
              │  (Express)       │       │  (Express)       │
              └────────┬─────────┘       └────────┬─────────┘
                       │                           │
                       └───────────┬───────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌──────────────┐              ┌──────────────┐
          │   Redis      │              │  Socket.IO   │
          │  (Pub/Sub)   │─────────────▶│   Adapter    │
          └──────────────┘              └──────────────┘
                    │
                    ▼
          ┌──────────────┐
          │   MongoDB    │
          │  (Primary)   │
          └──────────────┘
```

**Socket.IO Redis Adapter:**

```javascript
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const io = new Server(5000);

const redisClient = createClient({ url: 'redis://localhost:6379' });
const subClient = redisClient.duplicate();

await Promise.all([redisClient.connect(), subClient.connect()]);

io.adapter(createAdapter(redisClient, subClient));
```

---

## Decision Summary

| Use Case | Recommended | Reason |
|----------|-------------|--------|
| Clock In/Out | REST + Socket | REST for action, Socket for notification |
| List View | REST | Pagination, filtering, cacheable |
| Statistics | REST + Socket | REST initial, Socket updates |
| Live Dashboard | Socket | Real-time count, instant updates |
| Reports | REST | Heavy computation, file download |
| Bulk Operations | REST + Socket | REST action, Socket progress |
| Personal Notification | Socket | Instant feedback |

---

## Implementation Checklist

### Phase 1: REST API Integration (Required)
- [ ] Replace mock data with `useAttendanceREST` hook
- [ ] Implement clock in/out with REST
- [ ] Fetch attendance lists via REST
- [ ] Implement statistics via REST
- [ ] Add error handling for REST failures

### Phase 2: Socket.IO Integration (Recommended)
- [ ] Implement Socket.IO client connection
- [ ] Join company and user rooms
- [ ] Listen for clock_in/clock_out events
- [ ] Update live statistics in real-time
- [ ] Show in-app notifications

### Phase 3: Optimization (Optional)
- [ ] Add Redis caching for REST responses
- [ ] Implement Socket.IO Redis adapter
- [ ] Add request debouncing
- [ ] Implement offline support
- [ ] Add optimistic updates

---

## Summary

**Recommended Communication Pattern:**

1. **REST API** for:
   - All data fetching (CRUD)
   - Clock in/out actions
   - Report generation
   - Bulk operations

2. **Socket.IO** for:
   - Real-time notifications
   - Live dashboard updates
   - Multi-user synchronization
   - Progress updates

**Ratio:** 80% REST / 20% Socket.IO
