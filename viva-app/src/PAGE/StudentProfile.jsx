import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { User, Mail, Hash, BookOpen, LogOut, Edit2, Check, X, Lock, FileText } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../CSS/studentprofile.css";
import { getApiUrl } from "../utils/api";
import ReportCard from "../components/ReportCard";

const StudentProfile = () => {
  const navigate = useNavigate();
  const { UserInfo } = useSelector((state) => state.user);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit states
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  
  // Enrollment update states
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [newEnrollment, setNewEnrollment] = useState("");
  const [enrollmentOtp, setEnrollmentOtp] = useState("");
  const [enrollmentOtpSent, setEnrollmentOtpSent] = useState(false);
  
  // Email update states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  
  // Password update states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordOtp, setPasswordOtp] = useState("");
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  
  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  // Report card state
  const [showReportCard, setShowReportCard] = useState(false);

  useEffect(() => {
    if (UserInfo && UserInfo.length > 0) {
      if (UserInfo[0].payload.role != 0) {
        navigate("/login");
      }
      setUserData(UserInfo[0].payload);
      setNewName(UserInfo[0].payload.name);
      setIsLoading(false);
    }
  }, [UserInfo, navigate]);

  useEffect(() => {
    // Apply theme to html and body
    if (theme === "light") {
      document.documentElement.classList.add("light-theme");
      document.body.classList.add("light-theme");
    } else {
      document.documentElement.classList.remove("light-theme");
      document.body.classList.remove("light-theme");
    }
    // Save to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    try {
      const response = await fetch(getApiUrl("bin/update/student-name"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: userData._id,
          newName: newName.trim(),
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success("Name updated successfully!");
        setUserData({ ...userData, name: newName.trim() });
        setEditingName(false);
        
        // Update localStorage token
        const token = localStorage.getItem("authToken");
        const verifyResponse = await fetch(getApiUrl("bin/getUsername"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        
        if (verifyResponse.ok) {
          window.location.reload();
        }
      } else {
        toast.error(data.message || "Failed to update name");
      }
    } catch (error) {
      toast.error("Error updating name");
    }
  };

  const handleSendEnrollmentOtp = async () => {
    if (!newEnrollment.trim()) {
      toast.error("Please enter new enrollment number");
      return;
    }

    try {
      const response = await fetch(getApiUrl("bin/send-update-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userData.email,
          updateType: "enrollment",
          newValue: newEnrollment.trim(),
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success("OTP sent to your email!");
        setEnrollmentOtpSent(true);
      } else {
        toast.error(data.message || "Failed to send OTP");
      }
    } catch (error) {
      toast.error("Error sending OTP");
    }
  };

  const handleVerifyEnrollmentOtp = async () => {
    if (!enrollmentOtp.trim()) {
      toast.error("Please enter OTP");
      return;
    }

    try {
      const response = await fetch(getApiUrl("bin/verify-update-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userData.email,
          otp: enrollmentOtp.trim(),
          updateType: "enrollment",
          newValue: newEnrollment.trim(),
          studentId: userData._id,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success("Enrollment number updated successfully!");
        setUserData({ ...userData, ennumber: newEnrollment.trim() });
        setShowEnrollmentModal(false);
        setEnrollmentOtpSent(false);
        setEnrollmentOtp("");
        setNewEnrollment("");
      } else {
        toast.error(data.message || "Invalid OTP");
      }
    } catch (error) {
      toast.error("Error verifying OTP");
    }
  };

  const handleSendEmailOtp = async () => {
    if (!newEmail.trim()) {
      toast.error("Please enter new email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error("Please enter a valid email");
      return;
    }

    try {
      const response = await fetch(getApiUrl("bin/send-update-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          updateType: "email",
          currentEmail: userData.email,
          studentId: userData._id,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success("OTP sent to your new email!");
        setEmailOtpSent(true);
      } else {
        toast.error(data.message || "Failed to send OTP");
      }
    } catch (error) {
      toast.error("Error sending OTP");
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtp.trim()) {
      toast.error("Please enter OTP");
      return;
    }

    try {
      const response = await fetch(getApiUrl("bin/verify-update-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          otp: emailOtp.trim(),
          updateType: "email",
          newValue: newEmail.trim(),
          studentId: userData._id,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success("Email updated successfully!");
        setUserData({ ...userData, email: newEmail.trim() });
        setShowEmailModal(false);
        setEmailOtpSent(false);
        setEmailOtp("");
        setNewEmail("");
      } else {
        toast.error(data.message || "Invalid OTP");
      }
    } catch (error) {
      toast.error("Error verifying OTP");
    }
  };

  const handleSendPasswordOtp = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Please enter both password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      const response = await fetch(getApiUrl("bin/send-update-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userData.email,
          updateType: "password",
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success("OTP sent to your email!");
        setPasswordOtpSent(true);
      } else {
        toast.error(data.message || "Failed to send OTP");
      }
    } catch (error) {
      toast.error("Error sending OTP");
    }
  };

  const handleVerifyPasswordOtp = async () => {
    if (!passwordOtp.trim()) {
      toast.error("Please enter OTP");
      return;
    }

    try {
      const response = await fetch(getApiUrl("bin/verify-update-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userData.email,
          otp: passwordOtp.trim(),
          updateType: "password",
          newValue: newPassword,
          studentId: userData._id,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success("Password updated successfully!");
        setShowPasswordModal(false);
        setPasswordOtpSent(false);
        setPasswordOtp("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.message || "Invalid OTP");
      }
    } catch (error) {
      toast.error("Error verifying OTP");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/login");
  };

  if (isLoading || !userData) {
    return (
      <div className="profile-loading">
        <div className="profile-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="student-profile-container">
      <div className="profile-content">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar">
            {getInitials(userData.name)}
          </div>
          <div className="profile-header-info">
            <h1>{userData.name}</h1>
            <p className="profile-role">Student</p>
          </div>
        </div>

        {/* Profile Information */}
        <div className="profile-section">
          <h2 className="section-title">Profile Information</h2>
          
          {/* Name */}
          <div className="info-card">
            <div className="info-header">
              <div className="info-icon-wrapper">
                <User size={20} />
              </div>
              <div className="info-content">
                <label>Full Name</label>
                {editingName ? (
                  <div className="edit-input-group">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="edit-input"
                    />
                    <button onClick={handleUpdateName} className="btn-icon-success">
                      <Check size={18} />
                    </button>
                    <button onClick={() => {
                      setEditingName(false);
                      setNewName(userData.name);
                    }} className="btn-icon-cancel">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <p>{userData.name}</p>
                )}
              </div>
            </div>
            {!editingName && (
              <button onClick={() => setEditingName(true)} className="btn-edit">
                <Edit2 size={16} /> Edit
              </button>
            )}
          </div>

          {/* Email */}
          <div className="info-card">
            <div className="info-header">
              <div className="info-icon-wrapper">
                <Mail size={20} />
              </div>
              <div className="info-content">
                <label>Email Address</label>
                <p>{userData.email}</p>
              </div>
            </div>
            <button onClick={() => setShowEmailModal(true)} className="btn-edit">
              <Edit2 size={16} /> Change
            </button>
          </div>

          {/* Enrollment */}
          <div className="info-card">
            <div className="info-header">
              <div className="info-icon-wrapper">
                <Hash size={20} />
              </div>
              <div className="info-content">
                <label>Enrollment Number</label>
                <p>{userData.ennumber}</p>
              </div>
            </div>
            <button onClick={() => setShowEnrollmentModal(true)} className="btn-edit">
              <Edit2 size={16} /> Change
            </button>
          </div>
        </div>

        {/* Security Section */}
        <div className="profile-section">
          <h2 className="section-title">Security</h2>
          
          <div className="info-card">
            <div className="info-header">
              <div className="info-icon-wrapper">
                <Lock size={20} />
              </div>
              <div className="info-content">
                <label>Password</label>
                <p>••••••••</p>
              </div>
            </div>
            <button onClick={() => setShowPasswordModal(true)} className="btn-edit">
              <Edit2 size={16} /> Change
            </button>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="profile-section">
          <h2 className="section-title">Preferences</h2>
          
          <div className="info-card">
            <div className="info-header">
              <div className="info-icon-wrapper">
                <User size={20} />
              </div>
              <div className="info-content">
                <label>Theme</label>
                <div className="theme-selector">
                  <button 
                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    Dark
                  </button>
                  <button 
                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    Light
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Report Card Button */}
        <button onClick={() => setShowReportCard(true)} className="btn-report-card">
          <FileText size={20} /> Generate Report Card
        </button>

        {/* Logout Button */}
        <button onClick={handleLogout} className="btn-logout">
          <LogOut size={20} /> Logout
        </button>
      </div>

      {/* Enrollment Modal */}
      {showEnrollmentModal && (
        <div className="modal-overlay" onClick={() => {
          setShowEnrollmentModal(false);
          setEnrollmentOtpSent(false);
          setEnrollmentOtp("");
          setNewEnrollment("");
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Enrollment Number</h3>
              <button onClick={() => {
                setShowEnrollmentModal(false);
                setEnrollmentOtpSent(false);
                setEnrollmentOtp("");
                setNewEnrollment("");
              }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              {!enrollmentOtpSent ? (
                <>
                  <p className="modal-description">
                    Enter your new enrollment number. We'll send an OTP to <strong>{userData.email}</strong> for verification.
                  </p>
                  <input
                    type="text"
                    placeholder="New Enrollment Number"
                    value={newEnrollment}
                    onChange={(e) => setNewEnrollment(e.target.value)}
                    className="modal-input"
                  />
                  <button onClick={handleSendEnrollmentOtp} className="btn-primary-modal">
                    Send OTP
                  </button>
                </>
              ) : (
                <>
                  <p className="modal-description">
                    Enter the OTP sent to <strong>{userData.email}</strong>
                  </p>
                  <input
                    type="text"
                    placeholder="Enter OTP"
                    value={enrollmentOtp}
                    onChange={(e) => setEnrollmentOtp(e.target.value)}
                    className="modal-input"
                    maxLength={6}
                  />
                  <button onClick={handleVerifyEnrollmentOtp} className="btn-primary-modal">
                    Verify & Update
                  </button>
                  <button onClick={handleSendEnrollmentOtp} className="btn-secondary-modal">
                    Resend OTP
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="modal-overlay" onClick={() => {
          setShowEmailModal(false);
          setEmailOtpSent(false);
          setEmailOtp("");
          setNewEmail("");
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Email Address</h3>
              <button onClick={() => {
                setShowEmailModal(false);
                setEmailOtpSent(false);
                setEmailOtp("");
                setNewEmail("");
              }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              {!emailOtpSent ? (
                <>
                  <p className="modal-description">
                    Enter your new email address. We'll send an OTP to the new email for verification.
                  </p>
                  <input
                    type="email"
                    placeholder="New Email Address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="modal-input"
                  />
                  <button onClick={handleSendEmailOtp} className="btn-primary-modal">
                    Send OTP
                  </button>
                </>
              ) : (
                <>
                  <p className="modal-description">
                    Enter the OTP sent to <strong>{newEmail}</strong>
                  </p>
                  <input
                    type="text"
                    placeholder="Enter OTP"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    className="modal-input"
                    maxLength={6}
                  />
                  <button onClick={handleVerifyEmailOtp} className="btn-primary-modal">
                    Verify & Update
                  </button>
                  <button onClick={handleSendEmailOtp} className="btn-secondary-modal">
                    Resend OTP
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => {
          setShowPasswordModal(false);
          setPasswordOtpSent(false);
          setPasswordOtp("");
          setNewPassword("");
          setConfirmPassword("");
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <button onClick={() => {
                setShowPasswordModal(false);
                setPasswordOtpSent(false);
                setPasswordOtp("");
                setNewPassword("");
                setConfirmPassword("");
              }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              {!passwordOtpSent ? (
                <>
                  <p className="modal-description">
                    Enter your new password. We'll send an OTP to <strong>{userData.email}</strong> for verification.
                  </p>
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="modal-input"
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="modal-input"
                  />
                  <button onClick={handleSendPasswordOtp} className="btn-primary-modal">
                    Send OTP
                  </button>
                </>
              ) : (
                <>
                  <p className="modal-description">
                    Enter the OTP sent to <strong>{userData.email}</strong>
                  </p>
                  <input
                    type="text"
                    placeholder="Enter OTP"
                    value={passwordOtp}
                    onChange={(e) => setPasswordOtp(e.target.value)}
                    className="modal-input"
                    maxLength={6}
                  />
                  <button onClick={handleVerifyPasswordOtp} className="btn-primary-modal">
                    Verify & Update
                  </button>
                  <button onClick={handleSendPasswordOtp} className="btn-secondary-modal">
                    Resend OTP
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Card Modal */}
      <ReportCard
        isOpen={showReportCard}
        onClose={() => setShowReportCard(false)}
        userData={userData}
      />

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnHover
        draggable
      />
    </div>
  );
};

export default StudentProfile;
