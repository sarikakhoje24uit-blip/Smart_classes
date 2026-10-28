import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ACADEMIC_CLASSES } from '../utils/academicClass.js';

const userSchema = new mongoose.Schema({
  uniqueId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'student', 'parent'],
    required: true,
    default: 'student'
  },
  // Teacher specific fields
  subject: {
    type: String,
    default: ''
  },
  assignedClasses: {
    type: [String],
    validate: {
      validator: classes => classes.every(className => ACADEMIC_CLASSES.includes(className)),
      message: `Assigned classes must be one of: ${ACADEMIC_CLASSES.join(', ')}`
    }
  },
  linkedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Student specific fields
  rollNumber: {
    type: String,
    default: ''
  },
  class: {
    type: String,
    enum: ['', ...ACADEMIC_CLASSES],
    default: ''
  },
  dateOfBirth: {
    type: Date
  },
  parentEmail: {
    type: String,
    default: ''
  },
  parents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  enrolledCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  // Parent specific fields
  children: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    studentName: String,
    relationship: {
      type: String,
      default: 'Parent'
    }
  }],
  phone: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  profilePicture: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String
  },
  twoFactorPendingSecret: {
    type: String
  },
  twoFactorPendingExpires: {
    type: Date
  },
  twoFactorLastVerifiedStep: {
    type: Number,
    default: -1,
    default: ''
  },
  // Subscription & Free Trial
  subscriptionStatus: {
    type: String,
    enum: ['trial', 'active', 'expired'],
    default: 'trial'
  },
  trialStartDate: {
    type: Date,
    default: Date.now
  },
  trialEndDate: {
    type: Date,
    default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password helper
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
