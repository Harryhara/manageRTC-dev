/**
 * Socket.IO Client Hook
 * Manages real-time connection to backend Socket.IO server
 * Provides event listeners for attendance updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Socket.IO connection configuration
// Use REACT_APP_BACKEND_URL from Create React App env, fallback to localhost
const SOCKET_URL = (process.env as any).REACT_APP_BACKEND_URL || 'http://localhost:5000';

interface SocketHookReturn {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  reconnect: () => void;
  disconnect: () => void;
}

/**
 * Main Socket.IO connection hook
 * Handles authentication and connection management
 */
export const useSocket = (token?: string): SocketHookReturn => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!token) {
      console.warn('[useSocket] No token provided, skipping connection');
      return;
    }

    if (socketRef.current?.connected) {
      console.log('[useSocket] Socket already connected');
      return;
    }

    console.log('[useSocket] Connecting to Socket.IO server...');

    try {
      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket.on('connect', () => {
        console.log('[useSocket] Connected to Socket.IO server:', socket.id);
        setIsConnected(true);
        setConnectionError(null);
      });

      socket.on('disconnect', (reason) => {
        console.log('[useSocket] Disconnected from Socket.IO server:', reason);
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('[useSocket] Connection error:', error.message);
        setConnectionError(error.message);
        setIsConnected(false);
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log('[useSocket] Reconnected after', attemptNumber, 'attempts');
        setIsConnected(true);
        setConnectionError(null);
      });

      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('[useSocket] Reconnection attempt:', attemptNumber);
      });

      socket.on('reconnect_failed', () => {
        console.error('[useSocket] Reconnection failed');
        setConnectionError('Failed to reconnect to server');
      });

      socketRef.current = socket;
    } catch (error) {
      console.error('[useSocket] Error creating socket connection:', error);
      setConnectionError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, [token]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[useSocket] Disconnecting socket...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [connect, disconnect]);

  // Auto-connect on mount if token is available
  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    reconnect,
    disconnect,
  };
};

/**
 * Attendance-specific Socket.IO events hook
 * Listens for attendance-related real-time updates
 */
export interface AttendanceEvents {
  onClockIn?: (data: AttendanceClockInEvent) => void;
  onClockOut?: (data: AttendanceClockOutEvent) => void;
  onCreated?: (data: AttendanceCreatedEvent) => void;
  onUpdated?: (data: AttendanceUpdatedEvent) => void;
  onDeleted?: (data: AttendanceDeletedEvent) => void;
  onBulkUpdated?: (data: AttendanceBulkUpdatedEvent) => void;
  onYouClockedIn?: (data: AttendanceYouClockedInEvent) => void;
  onYouClockedOut?: (data: AttendanceYouClockedOutEvent) => void;
}

export interface AttendanceClockInEvent {
  attendanceId: string;
  _id: string;
  employee?: string;
  date: string;
  clockInTime: string;
  timestamp?: string;
}

export interface AttendanceClockOutEvent {
  attendanceId: string;
  _id: string;
  employee?: string;
  date: string;
  clockOutTime: string;
  hoursWorked?: number;
  timestamp?: string;
}

export interface AttendanceCreatedEvent {
  attendanceId: string;
  _id: string;
  employee?: string;
  date: string;
  status: string;
  clockIn: { time: string; location?: any; notes?: string };
  createdBy?: string;
  timestamp?: string;
}

export interface AttendanceUpdatedEvent {
  attendanceId: string;
  _id: string;
  employee?: string;
  date: string;
  status: string;
  hoursWorked?: number;
  updatedBy?: string;
  timestamp?: string;
}

export interface AttendanceDeletedEvent {
  attendanceId: string;
  deletedBy?: string;
  timestamp?: string;
}

export interface AttendanceBulkUpdatedEvent {
  action: string;
  updatedCount: number;
  timestamp?: string;
}

export interface AttendanceYouClockedInEvent {
  attendanceId: string;
  _id: string;
  clockInTime: string;
  timestamp?: string;
}

export interface AttendanceYouClockedOutEvent {
  attendanceId: string;
  _id: string;
  clockOutTime: string;
  hoursWorked?: number;
  timestamp?: string;
}

export const useAttendanceSocket = (
  socket: Socket | null,
  events: AttendanceEvents
) => {
  useEffect(() => {
    if (!socket) {
      console.log('[useAttendanceSocket] No socket available');
      return;
    }

    console.log('[useAttendanceSocket] Setting up attendance event listeners');

    // Company-wide events
    if (events.onClockIn) {
      socket.on('attendance:clock_in', events.onClockIn);
    }
    if (events.onClockOut) {
      socket.on('attendance:clock_out', events.onClockOut);
    }
    if (events.onCreated) {
      socket.on('attendance:created', events.onCreated);
    }
    if (events.onUpdated) {
      socket.on('attendance:updated', events.onUpdated);
    }
    if (events.onDeleted) {
      socket.on('attendance:deleted', events.onDeleted);
    }
    if (events.onBulkUpdated) {
      socket.on('attendance:bulk_updated', events.onBulkUpdated);
    }

    // User-specific events
    if (events.onYouClockedIn) {
      socket.on('attendance:you_clocked_in', events.onYouClockedIn);
    }
    if (events.onYouClockedOut) {
      socket.on('attendance:you_clocked_out', events.onYouClockedOut);
    }

    return () => {
      console.log('[useAttendanceSocket] Cleaning up attendance event listeners');
      if (events.onClockIn) {
        socket.off('attendance:clock_in', events.onClockIn);
      }
      if (events.onClockOut) {
        socket.off('attendance:clock_out', events.onClockOut);
      }
      if (events.onCreated) {
        socket.off('attendance:created', events.onCreated);
      }
      if (events.onUpdated) {
        socket.off('attendance:updated', events.onUpdated);
      }
      if (events.onDeleted) {
        socket.off('attendance:deleted', events.onDeleted);
      }
      if (events.onBulkUpdated) {
        socket.off('attendance:bulk_updated', events.onBulkUpdated);
      }
      if (events.onYouClockedIn) {
        socket.off('attendance:you_clocked_in', events.onYouClockedIn);
      }
      if (events.onYouClockedOut) {
        socket.off('attendance:you_clocked_out', events.onYouClockedOut);
      }
    };
  }, [socket, events]);
};

/**
 * Combined hook for attendance Socket.IO functionality
 * Usage: const { isConnected, onClockIn, onClockOut } = useSocketAttendance(token, { ... })
 */
export const useSocketAttendance = (
  token: string | undefined,
  events: AttendanceEvents
) => {
  const { socket, isConnected, connectionError, reconnect } = useSocket(token);
  useAttendanceSocket(socket, events);

  return {
    socket,
    isConnected,
    connectionError,
    reconnect,
  };
};

export default useSocket;
