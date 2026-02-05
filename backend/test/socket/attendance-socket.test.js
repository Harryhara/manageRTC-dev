/**
 * Socket.IO Attendance Events Tests
 * Tests for real-time attendance event broadcasting
 */

import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import http from 'http';
import { Server } from 'http';
import { MongoClient, ObjectId } from 'mongodb';
import { broadcastAttendanceEvents, getSocketIO } from '../utils/socketBroadcaster.js';

// Mock dependencies
jest.mock('../utils/attendanceCache.js', () => ({
  initializeRedis: jest.fn(),
  getClient: jest.fn(() => null),
  invalidateCompanyCache: jest.fn()
}));

jest.mock('../utils/attendanceLogger.js', () => ({
  logClockIn: jest.fn(),
  logClockOut: jest.fn()
}));

describe('Socket.IO Attendance Events', () => {
  let httpServer;
  let ioServer;
  let clientSocket;
  let mongoClient;
  let db;

  beforeAll(async () => {
    // Create HTTP server
    httpServer = http.createServer();

    // Create Socket.IO server
    ioServer = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Add authentication middleware (mocked)
    ioServer.use((socket, next) => {
      socket.userId = 'test-user-id';
      socket.companyId = 'test-company-id';
      socket.role = 'employee';
      socket.authenticated = true;
      next();
    });

    // Connection handler
    ioServer.on('connection', (socket) => {
      socket.join(`company_${socket.companyId}`);
      socket.join(`user_${socket.userId}`);

      socket.on('disconnect', () => {
        console.log('Client disconnected');
      });
    });

    await new Promise((resolve) => {
      httpServer.listen(() => {
        resolve();
      });
    });

    // Connect MongoDB client
    mongoClient = await MongoClient.connect(process.env.MONGO_URI || 'mongodb://localhost:27017');
    db = mongoClient.db('test_attendance');
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    ioServer.close();
    httpServer.close();
    if (mongoClient) {
      await mongoClient.close();
    }
  });

  beforeEach(() => {
    ioServer.removeAllListeners();
  });

  describe('Socket.IO Connection', () => {
    test('should establish connection with authentication', async () => {
      clientSocket = ioClient('http://localhost:3000', {
        auth: { token: 'test-token' },
        transports: ['websocket']
      });

      await new Promise((resolve) => {
        clientSocket.on('connect', resolve);
      });

      expect(clientSocket.connected).toBe(true);
    });

    test('should join company and user rooms', async () => {
      await new Promise((resolve) => {
        clientSocket.on('connect', resolve);
      });

      const rooms = ioServer.sockets.adapter.rooms;
      expect(rooms.has(`company_test-company-id`)).toBe(true);
      expect(rooms.has(`user_test-user-id`)).toBe(true);
    });

    test('should handle connection errors', async () => {
      const badSocket = ioClient('http://localhost:3000', {
        auth: {}, // No token
        transports: ['websocket']
      });

      await new Promise((resolve) => {
        badSocket.on('connect_error', resolve);
      });

      expect(badSocket.connected).toBe(false);
      badSocket.disconnect();
    });
  });

  describe('Clock In Events', () => {
    test('should broadcast clock_in event to company room', (done) => {
      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-001',
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        date: new Date(),
        clockIn: { time: new Date(), location: { type: 'office' } },
        status: 'present'
      };

      // Listen for event
      clientSocket.on('attendance:clock_in', (data) => {
        expect(data.attendanceId).toBe('ATT-001');
        expect(data.employee).toBe('EMP-001');
        expect(data.timestamp).toBeDefined();
        done();
      });

      // Broadcast event
      broadcastAttendanceEvents.clockIn(ioServer, 'test-company-id', attendance);
    });

    test('should broadcast you_clocked_in to specific user', (done) => {
      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-002',
        employeeId: 'test-user-id',
        clockIn: { time: new Date() }
      };

      clientSocket.on('attendance:you_clocked_in', (data) => {
        expect(data.attendanceId).toBe('ATT-002');
        done();
      });

      broadcastAttendanceEvents.clockIn(ioServer, 'test-company-id', attendance);
    });

    test('should include employee name in clock_in event', (done) => {
      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-003',
        employeeName: 'Jane Smith',
        clockIn: { time: new Date() }
      };

      clientSocket.on('attendance:clock_in', (data) => {
        expect(data.employee).toBe('Jane Smith');
        done();
      });

      broadcastAttendanceEvents.clockIn(ioServer, 'test-company-id', attendance);
    });
  });

  describe('Clock Out Events', () => {
    test('should broadcast clock_out event with hours worked', (done) => {
      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-004',
        employeeId: 'EMP-001',
        date: new Date(),
        clockOut: { time: new Date(), location: { type: 'office' } },
        hoursWorked: 8.5,
        status: 'present'
      };

      clientSocket.on('attendance:clock_out', (data) => {
        expect(data.attendanceId).toBe('ATT-004');
        expect(data.hoursWorked).toBe(8.5);
        done();
      });

      broadcastAttendanceEvents.clockOut(ioServer, 'test-company-id', attendance);
    });

    test('should broadcast you_clocked_out to employee', (done) => {
      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-005',
        employeeId: 'test-user-id',
        clockOut: { time: new Date() },
        hoursWorked: 7.75
      };

      clientSocket.on('attendance:you_clocked_out', (data) => {
        expect(data.attendanceId).toBe('ATT-005');
        expect(data.hoursWorked).toBe(7.75);
        done();
      });

      broadcastAttendanceEvents.clockOut(ioServer, 'test-company-id', attendance);
    });

    test('should handle clock out with zero hours worked', (done) => {
      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-006',
        clockOut: { time: new Date() },
        hoursWorked: 0
      };

      clientSocket.on('attendance:clock_out', (data) => {
        expect(data.hoursWorked).toBe(0);
        done();
      });

      broadcastAttendanceEvents.clockOut(ioServer, 'test-company-id', attendance);
    });
  });

  describe('Attendance Created/Updated Events', () => {
    test('should broadcast attendance:created event', (done) => {
      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-007',
        employeeId: 'EMP-002',
        date: new Date(),
        status: 'present',
        clockIn: { time: new Date() }
      };

      clientSocket.on('attendance:created', (data) => {
        expect(data.attendanceId).toBe('ATT-007');
        expect(data.status).toBe('present');
        done();
      });

      broadcastAttendanceEvents.created(ioServer, 'test-company-id', attendance);
    });

    test('should broadcast attendance:updated event', (done) => {
      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-008',
        employeeId: 'EMP-002',
        status: 'late',
        hoursWorked: 7.5
      };

      clientSocket.on('attendance:updated', (data) => {
        expect(data.attendanceId).toBe('ATT-008');
        expect(data.status).toBe('late');
        expect(data.hoursWorked).toBe(7.5);
        done();
      });

      broadcastAttendanceEvents.updated(ioServer, 'test-company-id', attendance);
    });
  });

  describe('Bulk Update Events', () => {
    test('should broadcast bulk_updated event', (done) => {
      const bulkData = {
        action: 'approve-regularization',
        updatedCount: 5,
        results: []
      };

      clientSocket.on('attendance:bulk_updated', (data) => {
        expect(data.action).toBe('approve-regularization');
        expect(data.updatedCount).toBe(5);
        done();
      });

      broadcastAttendanceEvents.bulkUpdated(ioServer, 'test-company-id', bulkData);
    });

    test('should include timestamp in bulk updates', (done) => {
      const bulkData = {
        action: 'update-status',
        updatedCount: 10
      };

      clientSocket.on('attendance:bulk_updated', (data) => {
        expect(data.timestamp).toBeDefined();
        done();
      });

      broadcastAttendanceEvents.bulkUpdated(ioServer, 'test-company-id', bulkData);
    });
  });

  describe('Deletion Events', () => {
    test('should broadcast attendance:deleted event', (done) => {
      clientSocket.on('attendance:deleted', (data) => {
        expect(data.attendanceId).toBe('ATT-009');
        expect(data.deletedBy).toBeDefined();
        done();
      });

      broadcastAttendanceEvents.deleted(ioServer, 'test-company-id', 'ATT-009', 'admin-user-id');
    });
  });

  describe('Room Management', () => {
    test('should only broadcast to company members', async () => {
      // Create second company client
      const company2Socket = ioClient('http://localhost:3000', {
        auth: { token: 'company2-token' },
        transports: ['websocket']
      });

      await new Promise((resolve) => {
        company2Socket.on('connect', resolve);
      });

      // Mock authentication for company 2
      company2Socket.userId = 'company2-user-id';
      company2Socket.companyId = 'company2-id';
      company2Socket.join(`company_company2-id`);

      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-010',
        clockIn: { time: new Date() }
      };

      let eventReceived = false;

      company2Socket.on('attendance:clock_in', () => {
        eventReceived = true;
      });

      broadcastAttendanceEvents.clockIn(ioServer, 'test-company-id', attendance);

      // Wait a bit to ensure no event
      setTimeout(() => {
        expect(eventReceived).toBe(false);
        company2Socket.disconnect();
      }, 100);
    });

    test('should broadcast to user-specific rooms', (done) => {
      const attendance = {
        _id: new ObjectId(),
        employeeId: 'test-user-id',
        clockIn: { time: new Date() }
      };

      clientSocket.on('attendance:you_clocked_in', (data) => {
        expect(data).toBeDefined();
        done();
      });

      broadcastAttendanceEvents.clockIn(ioServer, 'test-company-id', attendance);
    });
  });

  describe('Event Data Validation', () => {
    test('should include required fields in clock_in event', (done) => {
      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-011',
        employeeId: 'EMP-003',
        date: new Date(),
        clockIn: { time: new Date(), location: { type: 'office' } }
      };

      clientSocket.on('attendance:clock_in', (data) => {
        expect(data.attendanceId).toBeDefined();
        expect(data._id).toBeDefined();
        expect(data.date).toBeDefined();
        expect(data.clockInTime).toBeDefined();
        done();
      });

      broadcastAttendanceEvents.clockIn(ioServer, 'test-company-id', attendance);
    });

    test('should handle missing optional fields', (done) => {
      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-012',
        clockIn: { time: new Date() }
      };

      clientSocket.on('attendance:clock_in', (data) => {
        expect(data.attendanceId).toBe('ATT-012');
        done();
      });

      broadcastAttendanceEvents.clockIn(ioServer, 'test-company-id', attendance);
    });
  });

  describe('Multiple Clients', () => {
    test('should deliver events to all company members', async () => {
      const client2 = ioClient('http://localhost:3000', {
        auth: { token: 'test-token-2' },
        transports: ['websocket']
      });

      await new Promise((resolve) => {
        client2.on('connect', resolve);
      });

      client2.userId = 'test-user-id-2';
      client2.companyId = 'test-company-id';
      client2.join(`company_test-company-id`);

      let eventsReceived = 0;
      const allClientsReceived = new Promise((resolve) => {
        const checkEvents = () => {
          if (eventsReceived >= 2) resolve();
        };
        setTimeout(checkEvents, 200);
      });

      const attendance = {
        _id: new ObjectId(),
        attendanceId: 'ATT-MULTI',
        clockIn: { time: new Date() }
      };

      clientSocket.on('attendance:clock_in', () => {
        eventsReceived++;
      });

      client2.on('attendance:clock_in', () => {
        eventsReceived++;
      });

      broadcastAttendanceEvents.clockIn(ioServer, 'test-company-id', attendance);

      await allClientsReceived;
      expect(eventsReceived).toBe(2);

      client2.disconnect();
    });
  });

  describe('Error Handling', () => {
    test('should handle null io gracefully', () => {
      expect(() => {
        broadcastAttendanceEvents.clockIn(null, 'test-company-id', {});
      }).not.toThrow();
    });

    test('should handle missing attendance data', () => {
      expect(() => {
        broadcastAttendanceEvents.clockIn(ioServer, 'test-company-id', null);
      }).not.toThrow();
    });

    test('should handle malformed data', (done) => {
      clientSocket.on('attendance:clock_in', (data) => {
        // Should still receive event even with partial data
        expect(data).toBeDefined();
        done();
      });

      broadcastAttendanceEvents.clockIn(ioServer, 'test-company-id', {});
    });
  });
});
