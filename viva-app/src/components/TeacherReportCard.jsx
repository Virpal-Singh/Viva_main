import React, { useState, useRef } from "react";
import { 
  FileText, 
  Download, 
  X, 
  User, 
  Award, 
  BookOpen, 
  Users, 
  BarChart3,
  GraduationCap,
  TrendingUp,
  Calendar,
  Target
} from "lucide-react";
import html2pdf from "html2pdf.js";
import { getApiUrl } from "../utils/api";
import "../CSS/teacher-report.css";

const TeacherReportCard = ({ isOpen, onClose, teacherData }) => {
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const reportRef = useRef();

  React.useEffect(() => {
    if (isOpen && teacherData && !reportData) {
      fetchTeacherReportData();
    }
  }, [isOpen, teacherData]);

  const fetchTeacherReportData = async () => {
    setIsLoading(true);
    try {
      console.log("🎓 Fetching teacher report data for teacher ID:", teacherData._id);
      console.log("🎓 Full teacher data:", teacherData);
      
      if (!teacherData._id) {
        throw new Error("Teacher ID is missing");
      }

      // Fetch teacher classes with detailed stats (this has all the data we need)
      console.log("🌐 Making API call to:", getApiUrl("bin/get/teacher-classes-with-stats"));
      console.log("📤 Sending teacher ID:", teacherData._id);
      
      const classesResponse = await fetch(getApiUrl("bin/get/teacher-classes-with-stats"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherid: teacherData._id }),
      });

      console.log("📥 API Response status:", classesResponse.status);
      
      if (!classesResponse.ok) {
        const errorText = await classesResponse.text();
        console.error("❌ API Error:", errorText);
        throw new Error(`Failed to fetch teacher classes data: ${classesResponse.status}`);
      }

      const classesData = await classesResponse.json();
      console.log("🏫 Raw classes data:", classesData);

      // Extract classes array and total stats - API returns classes in 'message' field
      let classes = [];
      let totalStats = {};
      
      if (Array.isArray(classesData.message)) {
        classes = classesData.message;
        totalStats = classesData.totalStats || {};
      } else if (Array.isArray(classesData)) {
        // Fallback if API returns array directly
        classes = classesData;
      } else {
        console.warn("⚠️ Unexpected API response format:", classesData);
        classes = [];
        totalStats = {};
      }

      console.log("📊 Total stats from API:", totalStats);
      console.log("🏫 Classes array:", classes);
      console.log("🔢 Number of classes found:", classes.length);

      // Process class data with detailed statistics
      const processedClasses = await Promise.all(
        classes.map(async (classItem) => {
          try {
            // Calculate success rate for this class (average of all students' average scores)
            let classSuccessRate = 0;
            let totalAttempts = 0;
            const studentScores = {}; // Track scores per student

            try {
              // Get all vivas for this class first
              const vivasResponse = await fetch(getApiUrl("bin/get/vivavbyclasscode"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ classCode: classItem.code }),
              });

              if (vivasResponse.ok) {
                const vivas = await vivasResponse.json();
                
                // For each viva, get all results and calculate percentage scores
                for (const viva of vivas) {
                  try {
                    // Get viva details to know total possible marks
                    const totalQuestions = parseInt(viva.totalquetions) || 5;
                    const marksPerQuestion = viva.marksPerQuestion || 1;
                    const totalPossibleMarks = totalQuestions * marksPerQuestion;
                    
                    console.log(`📝 Viva ${viva._id} details:`, {
                      title: viva.title,
                      totalQuestions,
                      marksPerQuestion,
                      totalPossibleMarks
                    });

                    const vivaResultsResponse = await fetch(getApiUrl("bin/get/all-vivaresult"), {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ vivaId: viva._id }),
                    });

                    if (vivaResultsResponse.ok) {
                      const vivaResults = await vivaResultsResponse.json();
                      const submittedResults = vivaResults.filter(r => r.active === false);
                      
                      console.log(`📝 Viva ${viva._id} results:`, {
                        totalResults: vivaResults.length,
                        submittedResults: submittedResults.length,
                        sampleScores: submittedResults.slice(0, 3).map(r => ({ 
                          student: r.student, 
                          rawScore: r.score, 
                          percentage: Math.round((r.score / totalPossibleMarks) * 100),
                          active: r.active 
                        }))
                      });
                      
                      // Group percentage scores by student
                      submittedResults.forEach(result => {
                        const studentId = result.student;
                        if (!studentScores[studentId]) {
                          studentScores[studentId] = [];
                        }
                        // Convert raw score to percentage
                        const percentageScore = (result.score || 0) / totalPossibleMarks * 100;
                        studentScores[studentId].push(percentageScore);
                        totalAttempts++;
                      });
                    }
                  } catch (vivaError) {
                    console.error(`Error fetching results for viva ${viva._id}:`, vivaError);
                  }
                }

                // Calculate success rate: average of each student's average score
                const studentAverages = [];
                Object.keys(studentScores).forEach(studentId => {
                  const scores = studentScores[studentId];
                  const studentAvg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
                  studentAverages.push(studentAvg);
                });

                if (studentAverages.length > 0) {
                  const overallAvg = studentAverages.reduce((sum, avg) => sum + avg, 0) / studentAverages.length;
                  // Scores are already converted to percentages above
                  classSuccessRate = Math.round(overallAvg);
                }

                console.log(`📊 Class ${classItem.code} detailed calculation:`, {
                  totalVivas: vivas.length,
                  studentScores: studentScores,
                  studentAverages: studentAverages,
                  rawOverallAvg: studentAverages.length > 0 ? studentAverages.reduce((sum, avg) => sum + avg, 0) / studentAverages.length : 0,
                  finalClassSuccessRate: classSuccessRate,
                  totalAttempts: totalAttempts
                });
              }
            } catch (error) {
              console.error(`Error fetching vivas for class ${classItem.code}:`, error);
            }

            return {
              code: classItem.code,
              name: classItem.classname || classItem.code,
              totalStudents: classItem.studentCount || 0,
              totalVivas: classItem.vivaCount || 0,
              successRate: classSuccessRate,
              totalAttempts: totalAttempts
            };
          } catch (error) {
            console.error(`Error processing class ${classItem.code}:`, error);
            return {
              code: classItem.code,
              name: classItem.classname || classItem.code,
              totalStudents: classItem.studentCount || 0,
              totalVivas: classItem.vivaCount || 0,
              successRate: 0,
              totalAttempts: 0
            };
          }
        })
      );

      // Calculate overall success rate as average of all class success rates
      let totalSuccessRate = 0;
      let classesWithData = 0;

      console.log("🎯 Calculating overall success rate from processed classes:", 
        processedClasses.map(c => ({ 
          code: c.code, 
          successRate: c.successRate, 
          totalAttempts: c.totalAttempts 
        }))
      );

      // Sum up all class success rates
      for (const classItem of processedClasses) {
        if (classItem.totalAttempts > 0) {
          totalSuccessRate += classItem.successRate;
          classesWithData++;
          console.log(`➕ Adding class ${classItem.code}: ${classItem.successRate}% (running total: ${totalSuccessRate})`);
        } else {
          console.log(`⏭️ Skipping class ${classItem.code}: no attempts`);
        }
      }

      // Overall success rate is the average of all class success rates
      const successRate = classesWithData > 0 ? 
        Math.round(totalSuccessRate / classesWithData) : 0;
        
      console.log(`🎯 Final overall success rate: ${totalSuccessRate} / ${classesWithData} = ${successRate}%`);

      const reportDataObj = {
        teacherInfo: {
          name: teacherData.name,
          email: teacherData.email,
          enrollmentNumber: teacherData.ennumber
        },
        stats: {
          totalClasses: totalStats.totalClasses || classes.length,
          totalVivas: totalStats.totalVivas || 0,
          totalStudents: totalStats.totalStudents || 0,
          successRate: successRate
        },
        classes: processedClasses,
        generatedAt: new Date().toLocaleString()
      };

      console.log("📋 Processed classes:", processedClasses);
      console.log("📊 Final stats:", {
        totalClasses: reportDataObj.stats.totalClasses,
        totalVivas: reportDataObj.stats.totalVivas,
        totalStudents: reportDataObj.stats.totalStudents,
        successRate: reportDataObj.stats.successRate
      });
      console.log("📋 Final teacher report data:", reportDataObj);
      setReportData(reportDataObj);

    } catch (error) {
      console.error("❌ Error fetching teacher report data:", error);
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const element = reportRef.current;
      const opt = {
        margin: 0.5,
        filename: `teacher-report-${reportData?.teacherInfo?.name?.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          letterRendering: true
        },
        jsPDF: { 
          unit: 'in', 
          format: 'a4', 
          orientation: 'portrait' 
        }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      
      // Fallback: Try browser's print functionality
      try {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
            <head>
              <title>Teacher Report Card</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .teacher-report-card { max-width: 800px; margin: 0 auto; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .teacher-performance-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
                .teacher-performance-card { border: 1px solid #ddd; padding: 20px; text-align: center; }
                .teacher-section-title { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
              </style>
            </head>
            <body>
              ${element.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      } catch (fallbackError) {
        alert('Error generating PDF. Please try using your browser\'s print function (Ctrl+P).');
      }
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="teacher-report-modal-overlay">
      <div className="teacher-report-modal">
        <div className="teacher-report-modal-header">
          <h2>
            <GraduationCap className="icon" />
            Teacher Report Card
          </h2>
          <div className="teacher-report-modal-actions">
            <button
              onClick={generatePDF}
              disabled={isGeneratingPDF || isLoading}
              className="teacher-download-btn"
            >
              <Download className="icon" />
              {isGeneratingPDF ? "Generating..." : "Download PDF"}
            </button>
            <button onClick={onClose} className="teacher-close-btn">
              <X className="icon" />
            </button>
          </div>
        </div>

        <div className="teacher-report-modal-content">
          {isLoading ? (
            <div className="teacher-loading-state">
              <div className="teacher-spinner"></div>
              <p>Loading teacher report data...</p>
            </div>
          ) : !reportData ? (
            <div className="teacher-loading-state">
              <p>No report data available. Please try again.</p>
            </div>
          ) : (
            <div ref={reportRef} className="teacher-report-card">
              {/* Header */}
              <div className="teacher-report-header">
                <div className="teacher-report-title">
                  <GraduationCap className="teacher-report-icon" />
                  <h1>TEACHER REPORT CARD</h1>
                </div>
              </div>

              {/* Teacher Details */}
              <div className="teacher-report-section">
                <h2 className="teacher-section-title">
                  <User className="teacher-section-icon" />
                  Teacher Details
                </h2>
                <div className="teacher-details-grid">
                  <div className="teacher-detail-item">
                    <span className="teacher-detail-label">Name:</span>
                    <span className="teacher-detail-value">{reportData.teacherInfo.name}</span>
                  </div>
                  <div className="teacher-detail-item">
                    <span className="teacher-detail-label">Enrollment Number:</span>
                    <span className="teacher-detail-value">{reportData.teacherInfo.enrollmentNumber}</span>
                  </div>
                  <div className="teacher-detail-item">
                    <span className="teacher-detail-label">Email ID:</span>
                    <span className="teacher-detail-value">{reportData.teacherInfo.email}</span>
                  </div>
                </div>
              </div>

              {/* Performance Summary */}
              <div className="teacher-report-section">
                <h2 className="teacher-section-title">
                  <Award className="teacher-section-icon" />
                  Teaching Performance Summary
                </h2>
                <div className="teacher-performance-grid">
                  <div className="teacher-performance-card">
                    <div className="teacher-performance-number">{reportData.stats.totalClasses}</div>
                    <div className="teacher-performance-label">Total Classes Created</div>
                  </div>
                  <div className="teacher-performance-card">
                    <div className="teacher-performance-number">{reportData.stats.totalVivas}</div>
                    <div className="teacher-performance-label">Total Viva Exams Created</div>
                  </div>
                  <div className="teacher-performance-card">
                    <div className="teacher-performance-number">{reportData.stats.totalStudents}</div>
                    <div className="teacher-performance-label">Total Students Taught</div>
                  </div>
                  <div className="teacher-performance-card">
                    <div className="teacher-performance-number">{reportData.stats.successRate}%</div>
                    <div className="teacher-performance-label">Overall Success Rate</div>
                  </div>
                </div>
              </div>

              {/* Class Details Table */}
              <div className="teacher-report-section">
                <h2 className="teacher-section-title">
                  <BookOpen className="teacher-section-icon" />
                  Class Performance Details
                </h2>
                <div className="teacher-table-container">
                  {reportData.classes.length > 0 ? (
                    <table className="teacher-report-table">
                      <thead>
                        <tr>
                          <th>Class Name</th>
                          <th>Class Code</th>
                          <th>Total Vivas</th>
                          <th>Total Students</th>
                          <th>Success Rate</th>
                          <th>Total Attempts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.classes.map((classItem, index) => (
                          <tr key={index}>
                            <td>{classItem.name}</td>
                            <td>{classItem.code}</td>
                            <td>{classItem.totalVivas}</td>
                            <td>{classItem.totalStudents}</td>
                            <td>{classItem.successRate}%</td>
                            <td>{classItem.totalAttempts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="teacher-no-data-message">
                      <BookOpen size={48} style={{ opacity: 0.3, margin: '20px auto' }} />
                      <p>No classes created yet. Create your first class to see detailed performance metrics!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="teacher-report-footer">
                <div className="teacher-footer-content">
                  <div className="teacher-footer-left">
                    <p><strong>Generated on:</strong> {reportData.generatedAt}</p>
                    <p><strong>System:</strong> AI Viva Portal</p>
                  </div>
                  <div className="teacher-footer-right">
                    <div className="teacher-footer-logo">
                      <GraduationCap size={20} />
                      <span>AI Viva Portal</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherReportCard;