/**
 * Socket.IO Broadcaster Utility
 * Broadcasts real-time events after REST operations complete
 * This maintains the 80% REST + 20% Socket.IO hybrid architecture
 */

/**
 * Broadcast event to company-wide room
 * @param {Object} io - Socket.IO server instance
 * @param {string} companyId - Company ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const broadcastToCompany = (io, companyId, event, data) => {
  if (!io || !companyId) return;

  io.to(`company_${companyId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Broadcast event to specific user
 * @param {Object} io - Socket.IO server instance
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const broadcastToUser = (io, userId, event, data) => {
  if (!io || !userId) return;

  io.to(`user_${userId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Broadcast event to specific room (e.g., project room, department room)
 * @param {Object} io - Socket.IO server instance
 * @param {string} room - Room name
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const broadcastToRoom = (io, room, event, data) => {
  if (!io || !room) return;

  io.to(room).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Employee event broadcasters
 */
export const broadcastEmployeeEvents = {
  /**
   * Broadcast employee created event
   */
  created: (io, companyId, employee) => {
    broadcastToCompany(io, companyId, 'employee:created', {
      employeeId: employee.employeeId,
      _id: employee._id,
      name: employee.fullName,
      department: employee.department,
      designation: employee.designation,
      createdBy: employee.createdBy
    });
  },

  /**
   * Broadcast employee updated event
   */
  updated: (io, companyId, employee) => {
    broadcastToCompany(io, companyId, 'employee:updated', {
      employeeId: employee.employeeId,
      _id: employee._id,
      name: employee.fullName,
      department: employee.department,
      updatedBy: employee.updatedBy
    });
  },

  /**
   * Broadcast employee deleted event
   */
  deleted: (io, companyId, employeeId, deletedBy) => {
    broadcastToCompany(io, companyId, 'employee:deleted', {
      employeeId,
      deletedBy,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Project event broadcasters
 */
export const broadcastProjectEvents = {
  /**
   * Broadcast project created event
   */
  created: (io, companyId, project) => {
    broadcastToCompany(io, companyId, 'project:created', {
      projectId: project.projectId,
      _id: project._id,
      name: project.name,
      status: project.status,
      teamLeader: project.teamLeader,
      createdBy: project.createdBy
    });

    // Notify team members
    if (project.teamMembers && project.teamMembers.length > 0) {
      project.teamMembers.forEach(memberId => {
        broadcastToUser(io, memberId, 'project:you_joined', {
          projectId: project.projectId,
          _id: project._id,
          name: project.name
        });
      });
    }
  },

  /**
   * Broadcast project updated event
   */
  updated: (io, companyId, project) => {
    broadcastToCompany(io, companyId, 'project:updated', {
      projectId: project.projectId,
      _id: project._id,
      name: project.name,
      status: project.status,
      updatedBy: project.updatedBy
    });
  },

  /**
   * Broadcast project progress updated event
   */
  progressUpdated: (io, companyId, project) => {
    broadcastToRoom(io, `project_${project._id}`, 'project:progress_updated', {
      projectId: project.projectId,
      _id: project._id,
      name: project.name,
      progress: project.progress,
      status: project.status
    });
  },

  /**
   * Broadcast project deleted event
   */
  deleted: (io, companyId, projectId, deletedBy) => {
    broadcastToCompany(io, companyId, 'project:deleted', {
      projectId,
      deletedBy,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Task event broadcasters
 */
export const broadcastTaskEvents = {
  /**
   * Broadcast task created event
   */
  created: (io, companyId, task) => {
    broadcastToRoom(io, `project_${task.projectId}`, 'task:created', {
      taskId: task.taskId,
      _id: task._id,
      title: task.title,
      projectId: task.projectId,
      assignee: task.assignee,
      createdBy: task.createdBy
    });

    // Notify assignee
    if (task.assignee && Array.isArray(task.assignee)) {
      task.assignee.forEach(assigneeId => {
        broadcastToUser(io, assigneeId, 'task:assigned_to_you', {
          taskId: task.taskId,
          _id: task._id,
          title: task.title,
          projectId: task.projectId
        });
      });
    }
  },

  /**
   * Broadcast task updated event
   */
  updated: (io, companyId, task) => {
    broadcastToRoom(io, `project_${task.projectId}`, 'task:updated', {
      taskId: task.taskId,
      _id: task._id,
      title: task.title,
      projectId: task.projectId
    });
  },

  /**
   * Broadcast task status changed event
   */
  statusChanged: (io, companyId, task) => {
    broadcastToRoom(io, `project_${task.projectId}`, 'task:status_changed', {
      taskId: task.taskId,
      _id: task._id,
      title: task.title,
      status: task.status,
      projectId: task.projectId
    });
  },

  /**
   * Broadcast task deleted event
   */
  deleted: (io, companyId, taskId, projectId) => {
    broadcastToRoom(io, `project_${projectId}`, 'task:deleted', {
      taskId,
      projectId
    });
  }
};

/**
 * Lead event broadcasters
 */
export const broadcastLeadEvents = {
  /**
   * Broadcast lead created event
   */
  created: (io, companyId, lead) => {
    broadcastToCompany(io, companyId, 'lead:created', {
      leadId: lead.leadId,
      _id: lead._id,
      name: lead.name,
      company: lead.company,
      stage: lead.stage,
      owner: lead.owner,
      createdBy: lead.createdBy
    });
  },

  /**
   * Broadcast lead updated event
   */
  updated: (io, companyId, lead) => {
    broadcastToCompany(io, companyId, 'lead:updated', {
      leadId: lead.leadId,
      _id: lead._id,
      name: lead.name,
      company: lead.company,
      stage: lead.stage,
      updatedBy: lead.updatedBy
    });
  },

  /**
   * Broadcast lead stage changed event
   */
  stageChanged: (io, companyId, lead, previousStage) => {
    broadcastToCompany(io, companyId, 'lead:stage_changed', {
      leadId: lead.leadId,
      _id: lead._id,
      name: lead.name,
      company: lead.company,
      previousStage,
      newStage: lead.stage
    });
  },

  /**
   * Broadcast lead converted to client event
   */
  converted: (io, companyId, lead, client) => {
    broadcastToCompany(io, companyId, 'lead:converted_to_client', {
      leadId: lead.leadId,
      _id: lead._id,
      name: lead.name,
      clientId: client.clientId,
      clientName: client.name
    });
  },

  /**
   * Broadcast lead deleted event
   */
  deleted: (io, companyId, leadId, deletedBy) => {
    broadcastToCompany(io, companyId, 'lead:deleted', {
      leadId,
      deletedBy,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Client event broadcasters
 */
export const broadcastClientEvents = {
  /**
   * Broadcast client created event
   */
  created: (io, companyId, client) => {
    broadcastToCompany(io, companyId, 'client:created', {
      clientId: client.clientId,
      _id: client._id,
      name: client.name,
      clientType: client.clientType,
      tier: client.tier,
      accountManager: client.accountManager,
      createdBy: client.createdBy
    });
  },

  /**
   * Broadcast client updated event
   */
  updated: (io, companyId, client) => {
    broadcastToCompany(io, companyId, 'client:updated', {
      clientId: client.clientId,
      _id: client._id,
      name: client.name,
      tier: client.tier,
      updatedBy: client.updatedBy
    });
  },

  /**
   * Broadcast client deal statistics updated event
   */
  dealStatsUpdated: (io, companyId, client) => {
    broadcastToCompany(io, companyId, 'client:deal_stats_updated', {
      clientId: client.clientId,
      _id: client._id,
      name: client.name,
      totalDeals: client.totalDeals,
      wonDeals: client.wonDeals,
      totalValue: client.totalValue,
      wonValue: client.wonValue
    });
  },

  /**
   * Broadcast client deleted event
   */
  deleted: (io, companyId, clientId, deletedBy) => {
    broadcastToCompany(io, companyId, 'client:deleted', {
      clientId,
      deletedBy,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Dashboard event broadcasters
 */
export const broadcastDashboardEvents = {
  /**
   * Broadcast dashboard stats updated event
   */
  statsUpdated: (io, companyId, stats) => {
    broadcastToCompany(io, companyId, 'dashboard:stats_updated', stats);
  },

  /**
   * Broadcast new notification event
   */
  newNotification: (io, companyId, notification) => {
    broadcastToCompany(io, companyId, 'dashboard:new_notification', notification);
  }
};

/**
 * Helper to get Socket.IO instance from request
 * In Express, we can attach io to app and access via req.app.get('io')
 */
export const getSocketIO = (req) => {
  return req.app.get('io');
};

export default {
  broadcastToCompany,
  broadcastToUser,
  broadcastToRoom,
  broadcastEmployeeEvents,
  broadcastProjectEvents,
  broadcastTaskEvents,
  broadcastLeadEvents,
  broadcastClientEvents,
  broadcastDashboardEvents,
  getSocketIO
};
