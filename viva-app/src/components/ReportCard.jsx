import React, { useState, useEffect, useRef } from "react";
import { X, Download, FileText, Award, Calendar, User, Mail, Hash } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "react-toastify";
import { getApiUrl } from "../utils/api";
import "../CSS/reportcard.css";

const ReportCard = ({ isOpen, onClose, userData }) => {
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    if (isOpen && userData) {
      console.log("ReportCard opened with userData:", userData);
      fetchReportData();
    }
  }, [isOpen, userData]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const studentId = userData._id || userData.id;
      console.log("Fetching report data for student:", studentId);
      
      if (!studentId) {
        throw new Error("No student ID found in userData");
      }
      
      // Use same data source as StudentProfile - userData should contain ennumber
      let completeUserData = userData;
      console.log("=== USER DATA ANALYSIS (Same as StudentProfile) ===");
      console.log("Received userData:", completeUserData);
      console.log("Available fields:", Object.keys(completeUserData || {}));
      console.log("Name:", completeUserData?.name);
      console.log("Email:", completeUserData?.email);
      console.log("Enrollment Number (ennumber):", completeUserData?.ennumber);
      console.log("All enrollment-related fields:", {
        ennumber: completeUserData?.ennumber, // This is what StudentProfile uses
        enrollment: completeUserData?.enrollment,
        enrollmentNumber: completeUserData?.enrollmentNumber,
        rollNumber: completeUserData?.rollNumber,
        studentId: completeUserData?.studentId,
        regNumber: completeUserData?.regNumber
      });
      
      if (completeUserData?.ennumber) {
        console.log("✅ Enrollment number found as 'ennumber':", completeUserData.ennumber);
      } else {
        console.log("⚠️ No 'ennumber' field found - checking alternatives");
      }
      
      // Now get all vivas for the student to find their classes
      console.log("Fetching viva-info to get student's classes");
      const vivaInfoResponse = await fetch(getApiUrl("bin/get/viva-info"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: studentId }),
      });

      console.log("Viva-info response status:", vivaInfoResponse.status);
      
      if (!vivaInfoResponse.ok) {
        throw new Error(`Viva-info API failed: ${vivaInfoResponse.status}`);
      }

      const vivaInfoData = await vivaInfoResponse.json();
      console.log("Viva-info data:", vivaInfoData);

      // Extract unique class codes from vivas
      const uniqueClassCodes = new Set();
      if (vivaInfoData.vivas && Array.isArray(vivaInfoData.vivas)) {
        vivaInfoData.vivas.forEach(viva => {
          if (viva.classCode) {
            uniqueClassCodes.add(viva.classCode);
          }
        });
      }

      console.log("Found class codes:", Array.from(uniqueClassCodes));

      // Now fetch results for each class and enhance with viva details
      let allResults = [];
      for (const classCode of uniqueClassCodes) {
        console.log(`Fetching results for class: ${classCode}`);
        try {
          const classResultsResponse = await fetch(getApiUrl("bin/get/studentinresult"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ classCode: classCode, student: studentId }),
          });

          if (classResultsResponse.ok) {
            const classResults = await classResultsResponse.json();
            console.log(`Results for class ${classCode}:`, classResults);
            
            if (Array.isArray(classResults)) {
              // Filter for only submitted vivas (active === false)
              const submittedResults = classResults.filter(result => {
                const isSubmitted = result.active === false;
                console.log(`Viva ${result.vivaId}: active=${result.active}, submitted=${isSubmitted}`);
                return isSubmitted;
              });
              
              console.log(`Found ${submittedResults.length} submitted vivas out of ${classResults.length} total results`);
              
              // Enhance each submitted result with proper viva details
              for (let result of submittedResults) {
                const vivaId = result.vivaId || result.viva;
                console.log(`Enhancing result for viva ID: ${vivaId}`, result);
                
                try {
                  if (vivaId) {
                    // Fetch viva details to get correct total marks
                    const vivaDetailResponse = await fetch(getApiUrl("bin/get/viva-detail"), {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ data: vivaId }),
                    });

                    console.log(`Viva detail response status for ${vivaId}:`, vivaDetailResponse.status);

                    if (vivaDetailResponse.ok) {
                      const vivaDetail = await vivaDetailResponse.json();
                      console.log(`Viva detail for ${vivaId}:`, vivaDetail);
                      
                      // Calculate proper total marks: questions × marks per question
                      // Note: Backend has typo "totalquetions" instead of "totalQuestions"
                      const totalQuestions = parseInt(vivaDetail.totalquetions) || 
                                           parseInt(vivaDetail.totalQuestions) || 5;
                      const marksPerQuestion = vivaDetail.marksPerQuestion || 1;
                      const calculatedTotalMarks = totalQuestions * marksPerQuestion;
                      
                      console.log(`📊 Viva calculation: ${totalQuestions} questions × ${marksPerQuestion} marks = ${calculatedTotalMarks} total marks`);
                      
                      // Enhance result with viva details - use "title" field from viva schema
                      result.vivaName = vivaDetail.title || result.vivaName || result.title || `Viva ${vivaId.slice(-4)}`;
                      result.totalMarks = calculatedTotalMarks;
                      result.totalQuestions = totalQuestions;
                      result.marksPerQuestion = marksPerQuestion;
                      result.vivaDate = vivaDetail.createdAt || result.createdAt;
                      
                      console.log(`✅ Enhanced result: ${result.vivaName}, Total: ${calculatedTotalMarks} (${totalQuestions} × ${marksPerQuestion})`);
                    } else {
                      console.warn(`❌ Viva detail API failed for ${vivaId}:`, vivaDetailResponse.status);
                      applyFallbackData(result);
                    }
                  } else {
                    console.warn(`❌ No viva ID found for result:`, result);
                    applyFallbackData(result);
                  }
                } catch (vivaError) {
                  console.error(`❌ Error fetching viva details for ${vivaId}:`, vivaError);
                  applyFallbackData(result);
                }
              }
              
              // Helper function to apply fallback data
              const applyFallbackData = (result) => {
                // Use 5 questions as default instead of 10
                const fallbackQuestions = result.totalQuestions || 5;
                const fallbackMarksPerQ = result.marksPerQuestion || 1;
                result.totalMarks = result.totalMarks || (fallbackQuestions * fallbackMarksPerQ);
                result.totalQuestions = fallbackQuestions;
                result.marksPerQuestion = fallbackMarksPerQ;
                result.vivaName = result.vivaName || result.title || result.name || 
                                `Viva ${result.vivaId?.slice(-4) || 'Exam'}`;
                console.log(`🔄 Applied fallback data: "${result.vivaName}", Questions: ${fallbackQuestions}, Total: ${result.totalMarks}`);
              };
              
              allResults = allResults.concat(submittedResults);
            }
          } else {
            console.error(`Failed to fetch results for class ${classCode}:`, classResultsResponse.status);
          }
        } catch (error) {
          console.error(`Error fetching results for class ${classCode}:`, error);
        }
      }

      console.log("=== DETAILED RESULTS ANALYSIS ===");
      console.log("All combined results:", allResults);
      console.log("Number of results:", allResults.length);
      
      // Log each result in detail
      allResults.forEach((result, index) => {
        console.log(`Result ${index}:`, {
          raw: result,
          vivaName: result.vivaName || result.title || result.name,
          marks: result.marks || result.score,
          totalMarks: result.totalMarks || result.maxMarks || result.total,
          className: result.className || result.class || result.classCode,
          date: result.createdAt || result.date || result.submittedAt,
          allFields: Object.keys(result)
        });
      });
      
      // Remove duplicates - a student should only have one result per viva
      const seenVivas = new Map(); // Use Map to store best result for each viva
      
      allResults.forEach(result => {
        const vivaId = result.vivaId || result.viva || result._id;
        const vivaName = result.vivaName || result.title || result.name || 'Unknown';
        const vivaIdentifier = `${vivaId || vivaName}-${result.student}`;
        
        console.log(`Processing result: ${vivaName} (ID: ${vivaId}) for student ${result.student}`);
        
        if (!seenVivas.has(vivaIdentifier)) {
          seenVivas.set(vivaIdentifier, result);
          console.log(`Added unique viva: ${vivaName}`);
        } else {
          // If duplicate, keep the one with higher marks
          const existing = seenVivas.get(vivaIdentifier);
          const existingMarks = existing.marks || existing.score || 0;
          const currentMarks = result.marks || result.score || 0;
          
          if (currentMarks > existingMarks) {
            seenVivas.set(vivaIdentifier, result);
            console.log(`Replaced duplicate with higher marks: ${vivaName} (${currentMarks} > ${existingMarks})`);
          } else {
            console.log(`Kept existing result for: ${vivaName} (${existingMarks} >= ${currentMarks})`);
          }
        }
      });
      
      // Convert Map values back to array
      const uniqueResults = Array.from(seenVivas.values());
      console.log("=== FINAL DEDUPLICATION RESULTS ===");
      console.log("After deduplication:", uniqueResults.length, "unique results");
      
      uniqueResults.forEach((result, index) => {
        console.log(`📋 Result ${index + 1}:`, {
          vivaId: result.vivaId,
          vivaName: result.vivaName,
          className: result.className,
          marks: result.marks || result.score,
          totalMarks: result.totalMarks,
          totalQuestions: result.totalQuestions,
          marksPerQuestion: result.marksPerQuestion,
          active: result.active
        });
      });
      
      console.log("=== SUMMARY ===");
      console.log("✅ Unique viva names:", uniqueResults.map(r => r.vivaName));
      console.log("✅ Class names:", uniqueResults.map(r => r.className));
      console.log("✅ Question counts:", uniqueResults.map(r => r.totalQuestions));
      const results = uniqueResults;
        
        // Handle different response structures
        let resultsArray = [];
        if (Array.isArray(results)) {
          resultsArray = results;
        } else if (results && Array.isArray(results.data)) {
          resultsArray = results.data;
        } else if (results && Array.isArray(results.results)) {
          resultsArray = results.results;
        } else if (results && typeof results === 'object') {
          // If it's a single object, wrap it in an array
          resultsArray = [results];
        }
        
        console.log("Processing viva results:", resultsArray);
        
        // Calculate total classes joined from the class codes we already found
        const totalClassesJoined = uniqueClassCodes.size;
        console.log("Total classes joined:", totalClassesJoined);
        
        // Calculate statistics with better field mapping
        const totalVivas = resultsArray.length;
        
        // Enhanced field mapping for marks
        const totalMarksObtained = resultsArray.reduce((sum, result) => {
          const marks = result.marks || result.score || result.obtainedMarks || 0;
          console.log(`Result marks: ${marks} from result:`, result);
          return sum + marks;
        }, 0);
        
        const totalPossibleMarks = resultsArray.reduce((sum, result) => {
          // Use the enhanced total marks from viva details, or fallback
          const maxMarks = result.totalMarks || result.maxMarks || result.total || result.fullMarks || 
                          (result.totalQuestions * result.marksPerQuestion) || 10; // More reasonable default
          console.log(`Result total marks: ${maxMarks} from result:`, {
            vivaName: result.vivaName,
            totalMarks: result.totalMarks,
            totalQuestions: result.totalQuestions,
            marksPerQuestion: result.marksPerQuestion,
            calculated: result.totalQuestions * result.marksPerQuestion
          });
          return sum + maxMarks;
        }, 0);
        
        const averageScore = totalPossibleMarks > 0 ? ((totalMarksObtained / totalPossibleMarks) * 100).toFixed(2) : 0;
        console.log(`Average calculation: ${totalMarksObtained}/${totalPossibleMarks} = ${averageScore}%`);
        
        // Determine performance level
        let performanceLevel = "Needs Improvement";
        let performanceColor = "#ff6b6b";
        if (averageScore >= 90) {
          performanceLevel = "Excellent";
          performanceColor = "#51cf66";
        } else if (averageScore >= 80) {
          performanceLevel = "Very Good";
          performanceColor = "#69db7c";
        } else if (averageScore >= 70) {
          performanceLevel = "Good";
          performanceColor = "#ffd43b";
        } else if (averageScore >= 60) {
          performanceLevel = "Satisfactory";
          performanceColor = "#ffa94d";
        }

        // Enhance results with viva info data and fetch proper class names
        const enhancedResults = await Promise.all(resultsArray.map(async (result) => {
          // Try to find matching viva info for better names and class info
          const matchingViva = vivaInfoData.vivas?.find(viva => 
            viva.classCode === (result.classCode || result.className || result.class) ||
            viva._id === result.vivaId
          );
          
          // Get proper class name from class-info API
          let displayClassName = result.className || result.class;
          
          if (!displayClassName || displayClassName === result.classCode) {
            try {
              const classCode = result.classCode || result.className || result.class;
              console.log(`🏫 Fetching class info for code: ${classCode}`);
              
              const classInfoResponse = await fetch(getApiUrl("bin/get/class-info"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ classCode: classCode }),
              });
              
              if (classInfoResponse.ok) {
                const classInfo = await classInfoResponse.json();
                console.log(`🏫 Class info for ${classCode}:`, classInfo);
                
                // The API returns { success: true, classCode: "...", className: "...", teacher: "..." }
                displayClassName = classInfo.className || classInfo.classname || classCode;
                                 
                console.log(`✅ Found class name: "${displayClassName}" for code: ${classCode}`);
              } else {
                console.log(`❌ Class info not found for: ${classCode}`);
                displayClassName = classCode || "Unknown Class";
              }
            } catch (error) {
              console.error(`Error fetching class info:`, error);
              displayClassName = result.classCode || result.className || "Unknown Class";
            }
          }
          
          return {
            ...result,
            vivaName: result.vivaName || result.title || result.name || 
                     matchingViva?.title || matchingViva?.name || `Viva Exam`,
            className: displayClassName
          };
        }));

        const reportDataObj = {
          results: enhancedResults,
          totalVivas,
          totalClassesJoined,
          totalPossibleMarks,
          averageScore,
          performanceLevel,
          performanceColor,
          userData: completeUserData, // Include complete user data with enrollment
        };
        
        console.log("Setting report data:", reportDataObj);
        setReportData(reportDataObj);
    } catch (error) {
      console.error("Error fetching report data:", error);
      setReportData({
        results: [],
        totalVivas: 0,
        totalClassesJoined: 0,
        totalPossibleMarks: 0,
        averageScore: 0,
        performanceLevel: "No Data Available",
        performanceColor: "#718096",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!reportRef.current) return;
    
    setIsGeneratingPDF(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${userData.name}_Report_Card.pdf`);
      toast.success("Report card downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      // Handle different date formats
      let date;
      if (dateString instanceof Date) {
        date = dateString;
      } else if (typeof dateString === 'string' || typeof dateString === 'number') {
        date = new Date(dateString);
      } else {
        date = new Date(); // Fallback to current date
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Date not available";
      }
      
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="report-modal-overlay">
      <div className="report-modal">
        <div className="report-modal-header">
          <h2>
            <FileText className="icon" />
            Student Report Card
          </h2>
          <div className="report-modal-actions">
            <button
              onClick={generatePDF}
              disabled={isGeneratingPDF || isLoading}
              className="download-btn"
            >
              <Download className="icon" />
              {isGeneratingPDF ? "Generating..." : "Download PDF"}
            </button>
            <button onClick={onClose} className="close-btn">
              <X className="icon" />
            </button>
          </div>
        </div>

        <div className="report-modal-content">
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading report data...</p>
            </div>
          ) : !reportData ? (
            <div className="loading-state">
              <p>No report data available. Please try again.</p>
            </div>
          ) : (
            <div ref={reportRef} className="report-card">
              {/* Header */}
              <div className="report-header">
                <div className="report-title">
                  <Award className="report-icon" />
                  <h1>STUDENT REPORT CARD</h1>
                </div>
                <div className="report-logo">
                  <div className="logo-circle">
                    <FileText size={24} />
                  </div>
                </div>
              </div>

              {/* Student Details */}
              <div className="report-section">
                <h2 className="section-title">
                  <User className="section-icon" />
                  Student Details
                </h2>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">{reportData?.userData?.name || userData?.name || "N/A"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Enrollment Number:</span>
                    <span className="detail-value">{
                      reportData?.userData?.ennumber || // Same field as StudentProfile
                      userData?.ennumber || // Same field as StudentProfile
                      reportData?.userData?.enrollment || 
                      reportData?.userData?.enrollmentNumber || 
                      reportData?.userData?.rollNumber ||
                      userData?.enrollment || 
                      userData?.enrollmentNumber || 
                      userData?.rollNumber || 
                      "Not Available"
                    }</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email ID:</span>
                    <span className="detail-value">{reportData?.userData?.email || userData?.email || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Performance Summary */}
              <div className="report-section">
                <h2 className="section-title">
                  <Award className="section-icon" />
                  Performance Summary
                </h2>
                <div className="performance-grid">
                  <div className="performance-card">
                    <div className="performance-number">{reportData?.totalVivas || 0}</div>
                    <div className="performance-label">Total Viva Exams</div>
                  </div>
                  <div className="performance-card">
                    <div className="performance-number">{reportData?.totalClassesJoined || 0}</div>
                    <div className="performance-label">Total Classes Joined</div>
                  </div>
                  <div className="performance-card">
                    <div className="performance-number">{reportData?.averageScore || 0}%</div>
                    <div className="performance-label">Average Score</div>
                  </div>
                  <div className="performance-card">
                    <div 
                      className="performance-level"
                      style={{ color: reportData?.performanceColor }}
                    >
                      {reportData?.performanceLevel || "N/A"}
                    </div>
                    <div className="performance-label">Performance Level</div>
                  </div>
                </div>
              </div>



              {/* Viva Performance Table */}
              <div className="report-section">
                <h2 className="section-title">
                  <Calendar className="section-icon" />
                  Viva Performance Details
                </h2>
                <div className="table-container">
                  <table className="performance-table">
                    <thead>
                      <tr>
                        <th>Viva Name</th>
                        <th>Class</th>
                        <th>Marks Obtained</th>
                        <th>Total Marks</th>
                        <th>Percentage</th>
                        <th>Viva Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData?.results?.length > 0 ? (
                        reportData.results.map((result, index) => {
                          console.log(`Processing result ${index}:`, result);
                          
                          // Enhanced field mapping
                          const marksObtained = result.marks || result.score || result.obtainedMarks || 0;
                          const totalMarks = result.totalMarks || result.maxMarks || result.total || result.fullMarks || 100;
                          
                          // Better viva name extraction
                          const vivaName = result.vivaName || result.title || result.name || result.vivaTitle || 
                                          result.examName || result.testName || `Viva ${index + 1}`;
                          
                          // Better class name extraction  
                          const className = result.className || result.class || result.classCode || 
                                          result.courseCode || result.subject || "Unknown Class";
                          
                          // Better date extraction
                          const vivaDate = result.createdAt || result.date || result.submittedAt || 
                                         result.completedAt || result.timestamp || new Date();
                          
                          return (
                            <tr key={index}>
                              <td>{vivaName}</td>
                              <td>{className}</td>
                              <td className="marks-obtained">{marksObtained}</td>
                              <td>{totalMarks}</td>
                              <td className="percentage">
                                {totalMarks > 0 
                                  ? ((marksObtained / totalMarks) * 100).toFixed(1) + "%"
                                  : "0%"
                                }
                              </td>
                              <td>{formatDate(vivaDate)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="6" className="no-data">
                            No viva exam results found. Complete your first viva to see results here.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="report-footer">
                <div className="footer-content">
                  <div className="footer-left">
                    <p>Generated on: {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="footer-right">
                    <p className="ai-portal-text">AI Viva Portal</p>
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

export default ReportCard;