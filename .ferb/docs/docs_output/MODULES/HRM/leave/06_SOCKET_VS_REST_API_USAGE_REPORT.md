# Leave Module - Socket.IO vs REST API Usage Report

**Generated:** 2026-02-04
**Module:** HRM - Leave Management
**Architecture:** 80% REST + 20% Socket.IO

---

## Executive Summary

The Leave module follows a **hybrid architecture** with REST APIs for primary data operations and Socket.IO for real-time notifications. The backend broadcasts Socket.IO events after REST operations complete, ensuring immediate UI updates without polling.

**Current Status:**
- ✅ Backend Socket.IO events: Fully implemented
- ❌ Frontend Socket.IO client: Not connected
- ❌ Real-time UI updates: Not implemented

---

## 1. Architecture Overview

### 1.1 Communication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │   React UI       │         │  Socket.Client   │             │
│  │   Components     │◄────────┤  (Not Connected) │             │
│  └────────┬─────────┘         └──────────────────┘             │
│           │
└───────────┼───────────────────────────────────────────────────┘
            │
            │ REST API (Axios/Fetch)
            │
┌───────────▼───────────────────────────────────────────────────┐
│                      Backend API                               │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │ REST Controllers │────────▶│ Socket.Broadcast  │             │
│  │ (leave.controller)│         │ (socketBroadcaster)│             │
│  └────────┬─────────┘         └────────┬─────────┘             │
│           │                             │                        │
└───────────┼─────────────────────────────┼──────────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────┐         ┌───────────────────┐
│   Database        │         │   Socket.IO       │
│   (MongoDB)       │         │   Server          │
└───────────────────┘         └───────────────────┘
```

### 1.2 80/20 Split Rationale

| Operation Type | Protocol | Percentage | Examples |
|----------------|----------|------------|----------|
| CRUD Operations | REST API | 80% | Create, Read, Update, Delete leaves |
| Real-time Updates | Socket.IO | 20% | Approval notifications, Balance updates |

**Why REST for CRUD:**
- Standard HTTP methods (GET, POST, PUT, DELETE)
- Easy caching with HTTP cache headers
- Better error handling (HTTP status codes)
- Request/response pattern suitable for leave operations
- No need for persistent connection
- Easier testing and debugging

**Why Socket.IO for Notifications:**
- Real-time updates without polling
- Push notifications to specific users
- Instant UI updates on approval/rejection
- Room-based broadcasting (company, user, department)
- Lower latency than polling

---

## 2. REST API Operations

### 2.1 REST Endpoint Summary

| Operation | Method | Endpoint | Purpose | Returns |
|-----------|--------|----------|---------|---------|
| Get all leaves | GET | `/api/leaves` | List leaves with filters | Array of leaves |
| Get my leaves | GET | `/api/leaves/my` | Get user's leaves | Array of leaves |
| Get by ID | GET | `/api/leaves/:id` | Get single leave | Single leave object |
| Get balance | GET | `/api/leaves/balance` | Get leave balance | Balance object |
| Create | POST | `/api/leaves` | Apply for leave | Created leave |
| Update | PUT | `/api/leaves/:id` | Modify leave | Updated leave |
| Delete | DELETE | `/api/leaves/:id` | Soft delete | Deleted confirmation |
| Approve | POST | `/api/leaves/:id/approve` | Approve request | Approved leave |
| Reject | POST | `/api/leaves/:id/reject` | Reject request | Rejected leave |

### 2.2 REST Request/Response Flow

```
Client                    Server                    Database
  │                         │                          │
  │ POST /api/leaves        │                          │
  │────────────────────────▶│                          │
  │                         │ Validate & Process        │
  │                         │──────────────────────────▶│
  │                         │ Insert                    │
  │                         │◀─────────────────────────││
  │                         │                          │
  │                         │ Broadcast Socket Event   │
  │                         │ (leave:created)           │
  │                         │────────────┐              │
  │                         │            │              │
  │◀──────── Response       │            │              │
  │                         │            │              │
  │                         │            ▼              │
  │                         │       Other Clients       │
  │                         │    (real-time update)     │
```

---

## 3. Socket.IO Events

### 3.1 Event Emission Points

Socket events are emitted **after** REST operations complete:

| REST Operation | Socket Event | Trigger | Target |
|----------------|--------------|---------|--------|
| POST /api/leaves | `leave:created` | New request | Company room |
| PUT /api/leaves/:id | `leave:updated` | Modified | Company room |
| POST /api/leaves/:id/approve | `leave:approved` | Approved | Company + Employee |
| POST /api/leaves/:id/approve | `leave:balance_updated` | Balance change | Employee |
| POST /api/leaves/:id/reject | `leave:rejected` | Rejected | Company + Employee |
| DELETE /api/leaves/:id | `leave:deleted` | Deleted | Company room |

### 3.2 Event Payloads

#### leave:created

```javascript
{
  leaveId: "leave_1738452342_abc123",
  _id: ObjectId("..."),
  employee: ObjectId("..."),
  employeeName: "John Doe",
  leaveType: "casual",
  startDate: "2026-02-10T00:00:00Z",
  endDate: "2026-02-12T00:00:00Z",
  status: "pending",
  createdBy: ObjectId("..."),
  timestamp: "2026-02-04T10:30:00Z"
}
```

#### leave:approved

```javascript
{
  leaveId: "leave_1738452342_abc123",
  _id: ObjectId("..."),
  employee: ObjectId("..."),
  leaveType: "casual",
  startDate: "2026-02-10T00:00:00Z",
  endDate: "2026-02-12T00:00:00Z",
  approvedBy: ObjectId("..."),
  approvedByName: "Jane Smith",
  timestamp: "2026-02-04T11:30:00Z"
}
```

#### leave:your_leave_approved (Employee-specific)

```javascript
{
  leaveId: "leave_1738452342_abc123",
  _id: ObjectId("..."),
  leaveType: "casual",
  startDate: "2026-02-10T00:00:00Z",
  endDate: "2026-02-12T00:00:00Z",
  approvedBy: ObjectId("..."),
  approvedByName: "Jane Smith",
  comments: "Have a good break!",
  timestamp: "2026-02-04T11:30:00Z"
}
```

#### leave:rejected

```javascript
{
  leaveId: "leave_1738452342_abc123",
  _id: ObjectId("..."),
  employee: ObjectId("..."),
  leaveType: "casual",
  rejectedBy: ObjectId("..."),
  rejectedByName: "Jane Smith",
  reason: "Insufficient coverage during this period",
  timestamp: "2026-02-04T11:30:00Z"
}
```

#### leave:balance_updated

```javascript
{
  employeeId: "EMP001",
  balances: {
    sick: { type: "sick", balance: 10, used: 2, total: 12 },
    casual: { type: "casual", balance: 9, used: 3, total: 12 },
    earned: { type: "earned", balance: 5, used: 7, total: 12 }
  },
  timestamp: "2026-02-04T11:30:00Z"
}
```

---

## 4. Socket Rooms & Targeting

### 4.1 Room Structure

| Room Pattern | Members | Purpose |
|--------------|---------|---------|
| `company_{companyId}` | All company users | Company-wide notifications |
| `user_{userId}` | Single user | Personal notifications |
| `manager_{userId}` | Manager users | Manager-specific updates |
| `project_{projectId}` | Project team | Project-related updates (other modules) |

### 4.2 Broadcasting Functions

```javascript
// Broadcast to company (for admins, HR to see updates)
broadcastToCompany(io, companyId, 'leave:created', data);

// Broadcast to specific user (for personal notifications)
broadcastToUser(io, userId, 'leave:your_leave_approved', data);

// Broadcast to room (for team/department updates)
broadcastToRoom(io, `team_${teamId}`, 'leave:team_update', data);
```

### 4.3 Join/Leave Room Logic

```javascript
// On client connection
socket.on('join', (userId, companyId) => {
  socket.join(`user_${userId}`);
  socket.join(`company_${companyId}`);
});

// On client disconnect (automatic)
// Socket.IO handles room cleanup
```

---

## 5. Current Implementation Status

### 5.1 Backend Socket Implementation ✅

**Location:** `backend/utils/socketBroadcaster.js`

**Status:** Fully implemented with all leave events

```javascript
export const broadcastLeaveEvents = {
  created: (io, companyId, leave) => { /* ... */ },
  updated: (io, companyId, leave) => { /* ... */ },
  approved: (io, companyId, leave, approvedBy) => { /* ... */ },
  rejected: (io, companyId, leave, rejectedBy, reason) => { /* ... */ },
  cancelled: (io, companyId, leave, cancelledBy) => { /* ... */ },
  deleted: (io, companyId, leaveId, deletedBy) => { /* ... */ },
  balanceUpdated: (io, companyId, employeeId, balances) => { /* ... */ }
};
```

**Event emission in controller:**
```javascript
// After successful database operation
const io = getSocketIO(req);
if (io) {
  broadcastLeaveEvents.created(io, user.companyId, leave);
}
```

### 5.2 Frontend Socket Implementation ❌

**Status:** Not implemented

**Required:**
- Socket.IO client connection
- Event listeners for leave events
- UI updates on event receipt
- Connection management (reconnect, disconnect)
- Error handling

---

## 6. Required Frontend Implementation

### 6.1 Socket Client Setup

```typescript
// src/services/socket.ts
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    this.socket = io(process.env.REACT_APP_SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.joinRooms();
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // Leave events
    this.socket.on('leave:created', (data) => {
      // Update leave list if on admin page
    });

    this.socket.on('leave:approved', (data) => {
      // Update leave status
      // Show notification
    });

    this.socket.on('leave:rejected', (data) => {
      // Update leave status
      // Show notification with reason
    });

    this.socket.on('leave:your_leave_approved', (data) => {
      // Show success notification
      // Update balance display
    });

    this.socket.on('leave:your_leave_rejected', (data) => {
      // Show rejection notification with reason
    });

    this.socket.on('leave:balance_updated', (data) => {
      // Update balance cards
      // Refresh balance display
    });
  }

  private joinRooms() {
    const user = getCurrentUser();
    this.socket?.emit('join', user.userId, user.companyId);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export default new SocketService();
```

### 6.2 React Integration

```typescript
// src/hooks/useSocket.ts
import { useEffect } from 'react';
import socketService from '../services/socket';

export const useSocket = () => {
  useEffect(() => {
    const token = localStorage.getItem('token');
    socketService.connect(token);

    return () => {
      socketService.disconnect();
    };
  }, []);
};
```

### 6.3 Component Usage

```typescript
// src/App.tsx
import { useSocket } from './hooks/useSocket';

function App() {
  useSocket(); // Initialize socket connection

  return (
    // ... app content
  );
}

// In leave components
import { socket } from '../services/socket';

// Listen for updates
useEffect(() => {
  const handleLeaveApproved = (data) => {
    if (data.leaveId === currentLeave._id) {
      setCurrentLeave({ ...currentLeave, status: 'approved' });
      message.success('Your leave has been approved!');
    }
  };

  socket.on('leave:your_leave_approved', handleLeaveApproved);

  return () => {
    socket.off('leave:your_leave_approved', handleLeaveApproved);
  };
}, [currentLeave]);
```

---

## 7. REST vs Socket Decision Matrix

| Scenario | Protocol | Rationale |
|----------|----------|-----------|
| Create leave request | REST | Standard CRUD, need response with created object |
| Update leave | REST | Standard CRUD, need confirmation |
| Get leave list | REST | Data fetch, caching beneficial |
| Get leave balance | REST | Data fetch, can cache |
| Approve leave | REST + Socket | REST for confirmation, Socket for real-time update |
| Reject leave | REST + Socket | REST for confirmation, Socket for real-time update |
| Delete leave | REST + Socket | REST for confirmation, Socket for real-time update |
| Real-time notifications | Socket | Push to user without polling |
| Dashboard counters | Socket | Live updates when leaves change |

---

## 8. Performance Considerations

### 8.1 REST API Performance

| Factor | Impact | Mitigation |
|--------|--------|------------|
| Database queries | Medium | Indexes, aggregation pipelines |
| Network latency | Low | HTTP/2, keep-alive connections |
| Payload size | Low | Pagination, field projection |
| Caching | High | Redis for frequently accessed data |

### 8.2 Socket.IO Performance

| Factor | Impact | Mitigation |
|--------|--------|------------|
| Connection overhead | Low | Room-based targeting |
| Event frequency | Medium | Batch updates, debounce |
| Payload size | Low | Minimal event payloads |
| Memory usage | Medium | Clean up disconnected clients |

### 8.3 Hybrid Performance Benefits

```
Without Socket.IO (REST only):
Client ◀─poll─┐ polling interval: 30s
             │
          Server

→ 30 second delay for updates

With Socket.IO (Hybrid):
Client ◀────socket────┐ instant push
                      │
                   Server

→ Instant updates
→ Reduced server load (no polling)
→ Better user experience
```

---

## 9. Fallback Strategy

### 9.1 When Socket.IO Fails

If Socket connection fails, the system should:

1. **Continue REST operations** (primary functionality)
2. **Show offline indicator** in UI
3. **Poll for updates** as fallback
4. **Reconnect automatically** when available

```typescript
// Fallback polling implementation
class SocketService {
  private pollingInterval: NodeJS.Timeout | null = null;

  startFallbackPolling() {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(async () => {
      // Fetch updates via REST
      const updates = await fetchLeaveUpdates();
      // Process updates
    }, 30000); // 30 seconds
  }

  stopFallbackPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  onDisconnect() {
    this.startFallbackPolling();
    showOfflineNotification();
  }

  onReconnect() {
    this.stopFallbackPolling();
    hideOfflineNotification();
  }
}
```

---

## 10. Implementation Checklist

### Phase 1: Socket Client Setup

- [ ] Install socket.io-client dependency
- [ ] Create socket service class
- [ ] Implement connection/auth logic
- [ ] Add reconnection handling

### Phase 2: Event Listeners

- [ ] Add connection event listeners
- [ ] Add leave event listeners (created, updated, etc.)
- [ ] Add balance update listener
- [ ] Add error handling

### Phase 3: UI Integration

- [ ] Update leave list on create/update
- [ ] Show approval notifications
- [ ] Show rejection notifications
- [ ] Update balance cards
- [ ] Add offline indicator

### Phase 4: Testing

- [ ] Test socket connection
- [ ] Test event receipt
- [ ] Test reconnection
- [ ] Test fallback to REST
- [ ] Test multi-user scenarios

---

## 11. Security Considerations

### 11.1 Socket Authentication

```typescript
// Backend: Socket authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const user = verifyToken(token);
  if (user) {
    socket.data.user = user;
    next();
  } else {
    next(new Error('Authentication failed'));
  }
});
```

### 11.2 Room Access Control

```javascript
// Verify user can join room
socket.on('join', (userId, companyId) => {
  const user = socket.data.user;

  // Only join own user room
  if (user.userId !== userId) {
    return socket.emit('error', 'Cannot join another user room');
  }

  // Only join company room if member
  if (user.companyId !== companyId) {
    return socket.emit('error', 'Not a member of this company');
  }

  socket.join(`user_${userId}`);
  socket.join(`company_${companyId}`);
});
```

---

**Report End**
