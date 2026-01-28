/**
 * ID Generator Utility
 * Generates unique IDs for various entities
 */

import mongoose from 'mongoose';

/**
 * generateEmployeeId - Generate unique employee ID
 * Format: EMP-YYYY-NNNN (e.g., EMP-2026-0001)
 *
 * @param {string} companyId - Company ID
 * @param {Date} joiningDate - Employee joining date
 * @returns {Promise<string>} Generated employee ID
 */
export const generateEmployeeId = async (companyId, joiningDate = new Date()) => {
  const Employee = mongoose.model('Employee');
  const year = new Date(joiningDate).getFullYear();

  // Find the highest employee ID for this company and year
  const lastEmployee = await Employee.findOne({
    companyId,
    employeeId: new RegExp(`^EMP-${year}-`)
  }).sort({ employeeId: -1 });

  let sequence = 1;

  if (lastEmployee && lastEmployee.employeeId) {
    const lastSequence = parseInt(lastEmployee.employeeId.split('-')[2]);
    sequence = lastSequence + 1;
  }

  // Pad sequence to 4 digits
  const paddedSequence = String(sequence).padStart(4, '0');

  return `EMP-${year}-${paddedSequence}`;
};

/**
 * generateProjectId - Generate unique project ID
 * Format: PRJ-YYYY-NNNN
 *
 * @param {string} companyId - Company ID
 * @returns {Promise<string>} Generated project ID
 */
export const generateProjectId = async (companyId) => {
  const Project = mongoose.model('Project');
  const year = new Date().getFullYear();

  const lastProject = await Project.findOne({
    companyId,
    projectId: new RegExp(`^PRJ-${year}-`)
  }).sort({ projectId: -1 });

  let sequence = 1;

  if (lastProject && lastProject.projectId) {
    const lastSequence = parseInt(lastProject.projectId.split('-')[2]);
    sequence = lastSequence + 1;
  }

  const paddedSequence = String(sequence).padStart(4, '0');

  return `PRJ-${year}-${paddedSequence}`;
};

/**
 * generateTaskId - Generate unique task ID
 * Format: TSK-YYYY-NNNN
 *
 * @param {string} projectId - Project ID
 * @returns {Promise<string>} Generated task ID
 */
export const generateTaskId = async (projectId) => {
  const Task = mongoose.model('Task');
  const year = new Date().getFullYear();

  const lastTask = await Task.findOne({
    project: projectId,
    taskId: new RegExp(`^TSK-${year}-`)
  }).sort({ taskId: -1 });

  let sequence = 1;

  if (lastTask && lastTask.taskId) {
    const lastSequence = parseInt(lastTask.taskId.split('-')[2]);
    sequence = lastSequence + 1;
  }

  const paddedSequence = String(sequence).padStart(4, '0');

  return `TSK-${year}-${paddedSequence}`;
};

/**
 * generateLeaveId - Generate unique leave request ID
 * Format: LEA-YYYY-NNNN
 *
 * @param {string} companyId - Company ID
 * @returns {Promise<string>} Generated leave ID
 */
export const generateLeaveId = async (companyId) => {
  const Leave = mongoose.model('Leave');
  const year = new Date().getFullYear();

  const lastLeave = await Leave.findOne({
    companyId,
    leaveId: new RegExp(`^LEA-${year}-`)
  }).sort({ leaveId: -1 });

  let sequence = 1;

  if (lastLeave && lastLeave.leaveId) {
    const lastSequence = parseInt(lastLeave.leaveId.split('-')[2]);
    sequence = lastSequence + 1;
  }

  const paddedSequence = String(sequence).padStart(4, '0');

  return `LEA-${year}-${paddedSequence}`;
};

/**
 * generateLeadId - Generate unique lead ID
 * Format: LD-YYYY-NNNN
 *
 * @param {string} companyId - Company ID
 * @returns {Promise<string>} Generated lead ID
 */
export const generateLeadId = async (companyId) => {
  const Lead = mongoose.model('Lead');
  const year = new Date().getFullYear();

  const lastLead = await Lead.findOne({
    companyId,
    leadId: new RegExp(`^LD-${year}-`)
  }).sort({ leadId: -1 });

  let sequence = 1;

  if (lastLead && lastLead.leadId) {
    const lastSequence = parseInt(lastLead.leadId.split('-')[2]);
    sequence = lastSequence + 1;
  }

  const paddedSequence = String(sequence).padStart(4, '0');

  return `LD-${year}-${paddedSequence}`;
};

/**
 * generateClientId - Generate unique client ID
 * Format: CLI-YYYY-NNNN
 *
 * @param {string} companyId - Company ID
 * @returns {Promise<string>} Generated client ID
 */
export const generateClientId = async (companyId) => {
  const Client = mongoose.model('Client');
  const year = new Date().getFullYear();

  const lastClient = await Client.findOne({
    companyId,
    clientId: new RegExp(`^CLI-${year}-`)
  }).sort({ clientId: -1 });

  let sequence = 1;

  if (lastClient && lastClient.clientId) {
    const lastSequence = parseInt(lastClient.clientId.split('-')[2]);
    sequence = lastSequence + 1;
  }

  const paddedSequence = String(sequence).padStart(4, '0');

  return `CLI-${year}-${paddedSequence}`;
};

export default {
  generateEmployeeId,
  generateProjectId,
  generateTaskId,
  generateLeaveId,
  generateLeadId,
  generateClientId
};
