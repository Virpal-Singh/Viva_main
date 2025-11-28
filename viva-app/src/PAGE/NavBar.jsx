import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import "../CSS/navbar.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { addBasicInfo } from "../REDUX/UserSlice";
import { Bell, BarChart2, Users, BookOpen, Menu, X, User, Home } from "lucide-react";
import Login from "./Login";
import { getApiUrl } from "../utils/api";

const NavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [Role, SetRole] = useState("");
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showTeacherProfile, setShowTeacherProfile] = useState(false);
  const [teacherTheme, setTeacherTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });
  const dispatch = useDispatch();
  const { UserInfo } = useSelector((state) => state.user);

  // Apply theme changes
  useEffect(() => {
    if (teacherTheme === "light") {
      document.documentElement.classList.add("light-theme");
      document.body.classList.add("light-theme");
    } else {
      document.documentElement.classList.remove("light-theme");
      document.body.classList.remove("light-theme");
    }
    localStorage.setItem("theme", teacherTheme);
  }, [teacherTheme]);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setIsLoggedIn(false);
    SetRole("5");
    window.location.href = "/login";
  };

  useEffect(() => {
    if (UserInfo && UserInfo.length > 0) {
      setUsername(UserInfo[0].name);
    }
  }, [UserInfo]);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const token = localStorage.getItem("authToken");

        // If no token, user is logged out
        if (!token) {
          setIsLoggedIn(false);
          SetRole("");
          return;
        }

        // If UserInfo already exists in Redux, use it
        if (UserInfo && UserInfo.length > 0) {
          setIsLoggedIn(true);
          setUsername(UserInfo[0].payload.name);
          SetRole(UserInfo[0].payload.role);
          return;
        }

        // Fetch user info from API
        const response = await fetch(getApiUrl("bin/getUsername"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          // Invalid token, clear it
          localStorage.removeItem("authToken");
          setIsLoggedIn(false);
          SetRole("");
          return;
        }

        setIsLoggedIn(true);
        const data = await response.json();
        dispatch(addBasicInfo(data));
        setUsername(data.payload.name);
        SetRole(data.payload.role);
        setUserId(data.payload._id);
      } catch (error) {
        console.log("error verifying token");
        setIsLoggedIn(false);
        SetRole("");
      }
    };
    verifyToken();
  }, [dispatch, location, UserInfo]);

  // Fetch notifications for students
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!userId || Role !== "0") return; // Only for students
      
      try {
        const response = await fetch(
          getApiUrl("bin/notification/get-student"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId: userId }),
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
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId, Role]);

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

  return (
    <nav className="navbar glassy-nav">
      {/* Logo */}
      <Link to={"/"} style={{ textDecoration: "none" }}>
        <div className="logo">
          <div className="logo-icon-animated">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3 7V17L12 22L21 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 22V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 12L3 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 12L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <h1 className="logo-text">AI Viva</h1>
            <p className="logo-sub">Smart Assessments</p>
          </div>
        </div>
      </Link>

      {/* Hamburger Icon (Mobile Only) */}
      <button
        className="menu-toggle"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        {isMenuOpen ? <X size={26} /> : <Menu size={26} />}
      </button>

      {/* Links */}
      <div className={`nav-links ${isMenuOpen ? "active" : ""}`}>
        {(isMenuOpen === true) & (isLoggedIn == false) ? (
          <>
            <Link to="/login" className="signin-link">
              Sign In
            </Link>
          </>
        ) : (
          <> </>
        )}

        {Role === "1" && (
          <>
            <Link
              to="/"
              className={`nav-link ${location.pathname === "/" ? "active" : ""}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <Home size={16} /> Home
            </Link>
            <Link
              to="/teacherdashboard"
              className={`nav-link ${location.pathname === "/teacherdashboard" ? "active" : ""}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <BarChart2 size={16} /> Dashboard
            </Link>
            <Link
              to="/resources"
              className={`nav-link ${location.pathname === "/resources" ? "active" : ""}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <BookOpen size={16} /> Resources
            </Link>
            <Link
              to="/analytics"
              className={`nav-link ${location.pathname === "/analytics" ? "active" : ""}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <BarChart2 size={16} /> Analytics
            </Link>
            <button 
              className="nav-link" 
              onClick={() => {
                setShowTeacherProfile(true);
                setIsMenuOpen(false);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <User size={16} /> Profile
            </button>
          </>
        )}
        {isLoggedIn && Role == 0 && (
          <>
            <Link
              to="/"
              className={`nav-link ${location.pathname === "/" ? "active" : ""}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <Home size={16} /> Home
            </Link>
            <Link
              to="/join"
              className={`nav-link ${location.pathname === "/join" ? "active" : ""}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <Users size={16} /> Classes
            </Link>
            <Link
              to="/profile"
              className={`nav-link ${location.pathname === "/profile" ? "active" : ""}`}
              onClick={() => setIsMenuOpen(false)}
            >
              <User size={16} /> Profile
            </Link>
          </>
        )}
      </div>

      {/* Right Side */}
      <div className="nav-right">
        {/* Show notification bell only for logged-in students */}
        {isLoggedIn && Role === "0" && (
          <div className="notification" onClick={() => setShowNotifications(!showNotifications)}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </div>
        )}

        {/* Student Notification Panel */}
        {showNotifications && Role === "0" && (
          <div className="student-notification-panel">
            <div className="notification-panel-header">
              <h3>📢 New Viva Notifications</h3>
              <button className="notification-close-btn" onClick={() => setShowNotifications(false)}>
                ×
              </button>
            </div>
            <div className="notification-panel-body">
              {notifications.length === 0 ? (
                <div className="notification-empty">
                  <Bell size={48} />
                  <p>No notifications</p>
                  <span>You're all caught up!</span>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div key={notification._id} className="student-notification-item">
                    <div className="notification-icon-wrapper">
                      <span className="notification-viva-icon">📝</span>
                    </div>
                    <div className="notification-content">
                      <div className="notification-header-row">
                        <strong>{notification.vivaTitle}</strong>
                      </div>
                      <div className="notification-details">
                        <span className="notification-class">{notification.className}</span>
                      </div>
                      <div className="notification-message">{notification.message}</div>
                      <div className="notification-time">
                        {new Date(notification.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      className="notification-delete-btn"
                      onClick={() => handleDeleteNotification(notification._id)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {isLoggedIn ? (
          <></>
        ) : (
          <>
            <Link to="/login" className="signin-link">
              Sign In
            </Link>
            <Link to="/register" className="get-started-btn">
              Get Started
            </Link>
          </>
        )}
      </div>

      {/* Teacher Profile Modal */}
      {showTeacherProfile && Role === "1" && UserInfo && UserInfo.length > 0 && (
        <div className="teacher-profile-modal-overlay" onClick={() => setShowTeacherProfile(false)}>
          <div className="teacher-profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="teacher-profile-close" onClick={() => setShowTeacherProfile(false)}>
              ×
            </button>
            
            <div className="teacher-profile-avatar">
              {UserInfo[0].payload.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            
            <div className="teacher-profile-info">
              <h3>{UserInfo[0].payload.name}</h3>
              <p className="teacher-profile-role">Teacher</p>
              <div className="teacher-profile-email">
                <User size={16} />
                <span>{UserInfo[0].payload.email}</span>
              </div>
              <div className="teacher-profile-enrollment">
                <User size={16} />
                <span>{UserInfo[0].payload.ennumber}</span>
              </div>
              
              <div className="teacher-profile-theme">
                <label>Theme</label>
                <div className="teacher-theme-selector">
                  <button 
                    className={`teacher-theme-btn ${teacherTheme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTeacherTheme('dark')}
                  >
                    Dark
                  </button>
                  <button 
                    className={`teacher-theme-btn ${teacherTheme === 'light' ? 'active' : ''}`}
                    onClick={() => setTeacherTheme('light')}
                  >
                    Light
                  </button>
                </div>
              </div>
            </div>
            
            <button className="teacher-profile-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default NavBar;
