import React, { useEffect, useRef, useState } from "react";
import "../CSS/vivatest.css";
import { useSelector } from "react-redux";
import { getApiUrl } from "../utils/api";
import { CheckCircle2 } from "lucide-react";

const VivaTest = () => {
  const [timeLeft, setTimeLeft] = useState(null); // in seconds
  const intervalRef = useRef(null);
  const [answers, setAnswers] = useState(Array(10).fill(""));
  const { UserInfo } = useSelector((state) => state.user);
  const [userid, setUserId] = useState("");
  const [vivaMainid, setvivaMainid] = useState("");
  const [VivaResultId, setVivaResultId] = useState("");
  const [DataQuet, SetDataQuet] = useState([]);
  const [FinalQuetion, setFinalQuetion] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [load, setLoad] = useState(true);
  const [done, setDone] = useState(false);
  const [submittedData, setSubmittedData] = useState([]);
  const [marksPerQuestion, setMarksPerQuestion] = useState(1);
  const [vivaTitle, setVivaTitle] = useState("");

  useEffect(() => {
    if (UserInfo && UserInfo.length > 0) {
      setUserId(UserInfo[0].payload._id);
      if (UserInfo[0].payload.role != 0) {
        window.location.href = "/login";
      }
    }
  }, [UserInfo]);

  const handleChange = (index, value) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);

    const updatedQuestions = [...FinalQuetion];
    updatedQuestions[index].answer = value;
    setFinalQuetion(updatedQuestions);
  };
  function openFullscreen(element) {
    if (!element) {
      element = document.documentElement; // Default to whole page
    }

    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      /* Safari */
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      /* IE11 */
      element.msRequestFullscreen();
    }
  }

  openFullscreen();
  const handleSubmit = async (autoSubmitReason = null) => {
    // Prevent submission if questions aren't loaded or already submitted
    if (FinalQuetion.length === 0 || !vivaMainid || submitted || done) {
      console.log("⚠️ Cannot submit - invalid state");
      return;
    }

    // Mark as submitted immediately to prevent duplicate submissions
    setSubmitted(true);
    
    console.log("📤 Submitting viva...", autoSubmitReason ? `Reason: ${autoSubmitReason}` : "Manual submission");

    const data = FinalQuetion.map((q, i) => ({
      question: q.question,
      options: q.options,
      selectedAnswer: userAnswers[i] || "Not Answered",
      correctAnswer: q.answer,
    }));
    
    let correctCount = 0;
    data.forEach((q) => {
      const selectedAnswer = String(q.selectedAnswer || '').trim().toLowerCase();
      const correctAnswer = String(q.correctAnswer || '').trim().toLowerCase();
      if (selectedAnswer === correctAnswer) {
        correctCount++;
      }
    });
    
    const totalMarks = correctCount * marksPerQuestion;
    
    setSubmittedData(data);
    const _id = vivaMainid;
    
    try {
      const UpdateResul = await fetch(
        getApiUrl("bin/update/status"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            _id,
            status: false,
            marks: totalMarks,
            answers: data,
          }),
        }
      );
      
      if (!UpdateResul.ok) {
        throw new Error("Failed to submit viva");
      }
      
      const res = await UpdateResul.json();
      console.log("✅ Viva submitted successfully");
      
      // If auto-submitted, create notification
      if (autoSubmitReason) {
        const vivaId = localStorage.getItem("VivaId");
        await fetch(getApiUrl("bin/notification/create"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            studentId: userid,
            vivaId: vivaId,
            reason: autoSubmitReason,
          }),
        });
      }
      
      // Clear questions and timer
      setFinalQuetion([]);
      localStorage.removeItem("quizEndTs");
      setDone(true);
      
      // Show email notification alert
      alert("✅ Viva Submitted Successfully!\n\n📧 Check your email - We've sent your detailed result with marks and performance analysis.");
      
      window.location.href = "/";
    } catch (error) {
      console.error("❌ Error submitting viva:", error);
      setSubmitted(false); // Reset if submission failed
      alert("Failed to submit viva. Please try again.");
    }
  };

  const HandleGenrateQ = async (data) => {
    // Set marks per question from viva data
    setMarksPerQuestion(data.marksPerQuestion || 1);
    // Set viva title
    setVivaTitle(data.title || "Viva Test");

    try {
      // Check if result already exists for this student and viva
      const VivaExistInResult = await fetch(
        getApiUrl("bin/get/viva-resultexist"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ vivaId: data._id, student: userid }),
        }
      );
      
      const responseData = await VivaExistInResult.json();
      const status = VivaExistInResult.status;

      console.log("Viva check response:", { status, responseData });

      // Case 1: Result exists (status 200)
      if (status === 200 && responseData.result) {
        const result = responseData.result;
        const isActive = result.active === true;
        const isSubmitted = result.active === false;
        
        console.log("Result found - Active:", isActive, "Submitted:", isSubmitted);
        
        // If already submitted, show completion message
        if (isSubmitted) {
          console.log("✅ Viva already submitted");
          setFinalQuetion([]);
          setLoad(false);
          setDone(true);
          localStorage.removeItem("quizEndTs");
          return;
        }
        
        // If in progress, load existing questions
        if (isActive) {
          console.log("📝 Viva in progress, loading existing questions");
          setLoad(false);
          setFinalQuetion(result.vivaq);
          setvivaMainid(result._id);
          
          // Check if timer is still valid for THIS viva
          const storedVivaId = localStorage.getItem("VivaId");
          const existingEndTs = localStorage.getItem("quizEndTs");
          
          // Only use stored timer if it's for the same viva and not expired
          if (existingEndTs && storedVivaId === data._id) {
            const remaining = Math.floor((parseInt(existingEndTs) - Date.now()) / 1000);
            if (remaining > 0) {
              console.log("Using existing timer:", remaining, "seconds");
              setTimeLeft(remaining);
              return;
            }
          }
          
          // Timer expired or doesn't exist - create new one
          console.log("Creating new timer for resumed viva");
          const timeMs = data.time * 60 * 1000;
          const endTs = Date.now() + timeMs;
          localStorage.setItem("quizEndTs", endTs);
          setTimeLeft(data.time * 60);
          return;
        }
      }

      // Case 2: No result exists (status 404) - Create new viva attempt
      if (status === 404) {
        console.log("🆕 No existing result, creating new viva attempt");
        
        // Clear any old timer from previous vivas
        localStorage.removeItem("quizEndTs");
        
        // Generate questions
        const responseQuetion = await fetch(
          getApiUrl("bin/api/questions"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              syllabus: data.syllabus,
              totalq: data.totalquetions,
            }),
          }
        );

        if (!responseQuetion.ok) {
          throw new Error("Failed to generate questions");
        }

        const DataQ = await responseQuetion.json();
        
        if (!DataQ.questions || DataQ.questions.length === 0) {
          throw new Error("No questions generated");
        }

        // Create viva result entry
        const PostResultData = await fetch(
          getApiUrl("bin/take/vivatest"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              classCode: data.classCode,
              studentId: userid,
              vivaId: data._id,
              vivaq: DataQ.questions,
            }),
          }
        );

        const resultResponse = await PostResultData.json();
        
        if (PostResultData.status === 409) {
          // Result already exists (race condition), reload the page
          console.log("⚠️ Result created by another request, reloading...");
          window.location.reload();
          return;
        }

        if (!PostResultData.ok) {
          throw new Error(resultResponse.message || "Failed to create viva attempt");
        }

        // Set questions and timer
        setFinalQuetion(DataQ.questions);
        setvivaMainid(resultResponse.data._id);
        setLoad(false);

        // Set NEW timer for this viva
        const timeMs = Number(data.time) * 60 * 1000;
        const endTs = Date.now() + timeMs;
        localStorage.setItem("quizEndTs", endTs);
        setTimeLeft(data.time * 60);
        
        console.log("✅ New viva attempt created with timer:", data.time, "minutes");
        return;
      }

      // Unexpected status
      console.error("Unexpected response status:", status);
      alert("An error occurred. Please try again.");
      window.location.href = "/";

    } catch (error) {
      console.error("Error in HandleGenrateQ:", error);
      alert("Failed to load viva. Please try again.");
      window.location.href = "/";
    }
  };

  useEffect(() => {
    // Don't start timer if timeLeft is null or if questions aren't loaded
    if (timeLeft === null || FinalQuetion.length === 0) return;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          localStorage.removeItem("quizEndTs");

          // 🚨 Auto-submit if not already submitted and questions are loaded
          if (!submitted && FinalQuetion.length > 0 && vivaMainid) {
            console.log("⏰ Time over - auto-submitting viva");
            handleSubmit("time-over");
            setSubmitted(true);
            setDone(true);
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [timeLeft, submitted, FinalQuetion, vivaMainid]);

  useEffect(() => {
    const GetVivaFunc = async () => {
      try {
        const VivaId = localStorage.getItem("VivaId");
        const response = await fetch(
          getApiUrl("bin/get/viva-detail"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ data: VivaId }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
        }
        const data = await response.json();

        if (userid) {
          HandleGenrateQ(data);
        }
      } catch (e) {
        console.log("error");
      }
    };
    GetVivaFunc();
  }, [userid]);

  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("keydown", function (e) {
    if (
      e.key === "F12" ||
      (e.ctrlKey &&
        e.shiftKey &&
        (e.key === "I" || e.key === "J" || e.key === "C")) ||
      (e.ctrlKey && e.key === "U")
    ) {
      e.preventDefault();
    }
  });
  function startTabFocusMonitor(callback) {
    const interval = setInterval(() => {
      if (document.hidden) {
        callback("inactive"); // User left the tab or minimized
      } else {
        callback("active"); // User is on the tab
      }
    }, 1000); // Every second

    return () => clearInterval(interval); // returns a cleanup function
  }

  useEffect(() => {
    // Only monitor tab switching if viva is active (questions loaded and not submitted)
    if (!vivaMainid || FinalQuetion.length === 0 || submitted || done) {
      return;
    }

    const stopMonitoring = startTabFocusMonitor((status) => {
      if (status === "inactive" && !submitted && !done) {
        console.log("🚨 Tab switch detected - auto-submitting");
        alert("Form Is Submitted Because You Left The Tab 🚨");
        handleSubmit("tab-switch");
        setSubmitted(true);
        setTimeLeft(2);
      }
    });

    return () => stopMonitoring(); // cleanup on unmount
  }, [userid, vivaMainid, FinalQuetion, userAnswers, submitted, done]);

  let minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  let seconds = String(timeLeft % 60).padStart(2, "0");
  const optionChange = (index, selectedOption) => {
    setUserAnswers({ ...userAnswers, [index]: selectedOption });
  };

  const userSubmit = () => {
    const newData = FinalQuetion.map((q, i) => ({
      question: q.question,
      options: q.options,
      selectedAnswer: userAnswers[i] || "Not Answered",
    }));

    setSubmitted(true);
    setSubmittedData(newData);
    console.log("Submitted Data:", newData);
  };

  useEffect(() => {
    // Only monitor resize if viva is active
    if (!vivaMainid || FinalQuetion.length === 0 || submitted || done) {
      return;
    }

    let initialWidth = window.innerWidth;
    let initialHeight = window.innerHeight;
    let resizeTimeout;

    const handleResize = () => {
      clearTimeout(resizeTimeout);

      resizeTimeout = setTimeout(() => {
        if (submitted || done) return; // Don't trigger if already submitted

        let currentWidth = window.innerWidth;
        let currentHeight = window.innerHeight;

        let heightChange = Math.abs(
          ((currentHeight - initialHeight) / initialHeight) * 100
        );

        if (heightChange >= 30) {
          console.log("🚨 Screen minimized - auto-submitting");
          alert("Height Compromised - Screen Minimized");
          handleSubmit("minimize");
          setSubmitted(true);
          initialWidth = currentWidth;
          initialHeight = currentHeight;
        }
      }, 500);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [vivaMainid, FinalQuetion, submitted, done]);

  return (
    <div className="viva-test-page-wrapper">
      {/* Timer positioned at top right of entire screen */}
      <div className="timestyle">
        {FinalQuetion.length > 0 && (
          <p>
            ⏳ Time Remaining:{" "}
            <strong>
              {minutes}:{seconds}
            </strong>
          </p>
        )}
      </div>
      
      <div className="viva-container">
      <h2 className="viva-title">
        <CheckCircle2 size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        {vivaTitle}
      </h2>

      {FinalQuetion.length > 0 &&
        FinalQuetion.map((q, i) => (
          <div key={i} className="viva-question-block">
            <p className="viva-question">
              {i + 1}. {q.question}
            </p>
            <div className="viva-options">
              {Object.entries(q.options).map(([key, value]) => (
                <label
                  key={key}
                  className={`viva-option-label ${
                    submitted && userAnswers[i] === key ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${i}`}
                    value={key}
                    checked={userAnswers[i] === key}
                    onChange={() => optionChange(i, key)}
                    disabled={submitted}
                  />
                  <span className="option-letter">{key}.</span> {value}
                </label>
              ))}
            </div>
          </div>
        ))}
      {done ? (
        <>
          <h1>You Have Successfully Submited Your Viva Assigment</h1>
        </>
      ) : (
        <>
          <h1></h1>
        </>
      )}
      {load && <h1 className="loadingH1">Loading..</h1>}
      {FinalQuetion.length > 0 && (
        <>
          <button className="viva-submit-btn" onClick={() => handleSubmit()}>
            Submit Viva
          </button>
        </>
      )}
      </div>
    </div>
  );
};

export default VivaTest;
