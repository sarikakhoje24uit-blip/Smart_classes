import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import connectDB from './config/database.js';
import apiRoutes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import { handleRazorpayWebhook } from './controllers/feeController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables reliably from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be a unique value with at least 32 characters in backend/.env');
}

// Initialize Express App
const app = express();

// Connect to MongoDB
connectDB();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Security & Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
      frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
      connectSrc: ["'self'", 'https://api.razorpay.com']
    }
  }
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server, curl, local dev, or vercel/production domains
    if (!origin || origin.includes('localhost') || origin.endsWith('.vercel.app') || (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.post('/api/fees/razorpay/webhook', express.raw({ type: 'application/json' }), handleRazorpayWebhook);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    system: 'Kashvi SmartClass Backend API',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', apiRoutes);

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Kashvi SmartClass Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
