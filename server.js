const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routh_auth');
const verifyToken = require('./middleware_auth');

const app = express();

// Middleware
// const cors = require('cors');

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://haryana-gas-forntend.vercel.app'  // ← NO TRAILING SLASH! AAA
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api', authRoutes);

// Protected route example
app.get('/api/protected', verifyToken, (req, res) => {
  res.json({ 
    success: true, 
    message: 'This is protected data',
    user: req.user 
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: '✅ Server Running',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log('================================\n');
});