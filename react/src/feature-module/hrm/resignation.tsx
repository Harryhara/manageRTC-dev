import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Table from "../../core/common/dataTable/index";
import { all_routes } from "../router/all_routes";
import ImageWithBasePath from "../../core/common/imageWithBasePath";
import CommonSelect from "../../core/common/commonSelect";
import EmployeeNameCell from "../../core/common/EmployeeNameCell";
import { DatePicker } from "antd";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { useSocket } from "../../SocketContext";
import { Socket } from "socket.io-client";
import { format, parse } from "date-fns";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import dayjs from "dayjs";
import ResignationDetailsModal from "../../core/modals/ResignationDetailsModal";
import { toast } from "react-toastify";

type ResignationRow = {
  employeeName: string;
  employeeId: string;
  employee_id?: string; // Database ID for navigation
  employeeImage?: string;
  department: string;
  departmentId: string;
  designation?: string;
  reason: string;
  noticeDate: string;
  resignationDate: string; // already formatted by backend like "12 Sep 2025"
  resignationId: string;
};

type Stats = {
  totalResignations: string;
  recentResignations: string;
}

const Resignation = () => {
  const socket = useSocket() as Socket | null;

  const [rows, setRows] = useState<ResignationRow[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<{ value: string; label: string }[]>([]);
    const [employeeOptions, setEmployeeOptions] = useState<{ value: string; label: string }[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalResignations: "0",
    recentResignations: "0",
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string>("thisyear");
  const [customRange, setCustomRange] = useState<{
    startDate?: string;
    endDate?: string;
  }>({});
  const [editing, setEditing] = useState<any>(null);

  // State for viewing resignation details
  const [viewingResignation, setViewingResignation] = useState<ResignationRow | null>(null);

  // Controlled edit form data
  const [editForm, setEditForm] = useState({
    employeeName: "",
    employeeId: "",
    department: "",
    departmentId: "",
    noticeDate: "", // "DD-MM-YYYY" shown in modal
    reason: "",
    resignationDate: "", // "DD-MM-YYYY" shown in modal
    resignationId: "",
  });

  const ddmmyyyyToYMD = (s?: string) => {
    if (!s) return "";
    const d = parse(s, "dd-MM-yyyy", new Date());
    return isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
  };

  // Define fetchers early so they can be used in openEditModal
  const fetchStats = useCallback(() => {
    if (!socket) return;
    socket.emit("hr/resignation/resignation-details");
  }, [socket]);

  const fetchDepartments = useCallback(() => {
    if (!socket) return;
    socket.emit("hr/resignation/departmentlist");
  }, [socket]);

  const fetchEmployeesByDepartment = useCallback((departmentId: string) => {
    if (!socket || !departmentId) {
      console.log("fetchEmployeesByDepartment - socket or departmentId missing", { socket: !!socket, departmentId });
      setEmployeeOptions([]);
      return;
    }
    console.log("emit employees-by-department with departmentId:", departmentId, "type:", typeof departmentId);
    socket.emit("hr/resignation/employees-by-department", departmentId);
  }, [socket]);

  const openEditModal = (row: any) => {
    setEditForm({
      employeeName: row.employeeName || "",
      employeeId: row.employeeId || "",
      department: row.department || "",
      departmentId: row.departmentId || "",
      noticeDate: row.noticeDate
        ? format(parse(row.noticeDate, "yyyy-MM-dd", new Date()), "dd-MM-yyyy")
        : "",
      reason: row.reason || "",
      resignationDate: row.resignationDate
        ? format(
            parse(row.resignationDate, "yyyy-MM-dd", new Date()),
            "dd-MM-yyyy"
          )
        : "",
      resignationId: row.resignationId,
    });
    // Fetch employees for the selected department
    if (row.departmentId) {
      fetchEmployeesByDepartment(row.departmentId);
    }
  };

  const getModalContainer = () => {
    const modalElement = document.getElementById("modal-datepicker");
    return modalElement ? modalElement : document.body;
  };

  const parseYMD = (s?: string) =>
    s ? parse(s, "yyyy-MM-dd", new Date()) : null; // string -> Date
  const toYMD = (d: any) => {
    if (!d) return "";
    const dt = "toDate" in d ? d.toDate() : d; // support dayjs or Date
    return format(dt, "yyyy-MM-dd");
  };

  // state near top of component
  const [addForm, setAddForm] = useState({
    employeeName: "",
    employeeId: "",
    department: "",
    departmentId: "",
    reason: "",
    noticeDate: "", // YYYY-MM-DD from DatePicker
    resignationDate: "",
  });

  // Validation errors for Add Resignation
  const [addErrors, setAddErrors] = useState({
    departmentId: "",
    employeeId: "",
    reason: "",
    noticeDate: "",
    resignationDate: "",
  });

  // Validation errors for Edit Resignation
  const [editErrors, setEditErrors] = useState({
    departmentId: "",
    employeeId: "",
    reason: "",
    noticeDate: "",
    resignationDate: "",
  });

  const confirmDelete = (onConfirm: () => void) => {
    Modal.confirm({
      title: null,
      icon: null,
      closable: true,
      centered: true,
      okText: "Yes, Delete",
      cancelText: "Cancel",
      okButtonProps: {
        style: { background: "#ff4d4f", borderColor: "#ff4d4f" },
      },
      cancelButtonProps: { style: { background: "#f5f5f5" } },
      content: (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 12px",
              borderRadius: 12,
              background: "#ffecec",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <a aria-label="Delete">
              <DeleteOutlined style={{ fontSize: 18, color: "#ff4d4f" }} />
            </a>
          </div>
          <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
            Confirm Delete
          </div>
          <div style={{ color: "#6b7280" }}>
            You want to delete all the marked items, this can’t be undone once
            you delete.
          </div>
        </div>
      ),
      onOk: async () => {
        await onConfirm();
      },
    });
  };

  const fmtYMD = (s?: string) => {
    if (!s) return "";
    const d = parse(s, "yyyy-MM-dd", new Date());
    return isNaN(d.getTime()) ? s : format(d, "dd MMM yyyy");
  };

  // event handlers
  const onListResponse = useCallback((res: any) => {
    if (res?.done) {
      setRows(res.data || []);
    } else {
      setRows([]);
      console.error("Failed to fetch resignations:", res?.message);
      if (res?.message) {
        toast.error(res.message);
      }
    }
    setLoading(false);
  }, []);

  const onDepartmentsListResponse = useCallback((res: any) => {
    console.log("departments list response", res?.data);
    if (res?.done) {
      const opts = (res.data || []).map((dept: any) => ({
        value: dept._id,
        label: dept.department,
      }));
      setDepartmentOptions(opts);
    } else {
      setDepartmentOptions([]);
    }
  }, []);

  const onEmployeesByDepartmentResponse = useCallback((res: any) => {
    console.log("employees-by-dept response:", res?.data, "done:", res?.done, "message:", res?.message);
    if (res?.done) {

      const opts = (res.data || []).map((emp: any) => {
        console.log("Employee _id:", emp._id, "employeeId:", emp.employeeId, "employeeName:", emp.employeeName);
        return {
          value: emp.employeeId,
          label: `${emp.employeeId} - ${emp.employeeName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim()}`,
        };
      });
      console.log("Mapped employee options:", opts);
      setEmployeeOptions(opts);
    } else {
      console.log("Response not done or empty data");
      setEmployeeOptions([]);
    }
  }, []);

  const onStatsResponse = useCallback((res: any) => {
    if (res?.done && res.data) {
      setStats(res.data);
    }
  }, []);

  const onAddResponse = useCallback((res: any) => {
    if (res?.done) {
      toast.success("Resignation added successfully");
      // Close modal
      const modalElement = document.getElementById("add_resignation");
      if (modalElement) {
        const modal = window.bootstrap?.Modal?.getInstance(modalElement);
        if (modal) modal.hide();
      }
    } else {
      console.error("Failed to add resignation:", res?.message);
      if (res?.message) {
        toast.error(res.message);
      }
    }
  }, []);

  const onUpdateResponse = useCallback((res: any) => {
    if (res?.done) {
      toast.success("Resignation updated successfully");
      // Close modal
      const modalElement = document.getElementById("edit_resignation");
      if (modalElement) {
        const modal = window.bootstrap?.Modal?.getInstance(modalElement);
        if (modal) modal.hide();
      }
    } else {
      console.error("Failed to update resignation:", res?.message);
      if (res?.message) {
        toast.error(res.message);
      }
    }
  }, []);

  const onDeleteResponse = useCallback((res: any) => {
    if (res?.done) {
      toast.success("Resignation deleted successfully");
      setSelectedKeys([]);
    } else {
      console.error("Failed to delete resignation:", res?.message);
      if (res?.message) {
        toast.error(res.message);
      }
    }
  }, []);

  // register socket listeners and join room
  useEffect(() => {
    if (!socket) return;

    socket.emit("join-room", "hr_room");

    socket.on("hr/resignation/resignationlist-response", onListResponse);
    socket.on("hr/resignation/departmentlist-response", onDepartmentsListResponse);
    socket.on("hr/resignation/employees-by-department-response", onEmployeesByDepartmentResponse);
    socket.on("hr/resignation/resignation-details-response", onStatsResponse);
    socket.on("hr/resignation/add-resignation-response", onAddResponse);
    socket.on("hr/resignation/update-resignation-response", onUpdateResponse);
    socket.on("hr/resignation/delete-resignation-response", onDeleteResponse);

    return () => {
      socket.off("hr/resignation/resignationlist-response", onListResponse);
      socket.off("hr/resignation/departmentlist-response", onDepartmentsListResponse);
      socket.off("hr/resignation/employees-by-department-response", onEmployeesByDepartmentResponse);
      socket.off(
        "hr/resignation/resignation-details-response",
        onStatsResponse
      );
      socket.off("hr/resignation/add-resignation-response", onAddResponse);
      socket.off(
        "hr/resignation/update-resignation-response",
        onUpdateResponse
      );
      socket.off(
        "hr/resignation/delete-resignation-response",
        onDeleteResponse
      );
    };
  }, [
    socket,
    onListResponse,
    onDepartmentsListResponse,
    onEmployeesByDepartmentResponse,
    onStatsResponse,
    onAddResponse,
    onUpdateResponse,
    onDeleteResponse,
  ]);

  // fetchers
  const fetchList = useCallback(
    (type: string, range?: { startDate?: string; endDate?: string }) => {
      if (!socket) return;
      setLoading(true);
      const payload: any = { type };
      if (type === "custom" && range?.startDate && range?.endDate) {
        payload.startDate = range.startDate;
        payload.endDate = range?.endDate;
      }
      socket.emit("hr/resignation/resignationlist", payload);
    },
    [socket]
  );

  const toIsoFromDDMMYYYY = (s: string) => {
    // s like "13-09-2025"
    const [dd, mm, yyyy] = s.split("-").map(Number);
    if (!dd || !mm || !yyyy) return null;
    // Construct UTC date to avoid TZ shifts
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const handleAddSave = () => {
    console.log("[Resignation] handleAddSave called");

    // Validate form first
    if (!validateAddForm()) {
      console.log("[Resignation] Validation failed");
      return;
    }

    if (!socket) return;

    const noticeIso = toIsoFromDDMMYYYY(addForm.noticeDate);
    if (!noticeIso) {
      setAddErrors(prev => ({ ...prev, noticeDate: "Invalid notice date format" }));
      return;
    }
    
    const resIso = toIsoFromDDMMYYYY(addForm.resignationDate);
    if (!resIso) {
      setAddErrors(prev => ({ ...prev, resignationDate: "Invalid resignation date format" }));
      return;
    }

    const payload = {
      employeeName: addForm.employeeName,
      employeeId: addForm.employeeId,
      noticeDate: noticeIso,
      reason: addForm.reason,
      department: addForm.department,
      departmentId: addForm.departmentId,
      resignationDate: resIso,
    };

    console.log("[Resignation] Emitting add-resignation with payload:", payload);
    socket.emit("hr/resignation/add-resignation", payload);
    
    // Reset form after successful submission
    setAddForm({
      employeeName: "",
      employeeId: "",
      department: "",
      departmentId: "",
      reason: "",
      noticeDate: "",
      resignationDate: "",
    });
    
    // Clear errors
    setAddErrors({
      departmentId: "",
      employeeId: "",
      reason: "",
      noticeDate: "",
      resignationDate: "",
    });
    
    // Refresh the list
    socket.emit("hr/resignation/resignationlist", { type: "alltime" });
    socket.emit("hr/resignation/resignation-details");
  };

  const handleEditSave = () => {
    console.log("[Resignation] handleEditSave called");

    // Validate form first
    if (!validateEditForm()) {
      console.log("[Resignation] Validation failed");
      return;
    }

    if (!socket) return;

    const noticeIso = toIsoFromDDMMYYYY(editForm.noticeDate);
    if (!noticeIso) {
      setEditErrors(prev => ({ ...prev, noticeDate: "Invalid notice date format" }));
      return;
    }
    
    const resIso = toIsoFromDDMMYYYY(editForm.resignationDate);
    if (!resIso) {
      setEditErrors(prev => ({ ...prev, resignationDate: "Invalid resignation date format" }));
      return;
    }

    const payload = {
      employeeName: editForm.employeeName,
      employeeId: editForm.employeeId,
      noticeDate: noticeIso,
      reason: editForm.reason,
      department: editForm.department,
      departmentId: editForm.departmentId,
      resignationDate: resIso,
      resignationId: editForm.resignationId,
    };

    console.log("[Resignation] Emitting update-resignation with payload:", payload);
    socket.emit("hr/resignation/update-resignation", payload);
    
    // Reset form after successful submission
    setEditForm({
      employeeName: "",
      employeeId: "",
      department: "",
      departmentId: "",
      reason: "",
      noticeDate: "",
      resignationDate: "",
      resignationId: "",
    });
    
    // Clear errors
    setEditErrors({
      departmentId: "",
      employeeId: "",
      reason: "",
      noticeDate: "",
      resignationDate: "",
    });
    
    // Refresh the list
    socket.emit("hr/resignation/resignationlist", { type: "alltime" });
    socket.emit("hr/resignation/resignation-details");
  };

  // initial + reactive fetch
  useEffect(() => {
    if (!socket) return;
    fetchList(filterType, customRange);
    fetchDepartments();
    fetchStats();
  }, [socket, fetchList, fetchDepartments, fetchStats, filterType, customRange]);

  // ui events
  type Option = { value: string; label: string };
  const handleFilterChange = (opt: Option | null) => {
    const value = opt?.value ?? "alltime";
    setFilterType(value);
    if (value !== "custom") {
      setCustomRange({});
      fetchList(value);
    }
  };

  const handleCustomRange = (_: any, dateStrings: [string, string]) => {
    if (dateStrings && dateStrings[0] && dateStrings[1]) {
      const range = { startDate: dateStrings[0], endDate: dateStrings[1] };
      setCustomRange(range);
      fetchList("custom", range);
    }
  };

  const handleBulkDelete = () => {
    if (!socket || selectedKeys.length === 0) return;
    if (
      window.confirm(
        `Delete ${selectedKeys.length} record(s)? This cannot be undone.`
      )
    ) {
      socket.emit("hr/resignation/delete-resignation", selectedKeys);
    }
  };

  const handleSelectionChange = (keys: React.Key[]) => {
    setSelectedKeys(keys as string[]);
  };

  const handleAddDepartmentChange = (opt: any) => {
    console.log("Add department selected - _id:", opt?.value);
    setAddForm({
      ...addForm,
      department: opt?.label || "",
      departmentId: opt?.value || "",
      employeeName: "",
      employeeId: "",
    });
    // Clear department and dependent field errors
    setAddErrors(prev => ({ ...prev, departmentId: "", employeeId: "" }));
    if (opt?.value) {
      fetchEmployeesByDepartment(opt.value);
    }
  };

  const handleEditDepartmentChange = (opt: any) => {
    console.log("Edit department selected - _id:", opt?.value);
    setEditForm({
      ...editForm,
      department: opt?.label || "",
      departmentId: opt?.value || "",
      employeeName: "",
      employeeId: "",
    });
    // Clear department and dependent field errors
    setEditErrors(prev => ({ ...prev, departmentId: "", employeeId: "" }));
    if (opt?.value) {
      fetchEmployeesByDepartment(opt.value);
    }
  };

  // Validate Add Resignation form
  const validateAddForm = (): boolean => {
    const errors = {
      departmentId: "",
      employeeId: "",
      reason: "",
      noticeDate: "",
      resignationDate: "",
    };

    let isValid = true;

    if (!addForm.departmentId || addForm.departmentId === "") {
      errors.departmentId = "Please select a department";
      isValid = false;
    }

    if (!addForm.employeeId || addForm.employeeId === "") {
      errors.employeeId = "Please select a resigning employee";
      isValid = false;
    }

    if (!addForm.reason || addForm.reason.trim() === "") {
      errors.reason = "Please enter a reason for resignation";
      isValid = false;
    }

    if (!addForm.noticeDate || addForm.noticeDate === "") {
      errors.noticeDate = "Please select a notice date";
      isValid = false;
    }

    if (!addForm.resignationDate || addForm.resignationDate === "") {
      errors.resignationDate = "Please select a resignation date";
      isValid = false;
    }

    // Date validation: resignation date should be after or equal to notice date
    if (addForm.noticeDate && addForm.resignationDate) {
      const noticeIso = toIsoFromDDMMYYYY(addForm.noticeDate);
      const resignationIso = toIsoFromDDMMYYYY(addForm.resignationDate);
      
      if (noticeIso && resignationIso) {
        const noticeDate = new Date(noticeIso);
        const resignationDate = new Date(resignationIso);
        
        if (resignationDate < noticeDate) {
          errors.resignationDate = "Resignation date cannot be earlier than notice date";
          isValid = false;
        }
      }
    }

    setAddErrors(errors);
    return isValid;
  };

  // Validate Edit Resignation form
  const validateEditForm = (): boolean => {
    const errors = {
      departmentId: "",
      employeeId: "",
      reason: "",
      noticeDate: "",
      resignationDate: "",
    };

    let isValid = true;

    if (!editForm.departmentId || editForm.departmentId === "") {
      errors.departmentId = "Please select a department";
      isValid = false;
    }

    if (!editForm.employeeId || editForm.employeeId === "") {
      errors.employeeId = "Please select a resigning employee";
      isValid = false;
    }

    if (!editForm.reason || editForm.reason.trim() === "") {
      errors.reason = "Please enter a reason for resignation";
      isValid = false;
    }

    if (!editForm.noticeDate || editForm.noticeDate === "") {
      errors.noticeDate = "Please select a notice date";
      isValid = false;
    }

    if (!editForm.resignationDate || editForm.resignationDate === "") {
      errors.resignationDate = "Please select a resignation date";
      isValid = false;
    }

    // Date validation: resignation date should be after or equal to notice date
    if (editForm.noticeDate && editForm.resignationDate) {
      const noticeIso = toIsoFromDDMMYYYY(editForm.noticeDate);
      const resignationIso = toIsoFromDDMMYYYY(editForm.resignationDate);
      
      if (noticeIso && resignationIso) {
        const noticeDate = new Date(noticeIso);
        const resignationDate = new Date(resignationIso);
        
        if (resignationDate < noticeDate) {
          errors.resignationDate = "Resignation date cannot be earlier than notice date";
          isValid = false;
        }
      }
    }

    setEditErrors(errors);
    return isValid;
  };

  // Handle view resignation details
  const handleViewClick = (resignation: ResignationRow) => {
    console.log("[Resignation] View clicked:", resignation);
    setViewingResignation(resignation);
  };

  // table columns (preserved look, wired to backend fields)
  const columns: any[] = [
    {
      title: "Employee ID",
      dataIndex: "employeeId",
      render: (text: string) => (
        <span className="fw-medium">{text}</span>
      ),
      sorter: (a: ResignationRow, b: ResignationRow) =>
        a.employeeId.localeCompare(b.employeeId),
    },
    {
      title: "Name",
      dataIndex: "employeeName",
      render: (text: string, record: ResignationRow) => {
        // Extract just the name part if employeeName contains "ID - Name" format
        const getDisplayName = (employeeName: string): string => {
          const parts = employeeName.split(' - ');
          if (parts.length > 1) {
            return parts.slice(1).join(' - ');
          }
          return employeeName;
        };
        
        const displayName = getDisplayName(text);
        
        return (
          <EmployeeNameCell
            name={displayName}
            image={record.employeeImage}
            employeeId={record.employee_id || record.employeeId}
            avatarTheme="danger"
          />
        );
      },
      sorter: (a: ResignationRow, b: ResignationRow) => {
        const getDisplayName = (employeeName: string): string => {
          const parts = employeeName.split(' - ');
          if (parts.length > 1) {
            return parts.slice(1).join(' - ');
          }
          return employeeName;
        };
        return getDisplayName(a.employeeName).localeCompare(getDisplayName(b.employeeName));
      },
    },
    {
      title: "Department",
      dataIndex: "department",
    },
    {
      title: "Reason",
      dataIndex: "reason",
      render: (text: string) => {
        if (!text) return '-';
        const maxLength = 50;
        const truncated = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        return (
          <span title={text} className="d-inline-block" style={{ maxWidth: '250px' }}>
            {truncated}
          </span>
        );
      },
    },
    {
      title: "Notice Date",
      dataIndex: "noticeDate",
      render: (val: string) => fmtYMD(val),
      sorter: (a: ResignationRow, b: ResignationRow) =>
        new Date(a.noticeDate).getTime() - new Date(b.noticeDate).getTime(),
    },
    {
      title: "Resignation Date",
      dataIndex: "resignationDate",
      render: (val: string) => fmtYMD(val),
      sorter: (a: ResignationRow, b: ResignationRow) =>
        new Date(a.resignationDate).getTime() -
        new Date(b.resignationDate).getTime(),
    },
    {
      title: "",
      dataIndex: "actions",
      render: (_: any, record: ResignationRow) => (
        <div className="action-icon d-inline-flex">
          <Link
            to="#"
            className="me-2"
            onClick={(e) => {
              e.preventDefault();
              handleViewClick(record);
            }}
            data-bs-toggle="modal"
            data-bs-target="#view_resignation"
          >
            <i className="ti ti-eye" />
          </Link>
          <a
            href="#"
            className="me-2"
            data-bs-toggle="modal"
            data-bs-target="#edit_resignation"
            onClick={(e) => {
              openEditModal(record);
            }}
          >
            <i className="ti ti-edit" />
          </a>
          <a
            aria-label="Delete"
            onClick={(e) => {
              e.preventDefault();
              confirmDelete(() =>
                socket?.emit("hr/resignation/delete-resignation", [record.resignationId])
              );
            }}
          >
            <i className="ti ti-trash" />
          </a>
        </div>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys: selectedKeys,
    onChange: (keys: React.Key[]) => setSelectedKeys(keys as string[]),
  };

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Breadcrumb */}
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Resignation</h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={all_routes.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">HR</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Resignation
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap ">
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary d-flex align-items-center"
                  data-bs-toggle="modal"
                  data-bs-target="#new_resignation"
                >
                  <i className="ti ti-circle-plus me-2" />
                  Add Resignation
                </Link>
              </div>
              <div className="head-icons ms-2">
                <CollapseHeader />
              </div>
            </div>
          </div>
          {/* /Breadcrumb */}
          {/* Resignation List */}
          <div className="row">
            <div className="col-sm-12">
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                  <h5 className="d-flex align-items-center">
                    Resignation List
                  </h5>
                  <div className="d-flex align-items-center flex-wrap row-gap-3">
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="d-inline-flex align-items-center fs-12"
                      >
                        <label className="fs-12 d-inline-flex me-1">
                          Sort By :{" "}
                        </label>
                        <CommonSelect
                          className="select"
                          options={[
                            { value: "today", label: "Today" },
                            { value: "yesterday", label: "Yesterday" },
                            { value: "last7days", label: "Last 7 Days" },
                            { value: "last30days", label: "Last 30 Days" },
                            { value: "thismonth", label: "This Month" },
                            { value: "lastmonth", label: "Last Month" },
                            { value: "thisyear", label: "This Year" },
                            { value: "alltime", label: "All Time"},
                          ]}
                          defaultValue={filterType}
                          onChange={handleFilterChange}
                        />
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <Table dataSource={rows} columns={columns} Selection={true} />
                </div>
              </div>
            </div>
          </div>
          {/* /Resignation List  */}
        </div>
        {/* Footer */}
        <div className="footer d-sm-flex align-items-center justify-content-between bg-white border-top p-3">
          <p className="mb-0">2014 - 2025 © SmartHR.</p>
          <p>
            Designed &amp; Developed By{" "}
            <Link to="#" className="text-primary">
              Dreams
            </Link>
          </p>
        </div>
        {/* /Footer */}
      </div>
      {/* Add Resignation */}
      <div className="modal fade" id="new_resignation">
        <div className="modal-dialog modal-dialog-centered modal-md">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Resignation</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form>
              <div className="modal-body pb-0">
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Department</label>
                      <CommonSelect
                        className="select"
                        options={departmentOptions}
                        value={departmentOptions.find(opt => opt.value === addForm.departmentId) || null}
                        onChange={handleAddDepartmentChange}
                      />
                      {addErrors.departmentId && <div className="text-danger">{addErrors.departmentId}</div>}
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Resigning Employee</label>
                      <CommonSelect
                        className="select"
                        options={employeeOptions}
                        value={employeeOptions.find(opt => opt.value === addForm.employeeId) || null}
                        onChange={(opt: any) =>
                          setAddForm({
                            ...addForm,
                            employeeId: opt?.value || "",
                            employeeName: opt?.label || "",
                          })
                        }
                      />
                      {addErrors.employeeId && <div className="text-danger">{addErrors.employeeId}</div>}
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label mb-0">Reason</label>
                        <small className="text-muted">
                          {addForm.reason.length}/500 characters
                        </small>
                      </div>
                      <textarea
                        className="form-control"
                        rows={3}
                        maxLength={500}
                        value={addForm.reason}
                        onChange={(e) =>
                          setAddForm({ ...addForm, reason: e.target.value })
                        }
                        placeholder="Enter reason for resignation (max 500 characters)"
                      />
                      {addErrors.reason && <div className="text-danger">{addErrors.reason}</div>}
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Notice Date</label>
                      <div className="input-icon-end position-relative">
                        <DatePicker
                          className="form-control datetimepicker"
                          format={{
                            format: "DD-MM-YYYY",
                            type: "mask",
                          }}
                          getPopupContainer={getModalContainer}
                          placeholder="DD-MM-YYYY"
                          onChange={(_, dateString) =>
                            setAddForm({
                              ...addForm,
                              noticeDate: dateString as string,
                            })
                          }
                        />
                        <span className="input-icon-addon">
                          <i className="ti ti-calendar text-gray-7" />
                        </span>
                      </div>
                      {addErrors.noticeDate && <div className="text-danger">{addErrors.noticeDate}</div>}
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Resignation Date</label>
                      <div className="input-icon-end position-relative">
                        <DatePicker
                          className="form-control datetimepicker"
                          format={{
                            format: "DD-MM-YYYY",
                            type: "mask",
                          }}
                          getPopupContainer={getModalContainer}
                          placeholder="DD-MM-YYYY"
                          onChange={(_, dateString) =>
                            setAddForm({
                              ...addForm,
                              resignationDate: dateString as string,
                            })
                          }
                        />
                        <span className="input-icon-addon">
                          <i className="ti ti-calendar text-gray-7" />
                        </span>
                      </div>
                      {addErrors.resignationDate && <div className="text-danger">{addErrors.resignationDate}</div>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-white border me-2"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-bs-dismiss="modal"
                  className="btn btn-primary"
                  onClick={handleAddSave}
                >
                  Add Resignation
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Add Resignation */}
      {/* Edit Resignation */}
      <div className="modal fade" id="edit_resignation">
        <div className="modal-dialog modal-dialog-centered modal-md">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Resignation</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form>
              <div className="modal-body pb-0">
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Department</label>
                      <CommonSelect
                        className="select"
                        options={departmentOptions}
                        value={departmentOptions.find(opt => opt.value === editForm.departmentId) || null}
                        onChange={handleEditDepartmentChange}
                      />
                      {editErrors.departmentId && <div className="text-danger">{editErrors.departmentId}</div>}
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">
                        Resigning Employee&nbsp;
                      </label>
                      <CommonSelect
                        className="select"
                        options={employeeOptions}
                        value={employeeOptions.find(opt => opt.value === editForm.employeeId) || null}
                        onChange={(opt: any) =>
                          setEditForm({
                            ...editForm,
                            employeeId: opt?.value || "",
                            employeeName: opt?.label || "",
                          })
                        }
                      />
                      {editErrors.employeeId && <div className="text-danger">{editErrors.employeeId}</div>}
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label mb-0">Reason</label>
                        <small className="text-muted">
                          {editForm.reason.length}/500 characters
                        </small>
                      </div>
                      <textarea
                        className="form-control"
                        rows={3}
                        maxLength={500}
                        value={editForm.reason}
                        onChange={(e) =>
                          setEditForm({ ...editForm, reason: e.target.value })
                        }
                        placeholder="Enter reason for resignation (max 500 characters)"
                      />
                      {editErrors.reason && <div className="text-danger">{editErrors.reason}</div>}
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Notice Date</label>
                      <div className="input-icon-end position-relative">
                        <DatePicker
                          className="form-control datetimepicker"
                          format={{ format: "DD-MM-YYYY", type: "mask" }}
                          getPopupContainer={getModalContainer}
                          placeholder="DD-MM-YYYY"
                          defaultValue={
                            editForm.noticeDate
                              ? dayjs(editForm.noticeDate, "DD-MM-YYYY")
                              : null
                          }
                          onChange={(_, dateString) =>
                            setEditForm({
                              ...editForm,
                              noticeDate: dateString as string,
                            })
                          }
                        />
                        <span className="input-icon-addon">
                          <i className="ti ti-calendar text-gray-7" />
                        </span>
                      </div>
                      {editErrors.noticeDate && <div className="text-danger">{editErrors.noticeDate}</div>}
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Resignation Date</label>
                      <div className="input-icon-end position-relative">
                        <DatePicker
                          className="form-control datetimepicker"
                          format={{ format: "DD-MM-YYYY", type: "mask" }}
                          getPopupContainer={getModalContainer}
                          placeholder="DD-MM-YYYY"
                          defaultValue={
                            editForm.resignationDate
                              ? dayjs(editForm.resignationDate, "DD-MM-YYYY")
                              : null
                          }
                          onChange={(_, dateString) =>
                            setEditForm({
                              ...editForm,
                              resignationDate: dateString as string,
                            })
                          }
                        />
                        <span className="input-icon-addon">
                          <i className="ti ti-calendar text-gray-7" />
                        </span>
                      </div>
                      {editErrors.resignationDate && <div className="text-danger">{editErrors.resignationDate}</div>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-white border me-2"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-bs-dismiss="modal"
                  className="btn btn-primary"
                  onClick={handleEditSave}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Edit Resignation */}
      {/* View Resignation Details Modal */}
      <ResignationDetailsModal resignation={viewingResignation} modalId="view_resignation" />
      {/* /View Resignation Details Modal */}
    </>
  );
};

export default Resignation;