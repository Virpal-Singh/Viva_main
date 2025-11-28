import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Generate 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP Email
export const sendOTPEmail = async (email, otp, name) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "🔐 Verify Your Email - Viva Portal",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          }
          .header {
            background: rgba(255,255,255,0.1);
            padding: 30px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content {
            background: white;
            padding: 40px;
          }
          .otp-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 36px;
            font-weight: bold;
            text-align: center;
            padding: 20px;
            border-radius: 12px;
            letter-spacing: 8px;
            margin: 30px 0;
          }
          .message {
            color: #333;
            font-size: 16px;
            line-height: 1.6;
            margin: 20px 0;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
            color: #856404;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Viva Portal</h1>
            <p>Email Verification</p>
          </div>
          <div class="content">
            <p class="message">Hello <strong>${name}</strong>,</p>
            <p class="message">Thank you for registering with Viva Portal! Please use the following OTP to verify your email address:</p>
            
            <div class="otp-box">${otp}</div>
            
            <p class="message">This OTP is valid for <strong>10 minutes</strong>.</p>
            
            <div class="warning">
              ⚠️ <strong>Security Notice:</strong> Never share this OTP with anyone. Our team will never ask for your OTP.
            </div>
            
            <p class="message">If you didn't request this verification, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Viva Portal. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { success: false, error: error.message };
  }
};

// Send Result Email
export const sendResultEmail = async (studentData, vivaData, resultData) => {
  const { name, email, enrollment } = studentData;
  const { vivaTitle, className, totalQuestions, marksPerQuestion } = vivaData;
  const { score, answers } = resultData;

  const totalMarks = totalQuestions * marksPerQuestion;
  const percentage = (score / totalMarks) * 100;

  // Determine performance level
  let performanceBadge = "";
  let performanceColor = "";
  let advice = "";

  if (percentage >= 80) {
    performanceBadge = "🌟 Excellent";
    performanceColor = "#10b981";
    advice =
      "Outstanding performance! You have demonstrated excellent understanding of the concepts. Keep up the great work!";
  } else if (percentage >= 60) {
    performanceBadge = "👍 Good";
    performanceColor = "#3b82f6";
    advice =
      "Good effort! You have a solid grasp of the material. A bit more practice will help you achieve excellence!";
  } else {
    performanceBadge = "📚 Keep Practicing";
    performanceColor = "#f59e0b";
    advice =
      "Keep practicing! Review the topics carefully and don't hesitate to ask for help. Every expert was once a beginner!";
  }

  // Generate question breakdown HTML
  const questionsHTML = answers
    .map((q, index) => {
      const isCorrect =
        String(q.selectedAnswer || "")
          .trim()
          .toLowerCase() ===
        String(q.correctAnswer || "")
          .trim()
          .toLowerCase();
      const icon = isCorrect ? "✅" : "❌";
      const color = isCorrect ? "#10b981" : "#ef4444";

      const options =
        typeof q.options === "string" ? JSON.parse(q.options) : q.options;

      const optionsHTML = options
        ? Object.entries(options)
            .map(([key, value]) => {
              const isSelected = q.selectedAnswer === key;
              const isCorrectOption = q.correctAnswer === key;

              let optionStyle =
                "padding: 10px; margin: 5px 0; border-radius: 6px; background: #f3f4f6;";

              if (isSelected && isCorrect) {
                optionStyle =
                  "padding: 10px; margin: 5px 0; border-radius: 6px; background: #d1fae5; border: 2px solid #10b981;";
              } else if (isSelected && !isCorrect) {
                optionStyle =
                  "padding: 10px; margin: 5px 0; border-radius: 6px; background: #fee2e2; border: 2px solid #ef4444;";
              } else if (isCorrectOption && !isCorrect) {
                optionStyle =
                  "padding: 10px; margin: 5px 0; border-radius: 6px; background: #d1fae5; border: 2px solid #10b981;";
              }

              return `
        <div style="${optionStyle}">
          <strong style="color: #1f2937;">${key}.</strong> 
          <span style="color: #4b5563;">${value}</span>
          ${isSelected ? ` <span style="color: ${color};">${icon}</span>` : ""}
          ${
            isCorrectOption && !isCorrect
              ? ' <span style="color: #10b981;">✓ Correct</span>'
              : ""
          }
        </div>
      `;
            })
            .join("")
        : "";

      return `
      <div style="background: #f9fafb; border-left: 4px solid ${color}; padding: 15px; margin: 15px 0; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <strong style="color: #1f2937; font-size: 16px;">Question ${
            index + 1
          }</strong>
          <span style="font-size: 24px;">${icon}</span>
        </div>
        <p style="color: #1f2937; margin: 10px 0; font-size: 15px; font-weight: 500;">${
          q.question
        }</p>
        <div style="margin-top: 15px;">
          ${optionsHTML}
        </div>
      </div>
    `;
    })
    .join("");

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `📊 Your Viva Result - ${vivaTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 700px;
            margin: 40px auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 32px;
          }
          
          /* Gmail-safe circle */
          .score-circle {
            width: 160px;
            height: 160px;
            border-radius: 50%;
            background: white;
            margin: 20px auto;
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
            text-align: center;
          }

          .content {
            padding: 40px;
          }
          .info-section {
            background: #f9fafb;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            color: #6b7280;
            font-weight: 600;
          }
          .info-value {
            color: #1f2937;
            font-weight: 500;
          }
          .performance-badge {
            background: ${performanceColor};
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            margin: 30px 0;
          }
          .advice-box {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            border-left: 4px solid #667eea;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .advice-box p {
            margin: 0;
            color: #1f2937;
            line-height: 1.6;
          }
          .questions-section {
            margin-top: 30px;
          }
          .section-title {
            color: #1f2937;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
          }
          .footer {
            background: #f9fafb;
            text-align: center;
            padding: 30px;
            color: #6b7280;
          }
          .developers {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 13px;
            color: #9ca3af;
          }
          .developers strong {
            color: #667eea;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Viva Result</h1>
            <p style="font-size: 18px; margin: 10px 0;">${vivaTitle}</p>

            <!-- Gmail Safe Centered Circle -->
            <div class="score-circle">
              <table width="100%" height="160" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" valign="middle">
                    <div style="font-size: 52px; font-weight: bold; color: #667eea; line-height: 1;">
                      ${score}
                    </div>
                    <div style="font-size: 22px; color: #666; font-weight: 600;">
                      / ${totalMarks}
                    </div>
                  </td>
                </tr>
              </table>
            </div>

            <p style="font-size: 20px; margin: 10px 0;">${percentage.toFixed(
              1
            )}%</p>
          </div>
          
          <div class="content">
            <div class="info-section">
              <div class="info-row">
                <span class="info-label">👤 Student Name:</span>
                <span class="info-value">${name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">🎓 Enrollment:</span>
                <span class="info-value">${enrollment}</span>
              </div>
              <div class="info-row">
                <span class="info-label">📚 Class:</span>
                <span class="info-value">${className}</span>
              </div>
              <div class="info-row">
                <span class="info-label">📝 Viva:</span>
                <span class="info-value">${vivaTitle}</span>
              </div>
              <div class="info-row">
                <span class="info-label">✅ Correct Answers:</span>
                <span class="info-value">${
                  answers.filter(
                    (q) =>
                      String(q.selectedAnswer || "")
                        .trim()
                        .toLowerCase() ===
                      String(q.correctAnswer || "")
                        .trim()
                        .toLowerCase()
                  ).length
                } / ${totalQuestions}</span>
              </div>
            </div>

            <div class="performance-badge">
              ${performanceBadge}
            </div>

            <div class="advice-box">
              <p><strong>💡 Advice:</strong></p>
              <p>${advice}</p>
            </div>

            <div class="questions-section">
              <h2 class="section-title">Question-wise Breakdown</h2>
              ${questionsHTML}
            </div>
          </div>

          <div class="footer">
            <p style="font-size: 16px; margin: 10px 0;"><strong>Keep Learning! 🚀</strong></p>
            <p>© 2024 Viva Portal. All rights reserved.</p>
            <p style="font-size: 12px; margin-top: 15px;">This is an automated email. Please do not reply.</p>
            <div class="developers">
              <p>Developed by <strong>Sarbaz Malek</strong> and <strong>Virpal Sinh</strong></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending result email:", error);
    return { success: false, error: error.message };
  }
};

// Send Student Registration Email
export const sendStudentRegistrationEmail = async (studentData, teacherName) => {
  const { name, email, ennumber, password } = studentData;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "🎓 Welcome to AI Viva Portal - Your Account is Ready!",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 10px 0 0 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 30px; color: #333; }
          .message { font-size: 16px; line-height: 1.6; margin-bottom: 25px; }
          .welcome-box { background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-left: 4px solid #667eea; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .credentials { background: #f9fafb; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .cred-row { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .cred-row:last-child { border-bottom: none; }
          .cred-label { color: #6b7280; font-weight: 600; font-size: 14px; margin-bottom: 5px; }
          .cred-value { color: #1f2937; font-weight: 700; font-size: 16px; font-family: monospace; background: white; padding: 8px; border-radius: 4px; display: inline-block; }
          .login-section { text-align: center; margin: 30px 0; }
          .login-btn { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 14px 40px; border-radius: 25px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); }
          .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #92400e; }
          .footer { text-align: center; padding: 20px; background: #f9fafb; color: #666; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Welcome to AI Viva Portal</h1>
            <p>Your Student Account is Ready!</p>
          </div>
          <div class="content">
            <div class="welcome-box">
              <strong>🎉 Congratulations ${name}!</strong><br>
              Your registration has been successfully completed by <strong>${teacherName}</strong>.
            </div>
            
            <p class="message">
              <strong>Hello ${name},</strong><br><br>
              Welcome to AI Viva Portal! Your student account has been created and you can now login to access your classes, take viva exams, and track your progress.
            </p>
            
            <h3 style="color: #667eea; margin-top: 30px;">📋 Your Login Credentials:</h3>
            <div class="credentials">
              <div class="cred-row">
                <div class="cred-label">👤 Full Name</div>
                <div class="cred-value">${name}</div>
              </div>
              <div class="cred-row">
                <div class="cred-label">📧 Email Address</div>
                <div class="cred-value">${email}</div>
              </div>
              <div class="cred-row">
                <div class="cred-label">🎓 Enrollment Number</div>
                <div class="cred-value">${ennumber}</div>
              </div>
              <div class="cred-row">
                <div class="cred-label">🔐 Password</div>
                <div class="cred-value">${password}</div>
              </div>
            </div>
            
            <div class="info-box">
              <strong>🔒 Security Tip:</strong> Please change your password after your first login for better security. Keep your credentials safe and never share them with anyone.
            </div>
            
            <div class="login-section">
              <p style="margin-bottom: 15px; color: #666;">Ready to start your learning journey?</p>
              <a href="http://localhost:5173/login" class="login-btn">
                🚀 Login to Viva Portal
              </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666; line-height: 1.6;">
              If you have any questions or need assistance, please contact your teacher <strong>${teacherName}</strong>.
            </p>
          </div>
          <div class="footer">
            <p><strong>© 2024 AI Viva Portal</strong></p>
            <p style="margin-top: 10px;">This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending student registration email:", error);
    return { success: false, error: error.message };
  }
};

// Send Teacher Credentials Email (NOT OTP - This is an information email)
export const sendTeacherCredentialsEmail = async (teacherData) => {
  const { name, email, ennumber, password } = teacherData;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "🎓 Welcome to AI Viva Portal - Your Teacher Account Details",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 10px 0 0 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 30px; color: #333; }
          .message { font-size: 16px; line-height: 1.6; margin-bottom: 25px; }
          .welcome-box { background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-left: 4px solid #667eea; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .credentials { background: #f9fafb; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .cred-row { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .cred-row:last-child { border-bottom: none; }
          .cred-label { color: #6b7280; font-weight: 600; font-size: 14px; margin-bottom: 5px; }
          .cred-value { color: #1f2937; font-weight: 700; font-size: 16px; font-family: monospace; background: white; padding: 8px; border-radius: 4px; display: inline-block; }
          .login-section { text-align: center; margin: 30px 0; }
          .login-btn { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 14px 40px; border-radius: 25px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); }
          .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #92400e; }
          .footer { text-align: center; padding: 20px; background: #f9fafb; color: #666; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Welcome to AI Viva Portal</h1>
            <p>Teacher Account Created Successfully</p>
          </div>
          <div class="content">
            <div class="welcome-box">
              <strong>🎉 Congratulations!</strong><br>
              You have been selected as a Teacher at AI Viva Portal.
            </div>
            
            <p class="message">
              <strong>Hello ${name},</strong><br><br>
              Your teacher account has been created successfully. You can now login to the portal and start creating classes, managing vivas, and evaluating students.
            </p>
            
            <h3 style="color: #667eea; margin-top: 30px;">📋 Your Login Credentials:</h3>
            <div class="credentials">
              <div class="cred-row">
                <div class="cred-label">👤 Full Name</div>
                <div class="cred-value">${name}</div>
              </div>
              <div class="cred-row">
                <div class="cred-label">🎓 Enrollment Number (Username)</div>
                <div class="cred-value">${ennumber}</div>
              </div>
              <div class="cred-row">
                <div class="cred-label">🔐 Password</div>
                <div class="cred-value">${password}</div>
              </div>
            </div>
            
            <div class="info-box">
              <strong>🔒 Security Tip:</strong> Please change your password after your first login for better security.
            </div>
            
            <div class="login-section">
              <p style="margin-bottom: 15px; color: #666;">Ready to get started?</p>
              <a href="http://localhost:5173/login" class="login-btn">
                🚀 Login to Portal
              </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666; line-height: 1.6;">
              If you have any questions or need assistance, please contact the administrator.
            </p>
          </div>
          <div class="footer">
            <p><strong>© 2024 AI Viva Portal</strong></p>
            <p style="margin-top: 10px;">This is an automated information email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending teacher credentials email:", error);
    return { success: false, error: error.message };
  }
};
