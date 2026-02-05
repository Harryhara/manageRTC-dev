/**
 * Timezone Utility Tests
 * Tests for timezone conversion and attendance time calculations
 */

import { DateTime } from 'luxon';
import {
  convertToTimeZone,
  getStartOfDayInTimeZone,
  getEndOfDayInTimeZone,
  isSameDayInTimeZone,
  calculateWorkDuration,
  checkBusinessHours,
  isLateArrival,
  isEarlyDeparture,
  convertLocalToUTC,
  convertUTCToLocal,
  getCurrentTimeInTimeZone,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  isValidTimeZone,
  getBusinessHoursRange,
  calculateOverlapDuration,
  isBusinessDay,
  getNextBusinessDay,
  getPreviousBusinessDay
} from '../utils/timezoneUtils.js';

describe('Timezone Utilities', () => {
  describe('Timezone Conversion', () => {
    test('should convert UTC date to target timezone', () => {
      const utcDate = new Date('2026-01-28T14:00:00Z'); // 2 PM UTC
      const estDate = convertToTimeZone(utcDate, 'America/New_York');

      // EST is UTC-5, so 2 PM UTC = 9 AM EST
      expect(estDate.getHours()).toBe(9);
    });

    test('should handle invalid timezone gracefully', () => {
      const utcDate = new Date('2026-01-28T14:00:00Z');
      const result = convertToTimeZone(utcDate, 'Invalid/Timezone');

      // Should return original date on error
      expect(result).toEqual(utcDate);
    });

    test('should convert local date to UTC', () => {
      const localDate = new Date('2026-01-28T09:00:00');
      const utcDate = convertLocalToUTC(localDate, 'America/New_York');

      expect(utcDate).toBeDefined();
      expect(utcDate.toISOString()).toBeDefined();
    });

    test('should convert UTC date to local', () => {
      const utcDate = new Date('2026-01-28T14:00:00Z');
      const localDate = convertUTCToLocal(utcDate, 'America/New_York');

      expect(localDate).toBeDefined();
    });
  });

  describe('Day Boundary Calculations', () => {
    test('should get start of day in timezone', () => {
      const date = new Date('2026-01-28T14:00:00Z');
      const startOfDay = getStartOfDayInTimeZone(date, 'America/New_York');

      expect(startOfDay.getHours()).toBe(0);
      expect(startOfDay.getMinutes()).toBe(0);
      expect(startOfDay.getSeconds()).toBe(0);
    });

    test('should get end of day in timezone', () => {
      const date = new Date('2026-01-28T14:00:00Z');
      const endOfDay = getEndOfDayInTimeZone(date, 'America/New_York');

      expect(endOfDay.getHours()).toBe(23);
      expect(endOfDay.getMinutes()).toBe(59);
      expect(endOfDay.getSeconds()).toBe(59);
    });

    test('should check if dates are same day in timezone', () => {
      const date1 = new Date('2026-01-28T10:00:00Z');
      const date2 = new Date('2026-01-28T20:00:00Z');

      expect(isSameDayInTimeZone(date1, date2, 'America/New_York')).toBe(true);

      const date3 = new Date('2026-01-29T10:00:00Z');
      expect(isSameDayInTimeZone(date1, date3, 'America/New_York')).toBe(false);
    });
  });

  describe('Work Duration Calculations', () => {
    test('should calculate work duration in hours', () => {
      const clockIn = new Date('2026-01-28T09:00:00Z');
      const clockOut = new Date('2026-01-28T17:00:00Z');

      const duration = calculateWorkDuration(clockIn, clockOut);
      expect(duration).toBe(8); // 8 hours
    });

    test('should calculate work duration with break', () => {
      const clockIn = new Date('2026-01-28T09:00:00Z');
      const clockOut = new Date('2026-01-28T17:30:00Z');
      const breakMinutes = 30;

      const duration = calculateWorkDuration(clockIn, clockOut, breakMinutes);
      expect(duration).toBe(8); // 8.5 hours - 30 min break = 8 hours
    });

    test('should return 0 for missing clock times', () => {
      expect(calculateWorkDuration(null, new Date())).toBe(0);
      expect(calculateWorkDuration(new Date(), null)).toBe(0);
    });

    test('should handle overnight shifts', () => {
      const clockIn = new Date('2026-01-28T22:00:00Z'); // 10 PM
      const clockOut = new Date('2026-01-29T06:00:00Z'); // 6 AM next day

      const duration = calculateWorkDuration(clockIn, clockOut);
      expect(duration).toBe(8); // 8 hours overnight
    });
  });

  describe('Business Hours Checks', () => {
    const businessHours = {
      start: '09:00',
      end: '17:00',
      timezone: 'America/New_York'
    };

    test('should detect time within business hours', () => {
      const withinHours = new Date('2026-01-28T14:00:00Z'); // 9 AM EST = 2 PM UTC
      expect(checkBusinessHours(withinHours, businessHours)).toBe(true);
    });

    test('should detect time outside business hours (before)', () => {
      const beforeHours = new Date('2026-01-28T12:00:00Z'); // 7 AM EST = 12 PM UTC
      expect(checkBusinessHours(beforeHours, businessHours)).toBe(false);
    });

    test('should detect time outside business hours (after)', () => {
      const afterHours = new Date('2026-01-28T23:00:00Z'); // 6 PM EST = 11 PM UTC
      expect(checkBusinessHours(afterHours, businessHours)).toBe(false);
    });

    test('should get business hours range for a date', () => {
      const date = new Date('2026-01-28');
      const range = getBusinessHoursRange(date, businessHours);

      expect(range.start).toBeDefined();
      expect(range.end).toBeDefined();
      expect(range.end.getTime() - range.start.getTime()).toBe(8 * 60 * 60 * 1000); // 8 hours
    });
  });

  describe('Late Arrival & Early Departure', () => {
    const shiftStart = '09:00';
    const shiftEnd = '17:00';
    const gracePeriod = 15; // 15 minutes grace period

    test('should detect late arrival', () => {
      const onTime = new Date('2026-01-28T14:00:00Z'); // 9 AM EST
      expect(isLateArrival(onTime, shiftStart, gracePeriod, 'America/New_York')).toBe(false);

      const late = new Date('2026-01-28T14:20:00Z'); // 9:20 AM EST
      expect(isLateArrival(late, shiftStart, gracePeriod, 'America/New_York')).toBe(true);
    });

    test('should allow grace period for late arrival', () => {
      const atGraceLimit = new Date('2026-01-28T14:15:00Z'); // 9:15 AM EST
      expect(isLateArrival(atGraceLimit, shiftStart, gracePeriod, 'America/New_York')).toBe(false);
    });

    test('should detect early departure', () => {
      const onTime = new Date('2026-01-28T22:00:00Z'); // 5 PM EST
      expect(isEarlyDeparture(onTime, shiftEnd, 0, 'America/New_York')).toBe(false);

      const early = new Date('2026-01-28T21:30:00Z'); // 4:30 PM EST
      expect(isEarlyDeparture(early, shiftEnd, 0, 'America/New_York')).toBe(true);
    });

    test('should handle grace period for early departure', () => {
      const atGraceLimit = new Date('2026-01-28T21:45:00Z'); // 4:45 PM EST
      expect(isEarlyDeparture(atGraceLimit, shiftEnd, 15, 'America/New_York')).toBe(false);
    });
  });

  describe('Time Formatting', () => {
    test('should get current time in timezone', () => {
      const currentTime = getCurrentTimeInTimeZone('America/New_York');
      expect(currentTime).toBeInstanceOf(Date);
    });

    test('should format date in timezone', () => {
      const date = new Date('2026-01-28T14:00:00Z');
      const formatted = formatDateInTimeZone(date, 'America/New_York');

      expect(formatted).toContain('2026');
      expect(formatted).toContain('January');
    });

    test('should format time in timezone', () => {
      const date = new Date('2026-01-28T14:00:00Z');
      const formatted = formatTimeInTimeZone(date, 'America/New_York');

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Timezone Validation', () => {
    test('should validate correct timezone', () => {
      expect(isValidTimeZone('America/New_York')).toBe(true);
      expect(isValidTimeZone('Europe/London')).toBe(true);
      expect(isValidTimeZone('Asia/Tokyo')).toBe(true);
    });

    test('should reject invalid timezone', () => {
      expect(isValidTimeZone('Invalid/Timezone')).toBe(false);
      expect(isValidTimeZone('')).toBe(false);
      expect(isValidTimeZone(null)).toBe(false);
    });
  });

  describe('Business Day Calculations', () => {
    test('should identify weekdays as business days', () => {
      const monday = new Date('2026-01-26'); // Monday
      expect(isBusinessDay(monday, 'America/New_York')).toBe(true);

      const saturday = new Date('2026-01-31'); // Saturday
      expect(isBusinessDay(saturday, 'America/New_York')).toBe(false);
    });

    test('should get next business day', () => {
      const friday = new Date('2026-01-31'); // Friday
      const nextBusinessDay = getNextBusinessDay(friday, 'America/New_York');

      // Should be Monday (skipping weekend)
      expect(nextBusinessDay.getDay()).toBe(1); // Monday
    });

    test('should get previous business day', () => {
      const monday = new Date('2026-01-26'); // Monday
      const prevBusinessDay = getPreviousBusinessDay(monday, 'America/New_York');

      expect(prevBusinessDay.getDay()).toBe(5); // Friday
    });
  });

  describe('Duration Overlap', () => {
    test('should calculate overlap between two time ranges', () => {
      const range1 = { start: new Date('2026-01-28T09:00:00Z'), end: new Date('2026-01-28T17:00:00Z') };
      const range2 = { start: new Date('2026-01-28T10:00:00Z'), end: new Date('2026-01-28T15:00:00Z') };

      const overlap = calculateOverlapDuration(range1, range2);
      expect(overlap).toBe(5 * 60 * 60 * 1000); // 5 hours in milliseconds
    });

    test('should return 0 for non-overlapping ranges', () => {
      const range1 = { start: new Date('2026-01-28T09:00:00Z'), end: new Date('2026-01-28T12:00:00Z') };
      const range2 = { start: new Date('2026-01-28T13:00:00Z'), end: new Date('2026-01-28T17:00:00Z') };

      const overlap = calculateOverlapDuration(range1, range2);
      expect(overlap).toBe(0);
    });

    test('should handle contained ranges', () => {
      const range1 = { start: new Date('2026-01-28T09:00:00Z'), end: new Date('2026-01-28T17:00:00Z') };
      const range2 = { start: new Date('2026-01-28T10:00:00Z'), end: new Date('2026-01-28T11:00:00Z') };

      const overlap = calculateOverlapDuration(range1, range2);
      expect(overlap).toBe(1 * 60 * 60 * 1000); // 1 hour
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined inputs gracefully', () => {
      expect(convertToTimeZone(null)).toBeNull();
      expect(convertToTimeZone(undefined)).toBeNull();
    });

    test('should handle invalid date inputs', () => {
      const invalidDate = new Date('invalid');
      const result = convertToTimeZone(invalidDate, 'America/New_York');

      // Should handle invalid dates gracefully
      expect(result).toBeDefined();
    });

    test('should handle date string inputs', () => {
      const dateString = '2026-01-28T14:00:00Z';
      const result = convertToTimeZone(dateString, 'America/New_York');

      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('Multiple Timezones', () => {
    const testDate = new Date('2026-01-28T14:00:00Z'); // 2 PM UTC

    test('should convert to multiple timezones correctly', () => {
      const nyTime = convertToTimeZone(testDate, 'America/New_York');
      const londonTime = convertToTimeZone(testDate, 'Europe/London');
      const tokyoTime = convertToTimeZone(testDate, 'Asia/Tokyo');

      // Each timezone should have different hour offset
      expect(nyTime.getHours()).not.toBe(londonTime.getHours());
    });

    test('should handle DST transitions', () => {
      // Test during potential DST transition
      const dstDate = new Date('2026-03-08T12:00:00Z'); // Near DST start
      const converted = convertToTimeZone(dstDate, 'America/New_York');

      expect(converted).toBeInstanceOf(Date);
    });
  });
});
