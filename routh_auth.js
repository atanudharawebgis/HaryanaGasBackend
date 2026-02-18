const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('./db');
require('dotenv').config();

// Email transporter - Gmail configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use Gmail service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Test email connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email configuration error:', error.message);
    console.log('⚠️  Email features will not work. Please check EMAIL_* variables in .env');
  } else {
    console.log('✅ Email server ready');
  }
});

// LOGIN ROUTE
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Update last login (optional - won't fail if column doesn't exist)
    try {
      await pool.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );
    } catch (err) {
      console.log('Note: last_login column not updated');
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

// FORGOT PASSWORD - Send OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If your email exists, you will receive a reset code shortly.',
      });
    }

    const user = result.rows[0];
    
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 600000); // 10 minutes

    // Delete old unused tokens for this user
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1 AND is_used = false',
      [user.id]
    );

    // Insert new OTP
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, otp, expires_at) VALUES ($1, $2, $3, $4)',
      [user.id, resetToken, otp, expiresAt]
    );

    // Send email with OTP
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Code - HCG GIS Portal',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">Password Reset Request</h2>
          <p>Hello <strong>${user.full_name || user.username}</strong>,</p>
          <p>You requested to reset your password. Use this code:</p>
          
          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="color: #f97316; font-size: 36px; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          
          <p><strong>This code expires in 10 minutes.</strong></p>
          <p style="color: #64748b; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px;">
            HCG GIS Portal - Haryana City Gas<br>
            Developed by MapGeoid
          </p>
        </div>
      `,
    };

    // Try sending email, but don't fail if it doesn't work
    try {
      await transporter.sendMail(mailOptions);
      console.log(`\n✅ EMAIL SENT SUCCESSFULLY!`);
      console.log(`📧 To: ${email}`);
      console.log(`🔐 OTP: ${otp}`);
      console.log(`⏰ Expires in: 10 minutes\n`);
    } catch (emailError) {
      console.error('\n❌ Email Send Failed:', emailError.message);
      console.log('\n⚠️  NO PROBLEM! Use this OTP from console:');
      console.log('================================');
      console.log(`📧 Email: ${email}`);
      console.log(`🔐 OTP Code: ${otp}`);
      console.log(`⏰ Valid for: 10 minutes`);
      console.log('================================\n');
    }

    res.json({
      success: true,
      message: 'Password reset code generated. Check server console for OTP.',
      // Show OTP in response for development
      otp: otp  // Remove this line in production!
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
});

// VERIFY OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    const result = await pool.query(
      `SELECT prt.*, u.email, u.full_name 
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1 
         AND prt.otp = $2 
         AND prt.is_used = false
         AND prt.expires_at > NOW()`,
      [email, otp]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    const resetData = result.rows[0];

    res.json({
      success: true,
      message: 'OTP verified successfully',
      resetToken: resetData.token,
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const result = await pool.query(
      `SELECT * FROM password_reset_tokens 
       WHERE token = $1 
         AND is_used = false
         AND expires_at > NOW()`,
      [resetToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    const resetData = result.rows[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, resetData.user_id]
    );

    // Mark token as used
    await pool.query(
      'UPDATE password_reset_tokens SET is_used = true WHERE id = $1',
      [resetData.id]
    );

    res.json({
      success: true,
      message: 'Password reset successfully',
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

module.exports = router;