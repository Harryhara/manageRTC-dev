/**
 * Holiday REST API Hook
 * Provides holiday management and working day calculation operations
 */

import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import { get, post, put, del, ApiResponse } from '../services/api';
import { useSocket } from '../SocketContext';

/**
 * Holiday interface matching backend schema
 */
export interface Holiday {
  _id?: string;
  holidayId: string;
  companyId: string;
  name: string;
  date: string;
  type: 'public' | 'company' | 'optional';
  isRecurring: boolean;
  recurringDay?: number;
  recurringMonth?: number;
  applicableStates?: string[];
  description?: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Working days calculation result
 */
export interface WorkingDaysResult {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  workingDays: number;
  weekendDays: number;
  holidayCount: number;
  dates: Array<{
    date: Date;
    isWeekend: boolean;
    isHoliday: boolean;
    isWorkingDay: boolean;
    holidayName?: string;
  }>;
  holidays: Array<{
    date: Date;
    name: string;
    type: string;
  }>;
}

/**
 * Holiday REST API Hook
 */
export const useHolidayREST = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all holidays with optional filtering
   */
  const fetchHolidays = useCallback(async (params: {
    year?: number;
    month?: number;
    type?: string;
    search?: string;
  } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params.year) queryParams.append('year', params.year.toString());
      if (params.month) queryParams.append('month', params.month.toString());
      if (params.type) queryParams.append('type', params.type);
      if (params.search) queryParams.append('search', params.search);

      const response: ApiResponse<Holiday[]> = await get(`/holidays?${queryParams.toString()}`);

      if (response.success && response.data) {
        setHolidays(response.data);
        return response.data;
      }
      throw new Error(response.error?.message || 'Failed to fetch holidays');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to fetch holidays';
      setError(errorMessage);
      message.error(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch upcoming holidays
   */
  const fetchUpcomingHolidays = useCallback(async (days = 30) => {
    setLoading(true);
    setError(null);
    try {
      const response: ApiResponse<Holiday[]> = await get(`/holidays/upcoming?days=${days}`);

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error?.message || 'Failed to fetch upcoming holidays');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to fetch upcoming holidays';
      setError(errorMessage);
      message.error(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Calculate working days for a date range
   */
  const calculateWorkingDays = useCallback(async (params: {
    startDate: string;
    endDate: string;
    state?: string;
  }): Promise<WorkingDaysResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const response: ApiResponse<WorkingDaysResult> = await post('/holidays/calculate', params);

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error?.message || 'Failed to calculate working days');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to calculate working days';
      setError(errorMessage);
      message.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Validate leave dates
   */
  const validateLeaveDates = useCallback(async (params: {
    startDate: string;
    endDate: string;
    employeeId?: string;
  }): Promise<WorkingDaysResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const response: ApiResponse<WorkingDaysResult> = await post('/holidays/validate', params);

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error?.message || 'Failed to validate dates');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || err.message || 'Failed to validate dates';
      setError(errorMessage);
      message.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Socket.IO event listeners for real-time updates
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleHolidayCreated = (data: any) => {
      console.log('[useHolidayREST] Holiday created via broadcast:', data);
      setHolidays(prev => [...prev, data]);
      message.success(`New holiday added: ${data.name}`);
    };

    const handleHolidayUpdated = (data: any) => {
      console.log('[useHolidayREST] Holiday updated via broadcast:', data);
      setHolidays(prev =>
        prev.map(h => h.holidayId === data.holidayId ? { ...h, ...data } : h)
      );
      message.info(`Holiday updated: ${data.name}`);
    };

    const handleHolidayDeleted = (data: any) => {
      console.log('[useHolidayREST] Holiday deleted via broadcast:', data);
      setHolidays(prev => prev.filter(h => h.holidayId !== data.holidayId));
      message.info(`Holiday deleted: ${data.name}`);
    };

    socket.on('holiday:created', handleHolidayCreated);
    socket.on('holiday:updated', handleHolidayUpdated);
    socket.on('holiday:deleted', handleHolidayDeleted);

    return () => {
      socket.off('holiday:created', handleHolidayCreated);
      socket.off('holiday:updated', handleHolidayUpdated);
      socket.off('holiday:deleted', handleHolidayDeleted);
    };
  }, [socket]);

  return {
    holidays,
    loading,
    error,
    fetchHolidays,
    fetchUpcomingHolidays,
    calculateWorkingDays,
    validateLeaveDates,
  };
};

export default useHolidayREST;
