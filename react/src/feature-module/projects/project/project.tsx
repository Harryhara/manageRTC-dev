import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import CommonSelect, { Option } from "../../../core/common/commonSelect";
import { DatePicker } from "antd";
import { priority } from "../../../core/common/selectoption/selectoption";
import CommonTagsInput from "../../../core/common/Taginput";
import CommonTextEditor from "../../../core/common/textEditor";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { useSocket } from "../../../SocketContext";
import { toast } from "react-toastify";
import { Socket } from "socket.io-client";

interface Project {
  _id: string;
  name: string;
  client?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  priority: string;
  status: string;
  progress: number;
  teamMembers?: string[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  onHold: number;
  overdue: number;
}

const Project = () => {
  const socket = useSocket() as Socket | null;
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats>({ total: 0, active: 0, completed: 0, onHold: 0, overdue: 0 });
  const [clients, setClients] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    priority: "all",
    client: "all",
    search: ""
  });

  const searchTimeoutRef = useRef<number | null>(null);


  const handleSearchChange = useCallback((value: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value }));
    }, 500);
  }, []);


  const clearFilters = useCallback(() => {
    setFilters({
      status: "all",
      priority: "all",
      client: "all",
      search: ""
    });
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);


  const [formData, setFormData] = useState({
    name: "",
    client: "",
    description: "",
    startDate: null as Date | null,
    endDate: null as Date | null,
    priority: "Medium",
    status: "Active",
    teamMembers: [] as string[],
    tags: [] as string[]
  });

  const getModalContainer = () => {
    const modalElement = document.getElementById("modal-datepicker");
    return modalElement ? modalElement : document.body;
  };

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "Active", label: "Active" },
    { value: "Completed", label: "Completed" },
    { value: "On Hold", label: "On Hold" },
  ];

  const priorityOptions = [
    { value: "all", label: "All Priority" },
    { value: "High", label: "High" },
    { value: "Medium", label: "Medium" },
    { value: "Low", label: "Low" },
  ];

  const clientOptions = [
    { value: "all", label: "All Clients" },
    ...clients.map(client => ({ value: client, label: client }))
  ];


  const getFilteredProjects = useCallback(() => {
    return projects;
  }, [projects]);


  const loadProjects = useCallback((filterParams = {}) => {
    if (!socket) return;

    setLoading(true);
    socket.emit("project:getAllData", filterParams);
  }, [socket]);

  const handleCreateProject = useCallback((projectData: any) => {
    if (!socket) return;

    socket.emit("project:create", projectData);
  }, [socket]);

  const handleUpdateProject = useCallback((projectId: string, updateData: any) => {
    if (!socket) return;

    socket.emit("project:update", { projectId, update: updateData });
  }, [socket]);

  const handleDeleteProject = useCallback((projectId: string) => {
    if (!socket) return;

    socket.emit("project:delete", { projectId });
  }, [socket]);

  const handleExportPDF = useCallback(() => {
    if (!socket) return;

    socket.emit("project/export-pdf");
  }, [socket]);

  const handleExportExcel = useCallback(() => {
    if (!socket) return;

    socket.emit("project/export-excel");
  }, [socket]);


  useEffect(() => {
    if (!socket) return;


    const handleGetAllDataResponse = (response: any) => {
      setLoading(false);
      if (response.done) {
        setProjects(response.data.projects || []);
        setStats(response.data.stats || { total: 0, active: 0, completed: 0, onHold: 0, overdue: 0 });
        setClients(response.data.clients || []);
        setError(null);
      } else {
        setError(response.error || "Failed to load projects");
        toast.error(response.error || "Failed to load projects");
      }
    };

    const handleCreateResponse = (response: any) => {
      if (response.done) {
        toast.success("Project created successfully");
        setShowAddModal(false);
        resetForm();
        loadProjects();
      } else {
        toast.error(response.error || "Failed to create project");
      }
    };

    const handleUpdateResponse = (response: any) => {
      if (response.done) {
        toast.success("Project updated successfully");
        setShowEditModal(false);
        setEditingProject(null);
        resetForm();
        loadProjects();
      } else {
        toast.error(response.error || "Failed to update project");
      }
    };

    const handleDeleteResponse = (response: any) => {
      if (response.done) {
        toast.success("Project deleted successfully");
        setDeletingProject(null);
        loadProjects();
      } else {
        toast.error(response.error || "Failed to delete project");
      }
    };

    const handleExportPDFResponse = (response: any) => {
      if (response.done) {
        window.open(response.data.pdfUrl, '_blank');
        toast.success("PDF exported successfully");
      } else {
        toast.error(response.error || "Failed to export PDF");
      }
    };

    const handleExportExcelResponse = (response: any) => {
      if (response.done) {
        window.open(response.data.excelUrl, '_blank');
        toast.success("Excel exported successfully");
      } else {
        toast.error(response.error || "Failed to export Excel");
      }
    };


    const handleProjectCreated = (response: any) => {
      if (response.done) {
        toast.info("A new project was created");
        loadProjects();
      }
    };

    const handleProjectUpdated = (response: any) => {
      if (response.done) {
        toast.info("A project was updated");
        loadProjects();
      }
    };

    const handleProjectDeleted = (response: any) => {
      if (response.done) {
        toast.info("A project was deleted");
        loadProjects();
      }
    };


    socket.on("project:getAllData-response", handleGetAllDataResponse);
    socket.on("project:create-response", handleCreateResponse);
    socket.on("project:update-response", handleUpdateResponse);
    socket.on("project:delete-response", handleDeleteResponse);
    socket.on("project/export-pdf-response", handleExportPDFResponse);
    socket.on("project/export-excel-response", handleExportExcelResponse);


    socket.on("project:project-created", handleProjectCreated);
    socket.on("project:project-updated", handleProjectUpdated);
    socket.on("project:project-deleted", handleProjectDeleted);

    return () => {
      socket.off("project:getAllData-response", handleGetAllDataResponse);
      socket.off("project:create-response", handleCreateResponse);
      socket.off("project:update-response", handleUpdateResponse);
      socket.off("project:delete-response", handleDeleteResponse);
      socket.off("project/export-pdf-response", handleExportPDFResponse);
      socket.off("project/export-excel-response", handleExportExcelResponse);
      socket.off("project:project-created", handleProjectCreated);
      socket.off("project:project-updated", handleProjectUpdated);
      socket.off("project:project-deleted", handleProjectDeleted);
    };
  }, [socket, loadProjects]);


  useEffect(() => {
    if (socket) {
      loadProjects(filters);
    }
  }, [socket, filters, loadProjects]);


  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);


  const resetForm = () => {
    setFormData({
      name: "",
      client: "",
      description: "",
      startDate: null,
      endDate: null,
      priority: "medium",
      status: "active",
      teamMembers: [],
      tags: []
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    const projectData = {
      name: formData.name,
      client: formData.client || undefined,
      description: formData.description || undefined,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      priority: formData.priority,
      status: formData.status,
      teamMembers: formData.teamMembers,
      tags: formData.tags
    };

    if (editingProject) {
      handleUpdateProject(editingProject._id, projectData);
    } else {
      handleCreateProject(projectData);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      client: project.client || "",
      description: project.description || "",
      startDate: project.startDate || null,
      endDate: project.endDate || null,
      priority: project.priority,
      status: project.status,
      teamMembers: project.teamMembers || [],
      tags: project.tags || []
    });
    setShowEditModal(true);
  };

  const handleDelete = (project: Project) => {
    setDeletingProject(project);
  };

  const confirmDelete = () => {
    if (deletingProject) {
      handleDeleteProject(deletingProject._id);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high": return "badge badge-danger-transparent";
      case "medium": return "badge badge-warning-transparent";
      case "low": return "badge badge-success-transparent";
      default: return "badge badge-secondary-transparent";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active": return "badge badge-success-transparent";
      case "completed": return "badge badge-info-transparent";
      case "on-hold": return "badge badge-warning-transparent";
      default: return "badge badge-secondary-transparent";
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-danger" role="alert">
            <i className="ti ti-alert-circle me-2"></i>
            {error}
            <button
              type="button"
              className="btn btn-sm btn-outline-danger ms-2"
              onClick={loadProjects}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <>
        <div className="page-wrapper">
          <div className="content">
            <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
              <div className="my-auto mb-2">
                <h2 className="mb-1">Projects</h2>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={all_routes.adminDashboard}>
                        <i className="ti ti-smart-home" />
                      </Link>
                    </li>
                    <li className="breadcrumb-item">Employee</li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Projects Grid
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap ">
                <div className="me-2 mb-2">
                  <div className="d-flex align-items-center border bg-white rounded p-1 me-2 icon-list">
                    <Link
                      to={all_routes.projectlist}
                      className="btn btn-icon btn-sm me-1"
                    >
                      <i className="ti ti-list-tree" />
                    </Link>
                    <Link
                      to={all_routes.project}
                      className="btn btn-icon btn-sm active bg-primary text-white"
                    >
                      <i className="ti ti-layout-grid" />
                    </Link>
                  </div>
                </div>
                <div className="me-2 mb-2">
                  <div className="dropdown">
                    <button
                      className="dropdown-toggle btn btn-white d-inline-flex align-items-center"
                      data-bs-toggle="dropdown"
                    >
                      <i className="ti ti-file-export me-1" />
                      Export
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end p-3">
                      <li>
                        <button
                          className="dropdown-item rounded-1"
                          onClick={handleExportPDF}
                        >
                          <i className="ti ti-file-type-pdf me-1" />
                          Export as PDF
                        </button>
                      </li>
                      <li>
                        <button
                          className="dropdown-item rounded-1"
                          onClick={handleExportExcel}
                        >
                          <i className="ti ti-file-type-xls me-1" />
                          Export as Excel
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="mb-2">
                  <button
                    className="btn btn-primary d-flex align-items-center"
                    onClick={() => {
                      resetForm();
                      setShowAddModal(true);
                    }}
                  >
                    <i className="ti ti-circle-plus me-2" />
                    Add Project
                  </button>
                </div>
                <div className="ms-2 head-icons">
                  <CollapseHeader />
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-body p-3">
                <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-3">
                  <h5>
                    Projects Grid ({projects.length}
                    {(filters.status !== "all" || filters.priority !== "all" || filters.client !== "all" || filters.search) && ` of ${stats.total}`}
                    )
                  </h5>
                  <div className="d-flex align-items-center flex-wrap row-gap-3">
                    <div className="dropdown me-2">
                      <CommonSelect
                        className="select"
                        options={statusOptions}
                        defaultValue={filters.status}
                        onChange={(option) => setFilters(prev => ({ ...prev, status: option?.value || "all" }))}
                      />
                    </div>
                    <div className="dropdown me-2">
                      <CommonSelect
                        className="select"
                        options={priorityOptions}
                        defaultValue={filters.priority}
                        onChange={(option) => setFilters(prev => ({ ...prev, priority: option?.value || "all" }))}
                      />
                    </div>
                    <div className="dropdown me-2">
                      <CommonSelect
                        className="select"
                        options={clientOptions}
                        defaultValue={filters.client}
                        onChange={(option) => setFilters(prev => ({ ...prev, client: option?.value || "all" }))}
                      />
                    </div>
                    <div className="input-group" style={{ width: '200px' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search projects..."
                        defaultValue={filters.search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                      />
                    </div>
                    {(filters.status !== "all" || filters.priority !== "all" || filters.client !== "all" || filters.search) && (
                      <button
                        className="btn btn-outline-secondary ms-2"
                        onClick={clearFilters}
                        title="Clear all filters"
                      >
                        <i className="ti ti-x" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="row">
              {projects.length === 0 ? (
                <div className="col-12">
                  <div className="text-center py-5">
                    <i className="ti ti-folder-x fs-1 text-muted mb-3"></i>
                    <h5 className="text-muted">No projects found</h5>
                    <p className="text-muted">Create your first project to get started</p>
                  </div>
                </div>
              ) : (
                getFilteredProjects().map((project) => (
                  <div key={project._id} className="col-xxl-3 col-lg-4 col-md-6">
                    <div className="card">
                      <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <div className="d-flex align-items-center gap-2">
                            <h6>
                              <Link to={`${all_routes.projectdetails}/${project._id}`}>
                                {project.name}
                              </Link>
                            </h6>
                            <span className={getPriorityColor(project.priority)}>
                              {project.priority}
                            </span>
                            <span className={getStatusColor(project.status)}>
                              {project.status}
                            </span>
                          </div>
                          <div className="dropdown">
                            <button
                              className="btn btn-icon btn-sm"
                              data-bs-toggle="dropdown"
                              aria-expanded="false"
                            >
                              <i className="ti ti-dots-vertical" />
                            </button>
                            <ul className="dropdown-menu dropdown-menu-end p-3">
                              <li>
                                <button
                                  className="dropdown-item rounded-1"
                                  onClick={() => handleEdit(project)}
                                >
                                  <i className="ti ti-edit me-2" />
                                  Edit
                                </button>
                              </li>
                              <li>
                                <button
                                  className="dropdown-item rounded-1 text-danger"
                                  onClick={() => handleDelete(project)}
                                >
                                  <i className="ti ti-trash me-1" />
                                  Delete
                                </button>
                              </li>
                            </ul>
                          </div>
                        </div>
                        <div className="mb-3 pb-3 border-bottom">
                          <p className="text-truncate line-clamp-3 mb-0">
                            {project.description || "No description provided."}
                          </p>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-3 pb-3 border-bottom">
                          <div className="d-flex align-items-center file-name-icon">
                            <div className="avatar avatar-sm avatar-rounded flex-shrink-0 bg-primary text-white">
                              <span className="fs-12 fw-medium">
                                {project.name && project.name.length > 0 ? project.name.charAt(0).toUpperCase() : '?'}
                              </span>
                            </div>
                            <div className="ms-2">
                              <h6 className="fw-normal fs-12">
                                {project.client || "No Client"}
                              </h6>
                              <span className="fs-12 fw-normal text-muted">
                                Client
                              </span>
                            </div>
                          </div>
                          <div className="d-flex align-items-center">
                            <div>
                              <span className="fs-12 fw-normal text-muted">Deadline</span>
                              <p className="mb-0 fs-12">{formatDate(project.endDate)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center">
                            <span className="avatar avatar-sm avatar-rounded bg-success-transparent flex-shrink-0 me-2">
                              <i className="ti ti-checklist text-success fs-16" />
                            </span>
                            <p>
                              <small>Progress: </small>
                              <span className="text-dark">{project.progress}%</span>
                            </p>
                          </div>
                          <div className="avatar-list-stacked avatar-group-sm">
                            {project.teamMembers && project.teamMembers.length > 0 ? (
                              project.teamMembers.slice(0, 3).map((member, index) => (
                                <span key={index} className="avatar avatar-rounded bg-primary text-white">
                                  <span className="fs-12 fw-medium">
                                    {member && typeof member === 'string' && member.length > 0 ? member.charAt(0).toUpperCase() : '?'}
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span className="avatar avatar-rounded bg-secondary text-white">
                                <span className="fs-12 fw-medium">?</span>
                              </span>
                            )}
                            {project.teamMembers && project.teamMembers.length > 3 && (
                              <span className="avatar bg-primary avatar-rounded text-fixed-white fs-12 fw-medium">
                                +{project.teamMembers.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="footer d-sm-flex align-items-center justify-content-between border-top bg-white p-3">
            <p className="mb-0">2014 - 2025 © Amasqis.</p>
            <p>
              Designed &amp; Developed By{" "}
              <Link to="#" className="text-primary">
                Dreams
              </Link>
            </p>
          </div>
        </div>
      </>

      {showAddModal && (
        <div className="modal fade show" style={{ display: 'block' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header header-border align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <h5 className="modal-title me-2">Add Project</h5>
                  <p className="text-dark">Project ID : PRO-{Date.now().toString().slice(-4)}</p>
                </div>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  onClick={() => setShowAddModal(false)}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Project Name *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Client</label>
                        <CommonSelect
                          className="select"
                          options={clientOptions.filter(c => c.value !== 'all')}
                          defaultValue={formData.client}
                          onChange={(option) => setFormData(prev => ({ ...prev, client: option?.value || "" }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Start Date</label>
                        <DatePicker
                          className="form-control"
                          format="DD-MM-YYYY"
                          getPopupContainer={getModalContainer}
                          placeholder="DD-MM-YYYY"
                          value={formData.startDate}
                          onChange={(date) => setFormData(prev => ({ ...prev, startDate: date }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">End Date</label>
                        <DatePicker
                          className="form-control"
                          format="DD-MM-YYYY"
                          getPopupContainer={getModalContainer}
                          placeholder="DD-MM-YYYY"
                          value={formData.endDate}
                          onChange={(date) => setFormData(prev => ({ ...prev, endDate: date }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Priority</label>
                        <CommonSelect
                          className="select"
                          options={[
                            { value: "low", label: "Low" },
                            { value: "medium", label: "Medium" },
                            { value: "high", label: "High" },
                          ]}
                          defaultValue={formData.priority}
                          onChange={(option) => setFormData(prev => ({ ...prev, priority: option?.value || "medium" }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Status</label>
                        <CommonSelect
                          className="select"
                          options={[
                            { value: "active", label: "Active" },
                            { value: "completed", label: "Completed" },
                            { value: "on-hold", label: "On Hold" },
                          ]}
                          defaultValue={formData.status}
                          onChange={(option) => setFormData(prev => ({ ...prev, status: option?.value || "active" }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Enter project description..."
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Team Members</label>
                        <CommonTagsInput
                          value={formData.teamMembers}
                          onChange={(tags) => setFormData(prev => ({ ...prev, teamMembers: tags }))}
                          placeholder="Add team members..."
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Tags</label>
                        <CommonTagsInput
                          value={formData.tags}
                          onChange={(tags) => setFormData(prev => ({ ...prev, tags: tags }))}
                          placeholder="Add tags..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-light border me-2"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="submit">
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingProject && (
        <div className="modal fade show" style={{ display: 'block' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header header-border align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <h5 className="modal-title me-2">Edit Project</h5>
                  <p className="text-dark">Project ID : PRO-{editingProject._id.slice(-4)}</p>
                </div>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  onClick={() => setShowEditModal(false)}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Project Name *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Client</label>
                        <CommonSelect
                          className="select"
                          options={clientOptions.filter(c => c.value !== 'all')}
                          defaultValue={formData.client}
                          onChange={(option) => setFormData(prev => ({ ...prev, client: option?.value || "" }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Start Date</label>
                        <DatePicker
                          className="form-control"
                          format="DD-MM-YYYY"
                          getPopupContainer={getModalContainer}
                          placeholder="DD-MM-YYYY"
                          value={formData.startDate}
                          onChange={(date) => setFormData(prev => ({ ...prev, startDate: date }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">End Date</label>
                        <DatePicker
                          className="form-control"
                          format="DD-MM-YYYY"
                          getPopupContainer={getModalContainer}
                          placeholder="DD-MM-YYYY"
                          value={formData.endDate}
                          onChange={(date) => setFormData(prev => ({ ...prev, endDate: date }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Priority</label>
                        <CommonSelect
                          className="select"
                          options={[
                            { value: "low", label: "Low" },
                            { value: "medium", label: "Medium" },
                            { value: "high", label: "High" },
                          ]}
                          defaultValue={formData.priority}
                          onChange={(option) => setFormData(prev => ({ ...prev, priority: option?.value || "medium" }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Status</label>
                        <CommonSelect
                          className="select"
                          options={[
                            { value: "active", label: "Active" },
                            { value: "completed", label: "Completed" },
                            { value: "on-hold", label: "On Hold" },
                          ]}
                          defaultValue={formData.status}
                          onChange={(option) => setFormData(prev => ({ ...prev, status: option?.value || "active" }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Enter project description..."
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Team Members</label>
                        <CommonTagsInput
                          value={formData.teamMembers}
                          onChange={(tags) => setFormData(prev => ({ ...prev, teamMembers: tags }))}
                          placeholder="Add team members..."
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Tags</label>
                        <CommonTagsInput
                          value={formData.tags}
                          onChange={(tags) => setFormData(prev => ({ ...prev, tags: tags }))}
                          placeholder="Add tags..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-light border me-2"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="submit">
                    Update Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {deletingProject && (
        <div className="modal fade show" style={{ display: 'block' }} role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-body">
                <div className="text-center p-3">
                  <span className="avatar avatar-lg avatar-rounded bg-danger-transparent mb-3">
                    <i className="ti ti-trash text-danger fs-24" />
                  </span>
                  <h5 className="mb-2">Delete Project</h5>
                  <p className="mb-3">
                    Are you sure you want to delete <strong>{deletingProject.name}</strong>?
                    This action cannot be undone.
                  </p>
                  <div className="d-flex justify-content-center gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-light border"
                      onClick={() => setDeletingProject(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={confirmDelete}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {(showAddModal || showEditModal || deletingProject) && (
        <div className="modal-backdrop fade show" onClick={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setDeletingProject(null);
        }}></div>
      )}
    </>
  );
};

export default Project;
