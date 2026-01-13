import { getTenantCollections } from "../../config/db.js";
import { ObjectId } from "mongodb";

/**
 * Apply a pending promotion to employee record
 * @param {string} companyId - Company/tenant ID
 * @param {ObjectId|string} promotionId - Promotion ID to apply
 * @returns {Promise<{done: boolean, data?: object, message?: string}>}
 */
async function applyPromotion(companyId, promotionId) {
  try {
    const collections = await getTenantCollections(companyId);
    const promotion = await collections.promotions.findOne({ 
      _id: new ObjectId(promotionId) 
    });
    
    if (!promotion) {
      return { done: false, message: "Promotion not found" };
    }
    
    // Check if already applied
    if (promotion.status === "applied") {
      console.log(`[PromotionService] Promotion ${promotionId} already applied`);
      return { done: true, data: promotion, message: "Already applied" };
    }
    
    // Check if cancelled
    if (promotion.status === "cancelled") {
      return { done: false, message: "Cannot apply cancelled promotion" };
    }
    
    // Verify promotion date has arrived
    const promotionDate = new Date(promotion.promotionDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    promotionDate.setHours(0, 0, 0, 0);
    
    if (promotionDate > today) {
      return { done: false, message: "Promotion date not yet reached" };
    }
    
    // Update employee record
    const employeeUpdate = {
      designationId: promotion.promotionTo.designation.id,
      designation: promotion.promotionTo.designation.name,
      departmentId: promotion.promotionTo.department.id,
      department: promotion.promotionTo.department.name,
      updatedAt: new Date()
    };
    
    await collections.employees.updateOne(
      { _id: new ObjectId(promotion.employee.id) },
      { $set: employeeUpdate }
    );
    
    // Update promotion status
    await collections.promotions.updateOne(
      { _id: new ObjectId(promotionId) },
      { 
        $set: { 
          status: "applied",
          appliedAt: new Date()
        } 
      }
    );
    
    console.log(`[PromotionService] Successfully applied promotion ${promotionId} for employee ${promotion.employee.id}`);
    
    const updatedPromotion = await collections.promotions.findOne({ 
      _id: new ObjectId(promotionId) 
    });
    
    return { done: true, data: updatedPromotion };
  } catch (error) {
    console.error("[PromotionService] Error applying promotion:", error);
    return { done: false, message: error.message };
  }
}

/**
 * Process all pending promotions whose dates have arrived
 * @param {string} companyId - Company/tenant ID
 * @returns {Promise<{done: boolean, applied: number, failed: number}>}
 */
async function processPendingPromotions(companyId) {
  try {
    const collections = await getTenantCollections(companyId);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find all pending promotions with dates on or before today
    const pendingPromotions = await collections.promotions.find({
      status: "pending",
      promotionDate: { $lte: today },
      isDeleted: false
    }).toArray();
    
    console.log(`[PromotionService] Found ${pendingPromotions.length} pending promotions to process for company ${companyId}`);
    
    let applied = 0;
    let failed = 0;
    
    for (const promotion of pendingPromotions) {
      const result = await applyPromotion(companyId, promotion._id);
      if (result.done) {
        applied++;
      } else {
        failed++;
        console.error(`[PromotionService] Failed to apply promotion ${promotion._id}: ${result.message}`);
      }
    }
    
    console.log(`[PromotionService] Processed promotions for ${companyId}: ${applied} applied, ${failed} failed`);
    
    return { done: true, applied, failed };
  } catch (error) {
    console.error("[PromotionService] Error processing pending promotions:", error);
    return { done: false, applied: 0, failed: 0 };
  }
}

/**
 * Parse and validate date input
 */
const parseDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
};

/**
 * Normalize promotion input data
 */
const normalizePromotionInput = (input = {}) => {
  const now = new Date();
  
  return {
    employee: {
      id: (input.employee?.id || input.employeeId || "").trim(),
      name: (input.employee?.name || input.employeeName || "").trim(),
      image: (input.employee?.image || input.employeeImage || "").trim()
    },
    promotionFrom: {
      department: {
        id: (input.promotionFrom?.department?.id || input.departmentFromId || "").trim(),
        name: (input.promotionFrom?.department?.name || input.departmentFromName || "").trim()
      },
      designation: {
        id: (input.promotionFrom?.designation?.id || input.designationFrom?.id || "").trim(),
        name: (input.promotionFrom?.designation?.name || input.designationFrom?.name || "").trim()
      }
    },
    promotionTo: {
      department: {
        id: (input.promotionTo?.department?.id || input.departmentId || input.targetDepartmentId || "").trim(),
        name: (input.promotionTo?.department?.name || input.departmentName || "").trim()
      },
      designation: {
        id: (input.promotionTo?.designation?.id || input.designationTo?.id || "").trim(),
        name: (input.promotionTo?.designation?.name || input.designationTo?.name || "").trim()
      }
    },
    promotionDate: parseDate(input.promotionDate) || now,
    promotionType: input.promotionType || "Regular",
    salaryChange: {
      previousSalary: typeof input.salaryChange?.previousSalary === "number" ? input.salaryChange.previousSalary : null,
      newSalary: typeof input.salaryChange?.newSalary === "number" ? input.salaryChange.newSalary : null,
      increment: typeof input.salaryChange?.increment === "number" ? input.salaryChange.increment : null,
      incrementPercentage: typeof input.salaryChange?.incrementPercentage === "number" ? input.salaryChange.incrementPercentage : null
    },
    reason: (input.reason || "").trim(),
    notes: (input.notes || "").trim(),
    status: input.status || "pending", // pending, applied, cancelled
    appliedAt: input.appliedAt || null, // When promotion was applied to employee record
    createdBy: {
      userId: (input.createdBy?.userId || "").trim(),
      userName: (input.createdBy?.userName || "").trim()
    },
    updatedBy: {
      userId: (input.updatedBy?.userId || "").trim(),
      userName: (input.updatedBy?.userName || "").trim()
    },
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Validate promotion data for creation
 */
const validateCreate = async (collections, promotion, existingPromotionId = null) => {
  if (!promotion.employee?.id) return "Employee is required";
  if (!promotion.employee?.name) return "Employee name is required";
  
  if (!promotion.promotionFrom?.department?.id) return "Current department is required";
  if (!promotion.promotionFrom?.department?.name) return "Current department name is required";
  if (!promotion.promotionFrom?.designation?.id || !promotion.promotionFrom?.designation?.name) {
    return "Current designation is required";
  }
  
  if (!promotion.promotionTo?.department?.id) return "Target department is required";
  if (!promotion.promotionTo?.department?.name) return "Target department name is required";
  if (!promotion.promotionTo?.designation?.id || !promotion.promotionTo?.designation?.name) {
    return "Target designation is required";
  }
  
  if (!promotion.promotionDate) return "Promotion date is required";
  
  // Validate that designations are different
  if (promotion.promotionFrom.designation.id === promotion.promotionTo.designation.id) {
    return "New designation must be different from current designation";
  }
  
  // Validate promotion date is not before employee's joining date
  try {
    const employee = await collections.employees.findOne({ 
      _id: new ObjectId(promotion.employee.id) 
    });
    
    if (employee && employee.dateOfJoining) {
      const joiningDate = new Date(employee.dateOfJoining);
      const promotionDate = new Date(promotion.promotionDate);
      
      joiningDate.setHours(0, 0, 0, 0);
      promotionDate.setHours(0, 0, 0, 0);
      
      if (promotionDate < joiningDate) {
        return "Promotion date cannot be before employee's joining date";
      }
    }
    
    // Check for overlapping promotions (only pending promotions)
    const query = {
      "employee.id": promotion.employee.id,
      status: "pending",
      isDeleted: { $ne: true }
    };
    
    // Exclude current promotion if updating
    if (existingPromotionId) {
      query._id = { $ne: new ObjectId(existingPromotionId) };
    }
    
    const overlappingPromotion = await collections.promotions.findOne(query);
    
    if (overlappingPromotion) {
      return "Employee already has a pending promotion. Please complete or cancel the existing promotion first.";
    }
  } catch (error) {
    console.error("[PromotionService] Error in validation:", error);
    // Continue with other validations even if this fails
  }
  
  return null;
};

/**
 * Fetch employee details to populate promotion data
 */
const enrichPromotionWithEmployeeData = async (collections, employeeId) => {
  try {
    const employee = await collections.employees.findOne({ 
      _id: new ObjectId(employeeId),
      isDeleted: { $ne: true }
    });
    
    if (!employee) {
      return { error: "Employee not found" };
    }
    
    // Fetch department details
    let departmentName = employee.department || "";
    if (employee.departmentId) {
      const department = await collections.departments.findOne({ 
        _id: new ObjectId(employee.departmentId)
      });
      if (department) {
        departmentName = department.name || department.departmentName || departmentName;
      }
    }
    
    // Fetch designation details
    let designationName = employee.designation || "";
    if (employee.designationId) {
      const designation = await collections.designations.findOne({ 
        _id: new ObjectId(employee.designationId)
      });
      if (designation) {
        designationName = designation.name || designation.designation || designationName;
      }
    }
    
    return {
      employeeId: employee._id.toString(),
      employeeName: `${employee.firstName || ""} ${employee.lastName || ""}`.trim(),
      employeeImage: employee.image || employee.profilePicture || "",
      departmentId: employee.departmentId || "",
      departmentName: departmentName,
      currentDesignationId: employee.designationId || "",
      currentDesignationName: designationName
    };
  } catch (error) {
    console.error("[PromotionService] Error enriching employee data:", error);
    return { error: error.message };
  }
};

/**
 * Create a new promotion record
 */
export const createPromotion = async (companyId, data) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[PromotionService] createPromotion", { companyId, data });
    
    // If only employeeId is provided, fetch employee details
    if (data.employeeId && !data.employeeName) {
      const enrichedData = await enrichPromotionWithEmployeeData(collections, data.employeeId);
      if (enrichedData.error) {
        return { done: false, error: enrichedData.error };
      }
      
      // Merge enriched data with input data
      data = {
        ...data,
        employeeName: enrichedData.employeeName,
        employeeImage: enrichedData.employeeImage,
        departmentId: enrichedData.departmentId,
        departmentName: enrichedData.departmentName,
        // Set designationFrom if not provided
        designationFrom: data.designationFrom || {
          id: enrichedData.currentDesignationId,
          name: enrichedData.currentDesignationName
        }
      };
    }
    
    const toInsert = normalizePromotionInput(data);
    toInsert.companyId = companyId;

    const validationError = await validateCreate(collections, toInsert);
    if (validationError) {
      console.error("[PromotionService] Validation error", { validationError });
      return { done: false, error: validationError };
    }

    const result = await collections.promotions.insertOne(toInsert);
    if (!result.insertedId) {
      console.error("[PromotionService] Failed to insert promotion");
      return { done: false, error: "Failed to create promotion" };
    }
    
    const created = await collections.promotions.findOne({ _id: result.insertedId });
    
    // Check if promotion date is today or in the past - apply immediately
    const promotionDate = new Date(toInsert.promotionDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    promotionDate.setHours(0, 0, 0, 0);
    
    if (promotionDate <= today) {
      console.log("[PromotionService] Promotion date is today or past, applying immediately");
      // Apply promotion immediately
      try {
        await applyPromotion(companyId, result.insertedId);
      } catch (applyError) {
        console.error("[PromotionService] Error applying promotion:", applyError);
        // Don't fail the creation if application fails - it will be picked up by scheduler
      }
    } else {
      console.log("[PromotionService] Promotion date is in future, status remains pending");
    }
    
    // Return the latest version after potential application
    const finalPromotion = await collections.promotions.findOne({ _id: result.insertedId });
    return { done: true, data: finalPromotion };
  } catch (error) {
    console.error("[PromotionService] Error in createPromotion", { error: error.message });
    return { done: false, error: error.message };
  }
};

/**
 * Get all promotions with optional filters
 */
export const getAllPromotions = async (companyId, filters = {}) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[PromotionService] getAllPromotions", { companyId, filters });
    
    const query = { companyId, isDeleted: { $ne: true } };
    
    // Apply filters
    if (filters.employeeId) {
      query.employeeId = filters.employeeId;
    }
    
    if (filters.departmentId) {
      query.departmentId = filters.departmentId;
    }
    
    if (filters.promotionType) {
      query.promotionType = filters.promotionType;
    }
    
    if (filters.startDate || filters.endDate) {
      query.promotionDate = {};
      if (filters.startDate) {
        query.promotionDate.$gte = parseDate(filters.startDate);
      }
      if (filters.endDate) {
        query.promotionDate.$lte = parseDate(filters.endDate);
      }
    }
    
    // Use aggregation to lookup employee data and include employeeId and avatarUrl
    const promotions = await collections.promotions.aggregate([
      { $match: query },
      { $sort: { promotionDate: -1, createdAt: -1 } },
      {
        $lookup: {
          from: "employees",
          let: { empId: { $toObjectId: "$employee.id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$empId"] } } },
            { $project: { employeeId: 1, avatarUrl: 1 } }
          ],
          as: "employeeData"
        }
      },
      {
        $addFields: {
          "employee.employeeId": { $arrayElemAt: ["$employeeData.employeeId", 0] },
          "employee.image": { $arrayElemAt: ["$employeeData.avatarUrl", 0] }
        }
      },
      {
        $project: {
          employeeData: 0
        }
      }
    ]).toArray();
    
    return { done: true, data: promotions };
  } catch (error) {
    console.error("[PromotionService] Error in getAllPromotions", { error: error.message });
    return { done: false, error: error.message };
  }
};

/**
 * Get promotion by ID
 */
export const getPromotionById = async (companyId, promotionId) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[PromotionService] getPromotionById", { companyId, promotionId });
    
    if (!ObjectId.isValid(promotionId)) {
      return { done: false, error: "Invalid promotion ID format" };
    }
    
    const promotion = await collections.promotions.findOne({ 
      _id: new ObjectId(promotionId),
      companyId,
      isDeleted: { $ne: true }
    });
    
    if (!promotion) {
      return { done: false, error: "Promotion not found" };
    }
    
    return { done: true, data: promotion };
  } catch (error) {
    console.error("[PromotionService] Error in getPromotionById", { error: error.message });
    return { done: false, error: error.message };
  }
};

/**
 * Update promotion record
 */
export const updatePromotion = async (companyId, promotionId, updateData) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[PromotionService] updatePromotion", { companyId, promotionId, updateData });
    
    if (!ObjectId.isValid(promotionId)) {
      return { done: false, error: "Invalid promotion ID format" };
    }
    
    // Check if promotion exists
    const existing = await collections.promotions.findOne({ 
      _id: new ObjectId(promotionId),
      companyId,
      isDeleted: { $ne: true }
    });
    
    if (!existing) {
      return { done: false, error: "Promotion not found" };
    }
    
    // Prepare update object
    const toUpdate = {};
    const now = new Date();
    
    if (updateData.promotionDate) toUpdate.promotionDate = parseDate(updateData.promotionDate);
    if (updateData.promotionType) toUpdate.promotionType = updateData.promotionType;
    if (updateData.reason !== undefined) toUpdate.reason = updateData.reason.trim();
    if (updateData.notes !== undefined) toUpdate.notes = updateData.notes.trim();
    
    // Handle promotionTo updates (nested structure)
    if (updateData.promotionTo) {
      // Update department if provided
      if (updateData.promotionTo.department) {
        toUpdate["promotionTo.department"] = {
          id: (updateData.promotionTo.department.id || "").trim(),
          name: (updateData.promotionTo.department.name || "").trim()
        };
        
        // Validate department
        if (!toUpdate["promotionTo.department"].id || !toUpdate["promotionTo.department"].name) {
          return { done: false, error: "Target department is required" };
        }
      }
      
      // Update designation if provided
      if (updateData.promotionTo.designation) {
        toUpdate["promotionTo.designation"] = {
          id: (updateData.promotionTo.designation.id || "").trim(),
          name: (updateData.promotionTo.designation.name || "").trim()
        };
        
        // Validate designation
        if (!toUpdate["promotionTo.designation"].id || !toUpdate["promotionTo.designation"].name) {
          return { done: false, error: "New designation is required" };
        }
      }
    }
    
    // Legacy support for flat designationTo structure
    if (updateData.designationTo && !updateData.promotionTo?.designation) {
      toUpdate["promotionTo.designation"] = {
        id: (updateData.designationTo.id || "").trim(),
        name: (updateData.designationTo.name || "").trim()
      };
      
      // Validate new designation
      if (!toUpdate["promotionTo.designation"].id || !toUpdate["promotionTo.designation"].name) {
        return { done: false, error: "New designation is required" };
      }
    }
    
    if (updateData.salaryChange) {
      toUpdate.salaryChange = {
        previousSalary: updateData.salaryChange.previousSalary || null,
        newSalary: updateData.salaryChange.newSalary || null,
        increment: updateData.salaryChange.increment || null,
        incrementPercentage: updateData.salaryChange.incrementPercentage || null
      };
    }
    
    if (updateData.updatedBy) {
      toUpdate.updatedBy = {
        userId: (updateData.updatedBy.userId || "").trim(),
        userName: (updateData.updatedBy.userName || "").trim()
      };
    }
    
    toUpdate.updatedAt = now;
    
    // Validate changes if critical fields are being updated
    if (toUpdate.promotionDate || toUpdate["promotionTo.designation"]) {
      // Create a merged object for validation
      const mergedPromotion = {
        ...existing,
        ...toUpdate,
        promotionTo: {
          ...existing.promotionTo,
          designation: toUpdate["promotionTo.designation"] || existing.promotionTo.designation,
          department: toUpdate["promotionTo.department"] || existing.promotionTo.department
        },
        promotionDate: toUpdate.promotionDate || existing.promotionDate
      };
      
      const validationError = await validateCreate(collections, mergedPromotion, promotionId);
      if (validationError) {
        console.error("[PromotionService] Validation error on update", { validationError });
        return { done: false, error: validationError };
      }
    }
    
    const result = await collections.promotions.updateOne(
      { _id: new ObjectId(promotionId), companyId },
      { $set: toUpdate }
    );
    
    if (result.modifiedCount === 0) {
      return { done: false, error: "Failed to update promotion" };
    }
    
    const updated = await collections.promotions.findOne({ _id: new ObjectId(promotionId) });
    
    // Check if promotion should be applied based on date
    const promotionDate = new Date(updated.promotionDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    promotionDate.setHours(0, 0, 0, 0);
    
    // If promotion was already applied and date changed to future, revert to pending
    if (existing.status === "applied" && promotionDate > today) {
      console.log("[PromotionService] Promotion date moved to future, reverting to pending");
      await collections.promotions.updateOne(
        { _id: new ObjectId(promotionId) },
        { $set: { status: "pending", appliedAt: null } }
      );
    }
    // If promotion is pending and date is today or past, apply it
    else if (updated.status === "pending" && promotionDate <= today) {
      console.log("[PromotionService] Promotion date reached, applying promotion");
      try {
        await applyPromotion(companyId, promotionId);
      } catch (applyError) {
        console.error("[PromotionService] Error applying promotion:", applyError);
      }
    }
    // If already applied and department/designation changed, reapply
    else if (updated.status === "applied" && (toUpdate["promotionTo.designation"] || toUpdate["promotionTo.department"])) {
      console.log("[PromotionService] Applied promotion modified, reapplying");
      try {
        await applyPromotion(companyId, promotionId);
      } catch (applyError) {
        console.error("[PromotionService] Error reapplying promotion:", applyError);
      }
    }
    
    return { done: true, data: updated };
  } catch (error) {
    console.error("[PromotionService] Error in updatePromotion", { error: error.message });
    return { done: false, error: error.message };
  }
};

/**
 * Delete promotion record (hard delete)
 */
export const deletePromotion = async (companyId, promotionId) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[PromotionService] deletePromotion", { companyId, promotionId });
    
    if (!ObjectId.isValid(promotionId)) {
      return { done: false, error: "Invalid promotion ID format" };
    }
    
    // Check if promotion exists
    const existing = await collections.promotions.findOne({ 
      _id: new ObjectId(promotionId),
      companyId,
      isDeleted: { $ne: true }
    });
    
    if (!existing) {
      return { done: false, error: "Promotion not found" };
    }
    
    // Hard delete
    const result = await collections.promotions.deleteOne({ 
      _id: new ObjectId(promotionId),
      companyId 
    });
    
    if (result.deletedCount === 0) {
      return { done: false, error: "Failed to delete promotion" };
    }
    
    return { done: true, message: "Promotion deleted successfully" };
  } catch (error) {
    console.error("[PromotionService] Error in deletePromotion", { error: error.message });
    return { done: false, error: error.message };
  }
};

/**
 * Get list of employees for promotion selection
 */
export const getEmployeesForPromotion = async (companyId) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[PromotionService] getEmployeesForPromotion", { companyId });
    
    const employees = await collections.employees
      .find({ 
        isDeleted: { $ne: true },
        status: { $in: ["Active", "active"] }
      })
      .project({
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        image: 1,
        profilePicture: 1,
        department: 1,
        departmentId: 1,
        designation: 1,
        designationId: 1,
        employeeId: 1
      })
      .sort({ firstName: 1, lastName: 1 })
      .toArray();
    
    // Enrich with department and designation names
    const enrichedEmployees = await Promise.all(
      employees.map(async (emp) => {
        let departmentName = emp.department || "";
        let designationName = emp.designation || "";
        
        // Fetch department name
        if (emp.departmentId) {
          try {
            const dept = await collections.departments.findOne({ 
              _id: new ObjectId(emp.departmentId) 
            });
            if (dept) {
              departmentName = dept.name || dept.departmentName || departmentName;
            }
          } catch (e) {
            console.error("Error fetching department:", e);
          }
        }
        
        // Fetch designation name
        if (emp.designationId) {
          try {
            const desig = await collections.designations.findOne({ 
              _id: new ObjectId(emp.designationId) 
            });
            if (desig) {
              designationName = desig.name || desig.designation || designationName;
            }
          } catch (e) {
            console.error("Error fetching designation:", e);
          }
        }
        
        return {
          id: emp._id.toString(),
          name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
          email: emp.email,
          image: emp.image || emp.profilePicture || "",
          department: departmentName,
          departmentId: emp.departmentId,
          designation: designationName,
          designationId: emp.designationId,
          employeeId: emp.employeeId
        };
      })
    );
    
    return { done: true, data: enrichedEmployees };
  } catch (error) {
    console.error("[PromotionService] Error in getEmployeesForPromotion", { error: error.message });
    return { done: false, error: error.message };
  }
};

/**
 * Get list of departments for promotion selection
 */
export const getDepartments = async (companyId) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[PromotionService] getDepartments", { companyId });
    
    const departments = await collections.departments
      .find({ isDeleted: { $ne: true } })
      .project({
        _id: 1,
        name: 1,
        department: 1,
        departmentName: 1
      })
      .sort({ name: 1, department: 1 })
      .toArray();
    
    const formattedDepartments = departments.map(d => ({
      _id: d._id.toString(),
      department: d.name || d.department || d.departmentName || ""
    }));
    
    return { done: true, data: formattedDepartments };
  } catch (error) {
    console.error("[PromotionService] Error in getDepartments", { error: error.message });
    return { done: false, error: error.message };
  }
};

/**
 * Get employees by department for promotion selection
 */
export const getEmployeesByDepartment = async (companyId, departmentId) => {
  try {
    console.log("[PromotionService] getEmployeesByDepartment - received departmentId:", departmentId, "type:", typeof departmentId);

    const collections = getTenantCollections(companyId);
    
    // Query employees by department
    const query = {
      status: { $in: ["Active", "active"] },
      departmentId: departmentId,
      isDeleted: { $ne: true }
    };
    
    console.log("MongoDB query:", JSON.stringify(query, null, 2));
    
    const employees = await collections.employees
      .find(query)
      .project({ 
        _id: 1, 
        firstName: 1, 
        lastName: 1, 
        employeeId: 1, 
        employeeName: 1,
        email: 1,
        image: 1,
        profilePicture: 1,
        department: 1, 
        departmentId: 1,
        designation: 1,
        designationId: 1
      })
      .sort({ firstName: 1, lastName: 1 })
      .toArray();

    console.log("[PromotionService] getEmployeesByDepartment - found employees count:", employees.length);
    
    if (employees.length === 0) {
      console.log("[PromotionService] NO EMPLOYEES FOUND for departmentId:", departmentId);
    }

    // Enrich with department and designation names
    const enrichedEmployees = await Promise.all(
      employees.map(async (emp) => {
        let departmentName = emp.department || "";
        let designationName = "";
        
        // ALWAYS fetch designation name from designationId (FRESH DATA)
        // Don't trust the cached 'designation' string field
        if (emp.designationId) {
          try {
            const desig = await collections.designations.findOne({ 
              _id: new ObjectId(emp.designationId) 
            });
            if (desig) {
              designationName = desig.name || desig.designation || "";
              console.log(`[PromotionService] Employee ${emp.firstName} ${emp.lastName} - Fresh designation from DB: "${designationName}" (cached was: "${emp.designation}")`);
            } else {
              console.warn(`[PromotionService] Designation not found for ID: ${emp.designationId}, falling back to cached: "${emp.designation}"`);
              designationName = emp.designation || "";
            }
          } catch (e) {
            console.error("Error fetching designation:", e);
            designationName = emp.designation || "";
          }
        } else {
          // No designationId, use cached designation field
          designationName = emp.designation || "";
          console.log(`[PromotionService] Employee ${emp.firstName} ${emp.lastName} - No designationId, using cached: "${designationName}"`);
        }
        
        return {
          id: emp._id.toString(),
          name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
          email: emp.email,
          image: emp.image || emp.profilePicture || "",
          department: departmentName,
          departmentId: emp.departmentId,
          designation: designationName,
          designationId: emp.designationId,
          employeeId: emp.employeeId
        };
      })
    );
    
    return { done: true, data: enrichedEmployees };
  } catch (error) {
    console.error("[PromotionService] Error in getEmployeesByDepartment", { error: error.message });
    return { done: false, error: error.message };
  }
};

/**
 * Get list of designations for promotion selection
 */
export const getDesignationsForPromotion = async (companyId) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[PromotionService] getDesignationsForPromotion", { companyId });
    
    const designations = await collections.designations
      .find({ isDeleted: { $ne: true } })
      .project({
        _id: 1,
        name: 1,
        designation: 1,
        departmentId: 1,
        level: 1
      })
      .sort({ level: -1, name: 1 })
      .toArray();
    
    const formattedDesignations = designations.map(d => ({
      id: d._id.toString(),
      name: d.name || d.designation || "",
      level: d.level,
      departmentId: d.departmentId
    }));
    
    return { done: true, data: formattedDesignations };
  } catch (error) {
    console.error("[PromotionService] Error in getDesignationsForPromotion", { error: error.message });
    return { done: false, error: error.message };
  }
};

/**
 * Get list of designations by department for promotion selection
 */
export const getDesignationsByDepartment = async (companyId, departmentId) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[PromotionService] getDesignationsByDepartment", { companyId, departmentId, type: typeof departmentId });
    
    if (!departmentId) {
      return { done: false, error: "Department ID is required" };
    }
    
    // Query designations by departmentId
    const designations = await collections.designations
      .find({ 
        departmentId: departmentId,
        isDeleted: { $ne: true } 
      })
      .project({
        _id: 1,
        name: 1,
        designation: 1,
        departmentId: 1,
        level: 1
      })
      .sort({ level: -1, name: 1 })
      .toArray();
    
    console.log("[PromotionService] Found designations for department:", departmentId, "count:", designations.length);
    
    const formattedDesignations = designations.map(d => ({
      id: d._id.toString(),
      name: d.name || d.designation || "",
      level: d.level,
      departmentId: d.departmentId
    }));
    
    return { done: true, data: formattedDesignations };
  } catch (error) {
    console.error("[PromotionService] Error in getDesignationsByDepartment", { error: error.message });
    return { done: false, error: error.message };
  }
};

/**
 * Get employee details including current department
 */
export const getEmployeeDetails = async (companyId, employeeId) => {
  try {
    const collections = getTenantCollections(companyId);
    console.log("[PromotionService] getEmployeeDetails", { companyId, employeeId });
    
    if (!employeeId) {
      return { done: false, error: "Employee ID is required" };
    }
    
    // Query employee by ID
    const employee = await collections.employees
      .findOne({ 
        _id: new ObjectId(employeeId),
        isDeleted: { $ne: true } 
      });
    
    if (!employee) {
      console.error("[PromotionService] Employee not found:", employeeId);
      return { done: false, error: "Employee not found" };
    }
    
    console.log("[PromotionService] Raw employee data:", {
      id: employee._id,
      department: employee.department,
      departmentId: employee.departmentId,
      designation: employee.designation,
      designationId: employee.designationId
    });
    
    // Fetch department name - prioritize departmentId lookup
    let departmentName = "";
    
    // First try to get from departmentId
    if (employee.departmentId) {
      try {
        const department = await collections.departments.findOne({ 
          _id: new ObjectId(employee.departmentId),
          isDeleted: { $ne: true }
        });
        if (department) {
          departmentName = department.name || department.departmentName || department.department || "";
          console.log("[PromotionService] Fetched department from departmentId:", departmentName);
        } else {
          console.warn("[PromotionService] Department not found for departmentId:", employee.departmentId);
        }
      } catch (err) {
        console.error("[PromotionService] Error fetching department by ID:", err.message);
      }
    }
    
    // If still empty, try the department field as fallback (might be string name)
    if (!departmentName && employee.department) {
      departmentName = employee.department;
      console.log("[PromotionService] Using department field directly:", departmentName);
    }
    
    console.log("[PromotionService] Final department name:", departmentName || "EMPTY");
    
    const formattedEmployee = {
      id: employee._id.toString(),
      firstName: employee.firstName,
      lastName: employee.lastName,
      department: departmentName,
      departmentId: employee.departmentId,
      designation: employee.designation,
      designationId: employee.designationId,
      image: employee.image || employee.profileImage
    };
    
    console.log("[PromotionService] Returning employee with department:", formattedEmployee.department);
    
    return { done: true, data: formattedEmployee };
  } catch (error) {
    console.error("[PromotionService] Error in getEmployeeDetails", { error: error.message, stack: error.stack });
    return { done: false, error: error.message };
  }
};

/**
 * Export the promotion application functions for external use
 */
export { applyPromotion, processPendingPromotions };
