/**
 * Shift Model Tests
 * Tests for shift-based attendance calculations and validations
 */

import mongoose from 'mongoose';
import Shift from '../../models/shift/shift.schema.js';

// Mock attendance cache
jest.mock('../../utils/attendanceCache.js', () => ({
  initializeRedis: jest.fn(),
  getClient: jest.fn(() => null),
  cacheStats: jest.fn(),
  getCachedStats: jest.fn()
}));

describe('Shift Model', () => {
  let shift;

  beforeEach(async () => {
    shift = new Shift({
      shiftId: 'SHIFT-001',
      companyId: 'test-company-id',
      name: 'General Shift',
      shortCode: 'GS',
      startTime: '09:00',
      endTime: '17:00',
      gracePeriod: 15,
      overtimeThreshold: 8,
      lunchBreakDuration: 30,
      isActive: true,
      isNightShift: false,
      workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    });
  });

  describe('Shift Creation', () => {
    test('should create shift with valid data', async () => {
      const savedShift = await shift.save();
      expect(savedShift._id).toBeDefined();
      expect(savedShift.shiftId).toBe('SHIFT-001');
      expect(savedShift.name).toBe('General Shift');
    });

    test('should require shiftId', async () => {
      delete shift.shiftId;
      await expect(shift.save()).rejects.toThrow();
    });

    test('should require companyId', async () => {
      delete shift.companyId;
      await expect(shift.save()).rejects.toThrow();
    });

    test('should require name', async () => {
      delete shift.name;
      await expect(shift.save()).rejects.toThrow();
    });

    test('should require startTime and endTime', async () => {
      delete shift.startTime;
      await expect(shift.save()).rejects.toThrow();

      shift.startTime = '09:00';
      delete shift.endTime;
      await expect(shift.save()).rejects.toThrow();
    });
  });

  describe('Late Arrival Detection', () => {
    test('should detect late arrival within grace period', () => {
      const onTime = '09:15'; // Within 15 min grace period
      expect(shift.isLateArrival(onTime)).toBe(false);

      const late = '09:16';
      expect(shift.isLateArrival(late)).toBe(true);
    });

    test('should detect late arrival without grace period', () => {
      shift.gracePeriod = 0;

      const onTime = '09:00';
      expect(shift.isLateArrival(onTime)).toBe(false);

      const late = '09:01';
      expect(shift.isLateArrival(late)).toBe(true);
    });

    test('should handle late arrival for night shifts', () => {
      shift.startTime = '22:00';
      shift.endTime = '06:00';
      shift.isNightShift = true;

      const onTime = '22:15'; // Within grace period
      expect(shift.isLateArrival(onTime)).toBe(false);

      const late = '22:16';
      expect(shift.isLateArrival(late)).toBe(true);
    });
  });

  describe('Early Departure Detection', () => {
    test('should detect early departure', () => {
      const onTime = '17:00';
      expect(shift.isEarlyDeparture(onTime)).toBe(false);

      const early = '16:59';
      expect(shift.isEarlyDeparture(early)).toBe(true);
    });

    test('should allow early departure with permission', () => {
      const earlyWithPermission = '16:00';
      shift.hasEarlyDeparturePermission = true;

      expect(shift.isEarlyDeparture(earlyWithPermission, true)).toBe(false);
    });

    test('should detect early departure for night shifts', () => {
      shift.startTime = '22:00';
      shift.endTime = '06:00';
      shift.isNightShift = true;

      const onTime = '06:00';
      expect(shift.isEarlyDeparture(onTime)).toBe(false);

      const early = '05:59';
      expect(shift.isEarlyDeparture(early)).toBe(true);
    });
  });

  describe('Work Hours Calculation', () => {
    test('should calculate work hours excluding lunch', () => {
      const clockIn = '09:00';
      const clockOut = '17:00';

      const workHours = shift.calculateWorkHours(clockIn, clockOut);
      expect(workHours).toBe(7.5); // 8 hours - 30 min lunch
    });

    test('should calculate work hours without lunch', () => {
      shift.lunchBreakDuration = 0;
      const clockIn = '09:00';
      const clockOut = '17:00';

      const workHours = shift.calculateWorkHours(clockIn, clockOut);
      expect(workHours).toBe(8);
    });

    test('should calculate overtime hours', () => {
      const clockIn = '09:00';
      const clockOut = '19:00'; // 10 hours total

      const result = shift.calculateWorkHours(clockIn, clockOut);
      expect(result.workHours).toBe(9.5); // 10 - 0.5 lunch
      expect(result.overtimeHours).toBe(1.5); // Above 8 hour threshold
    });

    test('should handle partial work hours', () => {
      const clockIn = '09:00';
      const clockOut = '13:30';

      const workHours = shift.calculateWorkHours(clockIn, clockOut);
      expect(workHours).toBe(4); // 4.5 - 0.5 lunch
    });

    test('should calculate night shift hours', () => {
      shift.startTime = '22:00';
      shift.endTime = '06:00';
      shift.isNightShift = true;

      const clockIn = '22:00';
      const clockOut = '06:00';

      const workHours = shift.calculateWorkHours(clockIn, clockOut);
      expect(workHours).toBe(7.5); // 8 hours - 0.5 lunch
    });

    test('should handle overnight shifts crossing midnight', () => {
      shift.startTime = '22:00';
      shift.endTime = '06:00';
      shift.isNightShift = true;

      const clockIn = '22:00';
      const clockOut = '07:00'; // 1 hour overtime

      const result = shift.calculateWorkHours(clockIn, clockOut);
      expect(result.workHours).toBe(8); // 8.5 - 0.5 lunch
      expect(result.overtimeHours).toBe(0.5);
    });
  });

  describe('Break Duration Calculation', () => {
    test('should calculate total break duration', () => {
      const breaks = [
        { startTime: '12:00', endTime: '12:30', duration: 30 },
        { startTime: '15:00', endTime: '15:15', duration: 15 }
      ];

      const totalBreak = shift.calculateTotalBreakDuration(breaks);
      expect(totalBreak).toBe(45);
    });

    test('should handle missing break durations', () => {
      const breaks = [
        { startTime: '12:00', endTime: '12:30' }, // No duration
        { startTime: '15:00', endTime: '15:15', duration: 15 }
      ];

      const totalBreak = shift.calculateTotalBreakDuration(breaks);
      expect(totalBreak).toBeGreaterThan(0);
    });
  });

  describe('Half Day Calculation', () => {
    test('should identify half day (less than 4 hours)', () => {
      const workHours = 3.5;
      expect(shift.isHalfDay(workHours)).toBe(true);
    });

    test('should not identify half day (more than 4 hours)', () => {
      const workHours = 4.5;
      expect(shift.isHalfDay(workHours)).toBe(false);
    });

    test('should handle exactly 4 hours', () => {
      const workHours = 4;
      expect(shift.isHalfDay(workHours)).toBe(false);
    });
  });

  describe('Shift Validation', () => {
    test('should validate time format (HH:MM)', () => {
      shift.startTime = '25:00'; // Invalid hour

      await expect(shift.save()).rejects.toThrow();
    });

    test('should validate endTime is after startTime', () => {
      shift.startTime = '17:00';
      shift.endTime = '09:00';

      // For non-night shifts, end should be after start
      shift.isNightShift = false;
      await expect(shift.save()).rejects.toThrow();
    });

    test('should allow endTime before startTime for night shifts', () => {
      shift.startTime = '22:00';
      shift.endTime = '06:00';
      shift.isNightShift = true;

      const savedShift = await shift.save();
      expect(savedShift._id).toBeDefined();
    });

    test('should validate grace period range', () => {
      shift.gracePeriod = 60; // Too high

      await expect(shift.save()).rejects.toThrow();
    });

    test('should validate overtime threshold', () => {
      shift.overtimeThreshold = 0; // Must be positive

      await expect(shift.save()).rejects.toThrow();
    });
  });

  describe('Flexible Shifts', () => {
    test('should handle flexible shifts', () => {
      shift.isFlexible = true;
      shift.flexibleWindowStart = '08:00';
      shift.flexibleWindowEnd = '10:00';

      const clockIn = '09:30';
      expect(shift.isLateArrival(clockIn)).toBe(false); // Within flexible window
    });

    test('should reject flexible shift without window', () => {
      shift.isFlexible = true;
      delete shift.flexibleWindowStart;

      await expect(shift.save()).rejects.toThrow();
    });
  });

  describe('Shift Rotation', () => {
    test('should identify rotating shifts', () => {
      shift.isRotating = true;
      shift.rotationType = 'weekly';
      shift.rotationPattern = [1, 2, 3]; // Week 1, 2, 3

      const savedShift = await shift.save();
      expect(savedShift.isRotating).toBe(true);
    });

    test('should get current shift for rotating shift', () => {
      shift.isRotating = true;
      shift.rotationType = 'weekly';
      shift.rotationPattern = [1, 2, 3];

      const currentShift = shift.getCurrentRotationShift();
      expect(currentShift).toBeDefined();
    });
  });

  describe('Shift Scheduling', () => {
    test('should check if day is work day', () => {
      expect(shift.isWorkDay('monday')).toBe(true);
      expect(shift.isWorkDay('saturday')).toBe(false);
      expect(shift.isWorkDay('sunday')).toBe(false);
    });

    test('should handle all weekdays as work days', () => {
      shift.workDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

      expect(shift.isWorkDay('monday')).toBe(true);
      expect(shift.isWorkDay('friday')).toBe(true);
      expect(shift.isWorkDay('saturday')).toBe(false);
    });

    test('should handle 6-day work week', () => {
      shift.workDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      expect(shift.isWorkDay('saturday')).toBe(true);
      expect(shift.isWorkDay('sunday')).toBe(false);
    });
  });

  describe('Shift Status', () => {
    test('should check if shift is active', () => {
      shift.isActive = true;
      shift.effectiveStartDate = new Date('2026-01-01');

      expect(shift.isCurrentlyActive()).toBe(true);
    });

    test('should handle expired shifts', () => {
      shift.isActive = false;
      shift.effectiveEndDate = new Date('2025-12-31');

      expect(shift.isCurrentlyActive()).toBe(false);
    });

    test('should handle future shifts', () => {
      shift.effectiveStartDate = new Date('2026-12-01');

      expect(shift.isCurrentlyActive()).toBe(false);
    });
  });

  describe('Shift Statistics', () => {
    test('should calculate shift statistics', () => {
      shift.totalHours = 8;
      shift.breakMinutes = 30;

      const stats = shift.getStatistics();
      expect(stats.totalHours).toBe(8);
      expect(stats.netWorkHours).toBe(7.5);
      expect(stats.hasLunch).toBe(true);
    });

    test('should calculate overtime rate', () => {
      shift.overtimeRate = 1.5;

      const overtimeHours = 2;
      const overtimePay = shift.calculateOvertimePay(overtimeHours);
      expect(overtimePay).toBe(3); // 2 * 1.5
    });
  });

  describe('Multiple Shifts', () => {
    test('should detect shift conflicts', () => {
      const shift2 = new Shift({
        shiftId: 'SHIFT-002',
        companyId: 'test-company-id',
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '12:00',
        workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      });

      const hasConflict = shift.hasConflict(shift2);
      expect(hasConflict).toBe(true); // Overlaps with 9-5 shift
    });

    test('should not detect conflict for non-overlapping shifts', () => {
      const shift2 = new Shift({
        shiftId: 'SHIFT-002',
        companyId: 'test-company-id',
        name: 'Night Shift',
        startTime: '19:00',
        endTime: '23:00',
        workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      });

      const hasConflict = shift.hasConflict(shift2);
      expect(hasConflict).toBe(false);
    });
  });

  describe('Soft Delete', () => {
    test('should have isDeleted flag default to false', () => {
      expect(shift.isDeleted).toBe(false);
    });

    test('should allow soft delete', async () => {
      shift.isDeleted = true;
      shift.deletedAt = new Date();
      const savedShift = await shift.save();

      expect(savedShift.isDeleted).toBe(true);
      expect(savedShift.deletedAt).toBeDefined();
    });
  });

  describe('Indexes and Performance', () => {
    test('should have unique index on shiftId per company', async () => {
      await shift.save();

      const duplicateShift = new Shift({
        shiftId: 'SHIFT-001', // Same ID
        companyId: 'test-company-id',
        name: 'Duplicate Shift',
        startTime: '10:00',
        endTime: '18:00'
      });

      await expect(duplicateShift.save()).rejects.toThrow();
    });

    test('should allow same shiftId for different companies', async () => {
      await shift.save();

      const anotherCompanyShift = new Shift({
        shiftId: 'SHIFT-001',
        companyId: 'different-company-id',
        name: 'Same ID Different Company',
        startTime: '10:00',
        endTime: '18:00'
      });

      await expect(anotherCompanyShift.save()).resolves.toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero duration shifts', () => {
      shift.startTime = '09:00';
      shift.endTime = '09:00';

      const workHours = shift.calculateWorkHours('09:00', '09:00');
      expect(workHours).toBe(0);
    });

    test('should handle midnight boundary', () => {
      shift.startTime = '00:00';
      shift.endTime = '08:00';

      const workHours = shift.calculateWorkHours('00:00', '08:00');
      expect(workHours).toBeGreaterThan(0);
    });

    test('should handle 24-hour shifts', () => {
      shift.startTime = '00:00';
      shift.endTime = '23:59';

      const workHours = shift.calculateWorkHours('00:00', '23:59');
      expect(workHours).toBeCloseTo(24, 1);
    });
  });
});
