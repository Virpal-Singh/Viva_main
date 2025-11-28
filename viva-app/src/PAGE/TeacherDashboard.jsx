import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { getApiUrl } from "../utils/api";
import {
  GraduationCap,
  Users,
  BookOpen,
  BarChart3,
  Plus,
  Upload,
  Calendar,
  Trash2,
  Eye,
  Activity,
  TrendingUp,
  Clock,
  FileText,
  Award,
  Loader2,
  Bell,
  X,
  AlertTriangle,
  Download,
} from "lucide-react";
import "../CSS/teacher.css";
import "../CSS/global-loading.css";
import TeacherReportCard from "../components/TeacherReportCard";

const TeacherDashboard = () => {
  const [userid, setUsername] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [ClassRoom, setClassRoom] = useState([]);
  const [popupStatus, setpopupStatus] = useState(false);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [formData, setFormData] = useState({ classname: "", time: "" });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalVivas: 0,
    totalStudents: 0,
    successRate: 0,
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTeacherReport, setShowTeacherReport] = useState(false);
  const [showBulkRegisterModal, setShowBulkRegisterModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [isProcessingCSV, setIsProcessingCSV] = useState(false);
  const [registrationResults, setRegistrationResults] = useState(null);
  const { UserInfo } = useSelector((state) => state.user);

  useEffect(() => {
    if (UserInfo && UserInfo.length > 0) {
      setUsername(UserInfo[0].payload._id);
      setTeacherName(UserInfo[0].payload.name);
      if (UserInfo[0].payload.role != 1) {
        window.location.href = "/login";
      }
    }
  }, [UserInfo]);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!userid) return;

      try {
        const response = await fetch(
          getApiUrl("bin/notification/get-teacher"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teacherId: userid }),
          }
        );
        const data = await response.json();

        if (data.success) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [userid]);

  // Close notification panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showNotifications &&
        !event.target.closest(".notification-panel") &&
        !event.target.closest(".teacher-notification-btn")
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  useEffect(() => {
    const GetClassCode = async () => {
      try {
        const data = await fetch(
          getApiUrl("bin/get/teacher-classes-with-stats"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teacherid: userid }),
          }
        );
        const result = await data.json();
        if (result.message.length > 0) {
          setClassRoom(result.message);

          // Use real stats from backend
          setStats(result.totalStats);

          // Calculate real success rate using same logic as report card
          try {
            let totalSuccessRate = 0;
            let classesWithData = 0;

            // Calculate success rate for each class
            for (const classItem of result.message) {
              try {
                let classSuccessRate = 0;
                const studentScores = {};

                // Get all vivas for this class
                const vivasResponse = await fetch(getApiUrl("bin/get/vivavbyclasscode"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ classCode: classItem.code }),
                });

                if (vivasResponse.ok) {
                  const vivas = await vivasResponse.json();
                  
                  // For each viva, get results and calculate percentage scores
                  for (const viva of vivas) {
                    try {
                      const totalQuestions = parseInt(viva.totalquetions) || 5;
                      const marksPerQuestion = viva.marksPerQuestion || 1;
                      const totalPossibleMarks = totalQuestions * marksPerQuestion;

                      const vivaResultsResponse = await fetch(getApiUrl("bin/get/all-vivaresult"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ vivaId: viva._id }),
                      });

                      if (vivaResultsResponse.ok) {
                        const vivaResults = await vivaResultsResponse.json();
                        const submittedResults = vivaResults.filter(r => r.active === false);
                        
                        submittedResults.forEach(result => {
                          const studentId = result.student;
                          if (!studentScores[studentId]) {
                            studentScores[studentId] = [];
                          }
                          const percentageScore = (result.score || 0) / totalPossibleMarks * 100;
                          studentScores[studentId].push(percentageScore);
                        });
                      }
                    } catch (vivaError) {
                      console.error(`Error processing viva ${viva._id}:`, vivaError);
                    }
                  }

                  // Calculate class success rate
                  const studentAverages = [];
                  Object.keys(studentScores).forEach(studentId => {
                    const scores = studentScores[studentId];
                    const studentAvg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
                    studentAverages.push(studentAvg);
                  });

                  if (studentAverages.length > 0) {
                    const overallAvg = studentAverages.reduce((sum, avg) => sum + avg, 0) / studentAverages.length;
                    classSuccessRate = Math.round(overallAvg);
                    totalSuccessRate += classSuccessRate;
                    classesWithData++;
                  }
                }
              } catch (classError) {
                console.error(`Error calculating success rate for class ${classItem.code}:`, classError);
              }
            }

            const successRate = classesWithData > 0 ? Math.round(totalSuccessRate / classesWithData) : 0;
            setStats((prev) => ({ ...prev, successRate }));
          } catch (error) {
            console.log("Error fetching success rate:", error);
          }
        }
      } catch (error) {
        console.log(error);
      }
    };
    if (userid) GetClassCode();
  }, [userid]);

  const HandleInputchange = (e) => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();

    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
      time: `${hours}:${formattedMinutes}${ampm} ${day}/${month}/${year}`,
    }));
  };

  const HandleCreteClass = async (e) => {
    e.preventDefault();

    if (!formData.classname.trim()) {
      alert("Please enter a class name");
      return;
    }

    setIsCreatingClass(true);
    try {
      const response = await fetch(
        getApiUrl("bin/create/classcode"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teacherid: userid,
            classnname: formData.classname,
          }),
        }
      );
      const Data = await response.json();

      if (response.ok) {
        // Add the new class with initial counts
        const newClass = {
          ...Data.result,
          studentCount: 0,
          vivaCount: 0,
        };
        setClassRoom([...ClassRoom, newClass]);

        // Update stats
        const newTotalClasses = ClassRoom.length + 1;
        setStats({
          totalClasses: newTotalClasses,
          totalVivas: stats.totalVivas, // Keep current total
          totalStudents: stats.totalStudents, // Keep current total
        });

        // Reset form and close modal
        setFormData({ classname: "", time: "" });
        setpopupStatus(false);

        // Show success message
        alert("Class created successfully! 🎉");
      } else {
        alert("Failed to create class. Please try again.");
      }
    } catch (error) {
      console.log(error);
      alert("An error occurred while creating the class.");
    } finally {
      setIsCreatingClass(false);
    }
  };

  const HandleDeleteClass = (classData) => {
    setClassToDelete(classData);
    setDeleteConfirmation("");
    setDeleteModalOpen(true);
  };

  const HandleConfirmDelete = async () => {
    if (deleteConfirmation !== classToDelete.classname) {
      alert("Class name doesn't match. Please type the exact class name.");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(getApiUrl("bin/delete/class"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classCode: classToDelete.code }),
      });

      const result = await response.json();

      if (response.ok) {
        // Remove from local state
        const updatedClasses = ClassRoom.filter(
          (item) => item.code !== classToDelete.code
        );
        setClassRoom(updatedClasses);

        // Update stats
        setStats({
          totalClasses: updatedClasses.length,
          totalVivas: stats.totalVivas - (classToDelete.vivaCount || 0),
          totalStudents:
            stats.totalStudents - (classToDelete.studentCount || 0),
        });

        // Close modal and reset
        setDeleteModalOpen(false);
        setClassToDelete(null);
        setDeleteConfirmation("");

        alert(
          `Class "${classToDelete.classname}" and all associated vivas deleted successfully.`
        );
      } else {
        alert(result.message || "Failed to delete class. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting class:", error);
      alert("An error occurred while deleting the class.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      const response = await fetch(
        getApiUrl("bin/notification/delete"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId }),
        }
      );

      if (response.ok) {
        setNotifications(notifications.filter((n) => n._id !== notificationId));
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleClearAllNotifications = async () => {
    if (!window.confirm("Are you sure you want to clear all notifications?")) {
      return;
    }

    try {
      const response = await fetch(
        getApiUrl("bin/notification/delete-all"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherId: userid }),
        }
      );

      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  // CSV Template Download
  const handleDownloadTemplate = () => {
    const csvContent = "enrollment,name,email,password\n12345,John Doe,john@example.com,password123\n67890,Jane Smith,jane@example.com,password456";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_registration_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handle CSV File Upload
  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV file is empty or invalid');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const students = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= 4 && values[0]) {
          students.push({
            enrollment: values[0],
            name: values[1],
            email: values[2],
            password: values[3]
          });
        }
      }

      setCsvData(students);
    };

    reader.readAsText(file);
  };

  // Submit Bulk Registration
  const handleBulkRegister = async () => {
    if (csvData.length === 0) {
      alert('Please upload a CSV file first');
      return;
    }

    setIsProcessingCSV(true);
    try {
      const response = await fetch(getApiUrl('bin/bulk-register-students'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: csvData,
          teacherId: userid
        })
      });

      const result = await response.json();
      setRegistrationResults(result.results);
      
      // Reset form
      setCsvFile(null);
      setCsvData([]);
      
    } catch (error) {
      console.error('Error in bulk registration:', error);
      alert('Failed to register students. Please try again.');
    } finally {
      setIsProcessingCSV(false);
    }
  };

  const getReasonIcon = (reason) => {
    switch (reason) {
      case "tab-switch":
        return "🔄";
      case "minimize":
        return "📉";
      case "time-over":
        return "⏰";
      default:
        return "⚠️";
    }
  };

  const getReasonColor = (reason) => {
    switch (reason) {
      case "tab-switch":
        return "#f59e0b";
      case "minimize":
        return "#ef4444";
      case "time-over":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className="teacher-dashboard-container">
      {/* Header Section */}
      <div className="teacher-dashboard-header">
        <div className="teacher-header-content">
          <div className="teacher-header-info">
            <GraduationCap size={48} className="teacher-header-icon" />
            <div className="teacher-header-text">
              <h1>Welcome back, {teacherName || "Teacher"}!</h1>
              <p>Manage your classes and track student progress</p>
            </div>
          </div>
          <div className="teacher-header-actions">
            <button
              className="teacher-report-btn"
              onClick={() => setShowTeacherReport(true)}
              title="Generate Teacher Report"
            >
              <Download size={20} />
              <span>Report Card</span>
            </button>
            <button
              className="teacher-notification-btn"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="teacher-notification-badge">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Notification Panel */}
          {showNotifications && (
            <div className="notification-panel">
              <div className="notification-panel-header">
                <h3>
                  <AlertTriangle size={20} />
                  Auto-Submit Notifications
                </h3>
                <div className="notification-header-actions">
                  {notifications.length > 0 && (
                    <button
                      className="notification-clear-all"
                      onClick={handleClearAllNotifications}
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    className="notification-close-btn"
                    onClick={() => setShowNotifications(false)}
                    title="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="notification-panel-body">
                {notifications.length === 0 ? (
                  <div className="notification-empty">
                    <Bell size={48} />
                    <p>No notifications</p>
                    <span>All students are following the rules!</span>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`notification-item ${
                        !notification.isRead ? "notification-unread" : ""
                      }`}
                    >
                      <div className="notification-icon-wrapper">
                        <span
                          className="notification-reason-icon"
                          style={{
                            background: getReasonColor(notification.reason),
                          }}
                        >
                          {getReasonIcon(notification.reason)}
                        </span>
                      </div>
                      <div className="notification-content">
                        <div className="notification-header-row">
                          <strong>{notification.studentName}</strong>
                          <span className="notification-enrollment">
                            ({notification.studentEnrollment})
                          </span>
                        </div>
                        <div className="notification-details">
                          <span className="notification-class">
                            {notification.className}
                          </span>
                          <span className="notification-separator">•</span>
                          <span className="notification-viva">
                            {notification.vivaTitle}
                          </span>
                        </div>
                        <div className="notification-reason">
                          {notification.reason === "tab-switch" &&
                            "🔄 Tab Switch Detected"}
                          {notification.reason === "minimize" &&
                            "📉 Screen Minimized"}
                          {notification.reason === "time-over" &&
                            "⏰ Time Over"}
                        </div>
                        <div className="notification-time">
                          {new Date(notification.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        className="notification-delete-btn"
                        onClick={() =>
                          handleDeleteNotification(notification._id)
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Celebration Animation */}
          {showCelebration && (
            <div className="celebration-overlay">
              <div className="celebration-star star-1">⭐</div>
              <div className="celebration-star star-2">✨</div>
              <div className="celebration-star star-3">💫</div>
              <div className="celebration-star star-4">🌟</div>
              <div className="celebration-star star-5">⭐</div>
              <div className="celebration-star star-6">✨</div>
              <div className="celebration-star star-7">💫</div>
              <div className="celebration-star star-8">🌟</div>
              <div className="celebration-message">
                <h2>🎉 Happy New Year! 🎊</h2>
                <p>Wishing you success!</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="teacher-stats-section">
        <div className="teacher-stat-card">
          <div className="teacher-stat-icon">
            <BookOpen size={40} />
          </div>
          <div className="teacher-stat-content">
            <h3>{stats.totalClasses}</h3>
            <p>Total Classes</p>
            <span className="teacher-stat-trend">
              <TrendingUp size={16} />+{ClassRoom.length > 0 ? 1 : 0} this week
            </span>
          </div>
        </div>

        <div className="teacher-stat-card">
          <div className="teacher-stat-icon">
            <FileText size={40} />
          </div>
          <div className="teacher-stat-content">
            <h3>{stats.totalVivas}</h3>
            <p>Total Vivas</p>
            <span className="teacher-stat-trend">
              <TrendingUp size={16} />
              +5 this week
            </span>
          </div>
        </div>

        <div className="teacher-stat-card">
          <div className="teacher-stat-icon">
            <Users size={40} />
          </div>
          <div className="teacher-stat-content">
            <h3>{stats.totalStudents}</h3>
            <p>Total Students</p>
            <span className="teacher-stat-trend">
              <TrendingUp size={16} />
              +12 this week
            </span>
          </div>
        </div>

        <div className="teacher-stat-card">
          <div className="teacher-stat-icon">
            <BarChart3 size={40} />
          </div>
          <div className="teacher-stat-content">
            <h3>{stats.successRate}%</h3>
            <p>Success Rate</p>
            <span className="teacher-stat-trend">
              <TrendingUp size={16} />
              Average score
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="teacher-main-content">
        {/* Quick Actions */}
        <div className="teacher-quick-actions-card">
          <h2>Quick Actions</h2>
          <div className="teacher-actions-grid">
            <button
              className="teacher-action-btn teacher-action-primary"
              onClick={() => setpopupStatus(true)}
            >
              <Plus size={20} />
              Create New Class
            </button>
            <button
              className="teacher-action-btn teacher-action-primary"
              onClick={() => setShowBulkRegisterModal(true)}
            >
              <Users size={20} />
              Register Students
            </button>
            <button
              className="teacher-action-btn"
              style={{ opacity: 0.6, cursor: "not-allowed" }}
              disabled
            >
              <Upload size={20} />
              Upload Syllabus
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "0.85rem",
                  color: "#9ca3af",
                }}
              >
                Coming Soon
              </span>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="teacher-activity-card">
          <h2>Recent Activity</h2>
          <div className="teacher-activity-list">
            <div className="teacher-activity-item">
              <div className="teacher-activity-icon">
                <FileText size={20} />
              </div>
              <div className="teacher-activity-content">
                <span className="teacher-activity-title">
                  Math Test - Algebra Basics
                </span>
                <span className="teacher-activity-time">2 hours ago</span>
              </div>
              <span className="teacher-activity-tag teacher-tag-test">
                Test
              </span>
            </div>
            <div className="teacher-activity-item">
              <div className="teacher-activity-icon">
                <BookOpen size={20} />
              </div>
              <div className="teacher-activity-content">
                <span className="teacher-activity-title">
                  Physics Class - Motion Laws
                </span>
                <span className="teacher-activity-time">5 hours ago</span>
              </div>
              <span className="teacher-activity-tag teacher-tag-class">
                Class
              </span>
            </div>
            <div className="teacher-activity-item">
              <div className="teacher-activity-icon">
                <Clock size={20} />
              </div>
              <div className="teacher-activity-content">
                <span className="teacher-activity-title">
                  Chemistry Assignment Due
                </span>
                <span className="teacher-activity-time">1 day ago</span>
              </div>
              <span className="teacher-activity-tag teacher-tag-assignment">
                Assignment
              </span>
            </div>
            <div className="teacher-activity-item">
              <div className="teacher-activity-icon">
                <Award size={20} />
              </div>
              <div className="teacher-activity-content">
                <span className="teacher-activity-title">
                  Biology Quiz Results
                </span>
                <span className="teacher-activity-time">2 days ago</span>
              </div>
              <span className="teacher-activity-tag teacher-tag-result">
                Result
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Classes Section */}
      <div className="teacher-classes-section">
        <div className="teacher-section-header">
          <h2>Your Classes</h2>
          <p>{ClassRoom.length} active classes</p>
        </div>
        <div className="teacher-classes-grid">
          {ClassRoom.length > 0 ? (
            ClassRoom.map((data, i) => (
              <div className="teacher-class-card" key={i}>
                <div className="teacher-class-card-header">
                  <div className="teacher-class-info">
                    <BookOpen size={54} className="teacher-class-icon" />
                    <div>
                      <h3>{data.classname}</h3>
                      <p className="teacher-class-code">Code: {data.code}</p>
                    </div>
                  </div>
                  <button
                    className="teacher-delete-btn"
                    onClick={() => HandleDeleteClass(data)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="teacher-class-stats">
                  <div className="teacher-class-stat">
                    <Users size={16} />
                    <span>{data.studentCount || 0} Students</span>
                  </div>
                  <div className="teacher-class-stat">
                    <FileText size={16} />
                    <span>{data.vivaCount || 0} Vivas</span>
                  </div>
                </div>
                <Link
                  to={`/class/overview/${data.code}`}
                  state={{ className: data.classname }}
                  className="teacher-view-class-btn"
                >
                  <Eye size={18} />
                  View Class
                </Link>
              </div>
            ))
          ) : (
            <div className="teacher-empty-state">
              <BookOpen size={64} className="teacher-empty-icon" />
              <h3>No Classes Yet</h3>
              <p>Create your first class to get started</p>
              <button
                className="teacher-create-first-class-btn"
                onClick={() => setpopupStatus(true)}
              >
                <Plus size={20} />
                Create Your First Class
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {isCreatingClass && (
        <div className="global-loading-overlay">
          <div className="global-loading-spinner">
            <Loader2 className="global-spinner-icon" size={48} />
            <p>Creating class...</p>
          </div>
        </div>
      )}

      {/* Create Class Modal */}
      {popupStatus && (
        <div
          className="teacher-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isCreatingClass) {
              setpopupStatus(false);
            }
          }}
        >
          <div className="teacher-modal-content">
            <div className="teacher-modal-header">
              <h2>Create New Class</h2>
              <button
                className="teacher-modal-close"
                onClick={() => setpopupStatus(false)}
                disabled={isCreatingClass}
              >
                ×
              </button>
            </div>
            <div className="teacher-modal-body">
              <div className="teacher-form-group">
                <label>Class Name</label>
                <input
                  type="text"
                  placeholder="Enter class name (e.g., Mathematics, Physics)"
                  name="classname"
                  value={formData.classname}
                  onChange={HandleInputchange}
                  disabled={isCreatingClass}
                />
              </div>
            </div>
            <div className="teacher-modal-footer">
              <button
                className="teacher-btn-secondary"
                onClick={() => setpopupStatus(false)}
                disabled={isCreatingClass}
              >
                Cancel
              </button>
              <button
                className="teacher-btn-primary"
                onClick={(e) => HandleCreteClass(e)}
                disabled={isCreatingClass}
              >
                {isCreatingClass ? (
                  <>
                    <Loader2 className="teacher-spinner" size={18} />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Create Class
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && classToDelete && (
        <div
          className="teacher-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setDeleteModalOpen(false);
              setClassToDelete(null);
              setDeleteConfirmation("");
            }
          }}
        >
          <div className="teacher-modal-content">
            <div className="teacher-modal-header">
              <h2>⚠️ Delete Class</h2>
              <button
                className="teacher-modal-close"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setClassToDelete(null);
                  setDeleteConfirmation("");
                }}
                disabled={isDeleting}
              >
                ×
              </button>
            </div>
            <div className="teacher-modal-body">
              <div style={{ marginBottom: "20px" }}>
                <p
                  style={{
                    color: "#f87171",
                    fontWeight: "600",
                    marginBottom: "10px",
                  }}
                >
                  This action cannot be undone!
                </p>
                <p style={{ color: "#9ca3af", marginBottom: "15px" }}>
                  Deleting this class will permanently remove:
                </p>
                <ul
                  style={{
                    color: "#9ca3af",
                    marginLeft: "20px",
                    marginBottom: "15px",
                  }}
                >
                  <li>The class "{classToDelete.classname}"</li>
                  <li>
                    All {classToDelete.vivaCount || 0} vivas in this class
                  </li>
                  <li>All student results and submissions</li>
                  <li>All associated data</li>
                </ul>
              </div>
              <div className="teacher-form-group">
                <label>
                  Type the class name to confirm:{" "}
                  <strong>{classToDelete.classname}</strong>
                </label>
                <input
                  type="text"
                  placeholder={`Type "${classToDelete.classname}" to confirm`}
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  disabled={isDeleting}
                  style={{
                    borderColor:
                      deleteConfirmation &&
                      deleteConfirmation !== classToDelete.classname
                        ? "rgba(239, 68, 68, 0.5)"
                        : "rgba(139, 92, 246, 0.3)",
                  }}
                />
              </div>
            </div>
            <div className="teacher-modal-footer">
              <button
                className="teacher-btn-secondary"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setClassToDelete(null);
                  setDeleteConfirmation("");
                }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="teacher-btn-primary"
                onClick={HandleConfirmDelete}
                disabled={
                  isDeleting || deleteConfirmation !== classToDelete.classname
                }
                style={{
                  background: "linear-gradient(90deg, #ef4444, #dc2626)",
                  opacity:
                    deleteConfirmation !== classToDelete.classname ? 0.5 : 1,
                }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="teacher-spinner" size={18} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Delete Class
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Report Card Modal */}
      <TeacherReportCard
        isOpen={showTeacherReport}
        onClose={() => setShowTeacherReport(false)}
        teacherData={{
          _id: userid,
          name: teacherName,
          email: UserInfo?.[0]?.payload?.email || "N/A",
          ennumber: UserInfo?.[0]?.payload?.ennumber || "N/A"
        }}
      />

      {/* Bulk Register Students Modal */}
      {showBulkRegisterModal && (
        <div
          className="teacher-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isProcessingCSV) {
              setShowBulkRegisterModal(false);
              setCsvFile(null);
              setCsvData([]);
              setRegistrationResults(null);
            }
          }}
        >
          <div className="teacher-modal-content" style={{ maxWidth: '700px' }}>
            <div className="teacher-modal-header">
              <h2>
                <Users size={24} />
                Bulk Register Students
              </h2>
              <button
                className="teacher-modal-close"
                onClick={() => {
                  setShowBulkRegisterModal(false);
                  setCsvFile(null);
                  setCsvData([]);
                  setRegistrationResults(null);
                }}
                disabled={isProcessingCSV}
              >
                ×
              </button>
            </div>
            <div className="teacher-modal-body">
              {!registrationResults ? (
                <>
                  <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#8b5cf6' }}>📋 Instructions:</h4>
                    <ol style={{ margin: '0', paddingLeft: '20px', color: '#9ca3af', lineHeight: '1.8' }}>
                      <li>Download the CSV template below</li>
                      <li>Fill in student details (Enrollment, Name, Email, Password)</li>
                      <li>Upload the completed CSV file</li>
                      <li>Review the preview and click Register</li>
                      <li>Students will receive welcome emails with their credentials</li>
                    </ol>
                  </div>

                  <button
                    onClick={handleDownloadTemplate}
                    className="teacher-btn-secondary"
                    style={{ width: '100%', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                  >
                    <Download size={20} />
                    Download CSV Template
                  </button>

                  <div className="teacher-form-group">
                    <label>Upload CSV File</label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCSVUpload}
                      disabled={isProcessingCSV}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px dashed rgba(139, 92, 246, 0.3)',
                        borderRadius: '8px',
                        background: 'rgba(139, 92, 246, 0.05)',
                        cursor: 'pointer'
                      }}
                    />
                  </div>

                  {csvData.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                      <h4 style={{ color: '#8b5cf6', marginBottom: '10px' }}>
                        Preview ({csvData.length} students)
                      </h4>
                      <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead style={{ background: 'rgba(139, 92, 246, 0.1)', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid rgba(139, 92, 246, 0.3)' }}>Enrollment</th>
                              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid rgba(139, 92, 246, 0.3)' }}>Name</th>
                              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid rgba(139, 92, 246, 0.3)' }}>Email</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvData.map((student, index) => (
                              <tr key={index} style={{ borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                                <td style={{ padding: '10px' }}>{student.enrollment}</td>
                                <td style={{ padding: '10px' }}>{student.name}</td>
                                <td style={{ padding: '10px' }}>{student.email}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <h3 style={{ color: '#10b981', marginBottom: '15px' }}>
                    ✅ Registration Complete!
                  </h3>
                  <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <p style={{ margin: '5px 0', color: '#10b981' }}>
                      <strong>✓ Successfully Registered:</strong> {registrationResults.success.length} students
                    </p>
                    {registrationResults.failed.length > 0 && (
                      <p style={{ margin: '5px 0', color: '#ef4444' }}>
                        <strong>✗ Failed:</strong> {registrationResults.failed.length} students
                      </p>
                    )}
                  </div>

                  {registrationResults.success.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ color: '#10b981', marginBottom: '10px' }}>Successfully Registered:</h4>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '10px' }}>
                        {registrationResults.success.map((student, index) => (
                          <div key={index} style={{ padding: '8px', borderBottom: '1px solid rgba(16, 185, 129, 0.1)' }}>
                            ✓ {student.name} ({student.enrollment}) - {student.email}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {registrationResults.failed.length > 0 && (
                    <div>
                      <h4 style={{ color: '#ef4444', marginBottom: '10px' }}>Failed Registrations:</h4>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '10px' }}>
                        {registrationResults.failed.map((student, index) => (
                          <div key={index} style={{ padding: '8px', borderBottom: '1px solid rgba(239, 68, 68, 0.1)' }}>
                            ✗ {student.name} ({student.enrollment}) - {student.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="teacher-modal-footer">
              {!registrationResults ? (
                <>
                  <button
                    className="teacher-btn-secondary"
                    onClick={() => {
                      setShowBulkRegisterModal(false);
                      setCsvFile(null);
                      setCsvData([]);
                    }}
                    disabled={isProcessingCSV}
                  >
                    Cancel
                  </button>
                  <button
                    className="teacher-btn-primary"
                    onClick={handleBulkRegister}
                    disabled={isProcessingCSV || csvData.length === 0}
                    style={{
                      opacity: csvData.length === 0 ? 0.5 : 1
                    }}
                  >
                    {isProcessingCSV ? (
                      <>
                        <Loader2 className="teacher-spinner" size={18} />
                        Registering...
                      </>
                    ) : (
                      <>
                        <Users size={18} />
                        Register {csvData.length} Students
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  className="teacher-btn-primary"
                  onClick={() => {
                    setShowBulkRegisterModal(false);
                    setCsvFile(null);
                    setCsvData([]);
                    setRegistrationResults(null);
                  }}
                  style={{ width: '100%' }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
