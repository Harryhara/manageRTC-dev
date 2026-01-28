# 🚀 Frontend Migration Guide
## Socket.IO to REST API - Frontend Developer Instructions

**Last Updated:** January 28, 2026
**Target Audience:** Frontend Developers
**Purpose:** Guide for migrating from Socket.IO to REST API calls

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Setup](#setup)
3. [Basic REST API Calls](#basic-rest-api-calls)
4. [Socket.IO to REST Mapping](#socketio-to-rest-mapping)
5. [Common Patterns](#common-patterns)
6. [Real-time Updates](#real-time-updates)
7. [Migration Examples](#migration-examples)
8. [Troubleshooting](#troubleshooting)

---

## 1. OVERVIEW

### Migration Strategy

**Before (Socket.IO):**
```javascript
socket.emit('employee:getAll', { companyId }, (response) => {
  if (response.done) {
    setEmployees(response.data);
  }
});
```

**After (REST API):**
```javascript
const response = await fetch('/api/employees', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const result = await response.json();
if (result.success) {
  setEmployees(result.data);
}
```

### Key Benefits

| Feature | Socket.IO | REST API |
|---------|-----------|----------|
| Standard HTTP | ❌ | ✅ |
| Caching | ❌ | ✅ |
| Testability | ❌ | ✅ |
| Mobile Apps | ❌ | ✅ |
| Third-party APIs | ❌ | ✅ |
| Documentation | ❌ | ✅ |
| Rate Limiting | ❌ | ✅ |

---

## 2. SETUP

### API Service Configuration

Create `src/services/api.js`:

```javascript
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Get Clerk token
const getAuthToken = async () => {
  const { getToken } = await import('@clerk/clerk-react');
  return await getToken();
};

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
api.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error?.message || error.message || 'An error occurred';
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

export default api;
```

---

## 3. BASIC REST API CALLS

### GET Request (List Resources)

**Before (Socket.IO):**
```javascript
socket.emit('employee:getAll', { companyId, page: 1, limit: 20 }, (response) => {
  if (response.done) {
    setEmployees(response.data);
  }
});
```

**After (REST API):**
```javascript
import api from '@/services/api';

const getEmployees = async (params = {}) => {
  const response = await api.get('/api/employees', { params });
  if (response.data.success) {
    return {
      data: response.data.data,
      pagination: response.data.pagination
    };
  }
  throw new Error(response.data.error?.message || 'Failed to fetch employees');
};

// Usage
const { data, pagination } = await getEmployees({ page: 1, limit: 20 });
setEmployees(data);
```

### POST Request (Create Resource)

**Before (Socket.IO):**
```javascript
socket.emit('employee:create', employeeData, (response) => {
  if (response.done) {
    showNotification('Employee created successfully');
    refreshList();
  }
});
```

**After (REST API):**
```javascript
import api from '@/services/api';

const createEmployee = async (employeeData) => {
  const response = await api.post('/api/employees', employeeData);
  if (response.data.success) {
    showNotification('Employee created successfully');
    return response.data.data;
  }
  throw new Error(response.data.error?.message || 'Failed to create employee');
};

// Usage
try {
  const newEmployee = await createEmployee(employeeData);
  setEmployees([...employees, newEmployee]);
} catch (error) {
  showError(error.message);
}
```

### PUT Request (Update Resource)

**Before (Socket.IO):**
```javascript
socket.emit('employee:update', { employeeId, updateData }, (response) => {
  if (response.done) {
    showNotification('Employee updated successfully');
    refreshList();
  }
});
```

**After (REST API):**
```javascript
import api from '@/services/api';

const updateEmployee = async (employeeId, updateData) => {
  const response = await api.put(`/api/employees/${employeeId}`, updateData);
  if (response.data.success) {
    showNotification('Employee updated successfully');
    return response.data.data;
  }
  throw new Error(response.data.error?.message || 'Failed to update employee');
};

// Usage
try {
  const updated = await updateEmployee(employeeId, { firstName: 'Jane' });
  setEmployees(employees.map(emp => emp._id === employeeId ? { ...emp, ...updated } : emp));
} catch (error) {
  showError(error.message);
}
```

### DELETE Request (Soft Delete)

**Before (Socket.IO):**
```javascript
socket.emit('employee:delete', { employeeId }, (response) => {
  if (response.done) {
    showNotification('Employee deleted successfully');
    refreshList();
  }
});
```

**After (REST API):**
```javascript
import api from '@/services/api';

const deleteEmployee = async (employeeId) => {
  const response = await api.delete(`/api/employees/${employeeId}`);
  if (response.data.success) {
    showNotification('Employee deleted successfully');
    return true;
  }
  throw new Error(response.data.error?.message || 'Failed to delete employee');
};

// Usage
try {
  await deleteEmployee(employeeId);
  setEmployees(employees.filter(emp => emp._id !== employeeId));
} catch (error) {
  showError(error.message);
}
```

---

## 4. SOCKET.IO TO REST MAPPING

### Employees Module

| Socket.IO Event | REST Endpoint | HTTP Method |
|-----------------|---------------|------------|
| `employee:getAll` | `/api/employees` | GET |
| `employee:getById` | `/api/employees/:id` | GET |
| `employee:create` | `/api/employees` | POST |
| `employee:update` | `/api/employees/:id` | PUT |
| `employee:delete` | `/api/employees/:id` | DELETE |
| `employee:search` | `/api/employees/search` | GET |
| `employee:get-employee-stats` | `/api/employees/dashboard` | GET |

### Projects Module

| Socket.IO Event | REST Endpoint | HTTP Method |
|-----------------|---------------|------------|
| `project:getAll` | `/api/projects` | GET |
| `project:getById` | `/api/projects/:id` | GET |
| `project:create` | `/api/projects` | POST |
| `project:update` | `/api/projects/:id` | PUT |
| `project:delete` | `/api/projects/:id` | DELETE |
| `project:get-stats` | `/api/projects/stats` | GET |
| `project:update-progress` | `/api/projects/:id/progress` | PUT |

### Tasks Module

| Socket.IO Event | REST Endpoint | HTTP Method |
|-----------------|---------------|------------|
| `task:getAll` | `/api/tasks` | GET |
| `task:getById` | `/api/tasks/:id` | GET |
| `task:create` | `/api/tasks` | POST |
| `task:update` | `/api/tasks/:id` | PUT |
| `task:delete` | `/api/tasks/:id` | DELETE |
| `task:update-status` | `/api/tasks/:id/status` | PUT |

### Leads Module

| Socket.IO Event | REST Endpoint | HTTP Method |
|-----------------|---------------|------------|
| `lead:getAll` | `/api/leads` | GET |
| `lead:getById` | `/api/leads/:id` | GET |
| `lead:create` | `/api/leads` | POST |
| `lead:update` | `/api/leads/:id` | PUT |
| `lead:delete` | `/api/leads/:id` | DELETE |
| `lead:get-stage` | `/api/leads/stage/:stage` | GET |
| `lead:move-stage` | `/api/leads/:id/stage` | PUT |
| `lead:convert` | `/api/leads/:id/convert` | PUT |
| `lead:get-stats` | `/api/leads/stats` | GET |

### Clients Module

| Socket.IO Event | REST Endpoint | HTTP Method |
|-----------------|---------------|------------|
| `client:getAll` | `/api/clients` | GET |
| `client:getById` | `/api/clients/:id` | GET |
| `client:create` | `/api/clients` | POST |
| `client:update` | `/api/clients/:id` | PUT |
| `client:delete` | `/api/clients/:id` | DELETE |
| `client:get-tier` | `/api/clients/tier/:tier` | GET |
| `client:update-tier` | `/api/clients/:id/tier` | PUT |
| `client:get-stats` | `/api/clients/stats` | GET |

### Activities Module (NEW)

| Socket.IO Event | REST Endpoint | HTTP Method |
|-----------------|---------------|------------|
| `activity:getAll` | `/api/activities` | GET |
| `activity:getById` | `/api/activities/:id` | GET |
| `activity:create` | `/api/activities` | POST |
| `activity:update` | `/api/activities/:id` | PUT |
| `activity:delete` | `/api/activities/:id` | DELETE |
| `activity:getStats` | `/api/activities/stats` | GET |
| `activity:getOwners` | `/api/activities/owners` | GET |
| `activity:getAllData` | Use multiple calls | GET |
| `activity:complete` | `/api/activities/:id/complete` | PUT |
| `activity:postpone` | `/api/activities/:id/postpone` | PUT |

### Pipelines Module (NEW)

| Socket.IO Event | REST Endpoint | HTTP Method |
|-----------------|---------------|------------|
| `pipeline:getAll` | `/api/pipelines` | GET |
| `pipeline:getById` | `/api/pipelines/:id` | GET |
| `pipeline:create` | `/api/pipelines` | POST |
| `pipeline:update` | `/api/pipelines/:id` | PUT |
| `pipeline:delete` | `/api/pipelines/:id` | DELETE |
| `pipeline:getStats` | `/api/pipelines/stats` | GET |
| `pipeline:stage-change` | `/api/pipelines/:id/move-stage` | PUT |
| `pipeline:move-stage` | `/api/pipelines/:id/move-stage` | PUT |

---

## 5. COMMON PATTERNS

### API Hook Template

Create `src/hooks/useApi.js`:

```javascript
import { useState, useCallback } from 'react';
import api from '@/services/api';
import { useToast } from '@/hooks/useToast';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { showSuccess, showError } = useToast();

  const request = useCallback(async (apiCall) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall();
      setLoading(false);
      return response.data;
    } catch (err) {
      setLoading(false);
      const errorMessage = err.response?.data?.error?.message || err.message;
      setError(errorMessage);
      showError(errorMessage);
      throw err;
    }
  }, []);

  return { loading, error, request };
};
```

### Custom Hook for Employees

```javascript
import { useState, useEffect } from 'react';
import api from '@/services/api';
import { useApi } from './useApi';

export const useEmployees = (params = {}) => {
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState(null);
  const { loading, error, request } = useApi();

  const fetchEmployees = async () => {
    const response = await request(() => api.get('/api/employees', { params }));
    setEmployees(response.data);
    setPagination(response.pagination);
  };

  useEffect(() => {
    fetchEmployees();
  }, [JSON.stringify(params)]);

  const createEmployee = async (employeeData) => {
    const response = await request(() => api.post('/api/employees', employeeData));
    setEmployees([...employees, response.data]);
    return response.data;
  };

  const updateEmployee = async (employeeId, updateData) => {
    const response = await request(() => api.put(`/api/employees/${employeeId}`, updateData));
    setEmployees(employees.map(emp => emp._id === employeeId ? { ...emp, ...response.data } : emp));
    return response.data;
  };

  const deleteEmployee = async (employeeId) => {
    await request(() => api.delete(`/api/employees/${employeeId}`));
    setEmployees(employees.filter(emp => emp._id !== employeeId));
  };

  return {
    employees,
    pagination,
    loading,
    error,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    refresh: fetchEmployees
  };
};
```

---

## 6. REAL-TIME UPDATES

### Socket.IO Integration

Even after migration, Socket.IO is still used for real-time broadcasts.

**Setup in App.js:**

```javascript
import { useAuth } from '@clerk/clerk-react';
import io from 'socket.io-client';

let socket;

const App = () => {
  const { getToken } = useAuth();

  useEffect(() => {
    const initSocket = async () => {
      const token = await getToken();

      socket = io('http://localhost:5000', {
        auth: { token }
      });

      // Listen for real-time updates
      socket.on('employee:created', (data) => {
        // Refresh employees list when new employee is created
        queryClient.invalidateQueries(['employees']);
      });

      socket.on('employee:updated', (data) => {
        // Update specific employee in cache
        queryClient.setQueryData(['employees', data._id], data);
      });

      socket.on('employee:deleted', (data) => {
        // Remove deleted employee from cache
        queryClient.invalidateQueries(['employees']);
      });
    };

    initSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [getToken]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
```

---

## 7. MIGRATION EXAMPLES

### Example 1: Employee List Page

**Before (Socket.IO):**
```javascript
import { useEffect, useState } from 'react';
import { socket } from '@/context/SocketContext';

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    socket.emit('employee:getAll', { companyId }, (response) => {
      if (response.done) {
        setEmployees(response.data);
        setLoading(false);
      }
    });
  }, [companyId]);

  // ...
};
```

**After (REST API):**
```javascript
import { useEffect, useState } from 'react';
import api from '@/services/api';
import { useEmployees } from '@/hooks/useEmployees';

const EmployeeList = ({ filters }) => {
  const { employees, loading, error } = useEmployees(filters);

  // Loading state
  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;

  return (
    <Table data={employees} />
  );
};
```

### Example 2: Create Employee Form

**Before (Socket.IO):**
```javascript
const handleCreate = (employeeData) => {
  socket.emit('employee:create', employeeData, (response) => {
    if (response.done) {
      toast.success('Employee created successfully');
      navigate('/employees');
    } else {
      toast.error(response.error);
    }
  });
};
```

**After (REST API):**
```javascript
import api from '@/services/api';

const { createEmployee } = useEmployees();

const handleCreate = async (employeeData) => {
  try {
    await createEmployee(employeeData);
    toast.success('Employee created successfully');
    navigate('/employees');
  } catch (error) {
    toast.error(error.message);
  }
};
```

### Example 3: Activity Management

**Before (Socket.IO):**
```javascript
socket.emit('activity:create', activityData, (response) => {
  if (response.done) {
    setActivities([...activities, response.data]);
    socket.emit('activity:getAllData', {}, (refreshResponse) => {
      if (refreshResponse.done) {
        setActivities(refreshResponse.data.activities);
      }
    });
  }
});
```

**After (REST API):**
```javascript
import api from '@/services/api';

const { createActivity } = useActivities();

const handleCreate = async (activityData) => {
  try {
    const newActivity = await createActivity(activityData);
    setActivities(prev => [...prev, newActivity]);
    toast.success('Activity created');
  } catch (error) {
    toast.error(error.message);
  }
};

// Real-time update listener (still uses Socket.IO)
useEffect(() => {
  const handleActivityUpdate = (data) => {
    setActivities(prev => {
      const exists = prev.find(a => a._id === data._id);
      if (exists) {
        return prev.map(a => a._id === data._id ? { ...a, ...data } : a);
      }
      return [...prev, data];
    });
  };

  socket.on('activity:created', handleActivityUpdate);
  socket.on('activity:updated', handleActivityUpdate);

  return () => {
    socket.off('activity:created', handleActivityUpdate);
    socket.off('activity:updated', handleActivityUpdate);
  };
}, [socket]);
```

---

## 8. TROUBLESHOOTING

### Common Issues

#### 1. CORS Errors

**Error:** "Access blocked by CORS policy"

**Solution:** Ensure backend CORS is configured correctly:

```javascript
// backend/server.js
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
```

#### 2. Authentication Errors

**Error:** 401 Unauthorized

**Solutions:**
- Verify Clerk is properly configured
- Check token is being sent: `Authorization: Bearer <token>`
- Ensure user is signed in

#### 3. Permission Errors

**Error:** 403 Forbidden

**Solutions:**
- Check user role has required permissions
- Verify role-based access control in controller

#### 4. Validation Errors

**Error:** 400 Bad Request with validation details

**Solution:**
```javascript
try {
  await api.post('/api/employees', invalidData);
} catch (error) {
  if (error.response?.status === 400) {
    const errors = error.response.data.error.details;
    // Display validation errors
  }
}
```

### Testing Checklist

- [ ] Replace Socket.IO emits with API calls
- [ ] Update state management to use REST responses
- [ ] Test error handling
- [ ] Verify real-time updates still work via Socket.IO
- [ ] Test with different user roles
- [ ] Verify pagination works correctly
- [ ] Test search and filtering functionality

---

## 📚 QUICK REFERENCE

### API Response Structure

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**With Pagination:**
```json
{
  "success": true,
  "data": [...],
  "message": "Operation successful",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": { ... }
  }
}
```

### Migration Checklist

- [ ] Setup axios API service
- [ ] Replace Socket.IO emits with API calls
- [ ] Update error handling
- [ ] Add loading states
- [ ] Test all CRUD operations
- [ ] Verify Socket.IO real-time updates
- [ ] Remove deprecated Socket.IO calls
- [ ] Update TypeScript types (if applicable)
- [ ] Update API documentation

---

## 📞 SUPPORT

For questions or issues:
1. Check [API Documentation](./16_COMPLETE_API_DOCUMENTATION.md)
2. Review [Postman Collections](../../postman/)
3. Contact development team

---

**Happy Migration! 🎉**
