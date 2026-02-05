# Phase 4: Advanced Features Implementation Plan

## Overview
This document outlines the implementation of advanced features for the Leave Module, building upon Phases 1-3 (REST API integration, employee/leave type data, and real-time notifications).

---

## Feature 1: File Upload for Attachments

### Purpose
Allow employees to upload supporting documents (medical certificates, proof of emergency, etc.) when submitting leave requests.

### Backend Components

#### 1.1 Multer Configuration
**File**: `backend/config/multer.config.js`
```javascript
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/leave-attachments/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    cb(null, `leave-${req.params.leaveId || 'temp'}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and images (JPEG, PNG) are allowed.'), false);
  }
};

export const uploadConfig = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter
});
```

#### 1.2 Upload Endpoint
**File**: `backend/controllers/rest/leave.controller.js`
```javascript
/**
 * Upload attachment for leave request
 */
export const uploadAttachment = asyncHandler(async (req, res) => {
  const { leaveId } = req.params;
  const user = extractUser(req);

  const leave = await Leave.findOne({
    leaveId: leaveId,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!leave) {
    throw new ApiError(404, 'Leave request not found');
  }

  if (leave.employeeId !== user.employeeId && user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to upload attachments for this leave');
  }

  if (!req.file) {
    throw new ApiError(400, 'No file uploaded');
  }

  const attachment = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    url: `/uploads/leave-attachments/${req.file.filename}`,
    uploadedAt: new Date()
  };

  leave.attachments = leave.attachments || [];
  leave.attachments.push(attachment);
  await leave.save();

  // Broadcast event
  broadcastToCompany(io, user.companyId, 'leave:attachment_uploaded', {
    leaveId: leave.leaveId,
    attachment,
    uploadedBy: user.employeeId
  });

  res.status(200).json({
    success: true,
    data: attachment,
    message: 'Attachment uploaded successfully'
  });
});

/**
 * Delete attachment from leave request
 */
export const deleteAttachment = asyncHandler(async (req, res) => {
  const { leaveId, attachmentId } = req.params;
  const user = extractUser(req);

  const leave = await Leave.findOne({
    leaveId: leaveId,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!leave) {
    throw new ApiError(404, 'Leave request not found');
  }

  if (leave.employeeId !== user.employeeId && user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to delete attachments from this leave');
  }

  const attachmentIndex = leave.attachments.findIndex(a => a._id.toString() === attachmentId);
  if (attachmentIndex === -1) {
    throw new ApiError(404, 'Attachment not found');
  }

  // Delete file from filesystem
  const fs = await import('fs');
  const filePath = path.join(process.cwd(), 'public', leave.attachments[attachmentIndex].url);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  leave.attachments.splice(attachmentIndex, 1);
  await leave.save();

  res.status(200).json({
    success: true,
    message: 'Attachment deleted successfully'
  });
});
```

#### 1.3 Route Registration
**File**: `backend/routes/api/leaves.js`
```javascript
import { uploadConfig } from '../../config/multer.config.js';

router.post('/:leaveId/attachments',
  authenticateUser,
  uploadConfig.single('attachment'),
  leaveController.uploadAttachment
);

router.delete('/:leaveId/attachments/:attachmentId',
  authenticateUser,
  leaveController.deleteAttachment
);

router.get('/:leaveId/attachments',
  authenticateUser,
  leaveController.getAttachments
);
```

### Frontend Components

#### 1.4 Upload Component
**File**: `react/src/components/leave/AttachmentUpload.tsx`
```typescript
import { Upload, Button, message, List, Typography, Space, Popconfirm } from 'antd';
import { UploadOutlined, DeleteOutlined, FileOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useState } from 'react';

interface Attachment {
  _id: string;
  filename: string;
  originalName: string;
  url: string;
  uploadedAt: string;
}

interface AttachmentUploadProps {
  leaveId?: string;
  attachments?: Attachment[];
  onUploadComplete?: (attachment: Attachment) => void;
  onDeleteComplete?: (attachmentId: string) => void;
  readonly?: boolean;
}

export const AttachmentUpload: React.FC<AttachmentUploadProps> = ({
  leaveId,
  attachments = [],
  onUploadComplete,
  onDeleteComplete,
  readonly = false
}) => {
  const [uploading, setUploading] = useState(false);

  const uploadProps: UploadProps = {
    name: 'attachment',
    action: `${process.env.REACT_APP_BACKEND_URL}/api/leaves/${leaveId}/attachments`,
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    accept: '.pdf,.jpg,.jpeg,.png',
    maxCount: 5,
    beforeUpload: (file) => {
      const isValidType = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
        .includes(file.type);
      if (!isValidType) {
        message.error('Only PDF and images (JPEG, PNG) are allowed');
        return false;
      }
      const isValidSize = file.size / 1024 / 1024 < 5;
      if (!isValidSize) {
        message.error('File must be smaller than 5MB');
        return false;
      }
      return true;
    },
    onChange: (info) => {
      if (info.file.status === 'uploading') {
        setUploading(true);
      }
      if (info.file.status === 'done') {
        setUploading(false);
        message.success('File uploaded successfully');
        onUploadComplete?.(info.file.response.data);
      } else if (info.file.status === 'error') {
        setUploading(false);
        message.error('Upload failed');
      }
    },
    disabled: readonly
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/leaves/${leaveId}/attachments/${attachmentId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      message.success('Attachment deleted');
      onDeleteComplete?.(attachmentId);
    } catch (error) {
      message.error('Failed to delete attachment');
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {!readonly && (
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />} loading={uploading}>
            Upload Attachment
          </Button>
        </Upload>
      )}

      {attachments.length > 0 && (
        <List
          dataSource={attachments}
          renderItem={(item) => (
            <List.Item
              actions={
                !readonly ? [
                  <Popconfirm
                    key="delete"
                    title="Delete this attachment?"
                    onConfirm={() => handleDelete(item._id)}
                  >
                    <Button type="link" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ] : []
              }
            >
              <List.Item.Meta
                avatar={<FileOutlined />}
                title={
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.originalName}
                  </a>
                }
                description={`Uploaded: ${new Date(item.uploadedAt).toLocaleString()}`}
              />
            </List.Item>
          )}
        />
      )}
    </Space>
  );
};
```

---

## Feature 2: Holiday Calendar Integration

### Purpose
Accurately calculate leave duration excluding holidays and weekends, ensuring correct balance deductions.

### Backend Components

#### 2.1 Holiday Schema
**File**: `backend/models/holiday/holiday.schema.js`
```javascript
import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  holidayId: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  date: { type: Date, required: true },
  type: {
    type: String,
    enum: ['public', 'company', 'optional'],
    default: 'public'
  },
  isRecurring: { type: Boolean, default: false },
  recurringDay: { type: Number }, // Day of month (1-31)
  recurringMonth: { type: Number }, // Month (1-12)
  applicableStates: [String], // For region-specific holidays
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient date range queries
holidaySchema.index({ companyId: 1, date: 1, isDeleted: 1 });

// Static method to get holidays in date range
holidaySchema.statics.getHolidaysInRange = function(companyId, startDate, endDate) {
  return this.find({
    companyId,
    date: { $gte: startDate, $lte: endDate },
    isActive: true,
    isDeleted: false
  }).sort({ date: 1 });
};

export default mongoose.model('Holiday', holidaySchema);
```

#### 2.2 Working Day Calculator Utility
**File**: `backend/utils/workingDaysCalculator.js`
```javascript
import Holiday from '../models/holiday/holiday.schema.js';
import { getCompanySettings } from './companySettings.js';

/**
 * Calculate working days between two dates excluding weekends and holidays
 */
export const calculateWorkingDays = async (companyId, startDate, endDate, state = null) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Get company settings for weekend configuration
  const settings = await getCompanySettings(companyId);
  const weekendDays = settings?.weekendDays || [0, 6]; // Default: Sunday(0), Saturday(6)

  // Get holidays in the date range
  const holidays = await Holiday.getHolidaysInRange(companyId, start, end);
  const holidayDates = new Set(
    holidays
      .filter(h => !state || h.applicableStates?.includes(state) || h.type === 'public')
      .map(h => h.date.toISOString().split('T')[0])
  );

  let workingDays = 0;
  let totalDays = 0;
  const dates = [];

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    totalDays++;
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split('T')[0];

    const isWeekend = weekendDays.includes(dayOfWeek);
    const isHoliday = holidayDates.has(dateStr);

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }

    dates.push({
      date: new Date(date),
      isWeekend,
      isHoliday,
      isWorkingDay: !isWeekend && !isHoliday,
      holidayName: isHoliday ? holidays.find(h => h.date.toISOString().split('T')[0] === dateStr)?.name : null
    });
  }

  return {
    startDate: start,
    endDate: end,
    totalDays,
    workingDays,
    weekendDays: totalDays - workingDays - holidayDates.size,
    holidayCount: holidayDates.size,
    dates
  };
};

/**
 * Validate leave request dates
 */
export const validateLeaveDates = async (companyId, startDate, endDate, employeeId) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if dates are valid
  if (start > end) {
    throw new Error('Start date cannot be after end date');
  }

  // Check if start date is in the past (unless allowed by policy)
  if (start < today) {
    throw new Error('Cannot request leave for past dates');
  }

  // Calculate working days
  const workingDaysInfo = await calculateWorkingDays(companyId, startDate, endDate);

  if (workingDaysInfo.workingDays === 0) {
    throw new Error('No working days in the selected date range');
  }

  return workingDaysInfo;
};
```

#### 2.3 Holiday Controller
**File**: `backend/controllers/rest/holiday.controller.js`
```javascript
import Holiday from '../../models/holiday/holiday.schema.js';
import { generateId } from '../../utils/idGenerator.js';
import asyncHandler from 'express-async-handler';
import { ApiError } from '../../utils/apiError.js';

/**
 * Get all holidays for a company
 */
export const getHolidays = asyncHandler(async (req, res) => {
  const { year, month, type } = req.query;
  const user = extractUser(req);

  const filter = {
    companyId: user.companyId,
    isActive: true,
    isDeleted: false
  };

  if (year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    filter.date = { $gte: startDate, $lte: endDate };
  }

  if (month) {
    const startDate = new Date(year || new Date().getFullYear(), month - 1, 1);
    const endDate = new Date(year || new Date().getFullYear(), month, 0);
    filter.date = { $gte: startDate, $lte: endDate };
  }

  if (type) {
    filter.type = type;
  }

  const holidays = await Holiday.find(filter).sort({ date: 1 });

  res.status(200).json({
    success: true,
    data: holidays,
    count: holidays.length
  });
});

/**
 * Create new holiday
 */
export const createHoliday = asyncHandler(async (req, res) => {
  const user = extractUser(req);
  const holidayData = req.body;

  const holiday = new Holiday({
    holidayId: generateId('HLD', user.companyId),
    companyId: user.companyId,
    ...holidayData
  });

  await holiday.save();

  // Broadcast event
  broadcastToCompany(io, user.companyId, 'holiday:created', holiday);

  res.status(201).json({
    success: true,
    data: holiday,
    message: 'Holiday created successfully'
  });
});

/**
 * Update holiday
 */
export const updateHoliday = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  const holiday = await Holiday.findOne({
    holidayId: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!holiday) {
    throw new ApiError(404, 'Holiday not found');
  }

  Object.assign(holiday, req.body);
  holiday.updatedAt = new Date();
  await holiday.save();

  // Broadcast event
  broadcastToCompany(io, user.companyId, 'holiday:updated', holiday);

  res.status(200).json({
    success: true,
    data: holiday,
    message: 'Holiday updated successfully'
  });
});

/**
 * Delete holiday
 */
export const deleteHoliday = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = extractUser(req);

  const holiday = await Holiday.findOne({
    holidayId: id,
    companyId: user.companyId,
    isDeleted: false
  });

  if (!holiday) {
    throw new ApiError(404, 'Holiday not found');
  }

  holiday.isDeleted = true;
  holiday.updatedAt = new Date();
  await holiday.save();

  // Broadcast event
  broadcastToCompany(io, user.companyId, 'holiday:deleted', { holidayId: id });

  res.status(200).json({
    success: true,
    message: 'Holiday deleted successfully'
  });
});

/**
 * Calculate working days for a date range
 */
export const calculateDays = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.body;
  const user = extractUser(req);

  const result = await calculateWorkingDays(
    user.companyId,
    new Date(startDate),
    new Date(endDate),
    user.state
  );

  res.status(200).json({
    success: true,
    data: result
  });
});
```

### Frontend Components

#### 2.4 Date Range Calculator Component
**File**: `react/src/components/leave/DateRangeCalculator.tsx`
```typescript
import { useState, useEffect } from 'react';
import { DatePicker, Spin, Alert, Statistic, Row, Col } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { calculateDays } from '../../hooks/useHolidayREST';

interface DateRangeCalculatorProps {
  value?: { startDate: string; endDate: string };
  onChange?: (dates: { startDate: string; endDate: string; workingDays: number }) => void;
  disabled?: boolean;
}

export const DateRangeCalculator: React.FC<DateRangeCalculatorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const [calculating, setCalculating] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(value?.startDate ? dayjs(value.startDate) : null);
  const [endDate, setEndDate] = useState<Dayjs | null>(value?.endDate ? dayjs(value.endDate) : null);
  const [calculation, setCalculation] = useState<any>(null);

  useEffect(() => {
    if (startDate && endDate) {
      performCalculation();
    }
  }, [startDate, endDate]);

  const performCalculation = async () => {
    if (!startDate || !endDate) return;

    setCalculating(true);
    try {
      const result = await calculateDays({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      setCalculation(result);
      onChange?.({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        workingDays: result.workingDays
      });
    } catch (error) {
      console.error('Calculation error:', error);
    } finally {
      setCalculating(false);
    }
  };

  const disabledDate = (current: Dayjs) => {
    return current && current < dayjs().startOf('day');
  };

  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            disabledDate={disabledDate}
            disabled={disabled}
            style={{ width: '100%' }}
            placeholder="Start Date"
          />
        </Col>
        <Col span={12}>
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            disabledDate={(current) => disabledDate(current) || (startDate && current < startDate)}
            disabled={disabled || !startDate}
            style={{ width: '100%' }}
            placeholder="End Date"
          />
        </Col>
      </Row>

      {calculating && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Spin size="small" /> Calculating working days...
        </div>
      )}

      {calculation && (
        <div style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic title="Total Days" value={calculation.totalDays} />
            </Col>
            <Col span={8}>
              <Statistic title="Working Days" value={calculation.workingDays} suffix="days" />
            </Col>
            <Col span={8}>
              <Statistic title="Holidays/Weekends" value={calculation.holidayCount + calculation.weekendDays} />
            </Col>
          </Row>

          {calculation.holidayCount > 0 && (
            <Alert
              message={`${calculation.holidayCount} holiday(s) in this period`}
              description={calculation.dates
                .filter((d: any) => d.isHoliday)
                .map((d: any) => `${dayjs(d.date).format('MMM DD')}: ${d.holidayName}`)
                .join(', ')}
              type="info"
              style={{ marginTop: 12 }}
            />
          )}
        </div>
      )}
    </div>
  );
};
```

---

## Feature 3: Advanced Validations

### 3.1 Leave Request Validation Service
**File**: `backend/services/leaveValidation.js`
```javascript
import Leave from '../models/leave/leave.schema.js';
import LeaveType from '../models/leave/leaveType.schema.js';
import { calculateWorkingDays } from '../utils/workingDaysCalculator.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Comprehensive leave request validation
 */
export const validateLeaveRequest = async (req) => {
  const { employeeId, leaveType: leaveTypeCode, startDate, endDate, duration } = req.body;
  const user = extractUser(req);

  // 1. Check if employee exists
  const employee = await Employee.findOne({
    employeeId,
    companyId: user.companyId
  });
  if (!employee) {
    throw new ApiError(404, 'Employee not found');
  }

  // 2. Validate leave type
  const leaveTypeConfig = await LeaveType.getActiveTypes(user.companyId)
    .then(types => types.find(t => t.code === leaveTypeCode));

  if (!leaveTypeConfig) {
    throw new ApiError(400, 'Invalid leave type');
  }

  // 3. Calculate and validate duration
  const workingDaysInfo = await calculateWorkingDays(
    user.companyId,
    new Date(startDate),
    new Date(endDate),
    employee.state
  );

  if (workingDaysInfo.workingDays === 0) {
    throw new ApiError(400, 'No working days in selected date range');
  }

  // Check if duration matches calculated working days
  if (duration && duration !== workingDaysInfo.workingDays) {
    throw new ApiError(400, `Duration should be ${workingDaysInfo.workingDays} working days`);
  }

  // 4. Check minimum notice period
  if (leaveTypeConfig.minNoticeDays > 0) {
    const minNoticeDate = new Date();
    minNoticeDate.setDate(minNoticeDate.getDate() + leaveTypeConfig.minNoticeDays);

    if (new Date(startDate) < minNoticeDate) {
      throw new ApiError(400,
        `${leaveTypeConfig.name} requires ${leaveTypeConfig.minNoticeDays} days advance notice`
      );
    }
  }

  // 5. Check maximum consecutive days
  if (leaveTypeConfig.maxConsecutiveDays > 0 &&
      workingDaysInfo.workingDays > leaveTypeConfig.maxConsecutiveDays) {
    throw new ApiError(400,
      `Cannot take more than ${leaveTypeConfig.maxConsecutiveDays} consecutive days for ${leaveTypeConfig.name}`
    );
  }

  // 6. Check leave balance
  const currentBalance = await LeaveBalance.findOne({
    employeeId,
    companyId: user.companyId,
    leaveType: leaveTypeCode
  });

  const balance = currentBalance?.balance || 0;
  const pendingUsage = await Leave.aggregate([
    {
      $match: {
        employeeId,
        companyId: user.companyId,
        leaveType: leaveTypeCode,
        status: 'pending',
        startDate: { $gte: new Date() }
      }
    },
    {
      $group: { _id: null, total: { $sum: '$duration' } }
    }
  ]).then(result => result[0]?.total || 0);

  const availableBalance = balance - pendingUsage;

  if (workingDaysInfo.workingDays > availableBalance) {
    throw new ApiError(400,
      `Insufficient balance. Available: ${availableBalance} days, Requested: ${workingDaysInfo.workingDays} days`
    );
  }

  // 7. Check for overlapping leave requests
  const overlappingLeaves = await Leave.find({
    employeeId,
    companyId: user.companyId,
    status: { $in: ['pending', 'approved'] },
    $or: [
      { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
    ],
    isDeleted: false
  });

  if (overlappingLeaves.length > 0) {
    throw new ApiError(400,
      'You already have a leave request during this period'
    );
  }

  // 8. Check for document requirement
  if (leaveTypeConfig.requiresDocument && workingDaysInfo.workingDays >= 3) {
    if (!req.body.attachments || req.body.attachments.length === 0) {
      throw new ApiError(400,
        `Supporting document is required for ${leaveTypeConfig.name} of 3 or more days`
      );
    }
  }

  // 9. Prevent self-approval for managers
  const ownLeaveRequest = employeeId === user.employeeId;
  const requiresApproval = leaveTypeConfig.requiresApproval;

  if (ownLeaveRequest && requiresApproval) {
    // Verify that reporting manager is different from employee
    if (employee.reportingManagerId === employee.employeeId) {
      throw new ApiError(400,
        'Self-approval is not allowed. Please contact HR for approval'
      );
    }
  }

  return {
    employee,
    leaveTypeConfig,
    workingDaysInfo,
    availableBalance,
    duration: workingDaysInfo.workingDays
  };
};

/**
 * Validate leave approval
 */
export const validateLeaveApproval = async (leaveId, approverId, companyId) => {
  const leave = await Leave.findOne({
    leaveId,
    companyId,
    isDeleted: false
  });

  if (!leave) {
    throw new ApiError(404, 'Leave request not found');
  }

  if (leave.status !== 'pending') {
    throw new ApiError(400, `Cannot approve leave with status: ${leave.status}`);
  }

  // Check if approver is the reporting manager
  const employee = await Employee.findOne({ employeeId: leave.employeeId, companyId });

  if (employee.reportingManagerId !== approverId) {
    // Check if approver is admin
    const approver = await Employee.findOne({ employeeId: approverId, companyId });
    if (approver.role !== 'admin') {
      throw new ApiError(403, 'You are not authorized to approve this leave request');
    }
  }

  return leave;
};
```

---

## Implementation Priority

### Phase 4A (High Priority)
1. **Holiday Calendar Integration** - Essential for accurate leave calculation
2. **Advanced Validations** - Prevents invalid leave requests

### Phase 4B (Medium Priority)
3. **File Upload System** - Enhances documentation and compliance

### Phase 4C (Low Priority)
4. **Holiday Management UI** - Admin interface for managing holidays
5. **Leave Calendar View** - Visual representation of leave on calendar

---

## Testing Checklist

### Feature 1: File Upload
- [ ] Upload PDF file (success)
- [ ] Upload image file (success)
- [ ] Upload invalid file type (error)
- [ ] Upload file > 5MB (error)
- [ ] Delete attachment (success)
- [ ] Download attachment (success)

### Feature 2: Holiday Calendar
- [ ] Calculate working days excluding holidays
- [ ] Calculate working days excluding weekends
- [ ] Handle recurring holidays
- [ ] Region-specific holidays
- [ ] Create/update/delete holidays
- [ ] Holiday affects leave duration calculation

### Feature 3: Validations
- [ ] Minimum notice period validation
- [ ] Maximum consecutive days validation
- [ ] Insufficient balance validation
- [ ] Overlapping leave detection
- [ ] Document requirement enforcement
- [ ] Self-approval prevention
- [ ] Past date prevention

---

## API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/leaves/:leaveId/attachments` | POST | Upload attachment |
| `/api/leaves/:leaveId/attachments/:attachmentId` | DELETE | Delete attachment |
| `/api/holidays` | GET | Get holidays (with year/month filter) |
| `/api/holidays` | POST | Create holiday |
| `/api/holidays/:id` | PUT | Update holiday |
| `/api/holidays/:id` | DELETE | Delete holiday |
| `/api/holidays/calculate` | POST | Calculate working days |

---

## Dependencies

- `multer` - File upload handling
- `dayjs` - Date manipulation (already installed)
- Existing Leave, LeaveType, Employee models
- Socket.IO for real-time updates

---

## Notes

- All endpoints require authentication via `authenticateUser` middleware
- File uploads are limited to 5MB per file
- Only PDF and image files (JPEG, PNG) are accepted
- Working day calculation respects company weekend configuration
- Holiday calendar can support region-specific holidays
- All validations run before creating leave requests
