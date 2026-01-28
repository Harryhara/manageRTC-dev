/**
 * Employee API Routes
 * REST API endpoints for Employee management
 */

import express from 'express';
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getMyProfile,
  updateMyProfile,
  getEmployeeReportees,
  getEmployeeStatsByDepartment,
  searchEmployees,
  bulkUploadEmployees
} from '../../controllers/rest/employee.controller.js';
import {
  authenticate,
  requireRole,
  requireCompany,
  attachRequestId
} from '../../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  employeeSchemas
} from '../../middleware/validate.js';

const router = express.Router();

// Apply request ID middleware to all routes
router.use(attachRequestId);

/**
 * Public Routes (Authenticated users can access their own profile)
 */

// Get current user's profile
router.get(
  '/me',
  authenticate,
  getMyProfile
);

// Update current user's profile
router.put(
  '/me',
  authenticate,
  validateBody(employeeSchemas.update),
  updateMyProfile
);

/**
 * Admin/HR Routes (Restricted access)
 */

// List all employees with pagination and filtering
router.get(
  '/',
  authenticate,
  requireCompany,
  requireRole('admin', 'hr', 'superadmin'),
  validateQuery(employeeSchemas.list),
  getEmployees
);

// Create new employee
router.post(
  '/',
  authenticate,
  requireCompany,
  requireRole('admin', 'hr', 'superadmin'),
  validateBody(employeeSchemas.create),
  createEmployee
);

// Search employees
router.get(
  '/search',
  authenticate,
  requireCompany,
  requireRole('admin', 'hr', 'superadmin'),
  searchEmployees
);

// Get employee statistics by department
router.get(
  '/stats/by-department',
  authenticate,
  requireCompany,
  requireRole('admin', 'hr', 'superadmin'),
  getEmployeeStatsByDepartment
);

// Bulk upload employees
router.post(
  '/bulk-upload',
  authenticate,
  requireCompany,
  requireRole('admin', 'hr', 'superadmin'),
  bulkUploadEmployees
);

/**
 * Individual Employee Routes
 */

// Get single employee by ID
router.get(
  '/:id',
  authenticate,
  requireCompany,
  getEmployeeById
);

// Update employee
router.put(
  '/:id',
  authenticate,
  requireCompany,
  requireRole('admin', 'hr', 'superadmin'),
  validateBody(employeeSchemas.update),
  updateEmployee
);

// Delete employee (soft delete)
router.delete(
  '/:id',
  authenticate,
  requireCompany,
  requireRole('admin', 'superadmin'),
  deleteEmployee
);

// Get employee's reportees (subordinates)
router.get(
  '/:id/reportees',
  authenticate,
  requireCompany,
  requireRole('admin', 'hr', 'superadmin'),
  getEmployeeReportees
);

export default router;
