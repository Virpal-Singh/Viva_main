import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, BookOpen, FileText, GraduationCap, Plus, Trash2, LogOut, Mail, Hash, Lock, User as UserIcon } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../CSS/admindashboard.css";
import { getApiUrl } from "../utils/api";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalVivas: 0
  });
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);
  const [newTeacher, setNewTeacher] = useState({
    name: "",
    email: "",
    ennumber: "",
    password: ""
  });

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/admin/login");
      return;
    }
    fetchDashboardData();
  }, [navigate]);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const statsResponse = await fetch(getApiUrl("bin/admin/stats"));
      const statsData = await statsResponse.json();
      
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // Fetch teachers
      const teachersResponse = await fetch(getApiUrl("bin/admin/teachers"));
      const teachersData = await teachersResponse.json();
      
      if (teachersData.success) {
        setTeachers(teachersData.teachers);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Failed to load dashboard data");
      setIsLoading(false);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    
    if (!newTeacher.name || !newTeacher.email || !newTeacher.ennumber || !newTeacher.password) {
      toast.error("All fields are required");
      return;
    }

    setIsAddingTeacher(true);

    try {
      const response = await fetch(getApiUrl("bin/admin/add-teacher"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTeacher)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Teacher added successfully! Credentials sent to email.");
        setTeachers([data.teacher, ...teachers]);
        setStats({ ...stats, totalTeachers: stats.totalTeachers + 1 });
        setShowAddModal(false);
        setNewTeacher({ name: "", email: "", ennumber: "", password: "" });
      } else {
        toast.error(data.message || "Failed to add teacher");
      }
    } catch (error) {
      console.error("Error adding teacher:", error);
      toast.error("Error adding teacher");
    } finally {
      setIsAddingTeacher(false);
    }
  };

  const handleDeleteTeacher = async (teacherId, teacherName) => {
    if (!window.confirm(`Are you sure you want to delete ${teacherName}? This will delete all their classes, vivas, and related data.`)) {
      return;
    }

    try {
      const response = await fetch(getApiUrl("bin/admin/delete-teacher"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Teacher deleted successfully");
        setTeachers(teachers.filter(t => t._id !== teacherId));
        setStats({ ...stats, totalTeachers: stats.totalTeachers - 1 });
      } else {
        toast.error(data.message || "Failed to delete teacher");
      }
    } catch (error) {
      console.error("Error deleting teacher:", error);
      toast.error("Error deleting teacher");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin/login");
  };

  if (isLoading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
        <p>Loading Admin Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-content">
          <h1>🎓 Admin Dashboard</h1>
          <p>Viva Portal Administration</p>
        </div>
        <button onClick={handleLogout} className="admin-logout-btn">
          <LogOut size={20} /> Logout
        </button>
      </div>

      {/* Stats Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon students">
            <Users size={32} />
          </div>
          <div className="admin-stat-info">
            <h3>{stats.totalStudents}</h3>
            <p>Total Students</p>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon teachers">
            <GraduationCap size={32} />
          </div>
          <div className="admin-stat-info">
            <h3>{stats.totalTeachers}</h3>
            <p>Total Teachers</p>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon classes">
            <BookOpen size={32} />
          </div>
          <div className="admin-stat-info">
            <h3>{stats.totalClasses}</h3>
            <p>Total Classes</p>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon vivas">
            <FileText size={32} />
          </div>
          <div className="admin-stat-info">
            <h3>{stats.totalVivas}</h3>
            <p>Total Vivas</p>
          </div>
        </div>
      </div>

      {/* Teachers Section */}
      <div className="admin-section">
        <div className="admin-section-header">
          <h2>👨‍🏫 Teachers Management</h2>
          <button onClick={() => setShowAddModal(true)} className="admin-add-btn">
            <Plus size={20} /> Add Teacher
          </button>
        </div>

        <div className="admin-teachers-grid">
          {teachers.length === 0 ? (
            <div className="admin-empty-state">
              <GraduationCap size={64} />
              <p>No teachers added yet</p>
              <button onClick={() => setShowAddModal(true)} className="admin-add-btn">
                <Plus size={20} /> Add First Teacher
              </button>
            </div>
          ) : (
            teachers.map((teacher) => (
              <div key={teacher._id} className="admin-teacher-card">
                <div className="admin-teacher-avatar">
                  {teacher.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div className="admin-teacher-info">
                  <h3>{teacher.name}</h3>
                  <p><Mail size={14} /> {teacher.email}</p>
                  <p><Hash size={14} /> {teacher.ennumber}</p>
                  <p className="admin-teacher-date">
                    Added: {new Date(teacher.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button 
                  onClick={() => handleDeleteTeacher(teacher._id, teacher.name)}
                  className="admin-delete-btn"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Teacher Modal */}
      {showAddModal && (
        <div className="admin-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Add New Teacher</h2>
              <button onClick={() => setShowAddModal(false)} className="admin-modal-close">×</button>
            </div>
            <form onSubmit={handleAddTeacher} className="admin-modal-form">
              <div className="admin-form-group">
                <label><UserIcon size={16} /> Full Name</label>
                <input
                  type="text"
                  placeholder="Enter teacher's full name"
                  value={newTeacher.name}
                  onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label><Mail size={16} /> Email Address</label>
                <input
                  type="email"
                  placeholder="teacher@example.com"
                  value={newTeacher.email}
                  onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label><Hash size={16} /> Enrollment Number</label>
                <input
                  type="text"
                  placeholder="Enter enrollment number"
                  value={newTeacher.ennumber}
                  onChange={(e) => setNewTeacher({ ...newTeacher, ennumber: e.target.value })}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label><Lock size={16} /> Password</label>
                <input
                  type="password"
                  placeholder="Create a password"
                  value={newTeacher.password}
                  onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                  required
                />
              </div>

              <div className="admin-modal-info">
                ℹ️ Credentials will be sent to the teacher's email automatically
              </div>

              <div className="admin-modal-actions">
                <button type="submit" className="admin-submit-btn" disabled={isAddingTeacher}>
                  {isAddingTeacher ? (
                    <>
                      <div className="admin-btn-spinner"></div>
                      Adding Teacher...
                    </>
                  ) : (
                    <>
                      <Plus size={20} /> Add & Send Email
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
      />
    </div>
  );
};

export default AdminDashboard;
