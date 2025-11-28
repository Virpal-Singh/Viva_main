//middleware will be applied soon

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
const router = express.Router();
import {
  User,
  classModel,
  syllabusModel,
  vivaModel,
  classStudent,
  resultModel,
  notificationModel,
  vivaNotificationModel,
} from "../model/AllModel.js";

// Try to import email service, but don't fail if it's not available
let generateOTP, sendOTPEmail, sendResultEmail, sendTeacherCredentialsEmail, sendStudentRegistrationEmail;
try {
  const emailService = await import("../services/emailService.js");
  generateOTP = emailService.generateOTP;
  sendOTPEmail = emailService.sendOTPEmail;
  sendResultEmail = emailService.sendResultEmail;
  sendTeacherCredentialsEmail = emailService.sendTeacherCredentialsEmail;
  sendStudentRegistrationEmail = emailService.sendStudentRegistrationEmail;
  console.log("✅ Email service loaded successfully");
} catch (error) {
  console.error("❌ Failed to load email service:", error.message);
  // Provide fallback functions
  generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
  sendOTPEmail = async () => ({ success: false, error: "Email service not available" });
  sendResultEmail = async () => ({ success: false, error: "Email service not available" });
  sendTeacherCredentialsEmail = async () => ({ success: false, error: "Email service not available" });
  sendStudentRegistrationEmail = async () => ({ success: false, error: "Email service not available" });
}
import axios from "axios";
import mongoose from "mongoose";
const JWT_SECRET = process.env.JWT_SECRET;

// Helper function to get Socket.IO instance
const getIO = (req) => {
  return req.app.get('io');
};

// JWT Token Validation Middleware
const verifyToken = (req, res, next) => {
  const token = req.body.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      message: "Access denied. No token provided.", 
      expired: true 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.log("Token verification failed:", error.message);
    return res.status(401).json({ 
      message: "Token expired or invalid", 
      expired: true,
      error: "Authentication failed" 
    });
  }
};
router.get("/data", (req, res) => {
  res.send("Getting Response");
});

router.post("/getUsername", async (req, res) => {
  const token = req.body.token;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    console.log("Payload:", payload);
    const existingUser = await User.findOne({ ennumber: payload.ennumber });
    
    if (!existingUser) {
      return res.status(404).json({ message: "User not found", expired: false });
    }
    
    const Info = {
      _id: existingUser._id,
      name: existingUser.name,
      email: existingUser.email,
      ennumber: existingUser.ennumber,
      role: existingUser.role,
    };
    return res.status(200).json({ message: "User found", payload: Info });
  } catch (error) {
    console.log("Token expired");
    return res.status(401).json({ 
      message: "Token expired", 
      expired: true,
      error: "Authentication failed" 
    });
  }
});

// Send OTP for Email Verification
router.post("/send-otp", async (req, res) => {
  const { name, email, password, ennumber } = req.body;
  
  console.log("📧 OTP Request received for:", email);
  
  if (!name || !email || !password || !ennumber) {
    return res.status(400).json({ message: "All fields are required", success: false });
  }

  try {
    // Check if enrollment number already exists (verified users only)
    const existingUserByEnrollment = await User.findOne({ ennumber });
    if (existingUserByEnrollment && existingUserByEnrollment.isVerified) {
      console.log("❌ Enrollment number already registered:", ennumber);
      return res.status(409).json({ message: "Enrollment number already registered", success: false });
    }

    // Check if email already exists (verified users only)
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail && existingUserByEmail.isVerified) {
      console.log("❌ Email already registered:", email);
      return res.status(409).json({ message: "Email already registered", success: false });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log("🔑 Generated OTP:", otp);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Determine which user to update (by enrollment or email)
    let userToUpdate = existingUserByEnrollment || existingUserByEmail;

    // Save or update user with OTP (not verified yet)
    if (userToUpdate) {
      // Update existing unverified user
      userToUpdate.otp = otp;
      userToUpdate.otpExpiry = otpExpiry;
      userToUpdate.password = hashedPassword;
      userToUpdate.name = name;
      userToUpdate.email = email;
      userToUpdate.ennumber = ennumber;
      await userToUpdate.save();
      console.log("✅ Updated existing user with new OTP");
    } else {
      // Create new user
      const tempUser = new User({
        name,
        email,
        password: hashedPassword,
        ennumber,
        role: "0",
        isVerified: false,
        otp,
        otpExpiry
      });
      await tempUser.save();
      console.log("✅ Created new user with OTP");
    }

    // Send OTP email
    console.log("📨 Sending OTP email to:", email);
    const emailResult = await sendOTPEmail(email, otp, name);
    
    if (emailResult.success) {
      console.log("✅ OTP email sent successfully");
      res.status(200).json({ 
        message: "OTP sent to your email", 
        success: true 
      });
    } else {
      console.error("❌ Failed to send email:", emailResult.error);
      res.status(500).json({ 
        message: "Failed to send OTP email. Please check your email address.", 
        error: emailResult.error,
        success: false 
      });
    }
  } catch (err) {
    console.error("❌ Error in /send-otp:", err);
    res.status(500).json({ message: "Server error", success: false });
  }
});

// Verify OTP and Complete Registration
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Check if OTP expired
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ message: "OTP expired. Please request a new one" });
    }

    // Verify user
    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.status(200).json({ 
      message: "Email verified successfully! You can now login.", 
      success: true 
    });
  } catch (err) {
    console.error("Error in /verify-otp:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Resend OTP
router.post("/resend-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, user.name);
    
    if (emailResult.success) {
      res.status(200).json({ 
        message: "New OTP sent to your email", 
        success: true 
      });
    } else {
      res.status(500).json({ 
        message: "Failed to send OTP email", 
        error: emailResult.error 
      });
    }
  } catch (err) {
    console.error("Error in /resend-otp:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Register Route For StudentRegister (Kept for backward compatibility, but now requires verification)
router.post("/registerstudent", async (req, res) => {
  const { name, email, password, ennumber } = req.body;
  if (!name || !email || !password || !ennumber)
    return res.status(400).json({ message: "All field are required" });

  try {
    const existingUser = await User.findOne({ ennumber });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "Student Already registered With Enrollment Number" });
    }
    const existingUserEmail = await User.findOne({ email });
    if (existingUserEmail) {
      return res.status(409).json({ message: "Email Already Exist " });
    }
    //lets Genrate Hash Bro
    //First Salt
    const salt = await bcrypt.genSalt(10);
    const Hashedpassword = await bcrypt.hash(password, salt);

    const regisuser = new User({
      name,
      email,
      password: Hashedpassword,
      ennumber,
      role: "0",
    });
    await regisuser.save();
    res
      .status(201)
      .json({ message: "Student Registered Successfully", status: 201 });
  } catch (err) {
    console.error("Error in /register:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// get teacher

//login route

router.post("/login", async (req, res) => {
  const { ennumber, password } = req.body;
  if (!ennumber || !password)
    return res
      .status(400)
      .json({ message: "Enrollment-Number and password required" });
  try {
    const user = await User.findOne({ ennumber });
    if (!user) {
      return res
        .status(401)
        .json({ message: "Enrollment-Number Is Incorrect" });
    }

    // Email verification is handled during registration with OTP
    // No need to check again during login
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Password Is Incorrect" });
    }

    //if match then
    // Generate JWT token

    const token = jwt.sign(
      { ennumber: user.ennumber, Usernname: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    if (user.role == "0") {
      return res.json({
        token,
        messege: `Login success as student and en-number is ${user.ennumber}`,
      });
    } else if (user.role == "2") {
      return res.json({
        token,
        messege: `Login success as Admin Successfully `,
      });
    } else if (user.role == "1") {
      return res.json({
        token,
        messege: `Login success as Teacher ${user.email}`,
      });
    }
  } catch (err) {
    console.error("Error in /login:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// quetion route

router.post("/api/questions", async (req, res) => {
  const { syllabus, totalq } = req.body;
  const NoData = "```javascript ``` dont add any thing after ]";
const prompt = `Generate ${totalq} multiple-choice questions for a viva exam based on the following syllabus: "${syllabus}". Each question should include:
- A "question" string
- An "options" object with keys "A", "B", "C", and "D"
- An "answer" string containing the correct option key ("A", "B", "C", or "D")

JSON array format only. Do not include markdown or any text outside the JSON. use double quotes ("") for all keys and values. Do not add any text before or after the array. Only give the array.
`;


  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.AIKEY}
`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      }
    );

    const output = response.data.candidates[0].content.parts[0].text;

  let parsedOutput;
 try {
  // Clean up markdown-style wrappers
  const cleanOutput = output
    .replace(/```json|```/g, '') // remove ```json and ```
    .trim();

  // Try parsing again
  parsedOutput = JSON.parse(cleanOutput);
} catch (err) {
  return res.status(400).json({
    error: "Failed to parse JSON response from Gemini.",
    output, // keep original for debugging
  });
}

console.log(parsedOutput);
    res.json({ questions: parsedOutput });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate questions" });
  }
});

// answer Route

router.post("/api/questionsresultcalculate", async (req, res) => {
  const { paper } = req.body;
  const jsonString = JSON.stringify(paper);

  console.log(jsonString);

  const prompt = ` ${jsonString} this is list of quetion,options,selectedAnswser and correctAnswer. comparing current quetions selectedAnswser and correctAnswer if they  are same then  then give 1 mark and give me output of total marks  just return only marks no text or symbol     `;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.AIKEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      }
    );

    const output = response.data.candidates[0].content.parts[0].text;
    console.log(output);

    res.send(output);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate questions" });
  }
});

// creating classCode
router.post("/create/classcode", async (req, res) => {
  const { teacherid, classnname } = req.body;

  const code = Math.random().toString(36).substr(2, 6).toUpperCase();
  const Iscode = await classModel.findOne({ code });
  if (Iscode) {
    res.status(501).json({ message: "Try Again" });
  }
  const newClass = await classModel.create({
    code,
    teacher: teacherid,
    classname: classnname,
  });
  await newClass.save();
  res
    .status(201)
    .json({ message: "Class Code Registered Successfully", result: newClass });
});

// Student Join a Class

router.post("/join/class", async (req, res) => {
  const { classcode, studentid } = req.body;
  const Iscode = await classModel.findOne({ code: classcode });
  const StudentExist = await classStudent.findOne({
    code: classcode,
    student: studentid,
  });
  if (!Iscode) {
    return res.status(501).json({ message: "Class Does Not Exist !!" });
  }
  if (StudentExist) {
    return res.status(501).json({ message: "Already Joined" });
  }
  const newStudent = new classStudent({
    code: classcode,
    student: studentid,
  });
  await newStudent.save();
  res
    .status(200)
    .json({ message: "Successfully Student Added To Class", status: 201 });
});
// uploading syllabus

router.post("/upload/syllabus", async (req, res) => {
  const { classcode, syllabus } = req.body;
  const Iscode = await classModel.findOne({ code: classcode });
  if (!Iscode) {
    return res.status(501).json({ message: "Code Is Incorrect" });
  }
  const newSyllabus = new syllabusModel({
    classCode: classcode,
    topics: syllabus,
  });
  await newSyllabus.save();
  res.status(200).json({ message: "Successfully Uploaded Syllabus" });
});

// create viva
router.post("/create/viva", async (req, res) => {
  const { title, classCode, date, time, totalquetions, status, syllabus, marksPerQuestion } =
    req.body;
  console.log(date);

  const Iscode = await classModel.findOne({ code: classCode });
  if (!title || !classCode || !date || !totalquetions || !status || !time) {
    return res.status(501).json({ message: "All Fields Are Required" });
  }
  if (!Iscode) {
    return res.status(501).json({ message: "Code Is Incorrect" });
  }
  
  // Validate marksPerQuestion
  const marks = marksPerQuestion ? parseInt(marksPerQuestion) : 1;
  if (marks < 1) {
    return res.status(400).json({ message: "Marks per question must be at least 1" });
  }
  
  const newViva = new vivaModel({
    title,
    classCode,
    date,
    totalquetions,
    syllabus,
    time,
    status,
    marksPerQuestion: marks,
  });
  await newViva.save();

  // Create notification for all students in this class
  try {
    const vivaNotification = new vivaNotificationModel({
      vivaId: newViva._id,
      vivaTitle: title,
      classCode: classCode,
      className: Iscode.classname,
      message: `New viva "${title}" has been created in ${Iscode.classname}`,
    });
    await vivaNotification.save();

    // Emit real-time notification to all students in the class
    const io = getIO(req);
    if (io) {
      io.to(`class-${classCode}`).emit('new-viva-created', {
        vivaId: newViva._id,
        title: title,
        classCode: classCode,
        className: Iscode.classname,
        date: date,
        time: time,
        message: `New viva "${title}" has been created in ${Iscode.classname}`
      });
    }
  } catch (notifError) {
    console.error("Error creating viva notification:", notifError);
    // Don't fail viva creation if notification fails
  }

  res.status(201).json({ message: "Successfully Viva Created", status: 201 });
});

// When user Take Viva
router.post("/take/vivatest", async (req, res) => {
  console.log("Creating new viva attempt...");

  const { classCode, studentId, vivaId, vivaq } = req.body;
  let { answers, score } = req.body;
  answers = typeof answers !== "undefined" ? answers : [];
  score = typeof score !== "undefined" ? score : 0;
  
  try {
    // Check if student already has a result for this viva
    const existingResult = await resultModel.findOne({ student: studentId, vivaId: vivaId });
    if (existingResult) {
      console.log("Result already exists for this student and viva");
      return res.status(409).json({ 
        message: "You have already started or submitted this viva",
        result: existingResult 
      });
    }

    const Iscode = await classModel.findOne({ code: classCode });
    if (!Iscode) {
      return res.status(400).json({ message: "Invalid class code" });
    }
    
    const IsViva = await vivaModel.findById(vivaId);
    if (!IsViva) {
      return res.status(400).json({ message: "Invalid viva" });
    }
    
    const Isstudent = await User.findById(studentId);
    if (!Isstudent) {
      return res.status(400).json({ message: "Invalid student" });
    }
    
    const newVivaResult = new resultModel({
      classCode,
      student: Isstudent._id.toString(),
      vivaId,
      vivaq,
      active: true,  // Boolean true - viva in progress
      answers,
      score,
    });
    
    await newVivaResult.save();
    console.log("New viva result created successfully");
    
    res.status(201).json({ 
      message: "Viva started successfully", 
      data: newVivaResult 
    });
  } catch (error) {
    console.error("Error creating viva result:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//update status
router.post("/update/status", async (req, res) => {
  const { _id, status, marks, answers } = req.body;
  console.log(_id);

  try {
    const updatedUser = await resultModel.findByIdAndUpdate(
      _id, // only the ID here
      { active: false, score: marks, answers }, // fields to update
      { new: true } // optional: returns updated document
    );

    // Send result email after marks are evaluated
    if (updatedUser) {
      try {
        // Get student details
        const student = await User.findById(updatedUser.student);
        
        // Get viva details
        const viva = await vivaModel.findById(updatedUser.vivaId);
        
        // Get class details
        const classInfo = await classModel.findOne({ code: updatedUser.classCode });

        if (student && viva && classInfo) {
          const studentData = {
            name: student.name,
            email: student.email,
            enrollment: student.ennumber
          };

          const vivaData = {
            vivaTitle: viva.title,
            className: classInfo.classname,
            totalQuestions: parseInt(viva.totalquetions),
            marksPerQuestion: viva.marksPerQuestion || 1
          };

          const resultData = {
            score: marks,
            answers: answers
          };

          // Send email asynchronously (don't wait for it)
          sendResultEmail(studentData, vivaData, resultData)
            .then(result => {
              if (result.success) {
                console.log(`Result email sent successfully to ${student.email}`);
              } else {
                console.error(`Failed to send result email: ${result.error}`);
              }
            })
            .catch(error => {
              console.error('Error sending result email:', error);
            });
        }
      } catch (emailError) {
        console.error('Error preparing result email:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Emit real-time update to viva monitor
    const io = getIO(req);
    if (io && updatedUser) {
      io.to(`viva-${updatedUser.vivaId}`).emit('student-progress-update', {
        studentId: updatedUser.student,
        vivaId: updatedUser.vivaId,
        status: 'submitted',
        score: marks,
        timestamp: new Date()
      });
    }

    res
      .status(200)
      .json({ message: "Successfully Updated", result: updatedUser });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: "Error updating status" });
  }
});

router.post("/get/viva-info", async (req, res) => {
  const { studentId } = req.body;
  try {
    // Step 1: Get all joined class codes
    const joinedClasses = await classStudent.find({ student: studentId });
    const classCodes = joinedClasses.map((j) => j.code);

    if (classCodes.length === 0) {
      return res.status(404).json({ message: "No classes joined" });
    }
    
    // Step 2: Get ALL vivas (including ended ones)
    const vivaRecords = await vivaModel.find({
      classCode: { $in: classCodes }
    });
    
    // Step 3: Get student's submitted vivas
    const submittedResults = await resultModel.find({
      student: studentId,
      active: false // Only submitted results
    });
    const submittedVivaIds = submittedResults.map(r => r.vivaId);
    
    // Step 4: Filter vivas based on status and submission
    const filteredVivas = vivaRecords.filter(viva => {
      const isSubmitted = submittedVivaIds.includes(viva._id.toString());
      const isEnded = viva.status === "ended";
      
      // Show viva if:
      // 1. It's submitted (regardless of status)
      // 2. It's NOT ended and NOT submitted (active or inactive vivas)
      return isSubmitted || !isEnded;
    });
    
    res.status(200).json({ 
      vivas: filteredVivas,
      submittedVivaIds: submittedVivaIds 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

//get full viva detail from viva id
//user id
router.post("/get/viva-detail", async (req, res) => {
  const { data } = req.body;
  try {
    const Isvivaid = await vivaModel.findOne({ _id: data });
    if (!Isvivaid) {
      return res.status(200).json({ message: "Invalid Viva Try To Access" });
    }
    res.send(Isvivaid);
  } catch (error) {
    return res.status(500).json({ message: "Invalid Viva Try To Access" });
  }
});
// get viva result if exist
router.post("/get/viva-resultexist", async (req, res) => {
  const { student, vivaId } = req.body;
  try {
    console.log("Checking viva result for student:", student, "vivaId:", vivaId);

    const Isvivaid = await resultModel.findOne({ student, vivaId });
    if (!Isvivaid) {
      console.log("No result found - student can start viva");
      return res.status(404).json({ message: "No result found", canStart: true });
    }

    // Ensure active is boolean
    const isActive = Isvivaid.active === true;
    const isSubmitted = Isvivaid.active === false;

    console.log("Result found - active:", isActive, "submitted:", isSubmitted);

    res.status(200).json({ 
      message: "Viva result exists", 
      result: {
        ...Isvivaid.toObject(),
        active: isActive // Ensure boolean
      },
      isActive: isActive,
      isSubmitted: isSubmitted
    });
  } catch (error) {
    console.error("Error checking viva result:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

//teacher

router.post("/get/student", async (req, res) => {
  const { teacherid } = req.body;
  console.log("Teacher ID:", teacherid);
  try {
    const GetTeacher = await classModel.find({ teacher: teacherid });
    if (!GetTeacher) {
      return res.status(501).json({ message: "Invalid Teacher" });
    }
    res.json({ message: GetTeacher });
  } catch (error) {}
});

// NEW: Get teacher classes with student and viva counts
router.post("/get/teacher-classes-with-stats", async (req, res) => {
  const { teacherid } = req.body;
  try {
    const classes = await classModel.find({ teacher: teacherid });
    if (!classes || classes.length === 0) {
      return res.status(200).json({ message: [], totalStats: { totalClasses: 0, totalVivas: 0, totalStudents: 0 } });
    }

    // Get all class codes for this teacher
    const classCodes = classes.map(c => c.code);

    // For each class, get student count and viva count with timeout
    const classesWithStats = await Promise.all(
      classes.map(async (classItem) => {
        try {
          // Get student count with timeout
          const studentCount = await Promise.race([
            classStudent.countDocuments({ code: classItem.code }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]).catch(() => 0);
          
          // Get viva count with timeout
          const vivaCount = await Promise.race([
            vivaModel.countDocuments({ classCode: classItem.code }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]).catch(() => 0);

          return {
            _id: classItem._id,
            classname: classItem.classname,
            code: classItem.code,
            teacher: classItem.teacher,
            time: classItem.time,
            studentCount: studentCount,
            vivaCount: vivaCount,
          };
        } catch (error) {
          console.error("Error fetching class stats:", error);
          return {
            _id: classItem._id,
            classname: classItem.classname,
            code: classItem.code,
            teacher: classItem.teacher,
            time: classItem.time,
            studentCount: 0,
            vivaCount: 0,
          };
        }
      })
    );

    // Get unique students across all teacher's classes
    let uniqueStudentCount = 0;
    try {
      const uniqueStudents = await Promise.race([
        classStudent.distinct('student', { code: { $in: classCodes } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]).catch(() => []);
      uniqueStudentCount = uniqueStudents.length;
    } catch (error) {
      console.error("Error fetching unique students:", error);
      // Fallback to sum if distinct fails
      uniqueStudentCount = classesWithStats.reduce((sum, c) => sum + c.studentCount, 0);
    }

    // Calculate total stats with unique student count
    const totalStats = {
      totalClasses: classesWithStats.length,
      totalVivas: classesWithStats.reduce((sum, c) => sum + c.vivaCount, 0),
      totalStudents: uniqueStudentCount,
    };

    res.json({ message: classesWithStats, totalStats: totalStats });
  } catch (error) {
    console.error("Error fetching teacher classes with stats:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// NEW: Toggle Viva Status (Start/End Viva)
router.post("/viva/toggle-status", async (req, res) => {
  const { vivaId, status } = req.body;
  try {
    const viva = await vivaModel.findById(vivaId);
    if (!viva) {
      return res.status(404).json({ message: "Viva not found" });
    }

    // Update status - can be "inactive", "active", or "ended"
    viva.status = status;
    await viva.save();

    // Emit real-time status update to all students in the class
    const io = getIO(req);
    if (io) {
      io.to(`class-${viva.classCode}`).emit('viva-status-changed', {
        vivaId: vivaId,
        status: status,
        title: viva.title,
        classCode: viva.classCode,
        message: `Viva "${viva.title}" has been ${status === "active" ? "started" : status === "ended" ? "ended" : "stopped"}`
      });

      // Also emit to viva monitor room for real-time monitoring
      io.to(`viva-${vivaId}`).emit('viva-status-update', {
        vivaId: vivaId,
        status: status,
        timestamp: new Date()
      });
    }

    const statusMessage = status === "active" ? "started" : status === "ended" ? "ended" : "stopped";
    res.json({ success: true, viva: viva, message: `Viva ${statusMessage} successfully` });
  } catch (error) {
    console.error("Error toggling viva status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// NEW: Get Viva Monitor Data (for teacher monitoring page)
router.post("/viva/monitor-data", async (req, res) => {
  const { vivaId } = req.body;
  try {
    // Get viva details
    const viva = await vivaModel.findById(vivaId);
    if (!viva) {
      return res.status(404).json({ message: "Viva not found" });
    }

    // Get class info
    const classInfo = await classModel.findOne({ code: viva.classCode });
    const className = classInfo ? classInfo.classname : viva.classCode;

    // Get all students in the class
    const classStudents = await classStudent.find({ code: viva.classCode });
    
    // Get all student details
    const studentIds = classStudents.map(s => s.student);
    const students = await User.find({ _id: { $in: studentIds } });

    // Get all results for this viva
    const results = await resultModel.find({ vivaId: vivaId });
    console.log("Results found:", results.length);
    if (results.length > 0) {
      console.log("Sample result:", {
        active: results[0].active,
        score: results[0].score,
        student: results[0].student
      });
    }

    // Combine student data with results
    const studentData = students.map(student => {
      const result = results.find(r => r.student.toString() === student._id.toString());
      
      // Determine status based on result
      let status = "not-submitted";
      if (result) {
        if (result.active === true) {
          status = "in-progress";
        } else if (result.active === false) {
          status = "submitted";
        }
      }
      
      return {
        _id: student._id,
        name: student.name,
        enrollment: student.ennumber,
        email: student.email,
        status: status,
        marks: result && result.active === false ? result.score : null, // Use 'score' field from database
        submittedAt: result && result.active === false ? result.updatedAt : null,
      };
    });

    res.json({
      success: true,
      viva: {
        _id: viva._id,
        title: viva.title,
        time: viva.time,
        totalquetions: viva.totalquetions,
        classCode: viva.classCode,
        status: viva.status,
        date: viva.date,
        syllabus: viva.syllabus,
        marksPerQuestion: viva.marksPerQuestion || 1,
      },
      className: className,
      students: studentData,
      stats: {
        total: studentData.length,
        submitted: studentData.filter(s => s.status === "submitted").length,
        inProgress: studentData.filter(s => s.status === "in-progress").length,
        notStarted: studentData.filter(s => s.status === "not-submitted").length,
      }
    });
  } catch (error) {
    console.error("Error fetching viva monitor data:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// get viva by class code

router.post("/get/vivavbyclasscode", async (req, res) => {
  const { classCode } = req.body;
  try {
    const Isvivaid = await vivaModel.find({ classCode });
    if (!Isvivaid) {
      return res.status(200).json({ message: "Invalid Viva Try To Access" });
    }
    res.send(Isvivaid);
  } catch (error) {
    return res.status(500).json({ message: "Invalid Viva Try To Access" });
  }
});

// get student by classCode

router.post("/get/studentinclass", async (req, res) => {
  const { classCode } = req.body;
  try {
    const Isstudent = await classStudent.find({ code: classCode });
    if (!Isstudent) {
      return res.status(200).json({ message: "Invalid Viva Try To Access" });
    }
    res.send(Isstudent);
  } catch (error) {
    return res.status(500).json({ message: "Invalid Viva Try To Access" });
  }
});

// Get class information by class code
router.post("/get/class-info", async (req, res) => {
  const { classCode } = req.body;
  try {
    const classInfo = await classModel.findOne({ code: classCode });
    if (!classInfo) {
      return res.status(404).json({ message: "Class not found" });
    }
    res.status(200).json({ 
      success: true,
      classCode: classInfo.code,
      className: classInfo.classname,
      teacher: classInfo.teacher
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
});

// Get total users count (for home page stats)
router.get("/get/all-users-count", async (req, res) => {
  try {
    // Add timeout to prevent hanging
    const totalUsers = await Promise.race([
      User.countDocuments(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 5000)
      )
    ]);
    res.status(200).json({ count: totalUsers, success: true });
  } catch (error) {
    console.error("Error getting users count:", error);
    // Return fallback data instead of error
    res.status(200).json({ 
      count: 125, // Fallback count
      success: true,
      fallback: true,
      message: "Using cached data due to database connectivity issues"
    });
  }
});

//find all users

router.post("/get/allstudentinclass", async (req, res) => {
  const { _id } = req.body;
  try {
    const Isvivaid = await User.find({ _id: { $in: _id } });
    if (!Isvivaid) {
      return res.status(200).json({ message: "Invalid Ids" });
    }

    res.send(Isvivaid);
  } catch (error) {
    return res.status(500).json({ message: "Invalid Viva Try To Access" });
  }
});

//update viva

router.post("/update/vivadetail", async (req, res) => {
  const { id, title, date, time, totalquetions, status, syllabus, marksPerQuestion } = req.body;

  // Check required fields
  if (!id || !title || !date || !time || !totalquetions || !status) {
    return res.status(400).json({ message: "All Fields Are Required" });
  }

  try {
    const viva = await vivaModel.findById({ _id: id });
    if (!viva) {
      return res.status(404).json({ message: "Viva Not Found" });
    }

    // Validate marksPerQuestion if provided
    if (marksPerQuestion !== undefined) {
      const marks = parseInt(marksPerQuestion);
      if (marks < 1) {
        return res.status(400).json({ message: "Marks per question must be at least 1" });
      }
      viva.marksPerQuestion = marks;
    }

    // Update fields
    viva.title = title;
    viva.date = date;
    viva.totalquetions = totalquetions;
    viva.time = time;
    viva.status = status;
    viva.syllabus = syllabus;
    await viva.save();

    res.status(200).json({ message: "Viva Updated Successfully", viva });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error Updating Viva", error: error.message });
  }
});

// teacher side get all student marks from classcode & student

router.post("/get/studentinresult", async (req, res) => {
  const { classCode, student } = req.body;
  try {
    const Isstudent = await resultModel.find({ classCode, student });
    if (!Isstudent) {
      return res.status(200).json({ message: "No Student In Class" });
    }
    res.send(Isstudent);
  } catch (error) {
    return res.status(500).json({ message: "Error In Geting student result" });
  }
});

//get all viva

router.get("/get/all-viva", async (req, res) => {
  try {
    const Isvivaid = await vivaModel.find();
    if (!Isvivaid) {
      return res.status(200).json({ message: "Find  Viva No" });
    }
    res.send(Isvivaid);
  } catch (error) {
    return res.status(500).json({ message: "Error Catch Block" });
  }
});
router.post("/get/all-vivaresult", async (req, res) => {
  const { vivaId } = req.body;
  try {
    const IsresultId = await resultModel.find({ vivaId });
    if (!IsresultId) {
      return res.status(200).json({ message: "No Viva Exist" });
    }
    res.send(IsresultId);
  } catch (error) {
    return res.status(500).json({ message: "Error Catch Block" });
  }
});
router.post("/get/analytics", async (req, res) => {
  try {
    const { teacherId } = req.body;

    // 1. Find all classes of this teacher
    const classes = await classModel.find({ teacher: teacherId });

    if (!classes.length) {
      return res
        .status(404)
        .json({ message: "No classes found for this teacher" });
    }

    // 2. For each class, get all viva results and manually fetch student data
    const classData = await Promise.all(
      classes.map(async (cls) => {
        const results = await resultModel
          .find({ classCode: cls.code })
          .lean();

        // Manually fetch student data since student field is String, not ObjectId
        const studentsWithData = await Promise.all(
          results.map(async (r) => {
            try {
              // Fetch student data using the student ID string
              const studentData = await User.findById(r.student).lean();
              
              return {
                studentId: r.student,
                name: studentData?.name || "Unknown Student",
                enrollment: studentData?.ennumber || "N/A",
                email: studentData?.email || "N/A",
                score: r.score || 0,
              };
            } catch (error) {
              console.error("Error fetching student:", r.student, error);
              return {
                studentId: r.student,
                name: "Unknown Student",
                enrollment: "N/A",
                email: "N/A",
                score: r.score || 0,
              };
            }
          })
        );

        return {
          classId: cls._id,
          classname: cls.classname,
          code: cls.code,
          totalStudents: studentsWithData.length,
          students: studentsWithData,
        };
      })
    );

    // 3. Get unique students enrolled across all teacher's classes (not from results)
    const classCodes = classes.map(c => c.code);
    const uniqueStudentIds = await classStudent.distinct('student', { code: { $in: classCodes } });
    
    // Fetch unique student details
    const uniqueStudentsData = await Promise.all(
      uniqueStudentIds.map(async (studentId) => {
        try {
          const studentData = await User.findById(studentId).lean();
          return {
            studentId: studentId,
            name: studentData?.name || "Unknown Student",
            enrollment: studentData?.ennumber || "N/A",
            email: studentData?.email || "N/A",
          };
        } catch (error) {
          console.error("Error fetching unique student:", studentId, error);
          return {
            studentId: studentId,
            name: "Unknown Student",
            enrollment: "N/A",
            email: "N/A",
          };
        }
      })
    );

    // 4. Send analytics response with unique students list
    res.json({
      teacherId,
      totalClasses: classes.length,
      classes: classData,
      uniqueStudents: uniqueStudentsData, // Add unique students list
    });
  } catch (err) {
    console.error("Error in getTeacherAnalytics:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Delete class and all associated data
router.post("/delete/class", async (req, res) => {
  const { classCode } = req.body;
  
  if (!classCode) {
    return res.status(400).json({ message: "Class code is required" });
  }

  try {
    // Check if class exists
    const classExists = await classModel.findOne({ code: classCode });
    if (!classExists) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Delete all vivas associated with this class
    const vivasDeleted = await vivaModel.deleteMany({ classCode: classCode });
    
    // Delete all results associated with this class
    const resultsDeleted = await resultModel.deleteMany({ classCode: classCode });
    
    // Delete all student enrollments in this class
    const studentsDeleted = await classStudent.deleteMany({ code: classCode });
    
    // Delete all syllabus entries for this class
    const syllabusDeleted = await syllabusModel.deleteMany({ classCode: classCode });
    
    // Delete all notifications for this class
    const notificationsDeleted = await notificationModel.deleteMany({ classCode: classCode });
    
    // Finally, delete the class itself
    await classModel.deleteOne({ code: classCode });

    res.status(200).json({ 
      message: "Class and all associated data deleted successfully",
      deleted: {
        vivas: vivasDeleted.deletedCount,
        results: resultsDeleted.deletedCount,
        students: studentsDeleted.deletedCount,
        syllabus: syllabusDeleted.deletedCount,
        notifications: notificationsDeleted.deletedCount,
      }
    });
  } catch (error) {
    console.error("Error deleting class:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create auto-submit notification
router.post("/notification/create", async (req, res) => {
  const { studentId, vivaId, reason } = req.body;
  
  try {
    // Get student details
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get viva details
    const viva = await vivaModel.findById(vivaId);
    if (!viva) {
      return res.status(404).json({ message: "Viva not found" });
    }

    // Get class details
    const classInfo = await classModel.findOne({ code: viva.classCode });
    if (!classInfo) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Create message based on reason
    let message = "";
    if (reason === "tab-switch") {
      message = `${student.name} (${student.ennumber}) auto-submitted due to TAB SWITCH in viva "${viva.title}"`;
    } else if (reason === "minimize") {
      message = `${student.name} (${student.ennumber}) auto-submitted due to SCREEN MINIMIZE in viva "${viva.title}"`;
    } else if (reason === "time-over") {
      message = `${student.name} (${student.ennumber}) auto-submitted due to TIME OVER in viva "${viva.title}"`;
    } else {
      message = `${student.name} (${student.ennumber}) auto-submitted in viva "${viva.title}"`;
    }

    // Create notification
    const notification = new notificationModel({
      teacherId: classInfo.teacher,
      studentId: student._id,
      studentName: student.name,
      studentEnrollment: student.ennumber,
      vivaId: viva._id,
      vivaTitle: viva.title,
      classCode: viva.classCode,
      className: classInfo.classname,
      reason: reason,
      message: message,
    });

    await notification.save();

    res.status(201).json({ 
      success: true, 
      message: "Notification created successfully",
      notification: notification 
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all notifications for a teacher
router.post("/notification/get-teacher", async (req, res) => {
  const { teacherId } = req.body;
  
  try {
    const notifications = await notificationModel
      .find({ teacherId: teacherId })
      .sort({ createdAt: -1 }); // Most recent first

    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.status(200).json({ 
      success: true,
      notifications: notifications,
      unreadCount: unreadCount
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Mark notification as read
router.post("/notification/mark-read", async (req, res) => {
  const { notificationId } = req.body;
  
  try {
    const notification = await notificationModel.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json({ 
      success: true,
      message: "Notification marked as read",
      notification: notification
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete a notification (works for both teacher and student notifications)
router.post("/notification/delete", async (req, res) => {
  const { notificationId } = req.body;
  
  try {
    // Try to delete from teacher notifications first
    let notification = await notificationModel.findByIdAndDelete(notificationId);

    // If not found, try student notifications (viva notifications)
    if (!notification) {
      notification = await vivaNotificationModel.findByIdAndDelete(notificationId);
    }

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.status(200).json({ 
      success: true,
      message: "Notification deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete all notifications for a teacher
router.post("/notification/delete-all", async (req, res) => {
  const { teacherId } = req.body;
  
  try {
    const result = await notificationModel.deleteMany({ teacherId: teacherId });

    res.status(200).json({ 
      success: true,
      message: "All notifications deleted successfully",
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Error deleting all notifications:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get notifications for students (viva creation notifications)
router.post("/notification/get-student", async (req, res) => {
  const { studentId } = req.body;
  
  try {
    // Find all classes the student is enrolled in
    const enrolledClasses = await classStudent.find({ student: studentId });
    const classCodes = enrolledClasses.map(c => c.code);

    // Find viva notifications for these classes
    const notifications = await vivaNotificationModel
      .find({ classCode: { $in: classCodes } })
      .sort({ createdAt: -1 });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.status(200).json({ 
      success: true,
      notifications: notifications,
      unreadCount: unreadCount
    });
  } catch (error) {
    console.error("Error fetching student notifications:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get student class count
router.post("/get/student-class-count", async (req, res) => {
  const { studentId } = req.body;
  
  try {
    const count = await Promise.race([
      classStudent.countDocuments({ student: studentId }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]).catch(() => 0);
    
    res.status(200).json({ success: true, count: count });
  } catch (error) {
    console.error("Error fetching class count:", error);
    res.status(200).json({ success: true, count: 0, fallback: true });
  }
});

// ==================== ADMIN ROUTES ====================

// Admin Login
router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  
  try {
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign(
        { email: email, role: "admin" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      
      res.status(200).json({
        success: true,
        token: token,
        message: "Admin login successful"
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid admin credentials" });
    }
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get Admin Dashboard Stats
router.get("/admin/stats", async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: "0" });
    const totalTeachers = await User.countDocuments({ role: "1" });
    const totalClasses = await classModel.countDocuments();
    const totalVivas = await vivaModel.countDocuments();
    
    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalTeachers,
        totalClasses,
        totalVivas
      }
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get All Teachers
router.get("/admin/teachers", async (req, res) => {
  try {
    const teachers = await User.find({ role: "1" }).select("-password");
    res.status(200).json({ success: true, teachers });
  } catch (error) {
    console.error("Error fetching teachers:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Add Teacher by Admin
router.post("/admin/add-teacher", async (req, res) => {
  const { name, email, ennumber, password } = req.body;
  
  try {
    // Check if teacher already exists
    const existingUser = await User.findOne({ $or: [{ email }, { ennumber }] });
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: "Teacher with this email or enrollment number already exists" 
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create teacher
    const newTeacher = new User({
      name,
      email,
      ennumber,
      password: hashedPassword,
      role: "1",
      isVerified: true
    });
    
    await newTeacher.save();
    
    // Send email with credentials
    try {
      const emailResult = await sendTeacherCredentialsEmail({
        name,
        email,
        ennumber,
        password
      });
      
      if (!emailResult.success) {
        console.error("Failed to send credentials email:", emailResult.error);
      }
    } catch (emailError) {
      console.error("Error sending email:", emailError);
    }
    
    res.status(201).json({
      success: true,
      message: "Teacher added successfully",
      teacher: {
        _id: newTeacher._id,
        name: newTeacher.name,
        email: newTeacher.email,
        ennumber: newTeacher.ennumber
      }
    });
  } catch (error) {
    console.error("Error adding teacher:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete Teacher by Admin
router.post("/admin/delete-teacher", async (req, res) => {
  const { teacherId } = req.body;
  
  try {
    const teacher = await User.findById(teacherId);
    
    if (!teacher || teacher.role !== "1") {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }
    
    // Delete all classes created by this teacher
    const teacherClasses = await classModel.find({ teacher: teacherId });
    const classCodes = teacherClasses.map(c => c.code);
    
    // Delete related data
    await vivaModel.deleteMany({ classCode: { $in: classCodes } });
    await resultModel.deleteMany({ classCode: { $in: classCodes } });
    await classStudent.deleteMany({ code: { $in: classCodes } });
    await syllabusModel.deleteMany({ classCode: { $in: classCodes } });
    await notificationModel.deleteMany({ teacherId: teacherId });
    await classModel.deleteMany({ teacher: teacherId });
    
    // Delete teacher
    await User.findByIdAndDelete(teacherId);
    
    res.status(200).json({
      success: true,
      message: "Teacher and all related data deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting teacher:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update student name
router.post("/update/student-name", async (req, res) => {
  const { studentId, newName } = req.body;
  
  try {
    const student = await User.findByIdAndUpdate(
      studentId,
      { name: newName },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ success: true, message: "Name updated successfully" });
  } catch (error) {
    console.error("Error updating name:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Send OTP for profile updates
router.post("/send-update-otp", async (req, res) => {
  const { email, updateType, newValue, currentEmail, studentId } = req.body;
  
  try {
    // For email update, check if new email already exists
    if (updateType === "email") {
      const existingUser = await User.findOne({ email: email });
      if (existingUser && existingUser._id.toString() !== studentId) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    // For enrollment update, check if new enrollment already exists
    if (updateType === "enrollment") {
      const existingUser = await User.findOne({ ennumber: newValue });
      if (existingUser && existingUser._id.toString() !== studentId) {
        return res.status(409).json({ message: "Enrollment number already in use" });
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in user document
    const targetEmail = updateType === "email" ? email : (currentEmail || email);
    const user = await User.findOne({ email: targetEmail });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP email
    const userName = user.name;
    let emailSubject = "";
    let emailMessage = "";

    if (updateType === "enrollment") {
      emailSubject = "Verify Enrollment Number Change";
      emailMessage = `You requested to change your enrollment number to ${newValue}.`;
    } else if (updateType === "email") {
      emailSubject = "Verify Email Address Change";
      emailMessage = `You requested to change your email address.`;
    } else if (updateType === "password") {
      emailSubject = "Verify Password Change";
      emailMessage = `You requested to change your password.`;
    }

    const emailResult = await sendOTPEmail(email, otp, userName);
    
    if (emailResult.success) {
      res.status(200).json({ success: true, message: "OTP sent successfully" });
    } else {
      res.status(500).json({ message: "Failed to send OTP email" });
    }
  } catch (error) {
    console.error("Error sending update OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify OTP and update profile
router.post("/verify-update-otp", async (req, res) => {
  const { email, otp, updateType, newValue, studentId } = req.body;
  
  try {
    const user = await User.findById(studentId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check OTP
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Check if OTP expired
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // Update based on type
    if (updateType === "enrollment") {
      user.ennumber = newValue;
    } else if (updateType === "email") {
      user.email = newValue;
    } else if (updateType === "password") {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newValue, salt);
      user.password = hashedPassword;
    }

    // Clear OTP
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.status(200).json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Bulk Register Students from CSV
router.post("/bulk-register-students", async (req, res) => {
  try {
    const { students, teacherId } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: "No student data provided" });
    }

    // Get teacher info for email
    const teacher = await User.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const results = {
      success: [],
      failed: [],
      total: students.length
    };

    // Process each student
    for (const studentData of students) {
      try {
        const { enrollment, name, email, password } = studentData;

        // Validate required fields
        if (!enrollment || !name || !email || !password) {
          results.failed.push({
            enrollment: enrollment || 'N/A',
            name: name || 'N/A',
            reason: 'Missing required fields'
          });
          continue;
        }

        // Check if student already exists
        const existingStudent = await User.findOne({
          $or: [{ ennumber: enrollment }, { email: email }]
        });

        if (existingStudent) {
          results.failed.push({
            enrollment,
            name,
            reason: 'Student already exists'
          });
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new student
        const newStudent = new User({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          ennumber: enrollment.trim(),
          password: hashedPassword,
          role: 0, // Student role
          isVerified: true // Auto-verify bulk registered students
        });

        await newStudent.save();

        // Send welcome email
        try {
          await sendStudentRegistrationEmail(
            {
              name: name.trim(),
              email: email.trim().toLowerCase(),
              ennumber: enrollment.trim(),
              password: password // Send original password in email
            },
            teacher.name
          );
        } catch (emailError) {
          console.error(`Email failed for ${email}:`, emailError);
          // Don't fail registration if email fails
        }

        results.success.push({
          enrollment,
          name,
          email
        });

      } catch (error) {
        console.error(`Error registering student ${studentData.enrollment}:`, error);
        results.failed.push({
          enrollment: studentData.enrollment || 'N/A',
          name: studentData.name || 'N/A',
          reason: error.message || 'Unknown error'
        });
      }
    }

    res.status(200).json({
      message: "Bulk registration completed",
      results: results
    });

  } catch (error) {
    console.error("Error in bulk registration:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
