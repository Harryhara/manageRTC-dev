/**
 * Attendance Report Generator
 * Generates attendance reports in various formats (CSV, Excel, PDF)
 * Supports filtering by date range, employee, department, etc.
 */

import { getTenantCollections } from '../config/db.js';

/**
 * Generate attendance report data
 *
 * @param {string} companyId - Company ID
 * @param {Object} filters - Report filters
 * @param {Date} filters.startDate - Start date
 * @param {Date} filters.endDate - End date
 * @param {string} filters.employeeId - Optional employee ID filter
 * @param {string} filters.department - Optional department filter
 * @param {string} filters.status - Optional status filter
 * @returns {Promise<Object>} Report data
 */
export const generateAttendanceReport = async (companyId, filters = {}) => {
  const collections = getTenantCollections(companyId);

  const {
    startDate = new Date(new Date().setDate(1)), // Default to start of current month
    endDate = new Date(), // Default to today
    employeeId = null,
    status = null
  } = filters;

  // Build filter
  const filter = {
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    },
    isDeleted: { $ne: true }
  };

  if (employeeId) {
    filter.employeeId = employeeId;
  }

  if (status) {
    filter.status = status;
  }

  // Get attendance records
  const attendanceRecords = await collections.attendance
    .find(filter)
    .sort({ date: -1, employeeId: 1 })
    .toArray();

  // Get all employees for summary
  const employees = await collections.employees.find({
    companyId,
    isDeleted: { $ne: true }
  }).toArray();

  // Generate summary statistics
  const summary = generateAttendanceSummary(attendanceRecords, employees);

  // Group by employee
  const byEmployee = groupAttendanceByEmployee(attendanceRecords);

  // Group by date
  const byDate = groupAttendanceByDate(attendanceRecords);

  // Group by status
  const byStatus = groupAttendanceByStatus(attendanceRecords);

  return {
    meta: {
      companyId,
      reportType: 'attendance',
      generatedAt: new Date(),
      startDate,
      endDate,
      filters
    },
    summary,
    records: attendanceRecords,
    byEmployee,
    byDate,
    byStatus,
    totalRecords: attendanceRecords.length
  };
};

/**
 * Generate attendance summary statistics
 */
const generateAttendanceSummary = (records, employees) => {
  const summary = {
    totalEmployees: employees.length,
    totalAttendanceDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    halfDays: 0,
    onLeaveDays: 0,
    weekendDays: 0,
    holidayDays: 0,
    totalHoursWorked: 0,
    averageHoursPerDay: 0,
    attendanceRate: 0,
    lateRate: 0,
    absentRate: 0
  };

  for (const record of records) {
    summary.totalAttendanceDays++;

    switch (record.status) {
      case 'present':
        summary.presentDays++;
        break;
      case 'absent':
        summary.absentDays++;
        break;
      case 'late':
        summary.lateDays++;
        break;
      case 'half-day':
        summary.halfDays++;
        break;
      case 'on-leave':
        summary.onLeaveDays++;
        break;
      case 'holiday':
        summary.holidayDays++;
        break;
      case 'weekend':
        summary.weekendDays++;
        break;
    }

    summary.totalHoursWorked += record.workHours || 0;
  }

  // Calculate averages and rates
  const workingDays = summary.presentDays + summary.lateDays + summary.halfDays + summary.absentDays;
  if (workingDays > 0) {
    summary.averageHoursPerDay = summary.totalHoursWorked / workingDays;
    summary.attendanceRate = ((summary.presentDays + summary.halfDays * 0.5) / workingDays) * 100;
    summary.lateRate = (summary.lateDays / workingDays) * 100;
    summary.absentRate = (summary.absentDays / workingDays) * 100;
  }

  return summary;
};

/**
 * Group attendance records by employee
 */
const groupAttendanceByEmployee = (records) => {
  const grouped = {};

  for (const record of records) {
    const empId = record.employeeId;

    if (!grouped[empId]) {
      grouped[empId] = {
        employeeId: empId,
        employeeName: record.employeeName || 'Unknown',
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        halfDays: 0,
        onLeaveDays: 0,
        totalHours: 0,
        records: []
      };
    }

    grouped[empId].totalDays++;
    grouped[empId].totalHours += record.workHours || 0;

    switch (record.status) {
      case 'present':
        grouped[empId].presentDays++;
        break;
      case 'absent':
        grouped[empId].absentDays++;
        break;
      case 'late':
        grouped[empId].lateDays++;
        break;
      case 'half-day':
        grouped[empId].halfDays++;
        break;
      case 'on-leave':
        grouped[empId].onLeaveDays++;
        break;
    }

    grouped[empId].records.push(record);
  }

  return Object.values(grouped);
};

/**
 * Group attendance records by date
 */
const groupAttendanceByDate = (records) => {
  const grouped = {};

  for (const record of records) {
    const dateKey = new Date(record.date).toISOString().split('T')[0];

    if (!grouped[dateKey]) {
      grouped[dateKey] = {
        date: dateKey,
        totalEmployees: 0,
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        onLeave: 0
      };
    }

    grouped[dateKey].totalEmployees++;

    switch (record.status) {
      case 'present':
        grouped[dateKey].present++;
        break;
      case 'absent':
        grouped[dateKey].absent++;
        break;
      case 'late':
        grouped[dateKey].late++;
        break;
      case 'half-day':
        grouped[dateKey].halfDay++;
        break;
      case 'on-leave':
        grouped[dateKey].onLeave++;
        break;
    }
  }

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Group attendance records by status
 */
const groupAttendanceByStatus = (records) => {
  const grouped = {
    present: 0,
    absent: 0,
    late: 0,
    'half-day': 0,
    'on-leave': 0,
    holiday: 0,
    weekend: 0
  };

  for (const record of records) {
    if (grouped[record.status] !== undefined) {
      grouped[record.status]++;
    }
  }

  return Object.entries(grouped).map(([status, count]) => ({ status, count }));
};

/**
 * Convert report data to CSV format
 *
 * @param {Object} reportData - Report data from generateAttendanceReport
 * @returns {string} CSV formatted string
 */
export const convertToCSV = (reportData) => {
  const headers = [
    'Date',
    'Employee ID',
    'Employee Name',
    'Status',
    'Clock In',
    'Clock Out',
    'Work Hours',
    'Overtime Hours',
    'Late Minutes'
  ];

  const rows = reportData.records.map(record => [
    formatDate(record.date),
    record.employeeId || '',
    record.employeeName || 'Unknown',
    record.status || '',
    record.clockIn?.time ? formatDateTime(record.clockIn.time) : '',
    record.clockOut?.time ? formatDateTime(record.clockOut.time) : '',
    record.workHours?.toFixed(2) || '0',
    record.overtimeHours?.toFixed(2) || '0',
    record.lateMinutes || 0
  ]);

  // Add summary row
  rows.push([]);
  rows.push(['SUMMARY', '', '', '', '', '', '', '', '']);
  rows.push([
    'Total Records',
    reportData.totalRecords,
    '',
    'Present',
    reportData.summary.presentDays,
    'Absent',
    reportData.summary.absentDays,
    'Late',
    reportData.summary.lateDays
  ]);

  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
};

/**
 * Convert report data to Excel format (JSON)
 *
 * @param {Object} reportData - Report data from generateAttendanceReport
 * @returns {Object} Excel formatted data
 */
export const convertToExcel = (reportData) => {
  return {
    worksheets: [
      {
        name: 'Attendance Summary',
        data: [
          ['Metric', 'Value'],
          ['Report Generated', formatDateTime(reportData.meta.generatedAt)],
          ['Date Range', `${formatDate(reportData.meta.startDate)} - ${formatDate(reportData.meta.endDate)}`],
          [''],
          ['Total Employees', reportData.summary.totalEmployees],
          ['Total Attendance Days', reportData.summary.totalAttendanceDays],
          ['Present Days', reportData.summary.presentDays],
          ['Absent Days', reportData.summary.absentDays],
          ['Late Days', reportData.summary.lateDays],
          ['Half Days', reportData.summary.halfDays],
          ['On Leave Days', reportData.summary.onLeaveDays],
          ['Total Hours Worked', reportData.summary.totalHoursWorked.toFixed(2)],
          ['Average Hours/Day', reportData.summary.averageHoursPerDay.toFixed(2)],
          ['Attendance Rate', `${reportData.summary.attendanceRate.toFixed(2)}%`],
          ['Late Rate', `${reportData.summary.lateRate.toFixed(2)}%`]
        ]
      },
      {
        name: 'By Employee',
        data: [
          ['Employee ID', 'Employee Name', 'Total Days', 'Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Total Hours'],
          ...reportData.byEmployee.map(emp => [
            emp.employeeId,
            emp.employeeName,
            emp.totalDays,
            emp.presentDays,
            emp.absentDays,
            emp.lateDays,
            emp.halfDays,
            emp.onLeaveDays,
            emp.totalHours.toFixed(2)
          ])
        ]
      },
      {
        name: 'By Date',
        data: [
          ['Date', 'Total Employees', 'Present', 'Absent', 'Late', 'Half Day', 'On Leave'],
          ...reportData.byDate.map(date => [
            date.date,
            date.totalEmployees,
            date.present,
            date.absent,
            date.late,
            date.halfDay,
            date.onLeave
          ])
        ]
      }
    ]
  };
};

/**
 * Convert report data to PDF format (JSON structure for PDF generation)
 *
 * @param {Object} reportData - Report data from generateAttendanceReport
 * @returns {Object} PDF formatted data
 */
export const convertToPDF = (reportData) => {
  return {
    title: 'Attendance Report',
    meta: reportData.meta,
    summary: reportData.summary,
    tables: [
      {
        title: 'Summary Statistics',
        headers: ['Metric', 'Value'],
        rows: [
          ['Report Generated', formatDateTime(reportData.meta.generatedAt)],
          ['Date Range', `${formatDate(reportData.meta.startDate)} - ${formatDate(reportData.meta.endDate)}`],
          ['Total Employees', reportData.summary.totalEmployees],
          ['Present Days', reportData.summary.presentDays],
          ['Absent Days', reportData.summary.absentDays],
          ['Late Days', reportData.summary.lateDays],
          ['Total Hours Worked', reportData.summary.totalHoursWorked.toFixed(2)],
          ['Attendance Rate', `${reportData.summary.attendanceRate.toFixed(2)}%`]
        ]
      },
      {
        title: 'Attendance by Employee',
        headers: ['Employee', 'Total Days', 'Present', 'Absent', 'Late', 'On Leave', 'Hours'],
        rows: reportData.byEmployee.map(emp => [
          emp.employeeName,
          emp.totalDays,
          emp.presentDays,
          emp.absentDays,
          emp.lateDays,
          emp.onLeaveDays,
          emp.totalHours.toFixed(2)
        ])
      }
    ]
  };
};

/**
 * Helper: Format date to readable string
 */
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Helper: Format datetime to readable string
 */
const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Generate employee attendance report for individual employee
 *
 * @param {string} companyId - Company ID
 * @param {string} employeeId - Employee ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Employee attendance report
 */
export const generateEmployeeAttendanceReport = async (companyId, employeeId, startDate, endDate) => {
  const reportData = await generateAttendanceReport(companyId, {
    startDate,
    endDate,
    employeeId
  });

  const employeeData = reportData.byEmployee.find(emp => emp.employeeId === employeeId);

  return {
    ...reportData,
    employeeData,
    title: `Attendance Report - ${employeeData?.employeeName || 'Employee'}`,
    subtitle: `${formatDate(startDate)} to ${formatDate(endDate)}`
  };
};

export default {
  generateAttendanceReport,
  generateEmployeeAttendanceReport,
  convertToCSV,
  convertToExcel,
  convertToPDF
};
