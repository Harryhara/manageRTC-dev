/**
 * Multer Configuration for File Uploads
 * Handles file storage and validation for:
 * - Leave attachments
 * - Employee profile images
 */

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// LEAVE ATTACHMENTS CONFIGURATION
// ============================================================================

// Ensure upload directory exists
const leaveUploadDir = path.join(process.cwd(), 'public', 'uploads', 'leave-attachments');
if (!fs.existsSync(leaveUploadDir)) {
  fs.mkdirSync(leaveUploadDir, { recursive: true });
}

// Storage configuration for leave attachments
const leaveStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, leaveUploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: leave-{leaveId}-{timestamp}-{random}.{ext}
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const ext = path.extname(file.originalname);
    const leaveId = req.params.leaveId || req.body.leaveId || 'temp';
    cb(null, `leave-${leaveId}-${uniqueSuffix}${ext}`);
  }
});

// File filter for leave attachments (PDF and images)
const leaveFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and images (JPEG, PNG) are allowed.'), false);
  }
};

// Upload configuration for leave attachments
export const uploadConfig = multer({
  storage: leaveStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: leaveFileFilter
});

// Single file upload middleware
export const uploadSingleAttachment = uploadConfig.single('attachment');

// Multiple files upload middleware (max 5 files)
export const uploadMultipleAttachments = uploadConfig.array('attachments', 5);

// ============================================================================
// EMPLOYEE PROFILE IMAGE CONFIGURATION
// ============================================================================

// Ensure employee images directory exists
const employeeImagesDir = path.join(process.cwd(), 'public', 'uploads', 'employee-images');
if (!fs.existsSync(employeeImagesDir)) {
  fs.mkdirSync(employeeImagesDir, { recursive: true });
}

// Storage configuration for employee profile images
const employeeImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, employeeImagesDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: emp-{employeeId}-{timestamp}.{ext}
    const employeeId = req.params.id || req.body.employeeId || 'unknown';
    const uniqueSuffix = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `emp-${employeeId}-${uniqueSuffix}${ext}`);
  }
});

// File filter for employee images (images only)
const employeeImageFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// Upload configuration for employee profile images
export const employeeImageUpload = multer({
  storage: employeeImageStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for profile images
    files: 1 // Single file only
  },
  fileFilter: employeeImageFileFilter
});

// Middleware for uploading single employee profile image
export const uploadEmployeeImage = employeeImageUpload.single('profileImage');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Delete a file from the filesystem
 * @param {string} filePath - Relative path from public/uploads
 */
export const deleteUploadedFile = (filePath) => {
  try {
    const fullPath = path.join(process.cwd(), 'public', 'uploads', filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Multer Config] Failed to delete file:', error);
    return false;
  }
};

/**
 * Get public URL for uploaded file
 * @param {string} filePath - Relative path from public/uploads
 * @returns {string} Public URL
 */
export const getPublicUrl = (filePath) => {
  if (!filePath) return null;
  // If it's already a full URL, return as is
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  // Otherwise, construct the public URL
  return `/uploads/${filePath}`;
};

export default uploadConfig;
