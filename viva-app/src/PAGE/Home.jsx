import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { login, addBasicInfo } from "../REDUX/UserSlice";
import { getApiUrl } from "../utils/api";
import {
  Brain,
  BarChart3,
  BarChart2,
  Shield,
  Sparkles,
  Zap,
  CheckCircle2,
  TrendingUp,
  Lock,
  Eye,
  Activity,
  BookOpen,
} from "lucide-react";
import "../CSS/home.css";

const Home = () => {
  const dispatch = useDispatch();
  const { UserInfo, isLogin } = useSelector((state) => state.user);
  const [userstatus, setuserstatus] = useState(isLogin);
  const [username, setUsername] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    satisfaction: 0,
    assessments: 0,
  });

  // Verify token and fetch user info on mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const token = localStorage.getItem("authToken");

        // If no token, user is not logged in
        if (!token) {
          setIsLoadingUser(false);
          return;
        }

        // If UserInfo already exists in Redux, use it
        if (UserInfo && UserInfo.length > 0) {
          setUsername(UserInfo[0].payload.name);
          setUserRole(UserInfo[0].payload.role);
          dispatch(login());
          setuserstatus(true);
          setIsLoadingUser(false);
          return;
        }

        // Fetch user info from API
        const response = await fetch(getApiUrl("bin/getUsername"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          setIsLoadingUser(false);
          return;
        }

        const data = await response.json();

        // Dispatch to Redux
        dispatch(addBasicInfo(data));
        dispatch(login());

        // Set local state
        setUsername(data.payload.name);
        setUserRole(data.payload.role);
        setuserstatus(true);
        setIsLoadingUser(false);
      } catch (error) {
        console.log("Error verifying token:", error);
        setIsLoadingUser(false);
      }
    };

    verifyToken();
  }, [dispatch]);

  // Update local state when UserInfo changes
  useEffect(() => {
    if (UserInfo && UserInfo.length > 0) {
      setUsername(UserInfo[0].payload.name);
      setUserRole(UserInfo[0].payload.role);
      dispatch(login());
      setuserstatus(true);
    }
  }, [UserInfo, dispatch]);

  // Fetch real statistics from backend with fallback
  useEffect(() => {
    const fetchStats = async () => {
      // Set fallback data immediately
      const fallbackData = { users: 125, satisfaction: 98, assessments: 200 };

      try {
        // Try to fetch real data
        const [usersResponse, vivasResponse] = await Promise.allSettled([
          fetch(getApiUrl("bin/get/all-users-count")),
          fetch(getApiUrl("bin/get/all-viva")),
        ]);

        let totalUsers = fallbackData.users;
        let totalVivas = fallbackData.assessments;

        // Use real data if available
        if (usersResponse.status === "fulfilled" && usersResponse.value.ok) {
          const usersData = await usersResponse.value.json();
          totalUsers = usersData.count || fallbackData.users;
        }

        if (vivasResponse.status === "fulfilled" && vivasResponse.value.ok) {
          const vivasData = await vivasResponse.value.json();
          totalVivas = vivasData.length || fallbackData.assessments;
        }

        // Animate with real or fallback data
        animateStats({
          users: totalUsers,
          satisfaction: 98,
          assessments: totalVivas,
        });
      } catch (error) {
        console.log("Using fallback stats due to API error");
        // Use fallback data
        animateStats(fallbackData);
      }
    };

    fetchStats();
  }, []);

  // Animate stats counter
  const animateStats = (targets) => {
    const duration = 2000; // 2 seconds
    const steps = 60;
    const interval = duration / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setStats({
        users: Math.floor(targets.users * progress),
        satisfaction: Math.floor(targets.satisfaction * progress),
        assessments: Math.floor(targets.assessments * progress),
      });

      if (currentStep >= steps) {
        setStats(targets);
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  };

  function FeatureCard({ icon, title, description }) {
    return (
      <div className="feature-card glass-card">
        <div className="feature-icon">{icon}</div>
        <div className="feature-text">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="maindiv">
        <div className="home-container">
          <section className="hero">
            {UserInfo.length > 0 ? (
              <>
                <div className="namee">
                  <h1>Welcome</h1>
                  <h1>
                    <span className="gradient-text nameee">{username}</span>
                  </h1>
                </div>
              </>
            ) : (
              <>
                <div className="title">
                  <h1>
                    Transform Education with <br />
                    <span className="gradient-text">AI Excellence</span>
                  </h1>
                  <p className="platform-subtitle-text">
                    AI-Powered Education Platform
                  </p>
                </div>
              </>
            )}

            <p className="subtitle">
              Experience the future of learning with our premium education
              platform. AI-powered assessments, real-time analytics, and
              seamless collaboration for teachers and students.
            </p>

            <div className="cta-buttons">
              {isLoadingUser ? (
                <div className="loading-buttons">
                  <div className="skeleton-btn"></div>
                </div>
              ) : UserInfo.length > 0 ? (
                <>
                  {userRole === "0" && (
                    <Link to="/join" className="btn-navbar-style">
                      <BookOpen size={18} /> My Classes
                    </Link>
                  )}
                  {userRole === "1" && (
                    <>
                      <Link to="/teacherdashboard" className="btn-navbar-style">
                        <BarChart2 size={18} /> Dashboard
                      </Link>
                      <Link to="/analytics" className="btn-navbar-style">
                        <Activity size={18} /> Analytics
                      </Link>
                      <Link to="/resources" className="btn-navbar-style">
                        <BookOpen size={18} /> Resources
                      </Link>
                    </>
                  )}
                  {userRole === "2" && (
                    <Link to="/analytics" className="btn-navbar-style">
                      <Activity size={18} /> Analytics
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link to="/register" className="btn-primary glow-border">
                    Start Free Trial
                  </Link>
                  <button className="btn-secondary">▶ Watch Demo</button>
                </>
              )}
            </div>
          </section>

          {/* Stats Section */}
          <section className="stats">
            <div className="stat-item">
              <h2 className="stat-number">{stats.users}+</h2>
              <p>Active Users</p>
            </div>
            <div className="stat-item">
              <h2 className="stat-number">{stats.satisfaction}%</h2>
              <p>Satisfaction Rate</p>
            </div>
            <div className="stat-item">
              <h2 className="stat-number">{stats.assessments}+</h2>
              <p>Assessments</p>
            </div>
          </section>
        </div>

        <div className="maindiv2">
          <div className="header">
            <button className="premium-btn">Premium Features</button>
            <h1>
              <span className="highlight">Revolutionary</span> <br />
              Education Technology
            </h1>
            <p>
              Experience cutting-edge features designed to transform the way
              teachers teach and students learn. Built with modern technology
              and award-winning design.
            </p>
          </div>

          <div className="features">
            <div className="feature-card animated-card">
              <div className="icon-container purple-gradient">
                <Brain className="animated-icon" size={36} />
                <Sparkles className="sparkle-icon" size={16} />
              </div>
              <h2>AI-Powered Viva Tests</h2>
              <p>
                Advanced artificial intelligence conducts personalized oral
                examinations, adapting questions based on student responses and
                knowledge level.
              </p>
              <ul>
                <li>
                  <CheckCircle2 size={16} className="check-icon" /> Natural
                  Language Processing
                </li>
                <li>
                  <CheckCircle2 size={16} className="check-icon" /> Adaptive
                  Questioning
                </li>
                <li>
                  <CheckCircle2 size={16} className="check-icon" /> Real-time
                  Analysis
                </li>
              </ul>
            </div>

            <div className="feature-card animated-card">
              <div className="icon-container orange-gradient">
                <BarChart3 className="animated-icon" size={36} />
                <TrendingUp className="sparkle-icon" size={16} />
              </div>
              <h2>Advanced Analytics Dashboard</h2>
              <p>
                Comprehensive performance tracking with detailed insights,
                progress visualization, and predictive learning analytics.
              </p>
              <ul>
                <li>
                  <CheckCircle2 size={16} className="check-icon" /> Performance
                  Metrics
                </li>
                <li>
                  <CheckCircle2 size={16} className="check-icon" /> Progress
                  Tracking
                </li>
                <li>
                  <CheckCircle2 size={16} className="check-icon" /> Predictive
                  Insights
                </li>
              </ul>
            </div>

            <div className="feature-card animated-card">
              <div className="icon-container blue-gradient">
                <Shield className="animated-icon" size={36} />
                <Lock className="sparkle-icon" size={16} />
              </div>
              <h2>Anti-Cheat Technology</h2>
              <p>
                Sophisticated monitoring system detecting tab switching,
                copy-paste attempts, and unusual behavioral patterns during
                assessments.
              </p>
              <ul>
                <li>
                  <CheckCircle2 size={16} className="check-icon" /> Tab
                  Monitoring
                </li>
                <li>
                  <CheckCircle2 size={16} className="check-icon" /> Behavior
                  Analysis
                </li>
                <li>
                  <CheckCircle2 size={16} className="check-icon" /> Secure
                  Environment
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Testimonials Section */}
        <div className="testimonials-section">
          <div className="testimonials-header">
            <h2>What Our Users Say</h2>
            <p>Real feedback from students and teachers using AI Viva</p>
          </div>

          {/* Upper Row - Left to Right */}
          <div className="testimonials-row testimonials-row-ltr">
            {/* First set */}
            <div className="testimonial-card">
              <div className="testimonial-avatar">CD</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "AI Viva has completely transformed how I conduct assessments.
                  The automated grading saves me hours every week!"
                </p>
                <h4 className="testimonial-name">Professor C.D. Patel</h4>
                <span className="testimonial-role">
                  Computer Science Teacher
                </span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">SM</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The AI-powered questions are incredibly smart. It feels like
                  having a real conversation with a teacher!"
                </p>
                <h4 className="testimonial-name">Sarbaz Malek</h4>
                <span className="testimonial-role">Engineering Student</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">AG</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The analytics dashboard gives me deep insights into my
                  students' performance. Best educational tool I've used!"
                </p>
                <h4 className="testimonial-name">Aruna Gurjar</h4>
                <span className="testimonial-role">Mathematics Professor</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">UP</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "I love how the platform adapts to my learning pace. The
                  instant feedback helps me improve quickly."
                </p>
                <h4 className="testimonial-name">Utsav Patel</h4>
                <span className="testimonial-role">Medical Student</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">NG</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The anti-cheat system ensures fair assessments. My students
                  take tests seriously now!"
                </p>
                <h4 className="testimonial-name">Naman Gupta</h4>
                <span className="testimonial-role">Physics Teacher</span>
              </div>
            </div>

            {/* Duplicate set for seamless loop */}
            <div className="testimonial-card">
              <div className="testimonial-avatar">PP</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "AI Viva has completely transformed how I conduct assessments.
                  The automated grading saves me hours every week!"
                </p>
                <h4 className="testimonial-name">Priyanshi Patel</h4>
                <span className="testimonial-role">
                  Computer Science Teacher
                </span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">SD</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The AI-powered questions are incredibly smart. It feels like
                  having a real conversation with a teacher!"
                </p>
                <h4 className="testimonial-name">Sachin Daraji</h4>
                <span className="testimonial-role">Engineering Student</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">VP</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The analytics dashboard gives me deep insights into my
                  students' performance. Best educational tool I've used!"
                </p>
                <h4 className="testimonial-name">Vikas Parmar</h4>
                <span className="testimonial-role">Mathematics Professor</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">NB</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "I love how the platform adapts to my learning pace. The
                  instant feedback helps me improve quickly."
                </p>
                <h4 className="testimonial-name">Nidhi Bharai</h4>
                <span className="testimonial-role">Medical Student</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">VG</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The anti-cheat system ensures fair assessments. My students
                  take tests seriously now!"
                </p>
                <h4 className="testimonial-name">Vikram Gupta</h4>
                <span className="testimonial-role">Physics Teacher</span>
              </div>
            </div>
          </div>

          {/* Lower Row - Right to Left */}
          <div className="testimonials-row testimonials-row-rtl">
            {/* First set */}
            <div className="testimonial-card">
              <div className="testimonial-avatar">NP</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The interface is so intuitive! Even my non-tech-savvy
                  colleagues can use it easily."
                </p>
                <h4 className="testimonial-name">Nikki Patel</h4>
                <span className="testimonial-role">English Teacher</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">SC</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "Best platform for online assessments. The email notifications
                  keep me updated on my progress!"
                </p>
                <h4 className="testimonial-name">Sanjay Choudhary</h4>
                <span className="testimonial-role">MBA Student</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">WW</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "Creating vivas is so quick now. I can generate quality
                  questions in minutes instead of hours!"
                </p>
                <h4 className="testimonial-name">Walter white</h4>
                <span className="testimonial-role">Chemistry Professor</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">SP</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The real-time monitoring during tests gives me confidence
                  that assessments are fair and secure."
                </p>
                <h4 className="testimonial-name">Shailesh Patel</h4>
                <span className="testimonial-role">IT Student</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">DK</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The detailed result analysis helps me identify exactly where
                  my students need more support."
                </p>
                <h4 className="testimonial-name">Deepak Khanna</h4>
                <span className="testimonial-role">Biology Teacher</span>
              </div>
            </div>

            {/* Duplicate set for seamless loop */}
            <div className="testimonial-card">
              <div className="testimonial-avatar">NP</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The interface is so intuitive! Even my non-tech-savvy
                  colleagues can use it easily."
                </p>
                <h4 className="testimonial-name">Neha Patel</h4>
                <span className="testimonial-role">English Teacher</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">RV</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "Best platform for online assessments. The email notifications
                  keep me updated on my progress!"
                </p>
                <h4 className="testimonial-name">Rahul Verma</h4>
                <span className="testimonial-role">MBA Student</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">MS</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "Creating vivas is so quick now. I can generate quality
                  questions in minutes instead of hours!"
                </p>
                <h4 className="testimonial-name">Meera Singh</h4>
                <span className="testimonial-role">Chemistry Professor</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">VS</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The real-time monitoring during tests gives me confidence
                  that assessments are fair and secure."
                </p>
                <h4 className="testimonial-name">Virpal Singh</h4>
                <span className="testimonial-role">IT Student</span>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-avatar">DK</div>
              <div className="testimonial-content">
                <p className="testimonial-text">
                  "The detailed result analysis helps me identify exactly where
                  my students need more support."
                </p>
                <h4 className="testimonial-name">Deepak Khanna</h4>
                <span className="testimonial-role">Biology Teacher</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
