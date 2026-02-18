const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
  console.log('\n🧪 Testing Email Configuration...\n');
  
  console.log('Configuration:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET');
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
  console.log('');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    console.log('⏳ Verifying connection...');
    await transporter.verify();
    console.log('✅ Connection verified!\n');

    console.log('📧 Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: 'Test Email - HCG Portal',
      html: `
        <h2>✅ Email Configuration Successful!</h2>
        <p>Your HCG Portal email system is working correctly.</p>
        <p>Test OTP: <strong>123456</strong></p>
      `,
    });

    console.log('✅ EMAIL SENT SUCCESSFULLY!');
    console.log('Message ID:', info.messageId);
    console.log('\n📬 Check your inbox:', process.env.EMAIL_USER);
    console.log('================================\n');

  } catch (error) {
    console.error('\n❌ EMAIL TEST FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nCommon Issues:');
    console.error('1. App Password wrong - regenerate it');
    console.error('2. 2-Step Verification not enabled');
    console.error('3. Spaces in password - remove them');
    console.error('4. Using regular Gmail password instead of App Password');
    console.error('\n================================\n');
  }
}

testEmail();