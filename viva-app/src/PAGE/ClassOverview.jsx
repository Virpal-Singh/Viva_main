import React from "react";
import { useState, useEffect } from "react";
import "../CSS/classoverview.css";
import "../CSS/global-loading.css";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { getApiUrl } from "../utils/api";
import {
  GraduationCap,
  Users,
  FileText,
  Calendar,
  Clock,
  Edit3,
  Download,
  Plus,
  Play,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  ArrowLeft,
  BookOpen,
  TrendingUp,
  Activity,
  Loader2,
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import * as XLSX from "xlsx";
import Studentresult from "./Studentresult";
import { useDispatch } from "react-redux";
import { addstudentresult } from "../REDUX/UserSlice";
const ClassOverview = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { teacherclasscodeid } = useParams();

  // State management
  const [vivaItem, setvivaItem] = useState([]);
  const [messagedisplay, setMessgeDisplay] = useState(null);
  const [mainVivaItem, setmainVivaItem] = useState([]);
  const [studentResultItem, setstudentResultItem] = useState([]);
  const [studentBasic, setstudentBasic] = useState([]);
  const [vivaNameList, setvivaNameList] = useState([]);
  const [popupStatus, setpopupStatus] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(false);
  const [studentResultStatus, setstudentResultStatus] = useState(false);
  const [vivaIDS, SetVivaIds] = useState("");
  const [studentData, setStudentData] = useState([]);
  const [exelData, setExelData] = useState([]);
  const [exelDataResult, setExelDataResult] = useState([]);
  const [value, setValue] = useState("");
  const [relode, setRelode] = useState("");
  const [downloadCount, setDownloadCount] = useState(true);
  const [classInfo, setClassInfo] = useState({
    className: "",
    teacherName: "",
  });
  const [isCreatingViva, setIsCreatingViva] = useState(false);
  const [isUpdatingViva, setIsUpdatingViva] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    totalquetions: "",
    time: "",
    syllabus: "",
    marksPerQuestion: "1",
  });
  const [successRate, setSuccessRate] = useState(0);

  // Calculate success rate from student results (proper percentage calculation)
  useEffect(() => {
    const calculateSuccessRate = async () => {
      if (!teacherclasscodeid || mainVivaItem.length === 0) return;

      try {
        console.log(`🎯 Calculating success rate for class: ${teacherclasscodeid}`);
        
        const studentScores = {}; // Track scores per student

        // For each viva in this class, get results and calculate percentage scores
        for (const viva of mainVivaItem) {
          try {
            const totalQuestions = parseInt(viva.totalquetions) || 5;
            const marksPerQuestion = viva.marksPerQuestion || 1;
            const totalPossibleMarks = totalQuestions * marksPerQuestion;

            console.log(`📝 Processing viva ${viva._id}: ${totalQuestions} questions × ${marksPerQuestion} marks = ${totalPossibleMarks} total`);

            const vivaResultsResponse = await fetch(getApiUrl("bin/get/all-vivaresult"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vivaId: viva._id }),
            });

            if (vivaResultsResponse.ok) {
              const vivaResults = await vivaResultsResponse.json();
              const submittedResults = vivaResults.filter(r => r.active === false);
              
              console.log(`📊 Viva ${viva._id} has ${submittedResults.length} submitted results`);
              
              submittedResults.forEach(result => {
                const studentId = result.student;
                if (!studentScores[studentId]) {
                  studentScores[studentId] = [];
                }
                // Convert raw score to percentage
                const percentageScore = (result.score || 0) / totalPossibleMarks * 100;
                studentScores[studentId].push(percentageScore);
              });
            }
          } catch (vivaError) {
            console.error(`Error processing viva ${viva._id}:`, vivaError);
          }
        }

        // Calculate success rate: average of each student's average score
        const studentAverages = [];
        Object.keys(studentScores).forEach(studentId => {
          const scores = studentScores[studentId];
          const studentAvg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
          studentAverages.push(studentAvg);
        });

        let classSuccessRate = 0;
        if (studentAverages.length > 0) {
          const overallAvg = studentAverages.reduce((sum, avg) => sum + avg, 0) / studentAverages.length;
          classSuccessRate = Math.round(overallAvg);
        }

        console.log(`🎯 Class ${teacherclasscodeid} success rate calculation:`, {
          totalStudentsWithScores: studentAverages.length,
          studentAverages: studentAverages.slice(0, 5), // Show first 5 for debugging
          finalSuccessRate: classSuccessRate
        });

        setSuccessRate(classSuccessRate);
      } catch (error) {
        console.error("Error calculating success rate:", error);
        setSuccessRate(0);
      }
    };

    calculateSuccessRate();
  }, [studentData, mainVivaItem, teacherclasscodeid]);

  const verifyToken = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        window.location.href = "/login";
      }
      const response = await fetch(getApiUrl("bin/getUsername"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log("Auth error:", errorData.message);
        window.location.href = "/login";
      }

      const data = await response.json();

      if (data.payload.role != 1) {
        window.location.href = "/login";
      }

      // Set teacher name from token data
      if (data.payload && data.payload.name) {
        setClassInfo((prev) => ({
          ...prev,
          teacherName: data.payload.name,
        }));
      }
    } catch (error) {
      console.log("error");
    }
  };
  useEffect(() => {
    verifyToken();
  }, []);

  // Set class name from navigation state
  useEffect(() => {
    if (location.state?.className) {
      setClassInfo((prev) => ({
        ...prev,
        className: location.state.className,
      }));
    } else {
      // Fallback if no state passed
      setClassInfo((prev) => ({
        ...prev,
        className: `Class ${teacherclasscodeid}`,
      }));
    }
  }, [location.state, teacherclasscodeid]);

  useEffect(() => {
    try {
      const FetchData = async () => {
        const response = await fetch(
          getApiUrl("bin/get/studentinclass"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ classCode: teacherclasscodeid }),
          }
        );
        const data = await response.json();

        if (data) {
          ///get/allstudentinclass
          const idList = data.map((s) => s.student);

          const allstudent = await fetch(
            getApiUrl("bin/get/allstudentinclass"),
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ _id: idList }),
            }
          );
          const Filterstudents = await allstudent.json();
          setStudentData(Filterstudents);
        }
      };
      FetchData();
    } catch (error) {}
  }, [teacherclasscodeid]);

  useEffect(
    () => {
      try {
        const FetchData = async () => {
          const response = await fetch(
            getApiUrl("bin/get/vivavbyclasscode"),
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ classCode: teacherclasscodeid }),
            }
          );
          const data = await response.json();
          setvivaItem(data);
          setmainVivaItem(data);

          // Class name is now properly set from the studentinclass API response above
        };
        FetchData();
      } catch (error) {}
    },
    [teacherclasscodeid],
    [relode]
  );

  const HandleUpcoming = (e) => {
    e.preventDefault();
    setActiveFilter("upcoming");
    if (mainVivaItem.length > 0) {
      const filteredArray = mainVivaItem.filter(
        (data) => data.status == "false"
      );
      setvivaItem(filteredArray);
      setMessgeDisplay();
      if (filteredArray.length <= 0) {
        setMessgeDisplay("No Upcoming Vivas");
      }
    }
  };

  const HandleContinue = (e) => {
    e.preventDefault();
    setActiveFilter("active");
    if (mainVivaItem.length > 0) {
      const filteredArray = mainVivaItem.filter(
        (data) => data.status == "true" || data.status == "active"
      );
      setvivaItem(filteredArray);
      setMessgeDisplay();
      if (filteredArray.length <= 0) {
        setMessgeDisplay("No Active Vivas");
      }
    }
  };

  const HandleFinished = (e) => {
    e.preventDefault();
    setActiveFilter("finished");
    if (mainVivaItem.length > 0) {
      const filteredArray = mainVivaItem.filter(
        (data) => data.status === "ended"
      );
      setvivaItem(filteredArray);
      setMessgeDisplay();
      if (filteredArray.length <= 0) {
        setMessgeDisplay("No Finished Vivas");
      }
    }
  };

  const HandleAll = (e) => {
    e.preventDefault();
    setActiveFilter("all");
    setvivaItem(mainVivaItem);
    setMessgeDisplay();
  };

  const handleStartViva = async (vivaId) => {
    const confirmStart = window.confirm(
      "Are you sure you want to start this viva? Students will be able to take the test once started."
    );

    if (!confirmStart) return;

    try {
      const response = await fetch(
        getApiUrl("bin/viva/toggle-status"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vivaId: vivaId, status: "active" }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast.success("Viva started successfully! 🎉");

        // Update the viva status in the UI
        const updatedVivas = vivaItem.map((viva) =>
          viva._id === vivaId ? { ...viva, status: "active" } : viva
        );
        setvivaItem(updatedVivas);

        const updatedMainVivas = mainVivaItem.map((viva) =>
          viva._id === vivaId ? { ...viva, status: "active" } : viva
        );
        setmainVivaItem(updatedMainVivas);
      } else {
        toast.error("Failed to start viva");
      }
    } catch (error) {
      console.error("Error starting viva:", error);
      toast.error("An error occurred while starting the viva");
    }
  };

  const HandleCreate = () => {
    setpopupStatus(true);
    setFormData({
      title: "",
      date: "",
      totalquetions: "",
      time: "",
      syllabus: "",
      marksPerQuestion: "1",
    });
  };

  const HandleFalse = () => {
    setpopupStatus(false);
  };
  const HandleCreteViva = async (e) => {
    e.preventDefault();

    if (
      !formData.title.trim() ||
      !formData.date ||
      !formData.totalquetions ||
      !formData.time
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsCreatingViva(true);
    try {
      const response = await fetch(getApiUrl("bin/create/viva"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          classCode: teacherclasscodeid,
          date: formData.date,
          time: formData.time,
          totalquetions: formData.totalquetions,
          status: "false",
          syllabus: formData.syllabus,
          marksPerQuestion: formData.marksPerQuestion,
        }),
      });

      if (response.status !== 201) {
        const error = await response.json();
        toast.error(error.message);
        return;
      }

      const data = await response.json();
      toast.success(data.message);

      // Reset form and close modal
      setFormData({
        title: "",
        date: "",
        totalquetions: "",
        time: "",
        syllabus: "",
        marksPerQuestion: "1",
      });
      setpopupStatus(false);

      // Refresh viva list
      setRelode(Date.now().toString());
    } catch (error) {
      toast.error("Failed to create viva");
    } finally {
      setIsCreatingViva(false);
    }
  };
  const HandleInputchange = (e) => {
    const { name, value } = e.target;

    if (name == "date") {
      const stringdata = value.toString();
      setFormData((prevData) => ({
        ...prevData,
        [name]: stringdata,
      }));
      return;
    }
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    console.log("else");
  };
  const HandleSetinput = (data, e) => {
    setFormData({
      title: data.title,
      date: data.date,
      totalquetions: data.totalquetions,
      time: data.time,
      syllabus: data.syllabus,
      marksPerQuestion: data.marksPerQuestion || "1",
    });
    SetVivaIds(data._id);
    // Store the current status to preserve it during update
    setValue(data.status);

    setUpdateStatus(true);
  };
  const handleChange = (e) => {
    setValue(e.target.value === "true"); // convert string to boolean
  };

  const HandleUpdate = async () => {
    setIsUpdatingViva(true);
    try {
      const UpdateViva = await fetch(
        getApiUrl("bin/update/vivadetail"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: vivaIDS,
            title: formData.title,
            date: formData.date,
            time: formData.time,
            totalquetions: formData.totalquetions,
            status: value, // Keep the existing status
            syllabus: formData.syllabus,
            marksPerQuestion: formData.marksPerQuestion,
          }),
        }
      );

      if (UpdateViva.ok) {
        toast.success("Viva updated successfully!");
        setUpdateStatus(false);
        setRelode(Date.now().toString());
      } else {
        toast.error("Failed to update viva");
      }
    } catch (error) {
      toast.error("An error occurred while updating");
    } finally {
      setIsUpdatingViva(false);
    }
  };
  const DateFunc = (data) => {
    return data.split("T")[0];
  };
  const HandleViewStudent = async (data, e) => {
    //data._id //teacherclasscodeid

    setstudentBasic({
      student: data.name,
      ennumber: data.ennumber,
      email: data.email,
    });

    try {
      const response = await fetch(
        getApiUrl("bin/get/studentinresult"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            classCode: teacherclasscodeid,
            student: data._id,
          }),
        }
      );
      const Data = await response.json();

      const responseViva = await fetch(
        getApiUrl("bin/get/all-viva"),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const Dataviva = await responseViva.json();
      if (Data) {
        const vivaname = Dataviva.filter((item) => item._id == Data.vivaId);

        setvivaNameList(vivaname);
        setstudentResultItem(Data);
      }
    } catch (error) {}
    setstudentResultStatus(true);
    e.preventDefault();
  };

  const HandleDownloadExel = (e) => {
    e.preventDefault();
    console.log(exelData);

    if (studentResultItem.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(exelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

      // Generate buffer and create download link
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "student_individual_result.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      setExelData([]);
    }
  };

  const HandleDownloadvivaexelresult = async (e, data) => {
    e.preventDefault();
    const vivaname = data.title;

    try {
      const responseViva = await fetch(
        getApiUrl("bin/get/all-vivaresult"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ vivaId: data._id }),
        }
      );
      const Dataviva = await responseViva.json();

      Dataviva.map((data) => {
        const newdata = studentData.filter((std) => std._id == data.student);
        exelDataResult.push({
          Viva: vivaname,
          Name: newdata[0].name,
          Enrollment_num: newdata[0].ennumber,
          Email: newdata[0].email,
          Marks: data.score,
        });
      });

      const worksheet = XLSX.utils.json_to_sheet(exelDataResult);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

      // Generate buffer and create download link
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${vivaname}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setExelDataResult([]);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <>
      {/* Loading Overlays */}
      {isCreatingViva && (
        <div className="global-loading-overlay">
          <div className="global-loading-spinner">
            <Loader2 className="global-spinner-icon" size={48} />
            <p>Creating viva...</p>
          </div>
        </div>
      )}

      {isUpdatingViva && (
        <div className="global-loading-overlay">
          <div className="global-loading-spinner">
            <Loader2 className="global-spinner-icon" size={48} />
            <p>Updating viva...</p>
          </div>
        </div>
      )}

      <div className="class-overview-container">
        {/* Header Section */}
        <div className="class-overview-header">
          <div className="class-overview-header-background">
            <div className="class-overview-header-pattern"></div>
            <div className="class-overview-header-gradient"></div>
          </div>

          <div className="class-overview-header-content">
            <button
              onClick={() => navigate("/teacherdashboard")}
              className="class-overview-back-btn"
            >
              <ArrowLeft size={20} />
              Back to Dashboard
            </button>

            <div className="class-overview-header-main">
              <div className="class-overview-header-info">
                <div className="class-overview-header-icon-container">
                  <GraduationCap
                    size={56}
                    className="class-overview-header-icon"
                  />
                  <div className="class-overview-header-icon-glow"></div>
                </div>
                <div className="class-overview-header-text">
                  <h1>
                    {classInfo.className || `Class ${teacherclasscodeid}`}
                  </h1>
                  <div className="class-overview-header-details">
                    {classInfo.teacherName && (
                      <div className="class-overview-detail-item">
                        <Users size={16} />
                        <span>Teacher: {classInfo.teacherName}</span>
                      </div>
                    )}
                    <div className="class-overview-detail-item">
                      <BookOpen size={16} />
                      <span>Code: {teacherclasscodeid}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="class-overview-stats-grid">
                <div className="class-overview-stat-card">
                  <div className="class-overview-stat-icon">
                    <Users size={28} />
                  </div>
                  <div className="class-overview-stat-content">
                    <span className="class-overview-stat-number">
                      {studentData.length}
                    </span>
                    <span className="class-overview-stat-label">
                      Students Enrolled
                    </span>
                  </div>
                  <div className="class-overview-stat-trend">
                    <TrendingUp size={16} />
                    <span>Active</span>
                  </div>
                </div>

                <div className="class-overview-stat-card">
                  <div className="class-overview-stat-icon">
                    <FileText size={28} />
                  </div>
                  <div className="class-overview-stat-content">
                    <span className="class-overview-stat-number">
                      {mainVivaItem.length}
                    </span>
                    <span className="class-overview-stat-label">
                      Total Vivas
                    </span>
                  </div>
                  <div className="class-overview-stat-trend">
                    <Activity size={16} />
                    <span>
                      {mainVivaItem.filter((v) => v.status === "true").length}{" "}
                      Active
                    </span>
                  </div>
                </div>

                <div className="class-overview-stat-card">
                  <div className="class-overview-stat-icon">
                    <CheckCircle size={28} />
                  </div>
                  <div className="class-overview-stat-content">
                    <span className="class-overview-stat-number">
                      {successRate}%
                    </span>
                    <span className="class-overview-stat-label">
                      Success Rate
                    </span>
                  </div>
                  <div className="class-overview-stat-trend">
                    <TrendingUp size={16} />
                    <span>
                      {successRate >= 70
                        ? "Excellent"
                        : successRate >= 50
                        ? "Good"
                        : "Improving"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="class-overview-actions">
          <button
            className="class-overview-action-btn class-overview-action-primary"
            onClick={() => setpopupStatus(true)}
          >
            <Plus size={20} />
            Create New Viva
          </button>
        </div>

        {/* Viva Filters */}
        <div className="class-overview-filters">
          <button
            className={`class-overview-filter-btn ${
              activeFilter === "all" ? "active" : ""
            }`}
            onClick={HandleAll}
          >
            <BookOpen size={18} />
            All Vivas
          </button>
          <button
            className={`class-overview-filter-btn ${
              activeFilter === "upcoming" ? "active" : ""
            }`}
            onClick={HandleUpcoming}
          >
            <Clock size={18} />
            Upcoming
          </button>
          <button
            className={`class-overview-filter-btn ${
              activeFilter === "active" ? "active" : ""
            }`}
            onClick={HandleContinue}
          >
            <CheckCircle size={18} />
            Active
          </button>
          <button
            className={`class-overview-filter-btn ${
              activeFilter === "finished" ? "active" : ""
            }`}
            onClick={HandleFinished}
          >
            <XCircle size={18} />
            Finished
          </button>
        </div>

        {/* Viva Section with Background */}
        <div className="class-overview-viva-section">
          <div className="class-overview-viva-background">
            <div className="class-overview-section-header">
              <h2>
                <FileText size={24} />
                Viva Assessments
              </h2>
              <p>Manage and monitor your class assessments</p>
            </div>

            {vivaItem.length > 0 ? (
              <div className="class-overview-viva-grid">
                {vivaItem.map((data, i) => (
                  <div className="class-overview-viva-card" key={i}>
                    <div className="class-overview-viva-header">
                      <div className="class-overview-viva-info">
                        <h3>{data.title}</h3>
                        <div className="class-overview-viva-status">
                          {data.status === "active" ||
                          data.status === "true" ? (
                            <span className="class-overview-status-active">
                              <CheckCircle size={16} />
                              Active
                            </span>
                          ) : data.status === "ended" ? (
                            <span className="class-overview-status-ended">
                              <XCircle size={16} />
                              Ended
                            </span>
                          ) : (
                            <span className="class-overview-status-inactive">
                              <XCircle size={16} />
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="class-overview-viva-actions">
                        {(data.status === "inactive" ||
                          data.status === "false" ||
                          !data.status) && (
                          <button
                            className="class-overview-viva-action-btn"
                            onClick={(e) => HandleSetinput(data, e)}
                            title="Edit Viva"
                          >
                            <Edit3 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="class-overview-viva-details">
                      <div className="class-overview-viva-detail">
                        <Calendar size={16} />
                        <span>{new Date(data.date).toLocaleDateString()}</span>
                      </div>
                      <div className="class-overview-viva-detail">
                        <FileText size={16} />
                        <span>{data.totalquetions} Questions</span>
                      </div>
                      <div className="class-overview-viva-detail">
                        <Clock size={16} />
                        <span>{data.time} Minutes</span>
                      </div>
                    </div>

                    {data.status === "active" || data.status === "true" ? (
                      <button
                        className="class-overview-view-viva-btn"
                        onClick={() => navigate(`/viva/monitor/${data._id}`)}
                      >
                        <Eye size={18} />
                        View Viva
                      </button>
                    ) : data.status === "ended" ? (
                      <button
                        className="class-overview-view-results-btn"
                        onClick={() => navigate(`/viva/monitor/${data._id}`)}
                      >
                        <Eye size={18} />
                        View Results
                      </button>
                    ) : (
                      <button
                        className="class-overview-start-viva-btn"
                        onClick={() => handleStartViva(data._id)}
                      >
                        <Play size={18} />
                        Start Viva
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="class-overview-empty-state">
                {messagedisplay ? (
                  <>
                    <FileText size={64} className="class-overview-empty-icon" />
                    <h3>{messagedisplay}</h3>
                    <p>Try adjusting your filters or create a new viva</p>
                  </>
                ) : (
                  <>
                    <FileText size={64} className="class-overview-empty-icon" />
                    <h3>No Vivas Yet</h3>
                    <p>Create your first viva to get started</p>
                    <button
                      className="class-overview-create-first-btn"
                      onClick={() => setpopupStatus(true)}
                    >
                      <Plus size={20} />
                      Create First Viva
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Students Section */}
        <div className="class-overview-students-section">
          <div className="class-overview-students-background">
            <div className="class-overview-section-header">
              <h2>
                <Users size={24} />
                Enrolled Students
              </h2>
              <p>{studentData.length} students enrolled in this class</p>
            </div>

            {studentData.length > 0 ? (
              <div className="class-overview-students-table-container">
                <div className="class-overview-table-wrapper">
                  <table className="class-overview-students-table">
                    <thead>
                      <tr>
                        <th>
                          <div className="class-overview-th-content">
                            <Users size={16} />
                            Student Name
                          </div>
                        </th>
                        <th>
                          <div className="class-overview-th-content">
                            <FileText size={16} />
                            Enrollment
                          </div>
                        </th>
                        <th className="class-overview-th-email">
                          <div className="class-overview-th-content">
                            <Activity size={16} />
                            Email
                          </div>
                        </th>
                        <th className="class-overview-th-joined">
                          <div className="class-overview-th-content">
                            <Calendar size={16} />
                            Joined Date
                          </div>
                        </th>
                        <th>
                          <div className="class-overview-th-content">
                            <Eye size={16} />
                            Actions
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentData.map((data, i) => (
                        <tr key={i} className="class-overview-student-row">
                          <td>
                            <div className="class-overview-student-name">
                              <div className="class-overview-student-avatar">
                                <Users size={20} />
                              </div>
                              <span className="class-overview-name-text">
                                {data.name}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="class-overview-enrollment-badge">
                              {data.ennumber}
                            </span>
                          </td>
                          <td className="class-overview-td-email">
                            <span className="class-overview-email-text">
                              {data.email}
                            </span>
                          </td>
                          <td className="class-overview-td-joined">
                            <span className="class-overview-date-text">
                              {DateFunc(data.createdAt)}
                            </span>
                          </td>
                          <td>
                            <button
                              className="class-overview-view-results-btn"
                              onClick={(e) => HandleViewStudent(data, e)}
                              title="View Student Results"
                            >
                              <Eye size={16} />
                              <span className="class-overview-btn-text">
                                Results
                              </span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="class-overview-empty-students">
                <Users size={64} className="class-overview-empty-icon" />
                <h3>No Students Enrolled</h3>
                <p>Students will appear here once they join your class</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Viva Modal */}
      {popupStatus && (
        <div className="class-overview-modal-overlay">
          <div className="class-overview-modal-content">
            <div className="class-overview-modal-header">
              <h2>Create New Viva</h2>
              <button
                className="class-overview-modal-close"
                onClick={() => setpopupStatus(false)}
                disabled={isCreatingViva}
              >
                ×
              </button>
            </div>

            <div className="class-overview-modal-body">
              <div className="class-overview-form-group">
                <label>Viva Title</label>
                <input
                  type="text"
                  placeholder="Enter viva title"
                  name="title"
                  value={formData.title}
                  onChange={HandleInputchange}
                  disabled={isCreatingViva}
                />
              </div>

              <div className="class-overview-form-row">
                <div className="class-overview-form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={HandleInputchange}
                    disabled={isCreatingViva}
                  />
                </div>
                <div className="class-overview-form-group">
                  <label>Duration (minutes)</label>
                  <input
                    type="number"
                    placeholder="e.g., 60"
                    name="time"
                    value={formData.time}
                    onChange={HandleInputchange}
                    disabled={isCreatingViva}
                  />
                </div>
              </div>

              <div className="class-overview-form-row">
                <div className="class-overview-form-group">
                  <label>Total Questions</label>
                  <input
                    type="number"
                    placeholder="e.g., 20"
                    name="totalquetions"
                    value={formData.totalquetions}
                    onChange={HandleInputchange}
                    disabled={isCreatingViva}
                  />
                </div>
                <div className="class-overview-form-group">
                  <label>Marks Per Question</label>
                  <input
                    type="number"
                    placeholder="e.g., 1, 2, 3"
                    name="marksPerQuestion"
                    min="1"
                    value={formData.marksPerQuestion}
                    onChange={HandleInputchange}
                    disabled={isCreatingViva}
                  />
                </div>
              </div>

              <div className="class-overview-form-group">
                <label>Syllabus</label>
                <textarea
                  placeholder="Enter syllabus topics (e.g., Chapter 1: Introduction, Chapter 2: Advanced Topics, etc.)"
                  name="syllabus"
                  value={formData.syllabus}
                  onChange={HandleInputchange}
                  disabled={isCreatingViva}
                  rows="4"
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    borderRadius: "12px",
                    color: "white",
                    fontSize: "1rem",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            <div className="class-overview-modal-footer">
              <button
                className="class-overview-btn-secondary"
                onClick={() => setpopupStatus(false)}
                disabled={isCreatingViva}
              >
                Cancel
              </button>
              <button
                className="class-overview-btn-primary"
                onClick={HandleCreteViva}
                disabled={isCreatingViva}
              >
                {isCreatingViva ? (
                  <>
                    <Loader2 className="class-overview-spinner" size={18} />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Create Viva
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Viva Modal */}
      {updateStatus && (
        <div className="class-overview-modal-overlay">
          <div className="class-overview-modal-content">
            <div className="class-overview-modal-header">
              <h2>Update Viva</h2>
              <button
                className="class-overview-modal-close"
                onClick={() => setUpdateStatus(false)}
                disabled={isUpdatingViva}
              >
                ×
              </button>
            </div>

            <div className="class-overview-modal-body">
              <div className="class-overview-form-group">
                <label>Viva Title</label>
                <input
                  type="text"
                  placeholder="Enter viva title"
                  name="title"
                  value={formData.title}
                  onChange={HandleInputchange}
                  disabled={isUpdatingViva}
                />
              </div>

              <div className="class-overview-form-row">
                <div className="class-overview-form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={HandleInputchange}
                    disabled={isUpdatingViva}
                  />
                </div>
                <div className="class-overview-form-group">
                  <label>Duration (minutes)</label>
                  <input
                    type="number"
                    placeholder="e.g., 60"
                    name="time"
                    value={formData.time}
                    onChange={HandleInputchange}
                    disabled={isUpdatingViva}
                  />
                </div>
              </div>

              <div className="class-overview-form-row">
                <div className="class-overview-form-group">
                  <label>Total Questions</label>
                  <input
                    type="number"
                    placeholder="e.g., 20"
                    name="totalquetions"
                    value={formData.totalquetions}
                    onChange={HandleInputchange}
                    disabled={isUpdatingViva}
                  />
                </div>
                <div className="class-overview-form-group">
                  <label>Marks Per Question</label>
                  <input
                    type="number"
                    placeholder="e.g., 1, 2, 3"
                    name="marksPerQuestion"
                    min="1"
                    value={formData.marksPerQuestion}
                    onChange={HandleInputchange}
                    disabled={isUpdatingViva}
                  />
                </div>
              </div>

              <div className="class-overview-form-group">
                <label>Syllabus</label>
                <textarea
                  placeholder="Enter syllabus topics (e.g., Chapter 1: Introduction, Chapter 2: Advanced Topics, etc.)"
                  name="syllabus"
                  value={formData.syllabus}
                  onChange={HandleInputchange}
                  disabled={isUpdatingViva}
                  rows="4"
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    borderRadius: "12px",
                    color: "white",
                    fontSize: "1rem",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            <div className="class-overview-modal-footer">
              <button
                className="class-overview-btn-secondary"
                onClick={() => setUpdateStatus(false)}
                disabled={isUpdatingViva}
              >
                Cancel
              </button>
              <button
                className="class-overview-btn-primary"
                onClick={HandleUpdate}
                disabled={isUpdatingViva}
              >
                {isUpdatingViva ? (
                  <>
                    <Loader2 className="class-overview-spinner" size={18} />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit3 size={18} />
                    Update Viva
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Results Modal */}
      {studentResultStatus && (
        <div className="class-overview-modal-overlay">
          <div className="class-overview-results-modal">
            <div className="class-overview-modal-header">
              <h2>Student Results</h2>
              <div className="class-overview-results-actions">
                <button
                  className="class-overview-download-btn"
                  onClick={HandleDownloadExel}
                >
                  <Download size={16} />
                  Download Excel
                </button>
                <button
                  className="class-overview-modal-close"
                  onClick={() => setstudentResultStatus(false)}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="class-overview-results-content">
              <div className="class-overview-student-summary">
                <h3>{studentBasic.student}</h3>
                <p>Enrollment: {studentBasic.ennumber}</p>
                <p>Email: {studentBasic.email}</p>
              </div>

              <div className="class-overview-results-table">
                <table>
                  <thead>
                    <tr>
                      <th>Viva Name</th>
                      <th>Marks</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentResultItem.length > 0 &&
                      studentResultItem.map((data, i) => {
                        const vivaname = vivaItem.filter(
                          (res) => res._id == data.vivaId
                        );

                        if (downloadCount === true) {
                          exelData.push({
                            Name: studentBasic.student,
                            "Enrollment-Number": studentBasic.ennumber,
                            Email: studentBasic.email,
                            Viva: vivaname[0]?.title || "Unknown",
                            Marks: data.score,
                          });
                          setDownloadCount(false);
                        }

                        return (
                          <tr key={i}>
                            <td>{vivaname[0]?.title || "Unknown Viva"}</td>
                            <td>
                              <span className="class-overview-score">
                                {data.score}
                              </span>
                            </td>
                            <td>
                              <Link
                                to="/class/overview/studentresult"
                                className="class-overview-view-detail-btn"
                                onClick={() => {
                                  localStorage.setItem(
                                    "vivaresult",
                                    JSON.stringify(data.answers)
                                  );
                                  localStorage.setItem(
                                    "studentInfo",
                                    JSON.stringify({
                                      name: studentBasic.student,
                                      enrollment: studentBasic.ennumber,
                                      email: studentBasic.email,
                                      vivaName:
                                        vivaname[0]?.title || "Unknown Viva",
                                      score: data.score,
                                      marksPerQuestion:
                                        vivaname[0]?.marksPerQuestion || 1,
                                    })
                                  );
                                }}
                              >
                                <Eye size={16} />
                                View Details
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />
    </>
  );
};

//tittle,date,totalq
//API endpoint: bin/get/vivavbyclasscode

export default ClassOverview;
