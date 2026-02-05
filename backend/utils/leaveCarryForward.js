/**
 * Leave Carry Forward Service
 * Handles annual leave balance reset and carry-forward of unused leave
 *
 * This service should be run annually (typically at year end) to:
 * 1. Calculate unused leave balance for each employee
 * 2. Carry forward eligible leave to the next year
 * 3. Reset leave balances according to company policy
 * 4. Handle expiry of carried forward leave
 */

import { getTenantCollections } from '../config/db.js';

/**
 * Carry forward configuration
 * Can be overridden by company settings
 */
const DEFAULT_CARRY_FORWARD_CONFIG = {
  // Maximum number of days that can be carried forward
  maxCarryForwardDays: 10,

  // Percentage of unused leave that can be carried forward (0-100)
  carryForwardPercentage: 50,

  // Validity period for carried forward leave (in months)
  carryForwardValidityMonths: 3,

  // Leave types eligible for carry forward
  eligibleLeaveTypes: ['earned', 'casual'],

  // Whether to reset unused leave to zero or carry forward
  resetUnusedLeave: false
};

/**
 * Get carry forward configuration for a company
 * TODO: Fetch from company settings
 */
const getCarryForwardConfig = async (companyId) => {
  // For now, return default configuration
  // In production, this should be fetched from company settings
  return { ...DEFAULT_CARRY_FORWARD_CONFIG };
};

/**
 * Calculate carry forward leave for an employee
 *
 * @param {string} companyId - Company ID
 * @param {string} employeeId - Employee ID
 * @param {number} year - Year for which to calculate carry forward (defaults to previous year)
 * @returns {Promise<Object>} Carry forward calculation result
 */
export const calculateCarryForward = async (companyId, employeeId, year = null) => {
  const targetYear = year || new Date().getFullYear() - 1;
  const config = await getCarryForwardConfig(companyId);

  const collections = getTenantCollections(companyId);

  // Get employee details
  const employee = await collections.employees.findOne({
    employeeId,
    isDeleted: { $ne: true }
  });

  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  // Get current leave balances
  const leaveBalances = employee.leaveBalances || [];

  const carryForwardDetails = [];
  let totalCarryForwardDays = 0;

  // Process each leave type
  for (const balance of leaveBalances) {
    // Skip if not eligible for carry forward
    if (!config.eligibleLeaveTypes.includes(balance.type)) {
      continue;
    }

    const unusedDays = balance.balance || 0;

    if (unusedDays <= 0) {
      continue;
    }

    // Calculate carry forward days
    const percentageBasedDays = Math.floor(unusedDays * (config.carryForwardPercentage / 100));
    const carryForwardDays = Math.min(
      unusedDays,
      percentageBasedDays,
      config.maxCarryForwardDays
    );

    if (carryForwardDays > 0) {
      // Calculate expiry date for carried forward leave
      const expiryDate = new Date(targetYear + 1, 0 + config.carryForwardValidityMonths, 0); // End of validity month

      carryForwardDetails.push({
        leaveType: balance.type,
        unusedDays,
        carryForwardDays,
        expiryDate,
        percentageUsed: config.carryForwardPercentage,
        maxAllowed: config.maxCarryForwardDays
      });

      totalCarryForwardDays += carryForwardDays;
    }
  }

  return {
    employeeId,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    year: targetYear,
    targetYear: targetYear + 1,
    carryForwardDetails,
    totalCarryForwardDays,
    config,
    calculatedAt: new Date()
  };
};

/**
 * Process carry forward for all employees in a company
 *
 * @param {string} companyId - Company ID
 * @param {number} year - Year to process (defaults to previous year)
 * @returns {Promise<Object>} Processing results
 */
export const processCarryForwardForCompany = async (companyId, year = null) => {
  const targetYear = year || new Date().getFullYear() - 1;
  const config = await getCarryForwardConfig(companyId);

  const collections = getTenantCollections(companyId);

  // Get all active employees
  const employees = await collections.employees.find({
    companyId,
    isDeleted: { $ne: true },
    employmentStatus: { $in: ['active', 'probation'] }
  }).toArray();

  const results = {
    companyId,
    year: targetYear,
    targetYear: targetYear + 1,
    processedEmployees: 0,
    skippedEmployees: 0,
    totalCarryForwardDays: 0,
    errors: [],
    details: []
  };

  // Process each employee
  for (const employee of employees) {
    try {
      const carryForwardResult = await calculateCarryForward(
        companyId,
        employee.employeeId,
        targetYear
      );

      if (carryForwardResult.totalCarryForwardDays > 0) {
        // Update employee's leave balances with carry forward
        await updateEmployeeCarryForward(
          companyId,
          employee.employeeId,
          carryForwardResult
        );

        results.processedEmployees++;
        results.totalCarryForwardDays += carryForwardResult.totalCarryForwardDays;
        results.details.push(carryForwardResult);
      } else {
        results.skippedEmployees++;
      }
    } catch (error) {
      results.errors.push({
        employeeId: employee.employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Update employee leave balances with carry forward
 *
 * @param {string} companyId - Company ID
 * @param {string} employeeId - Employee ID
 * @param {Object} carryForwardResult - Carry forward calculation result
 * @returns {Promise<void>}
 */
const updateEmployeeCarryForward = async (
  companyId,
  employeeId,
  carryForwardResult
) => {
  const collections = getTenantCollections(companyId);

  const employee = await collections.employees.findOne({
    employeeId,
    isDeleted: { $ne: true }
  });

  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  const leaveBalances = employee.leaveBalances || [];
  const carryForwardBalances = [];

  // Update each leave type balance
  for (const detail of carryForwardResult.carryForwardDetails) {
    const balanceIndex = leaveBalances.findIndex(
      b => b.type === detail.leaveType
    );

    if (balanceIndex !== -1) {
      // Add carry forward to the balance
      const currentBalance = leaveBalances[balanceIndex];
      const newBalance = {
        ...currentBalance,
        // Add carried forward days to next year's balance
        carryForward: detail.carryForwardDays,
        carryForwardExpiry: detail.expiryDate,
        // Reset annual quota (will be set by company policy)
        total: currentBalance.total, // Will be updated by annual reset
        balance: detail.carryForwardDays, // Start with carried forward only
        used: 0, // Reset for new year
        lastCarryForwardYear: carryForwardResult.year
      };

      carryForwardBalances.push(newBalance);
    }
  }

  // Update employee document
  await collections.employees.updateOne(
    { employeeId },
    {
      $set: {
        leaveBalances: carryForwardBalances.length > 0 ? carryForwardBalances : leaveBalances,
        lastCarryForwardProcessed: carryForwardResult.year,
        updatedAt: new Date()
      }
    }
  );
};

/**
 * Get carry forward status for an employee
 *
 * @param {string} companyId - Company ID
 * @param {string} employeeId - Employee ID
 * @returns {Promise<Object>} Carry forward status
 */
export const getCarryForwardStatus = async (companyId, employeeId) => {
  const collections = getTenantCollections(companyId);

  const employee = await collections.employees.findOne({
    employeeId,
    isDeleted: { $ne: true }
  });

  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  const leaveBalances = employee.leaveBalances || [];
  const currentYear = new Date().getFullYear();
  const status = [];

  for (const balance of leaveBalances) {
    if (balance.carryForward && balance.carryForward > 0) {
      const expiryDate = new Date(balance.carryForwardExpiry);
      const isExpired = new Date() > expiryDate;
      const daysRemaining = Math.max(0, Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24)));

      status.push({
        leaveType: balance.type,
        carryForwardDays: balance.carryForward,
        expiryDate: balance.carryForwardExpiry,
        isExpired,
        daysRemaining,
        used: balance.used || 0,
        remaining: balance.balance || 0
      });
    }
  }

  return {
    employeeId,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    currentYear,
    carryForwardStatus: status,
    totalCarryForwardDays: status.reduce((sum, s) => sum + (s.isExpired ? 0 : s.carryForwardDays), 0),
    expiredCarryForwardDays: status.filter(s => s.isExpired).reduce((sum, s) => sum + s.carryForwardDays, 0)
  };
};

/**
 * Expire carried forward leave
 * Should be run periodically to expire old carry forward
 *
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Expiry results
 */
export const expireCarryForward = async (companyId) => {
  const collections = getTenantCollections(companyId);
  const now = new Date();

  const employees = await collections.employees.find({
    companyId,
    isDeleted: { $ne: true },
    'leaveBalances.carryForwardExpiry': { $lte: now }
  }).toArray();

  const results = {
    companyId,
    processedAt: now,
    employeesProcessed: 0,
    totalExpiredDays: 0,
    details: []
  };

  for (const employee of employees) {
    const leaveBalances = employee.leaveBalances || [];
    let expiredDays = 0;

    const updatedBalances = leaveBalances.map(balance => {
      if (balance.carryForwardExpiry && new Date(balance.carryForwardExpiry) <= now) {
        expiredDays += balance.carryForward || 0;
        return {
          ...balance,
          carryForward: 0,
          carryForwardExpiry: null
        };
      }
      return balance;
    });

    if (expiredDays > 0) {
      await collections.employees.updateOne(
        { employeeId: employee.employeeId },
        {
          $set: {
            leaveBalances: updatedBalances,
            updatedAt: now
          }
        }
      );

      results.employeesProcessed++;
      results.totalExpiredDays += expiredDays;
      results.details.push({
        employeeId: employee.employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        expiredDays
      });
    }
  }

  return results;
};

export default {
  calculateCarryForward,
  processCarryForwardForCompany,
  getCarryForwardStatus,
  expireCarryForward
};
