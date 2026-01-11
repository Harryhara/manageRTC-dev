import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import CollapseHeader from "../../core/common/collapse-header/collapse-header";
import { all_routes } from "../router/all_routes";
import Table from "../../core/common/dataTable/index";
import { HolidaysData } from "../../core/data/json/holidaysData";
import Footer from "../../core/common/footer";
import { useSocket } from "../../SocketContext";
import { Socket } from "socket.io-client";
import { log } from "console";
import { LogIn } from "react-feather";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { hideModal, cleanupModalBackdrops } from "../../utils/modalUtils";

interface Holidays {
  _id: string;
  title: string;
  date: string;
  description: string;
  status: "active" | "inactive";
}

interface HolidayEntry {
  id: string;
  title: string;
  date: string;
  description: string;
  status: string;
  repeatsEveryYear: boolean;
}

interface HolidayEntryErrors {
  title?: string;
  date?: string;
  status?: string;
}

interface ValidationErrors {
  [key: string]: HolidayEntryErrors;
}

const Holidays = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [responseData, setResponseData] = useState(null);
  const [holiday, setHoliday] = useState<Holidays[]>([]);
  const [editingHoliday, setEditingHoliday] = useState<Holidays | null>(null);
  const [deleteHoliday, setDeleteHoliday] = useState<Holidays | null>(null);

  // State for multiple holiday entries
  const [holidayEntries, setHolidayEntries] = useState<HolidayEntry[]>([
    { id: "1", title: "", date: "", description: "", status: "active", repeatsEveryYear: false }
  ]);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [successfulSubmissions, setSuccessfulSubmissions] = useState(0);
  const [expectedSubmissions, setExpectedSubmissions] = useState(0);
  const [hasSubmissionError, setHasSubmissionError] = useState(false);

  // State for edit modal
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editRepeatsEveryYear, setEditRepeatsEveryYear] = useState(false);
  const [editValidationErrors, setEditValidationErrors] = useState<HolidayEntryErrors>({});

  const socket = useSocket() as Socket | null;

  useEffect(() => {
    if (!socket) return;

    let isMounted = true;

    setLoading(true);

    const timeoutId = setTimeout(() => {
      if (loading && isMounted) {
        console.warn("Holidays loading timeout - showing fallback");
        setError("Holidays loading timed out. Please refresh the page.");
        setLoading(false);
      }
    }, 30000);

    socket.emit("hrm/holiday/get");

    const handleAddHolidayResponse = (response: any) => {
      if (!isMounted) return;

      const currentCount = submissionCount + 1;
      setSubmissionCount(currentCount);

      if (response.done) {
        setResponseData(response.data);
        
        // Track successful submission
        setSuccessfulSubmissions(prev => prev + 1);
        
        // Only show success toast and close modal when all submissions are complete without errors
        if (currentCount >= expectedSubmissions && !hasSubmissionError) {
          const successCount = successfulSubmissions + 1; // Include current success
          toast.success(`${successCount} holiday${successCount > 1 ? 's' : ''} added successfully`);
          setError(null);
          setIsSubmitting(false);
          setLoading(false);
          resetAddForm();
          
          // Close modal with proper cleanup
          hideModal("add_holiday");
          
          if (socket) {
            socket.emit("hrm/holiday/get");
          }
        } else if (currentCount >= expectedSubmissions && hasSubmissionError) {
          // Some succeeded, some failed - don't close modal
          setIsSubmitting(false);
          setLoading(false);
        }
      } else {
        // Handle backend validation errors
        const errorMessage = response.message || "Failed to add holiday";
        setHasSubmissionError(true);
        
        // Map backend errors to inline validation errors
        if (response.errors) {
          const firstEntryId = holidayEntries[0]?.id;
          if (firstEntryId) {
            setValidationErrors(prev => ({
              ...prev,
              [firstEntryId]: response.errors
            }));
          }
          console.error("Backend validation errors:", response.errors);
        }
        
        setError(errorMessage);
        setIsSubmitting(false);
        setLoading(false);
        
        // Keep modal open so user can fix errors - DO NOT show toast for validation errors
      }
    };

    const handleGetHolidayResponse = (response: any) => {
      if (!isMounted) return;

      if (response.done) {
        setHoliday(response.data);
        setResponseData(response.data);
        setError(null);
        setLoading(false);
      } else {
        setError(response.message || response.error || "Failed to get holiday");
        setLoading(false);
      }
    };

    const handleEditHolidayResponse = (response: any) => {
      if (!isMounted) return;

      if (response.done) {
        setResponseData(response.data);
        toast.success("Holiday updated successfully");
        setError(null);
        setLoading(false);
        setEditingHoliday(null);
        
        // Close modal with proper cleanup
        hideModal("edit_holiday");
        
        if (socket) {
          socket.emit("hrm/holiday/get");
        }
      } else {
        // Map backend errors to edit form validation
        if (response.errors) {
          setEditValidationErrors(response.errors);
        }
        setError(response.message || "Failed to update holiday");
        setLoading(false);
        // Keep modal open to show inline errors
      }
    }

    const handleDeleteHolidayResponse = (response: any) => {
      if (!isMounted) return;

      if (response.done) {
        setResponseData(response.data);
        toast.success("Holiday deleted successfully");
        setError(null);
        setLoading(false);
        if (socket) {
          socket.emit("hrm/holiday/get");
        }
      } else {
        setError(response.message || response.error || "Failed to delete holiday");
        toast.error(response.message || response.error || "Failed to delete holiday");
        setLoading(false);
      }
    }

    socket.on("hrm/holiday/add-response", handleAddHolidayResponse);
    socket.on("hrm/holiday/get-response", handleGetHolidayResponse);
    socket.on("hrm/holiday/update-response", handleEditHolidayResponse);
    socket.on("hrm/holiday/delete-response", handleDeleteHolidayResponse);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      socket.off("hrm/holiday/add-response", handleAddHolidayResponse);
      socket.off("hrm/holiday/get-response", handleGetHolidayResponse);
      socket.off("hrm/holiday/update-response", handleEditHolidayResponse);
      socket.off("hrm/holiday/delete-response", handleDeleteHolidayResponse);
      
      // Cleanup any lingering modal backdrops when component unmounts
      cleanupModalBackdrops();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const handleDeleteHoliday = (holidayId: string) => {
    try {
      setLoading(true);
      setError(null);

      if (!socket) {
        setError("Socket connection is not available");
        setLoading(false);
        return;
      }

      if (!holidayId) {
        setError("Holiday ID is required");
        setLoading(false);
        return;
      }

      socket.emit("hrm/holiday/delete", holidayId);
    } catch (error) {
      setError("Failed to initiate holiday deletion");
      setLoading(false);
    }
  };

  // Add new holiday entry
  const addHolidayEntry = () => {
    const newId = (parseInt(holidayEntries[holidayEntries.length - 1].id) + 1).toString();
    setHolidayEntries([
      ...holidayEntries,
      { id: newId, title: "", date: "", description: "", status: "active", repeatsEveryYear: false }
    ]);
  };

  // Remove holiday entry
  const removeHolidayEntry = (id: string) => {
    if (holidayEntries.length === 1) {
      toast.error("At least one holiday entry is required");
      return;
    }
    setHolidayEntries(holidayEntries.filter(entry => entry.id !== id));
    // Remove validation errors for this entry
    const newErrors = { ...validationErrors };
    delete newErrors[id];
    setValidationErrors(newErrors);
  };

  // Update holiday entry field
  const updateHolidayEntry = (id: string, field: keyof HolidayEntry, value: string | boolean) => {
    setHolidayEntries(
      holidayEntries.map(entry =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
    // Clear error for this field when user starts typing
    if (validationErrors[id]?.[field as keyof HolidayEntryErrors]) {
      setValidationErrors({
        ...validationErrors,
        [id]: {
          ...validationErrors[id],
          [field]: undefined
        }
      });
    }
  };

  // Validate single holiday entry
  const validateHolidayEntry = (entry: HolidayEntry): HolidayEntryErrors => {
    const errors: HolidayEntryErrors = {};
    
    if (!entry.title.trim()) {
      errors.title = "Title is required";
    }
    
    if (!entry.date) {
      errors.date = "Date is required";
    }
    
    if (!entry.status) {
      errors.status = "Status is required";
    }
    
    return errors;
  };

  // Validate all holiday entries
  const validateAllEntries = (): boolean => {
    const errors: ValidationErrors = {};
    let hasErrors = false;

    holidayEntries.forEach(entry => {
      const entryErrors = validateHolidayEntry(entry);
      if (Object.keys(entryErrors).length > 0) {
        errors[entry.id] = entryErrors;
        hasErrors = true;
      }
    });

    setValidationErrors(errors);
    return !hasErrors;
  };

  // Handle submit multiple holidays
  const handleSubmitHolidays = () => {
    // Run frontend validation first
    if (!validateAllEntries()) {
      // Errors are already displayed inline - don't show toast
      return;
    }

    if (!socket) {
      toast.error("Socket connection is not available");
      return;
    }

    setIsSubmitting(true);
    setLoading(true);
    setSubmissionCount(0);
    setSuccessfulSubmissions(0);
    setExpectedSubmissions(holidayEntries.length);
    setHasSubmissionError(false);

    // Submit each holiday
    holidayEntries.forEach((entry) => {
      const holidayData = {
        title: entry.title.trim(),
        date: entry.date,
        description: entry.description.trim(),
        status: entry.status,
        repeatsEveryYear: entry.repeatsEveryYear
      };

      socket.emit("hrm/holiday/add", holidayData);
    });

    // Don't close modal or reset form here - wait for responses
  };

  // Reset add form
  const resetAddForm = () => {
    setHolidayEntries([{ id: "1", title: "", date: "", description: "", status: "active", repeatsEveryYear: false }]);
    setValidationErrors({});
    setIsSubmitting(false);
    setSubmissionCount(0);
    setSuccessfulSubmissions(0);
    setExpectedSubmissions(0);
    setHasSubmissionError(false);
  };

  // Handle edit modal open
  useEffect(() => {
    if (editingHoliday) {
      setEditTitle(editingHoliday.title);
      setEditDate(editingHoliday.date.split('T')[0]); // Format date for input
      setEditDescription(editingHoliday.description || "");
      setEditStatus(editingHoliday.status);
      setEditRepeatsEveryYear((editingHoliday as any).repeatsEveryYear || false);
      setEditValidationErrors({});
    }
  }, [editingHoliday]);

  // Validate edit form
  const validateEditForm = (): boolean => {
    const errors: HolidayEntryErrors = {};
    
    if (!editTitle.trim()) {
      errors.title = "Title is required";
    }
    
    if (!editDate) {
      errors.date = "Date is required";
    }
    
    if (!editStatus) {
      errors.status = "Status is required";
    }
    
    setEditValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle edit submit
  const handleEditSubmit = () => {
    if (!validateEditForm()) {
      // Show inline errors, don't show toast
      return;
    }

    if (!socket || !editingHoliday) {
      toast.error("Socket connection is not available");
      return;
    }

    setLoading(true);

    const updatedHoliday = {
      _id: editingHoliday._id,
      title: editTitle.trim(),
      date: editDate,
      description: editDescription.trim(),
      status: editStatus,
      repeatsEveryYear: editRepeatsEveryYear
    };

    socket.emit("hrm/holiday/update", updatedHoliday);

    // Don't close modal here - wait for response
    // Modal will close in handleEditHolidayResponse if successful
  };

  // Clear edit validation error
  const clearEditError = (field: keyof HolidayEntryErrors) => {
    if (editValidationErrors[field]) {
      setEditValidationErrors({
        ...editValidationErrors,
        [field]: undefined
      });
    }
  };

  const routes = all_routes;
  const data = holiday;
  const columns = [
    {
      title: "Title",
      dataIndex: "title",
      render: (text: string) => (
        <h6 className="fw-medium">
          <Link to="#">{text}</Link>
        </h6>
      ),
      sorter: (a: any, b: any) => a.Title.length - b.Title.length,
    },
    {
      title: "Date",
      dataIndex: "date",
      sorter: (a: any, b: any) => a.Date.length - b.Date.length,
      render: (date: string | Date) => {
        if (!date) return "-";
        const d = new Date(date);
        return d.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        });
      }
    },
    {
      title: "Description",
      dataIndex: "description",
      sorter: (a: any, b: any) => a.Description.length - b.Description.length,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <span className={`badge ${((text === 'active') || (text === 'Active')) ? 'badge-success' : 'badge-danger'}   d-inline-flex align-items-center badge-sm`}>
          <i className="ti ti-point-filled me-1" />
          {text}
        </span>
      ),
      sorter: (a: any, b: any) => a.Status.length - b.Status.length,
    },
    {
      title: "",
      dataIndex: "actions",
      render: (_test: any, holiday: Holidays) => (
        <div className="action-icon d-inline-flex">
          <Link
            to="#"
            className="me-2"
            data-bs-toggle="modal"
            data-inert={true}
            data-bs-target="#edit_holiday"
            onClick={() => setEditingHoliday(holiday)}
          >
            <i className="ti ti-edit" />
          </Link>
          <Link
            to="#"
            data-bs-toggle="modal"
            data-inert={true}
            data-bs-target="#delete_modal"
            onClick={() => setDeleteHoliday(holiday)}
          >
            <i className="ti ti-trash" />
          </Link>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ height: "400px" }}
          >
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    console.error(error);
    toast.error(error);
  }

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Breadcrumb */}
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Holidays</h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">Employee</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Holidays
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap ">
              <div className="mb-2">
                <Link
                  to="#"
                  data-bs-toggle="modal"
                  data-inert={true}
                  data-bs-target="#add_holiday"
                  className="btn btn-primary d-flex align-items-center"
                >
                  <i className="ti ti-circle-plus me-2" />
                  Add Holiday
                </Link>
              </div>
              <div className="head-icons ms-2">
                <CollapseHeader />
              </div>
            </div>
          </div>
          {/* /Breadcrumb */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-3">
              <h5>Holidays List</h5>
            </div>
            <div className="card-body p-0">
              <Table dataSource={data} columns={columns} Selection={true} />
            </div>
          </div>
        </div>
        <Footer />
      </div>
      {/* /Page Wrapper */}

      {/* Add Holiday Modal */}
      <div className="modal fade" id="add_holiday">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Holidays</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={resetAddForm}
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Holiday Entries</h5>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={addHolidayEntry}
                  >
                    <i className="ti ti-plus me-1" />
                    Add Another Holiday
                  </button>
                </div>
                
                <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                  {holidayEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="border rounded p-3 mb-3"
                      style={{ position: "relative" }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="mb-0">Holiday {index + 1}</h6>
                        {holidayEntries.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-icon btn-danger"
                            onClick={() => removeHolidayEntry(entry.id)}
                            title="Remove this holiday"
                          >
                            <i className="ti ti-trash" />
                          </button>
                        )}
                      </div>

                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Title <span className="text-danger">*</span>
                            </label>
                            <input
                              type="text"
                              className={`form-control ${
                                validationErrors[entry.id]?.title ? "is-invalid" : ""
                              }`}
                              placeholder="Enter holiday title"
                              value={entry.title}
                              onChange={(e) =>
                                updateHolidayEntry(entry.id, "title", e.target.value)
                              }
                            />
                            {validationErrors[entry.id]?.title && (
                              <div className="invalid-feedback d-block">
                                {validationErrors[entry.id].title}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Date <span className="text-danger">*</span>
                            </label>
                            <input
                              type="date"
                              className={`form-control ${
                                validationErrors[entry.id]?.date ? "is-invalid" : ""
                              }`}
                              value={entry.date}
                              onChange={(e) =>
                                updateHolidayEntry(entry.id, "date", e.target.value)
                              }
                            />
                            {validationErrors[entry.id]?.date && (
                              <div className="invalid-feedback d-block">
                                {validationErrors[entry.id].date}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Status <span className="text-danger">*</span>
                            </label>
                            <select
                              className={`form-select ${
                                validationErrors[entry.id]?.status ? "is-invalid" : ""
                              }`}
                              value={entry.status}
                              onChange={(e) =>
                                updateHolidayEntry(entry.id, "status", e.target.value)
                              }
                            >
                              <option value="">Select Status</option>
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                            {validationErrors[entry.id]?.status && (
                              <div className="invalid-feedback d-block">
                                {validationErrors[entry.id].status}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Description</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Enter description (optional)"
                              value={entry.description}
                              onChange={(e) =>
                                updateHolidayEntry(entry.id, "description", e.target.value)
                              }
                            />
                          </div>
                        </div>

                        <div className="col-md-12">
                          <div className="mb-0">
                            <div className="form-check">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                id={`repeats-${entry.id}`}
                                checked={entry.repeatsEveryYear}
                                onChange={(e) =>
                                  updateHolidayEntry(entry.id, "repeatsEveryYear", e.target.checked)
                                }
                              />
                              <label className="form-check-label" htmlFor={`repeats-${entry.id}`}>
                                Repeats Every Year
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-light me-2"
                data-bs-dismiss="modal"
                onClick={resetAddForm}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitHolidays}
                disabled={isSubmitting || loading}
              >
                {isSubmitting ? `Submitting... (${submissionCount}/${expectedSubmissions})` : "Submit Holidays"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* /Add Holiday Modal */}

      {/* Edit Holiday Modal */}
      <div className="modal fade" id="edit_holiday">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Holiday</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={() => setEditingHoliday(null)}
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">
                      Title <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control ${
                        editValidationErrors.title ? "is-invalid" : ""
                      }`}
                      placeholder="Enter holiday title"
                      value={editTitle}
                      onChange={(e) => {
                        setEditTitle(e.target.value);
                        clearEditError("title");
                      }}
                    />
                    {editValidationErrors.title && (
                      <div className="invalid-feedback d-block">
                        {editValidationErrors.title}
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">
                      Date <span className="text-danger">*</span>
                    </label>
                    <input
                      type="date"
                      className={`form-control ${
                        editValidationErrors.date ? "is-invalid" : ""
                      }`}
                      value={editDate}
                      onChange={(e) => {
                        setEditDate(e.target.value);
                        clearEditError("date");
                      }}
                    />
                    {editValidationErrors.date && (
                      <div className="invalid-feedback d-block">
                        {editValidationErrors.date}
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">
                      Status <span className="text-danger">*</span>
                    </label>
                    <select
                      className={`form-select ${
                        editValidationErrors.status ? "is-invalid" : ""
                      }`}
                      value={editStatus}
                      onChange={(e) => {
                        setEditStatus(e.target.value);
                        clearEditError("status");
                      }}
                    >
                      <option value="">Select Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    {editValidationErrors.status && (
                      <div className="invalid-feedback d-block">
                        {editValidationErrors.status}
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter description (optional)"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="col-md-12">
                  <div className="mb-0">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="edit-repeats"
                        checked={editRepeatsEveryYear}
                        onChange={(e) => setEditRepeatsEveryYear(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="edit-repeats">
                        Repeats Every Year
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-light me-2"
                data-bs-dismiss="modal"
                onClick={() => setEditingHoliday(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleEditSubmit}
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Holiday"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* /Edit Holiday Modal */}

      <ToastContainer />

      {/* delete modal */}
      <div className="modal fade" id="delete_modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <span className="avatar avatar-xl bg-transparent-danger text-danger mb-3">
                <i className="ti ti-trash-x fs-36" />
              </span>
              <h4 className="mb-1">Confirm Deletion</h4>
              <p className="mb-3">
                {deleteHoliday
                  ? `Are you sure you want to delete holiday "${deleteHoliday.title}"? This cannot be undone.`
                  : "You want to delete all the marked holidays, this can't be undone once you delete."}
              </p>
              <div className="d-flex justify-content-center">
                <button
                  className="btn btn-light me-3"
                  data-bs-dismiss="modal"
                  onClick={() => setDeleteHoliday(null)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  data-bs-dismiss="modal"
                  onClick={() => {
                    if (deleteHoliday) {
                      handleDeleteHoliday(deleteHoliday._id);
                    }
                    setDeleteHoliday(null);
                  }}
                  disabled={loading}
                >
                  {loading ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* delete modal */}
    </>
  );
};

export default Holidays;