/**
 * Role Schema
 * Defines user roles that can be assigned permissions
 */

import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
  // Role Name (unique identifier)
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },

  // Display Name (for UI)
  displayName: {
    type: String,
    required: true,
    trim: true,
  },

  // Description
  description: {
    type: String,
    trim: true,
    default: '',
  },

  // Role Type
  type: {
    type: String,
    enum: ['system', 'custom'],
    default: 'custom',
  },

  // Hierarchy Level (lower = higher priority)
  level: {
    type: Number,
    required: true,
    default: 100,
    min: 1,
    max: 100,
  },

  // Is Active
  isActive: {
    type: Boolean,
    default: true,
  },

  // Is Default Role
  isDefault: {
    type: Boolean,
    default: false,
  },

  // User Count (for reference, updated by service)
  userCount: {
    type: Number,
    default: 0,
  },

  // Soft Delete
  isDeleted: {
    type: Boolean,
    default: false,
  },

  deletedAt: {
    type: Date,
    default: null,
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  // ============================================
  // EMBEDDED PERMISSIONS (New Structure)
  // ============================================
  // Stores all permissions assigned to this role
  // This replaces the rolePermissions junction table
  permissions: [{
    permissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Permission',
      required: false // Optional for backward compatibility
    },
    // NEW: Direct Page reference for efficient lookups
    pageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Page',
      required: false
    },
    module: {
      type: String, // e.g., 'super-admin.dashboard', 'hrm.employees-list'
      required: true
    },
    category: {
      type: String, // e.g., 'super-admin', 'hrm', 'projects'
      required: true
    },
    displayName: {
      type: String, // e.g., 'Dashboard', 'Employees List'
      required: true
    },
    // Permission actions
    actions: {
      all: { type: Boolean, default: false },
      read: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      write: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      import: { type: Boolean, default: false },
      export: { type: Boolean, default: false },
      approve: { type: Boolean, default: false },
      assign: { type: Boolean, default: false },
    }
  }],

  // Permission summary stats (cached for performance)
  permissionStats: {
    totalPermissions: { type: Number, default: 0 },
    categories: [{ type: String }], // List of categories this role has access to
    lastUpdatedAt: { type: Date, default: Date.now }
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  collection: 'roles',
});

// Indexes
roleSchema.index({ name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
roleSchema.index({ isActive: 1, isDeleted: 1 });
roleSchema.index({ type: 1 });
roleSchema.index({ level: 1 });
// New indexes for embedded permissions
roleSchema.index({ 'permissions.module': 1 });
roleSchema.index({ 'permissions.permissionId': 1 });
roleSchema.index({ 'permissions.category': 1 });
roleSchema.index({ 'permissions.pageId': 1 }); // NEW: Index for page lookups

// Pre-save middleware
roleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Prevent modification of system roles' critical fields
roleSchema.pre('save', function(next) {
  if (this.type === 'system' && this.isModified('level')) {
    // Only allow level modification for system roles if explicitly intended
    const originalLevel = this._doc.level;
    if (originalLevel !== undefined && this.level !== originalLevel) {
      return next(new Error('Cannot modify system role level'));
    }
  }
  next();
});

// Virtual for role permissions (kept for backward compatibility during migration)
roleSchema.virtual('rolePermissions', {
  ref: 'RolePermission',
  localField: '_id',
  foreignField: 'roleId',
  justOne: false,
});

// Static method to get active roles
roleSchema.statics.getActiveRoles = function() {
  return this.find({ isActive: true, isDeleted: false }).sort({ level: 1, displayName: 1 });
};

// Static method to get system roles
roleSchema.statics.getSystemRoles = function() {
  return this.find({ type: 'system', isActive: true, isDeleted: false }).sort({ level: 1 });
};

// Static method to get custom roles
roleSchema.statics.getCustomRoles = function() {
  return this.find({ type: 'custom', isActive: true, isDeleted: false }).sort({ displayName: 1 });
};

// Static method to check if role name exists
roleSchema.statics.nameExists = async function(name, excludeId = null) {
  const query = { name, isDeleted: false };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const count = await this.countDocuments(query);
  return count > 0;
};

// ============================================
// EMBEDDED PERMISSIONS METHODS
// ============================================

// Static method to check if role has specific permission and action
roleSchema.statics.hasPermission = async function(roleId, module, action = 'read') {
  const role = await this.findById(roleId).select('permissions');
  if (!role) return false;

  const perm = role.permissions.find(p => p.module === module);
  if (!perm) return false;

  // Check 'all' first
  if (perm.actions.all) return true;

  // Check specific action
  return perm.actions[action] || false;
};

// Static method to get permissions grouped by category
roleSchema.statics.getPermissionsGrouped = async function(roleId) {
  const role = await this.findById(roleId).select('permissions');
  if (!role) return [];

  const grouped = role.permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {});

  return Object.entries(grouped).map(([category, permissions]) => ({
    category,
    permissions
  }));
};

// Static method to set/update all permissions for a role
roleSchema.statics.setAllPermissions = async function(roleId, permissionsData) {
  // Update permissions and recalculate stats
  const role = await this.findByIdAndUpdate(
    roleId,
    {
      $set: {
        permissions: permissionsData,
        'permissionStats.totalPermissions': permissionsData.length,
        'permissionStats.lastUpdatedAt': new Date()
      },
      $addToSet: {
        'permissionStats.categories': { $each: [...new Set(permissionsData.map(p => p.category))] }
      }
    },
    { new: true }
  );

  return role;
};

// Static method to update a single permission action
roleSchema.statics.updatePermissionAction = async function(roleId, permissionId, actions) {
  const role = await this.findOneAndUpdate(
    {
      _id: roleId,
      'permissions.permissionId': permissionId
    },
    {
      $set: {
        'permissions.$.actions': actions,
        'permissionStats.lastUpdatedAt': new Date()
      }
    },
    { new: true }
  );

  return role;
};

// Static method to add a permission to a role
roleSchema.statics.addPermission = async function(roleId, permissionData) {
  const role = await this.findByIdAndUpdate(
    roleId,
    {
      $push: { permissions: permissionData },
      $inc: { 'permissionStats.totalPermissions': 1 },
      $addToSet: { 'permissionStats.categories': permissionData.category }
    },
    { new: true }
  );

  return role;
};

// Static method to remove a permission from a role
roleSchema.statics.removePermission = async function(roleId, permissionId) {
  const role = await this.findByIdAndUpdate(
    roleId,
    {
      $pull: { permissions: { permissionId } },
      $inc: { 'permissionStats.totalPermissions': -1 }
    },
    { new: true }
  );

  // Recalculate categories
  if (role) {
    const categories = [...new Set(role.permissions.map(p => p.category))];
    role.permissionStats.categories = categories;
    await role.save();
  }

  return role;
};

// ============================================
// NEW METHODS FOR PAGE-BASED PERMISSION CHECKS
// ============================================

// Static method to check if role has access to a specific page
roleSchema.statics.hasPageAccess = async function(roleId, pageId, action = 'read') {
  const role = await this.findById(roleId).select('permissions');
  if (!role) return false;

  // Check by pageId first (new method)
  const permByPage = role.permissions.find(p => p.pageId && p.pageId.toString() === pageId.toString());
  if (permByPage) {
    if (permByPage.actions.all) return true;
    return permByPage.actions[action] || false;
  }

  return false;
};

// Static method to check by page name (for backward compatibility)
roleSchema.statics.hasPermissionByPageName = async function(roleId, pageName, action = 'read') {
  const role = await this.findById(roleId).select('permissions');
  if (!role) return false;

  const perm = role.permissions.find(p => p.module === pageName);
  if (!perm) return false;

  if (perm.actions.all) return true;
  return perm.actions[action] || false;
};

// Static method to get all accessible pages for a role
roleSchema.statics.getAccessiblePages = async function(roleId) {
  const role = await this.findById(roleId)
    .select('permissions')
    .populate('permissions.pageId');

  if (!role) return [];

  return role.permissions
    .filter(p => p.pageId || p.module)
    .map(p => ({
      pageId: p.pageId?._id || p.permissionId,
      module: p.module,
      displayName: p.displayName,
      category: p.category,
      route: p.pageId?.route || null,
      actions: p.actions,
    }));
};

// Static method to get permissions with populated page data
roleSchema.statics.getPermissionsWithPages = async function(roleId) {
  const role = await this.findById(roleId)
    .populate('permissions.permissionId')
    .populate('permissions.pageId');

  if (!role) return { flat: [], grouped: [] };

  const flat = role.permissions.map(p => ({
    permissionId: p.permissionId,
    pageId: p.pageId?._id || p.pageId,
    module: p.module,
    displayName: p.displayName,
    category: p.category,
    route: p.pageId?.route || null,
    actions: p.actions,
  }));

  const grouped = flat.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {});

  return {
    flat,
    grouped: Object.entries(grouped).map(([category, permissions]) => ({
      category,
      permissions
    }))
  };
};

// Static method to sync role permissions with updated permission data
roleSchema.statics.syncPermissionsFromPages = async function() {
  const Permission = mongoose.model('Permission');
  const Page = mongoose.model('Page');
  const roles = await this.find({ isActive: true, isDeleted: false });
  const results = { updated: 0, skipped: 0, errors: [] };

  for (const role of roles) {
    try {
      let hasChanges = false;

      for (const perm of role.permissions) {
        // If permission has permissionId but no pageId, try to get pageId
        if (perm.permissionId && !perm.pageId) {
          const permission = await Permission.findById(perm.permissionId);
          if (permission?.pageId) {
            perm.pageId = permission.pageId;
            hasChanges = true;
          }
        }

        // If still no pageId but has module name, try to find page directly
        if (!perm.pageId && perm.module) {
          const page = await Page.findOne({ name: perm.module });
          if (page) {
            perm.pageId = page._id;
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        await role.save();
        results.updated++;
      } else {
        results.skipped++;
      }
    } catch (error) {
      results.errors.push({ roleId: role._id, error: error.message });
    }
  }

  return results;
};

export default mongoose.models.Role || mongoose.model('Role', roleSchema);
