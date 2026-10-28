import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import User from '../models/User.js';

// Resolve MongoDB SRV records via Google DNS (fixes querySrv ECONNREFUSED on local ISPs)
dns.setServers(['8.8.8.8', '8.8.4.4']);
import Attendance from '../models/Attendance.js';
import Homework from '../models/Homework.js';
import Test from '../models/Test.js';
import Fee from '../models/Fee.js';
import Announcement from '../models/Announcement.js';
import Report from '../models/Report.js';

dotenv.config();

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kashvi_smartclass');
    console.log('🔄 Connected to MongoDB. Seeding initial data...');

    const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
    const populatedCollections = await Promise.all(collections.map(async ({ name }) => ({
      name,
      hasRecords: await mongoose.connection.db.collection(name).countDocuments({}, { limit: 1 }) > 0
    })));
    const populatedNames = populatedCollections.filter(collection => collection.hasRecords).map(collection => collection.name);
    if (populatedNames.length) {
      throw new Error(`Seeding stopped: database collections already contain records (${populatedNames.join(', ')}). Demo seeding never deletes or overwrites data.`);
    }

    // 1. Create Core Users
    const admin = await User.create({
      uniqueId: 'ADMIN-2024-0001',
      name: 'Dr. Rajesh Sharma',
      email: 'admin@kashvi.com',
      password: 'Admin@2024',
      role: 'admin',
      phone: '+91 98765 43210',
      address: 'Kashvi Campus, New Delhi'
    });

    const teacher1 = await User.create({
      uniqueId: 'TCH-2024-0048',
      name: 'Prof. Vikram Verma',
      email: 'teacher@kashvi.com',
      password: 'Teacher@123',
      role: 'teacher',
      subject: 'Mathematics',
      assignedClasses: ['10', '9', '8', '7'],
      linkedStudents: [],
      phone: '+91 98765 43211'
    });

    const teacher2 = await User.create({
      uniqueId: 'TCH-2024-0049',
      name: 'Dr. Sunita Rao',
      email: 'sunita@kashvi.com',
      password: 'Teacher@123',
      role: 'teacher',
      subject: 'Physics',
      assignedClasses: ['10', '9', '8', '7'],
      linkedStudents: [],
      phone: '+91 98765 43212'
    });

    const student1 = await User.create({
      uniqueId: 'STU-2024-1284',
      name: 'Aarav Sharma',
      email: 'student@kashvi.com',
      password: 'Student@123',
      role: 'student',
      class: '10',
      rollNumber: '12',
      parentEmail: 'parent@kashvi.com',
      dateOfBirth: new Date('2009-04-15'),
      phone: '+91 98765 43220'
    });

    const student2 = await User.create({
      uniqueId: 'STU-2024-1285',
      name: 'Rhea Kulkarni',
      email: 'rhea@kashvi.com',
      password: 'Student@123',
      role: 'student',
      class: '10',
      rollNumber: '08',
      parentEmail: 'parent@kashvi.com',
      dateOfBirth: new Date('2009-08-22'),
      phone: '+91 98765 43221'
    });

    const student3 = await User.create({
      uniqueId: 'STU-2024-1286',
      name: 'Siddharth Patel',
      email: 'siddharth@kashvi.com',
      password: 'Student@123',
      role: 'student',
      class: '9',
      rollNumber: '15',
      parentEmail: 'parent@kashvi.com',
      dateOfBirth: new Date('2010-01-10'),
      phone: '+91 98765 43222'
    });

    const parent = await User.create({
      uniqueId: 'PRN-2024-0980',
      name: 'Mr. Sharma (Parent)',
      email: 'parent@kashvi.com',
      password: 'Parent@123',
      role: 'parent',
      phone: '+91 98765 43230',
      children: [
        { studentId: student1._id, studentName: 'Aarav Sharma', relationship: 'Son' },
        { studentId: student2._id, studentName: 'Rhea Kulkarni', relationship: 'Ward' },
        { studentId: student3._id, studentName: 'Siddharth Patel', relationship: 'Ward' }
      ]
    });
    await User.updateMany(
      { _id: { $in: [student1._id, student2._id, student3._id] } },
      { $set: { parents: [parent._id], parentEmail: parent.email } }
    );
    teacher1.linkedStudents = [student1._id, student2._id, student3._id];
    teacher2.linkedStudents = [student1._id, student2._id, student3._id];
    await Promise.all([teacher1.save(), teacher2.save()]);

    console.log('👤 Core users created (Admin, Teachers, Students, Parents).');

    // 2. Create Sample Attendance (30 records)
    const today = new Date();
    const attendanceRecords = [];
    for (let i = 0; i < 20; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      attendanceRecords.push({
        studentId: student1._id,
        studentName: student1.name,
        class: '10',
        date: d,
        status: i === 3 ? 'absent' : (i === 7 ? 'leave' : 'present'),
        markedBy: teacher1._id,
        subject: 'Mathematics'
      });
      attendanceRecords.push({
        studentId: student2._id,
        studentName: student2.name,
        class: '10',
        date: d,
        status: 'present',
        markedBy: teacher1._id,
        subject: 'Mathematics'
      });
    }
    await Attendance.insertMany(attendanceRecords);
    console.log(`📅 Inserted ${attendanceRecords.length} attendance records.`);

    // 3. Create Sample Homework
    await Homework.create([
      {
        title: 'Quadratic Equations Practice Set 4.2',
        description: 'Complete questions 1 to 15 from Chapter 4 and upload your working PDF.',
        subject: 'Mathematics',
        class: '10',
        teacherId: teacher1._id,
        teacherName: teacher1.name,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        attachments: [{ fileName: 'math_worksheet_4.pdf', fileUrl: 'https://kashvi-docs.edu/math_4.pdf' }],
        status: 'active'
      },
      {
        title: 'Newton Laws of Motion & Friction Lab Report',
        description: 'Summarize the laboratory findings on kinetic vs static friction coefficients.',
        subject: 'Physics',
        class: '10',
        teacherId: teacher2._id,
        teacherName: teacher2.name,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        attachments: [{ fileName: 'physics_lab_guidelines.pdf', fileUrl: 'https://kashvi-docs.edu/phys_lab.pdf' }],
        status: 'active'
      }
    ]);
    console.log('📝 Created sample homework tasks.');

    // 4. Create Sample Online Tests
    await Test.create([
      {
        title: 'Term 1 Mathematics Assessment',
        subject: 'Mathematics',
        class: '10',
        teacherId: teacher1._id,
        duration: 30,
        totalMarks: 20,
        passingMarks: 8,
        status: 'published',
        questions: [
          { question: 'What is the value of x if 2x + 8 = 20?', options: ['4', '6', '8', '10'], correctAnswer: '6', marks: 4 },
          { question: 'What is the discriminant of quadratic equation ax² + bx + c = 0?', options: ['b² - 4ac', 'b² + 4ac', '4ac - b²', '2b - 4ac'], correctAnswer: 'b² - 4ac', marks: 4 },
          { question: 'If sin(θ) = 1/2, what is standard acute angle θ?', options: ['45°', '30°', '60°', '90°'], correctAnswer: '30°', marks: 4 },
          { question: 'Sum of roots of 3x² - 9x + 5 = 0 is?', options: ['3', '-3', '5/3', '-5/3'], correctAnswer: '3', marks: 4 },
          { question: 'A circle with radius 7cm has circumference equal to?', options: ['44 cm', '22 cm', '88 cm', '154 cm'], correctAnswer: '44 cm', marks: 4 }
        ]
      },
      {
        title: 'Physics Mechanics Quick Quiz',
        subject: 'Physics',
        class: '10',
        teacherId: teacher2._id,
        duration: 20,
        totalMarks: 15,
        passingMarks: 6,
        status: 'published',
        questions: [
          { question: 'Which law of motion is known as Law of Inertia?', options: ['First Law', 'Second Law', 'Third Law', 'Universal Gravitation'], correctAnswer: 'First Law', marks: 5 },
          { question: 'What is the SI unit of Force?', options: ['Joule', 'Newton', 'Pascal', 'Watt'], correctAnswer: 'Newton', marks: 5 },
          { question: 'Acceleration due to gravity g on Earth is approximately?', options: ['9.8 m/s²', '8.9 m/s²', '10.5 m/s²', '3.14 m/s²'], correctAnswer: '9.8 m/s²', marks: 5 }
        ]
      }
    ]);
    console.log('🧪 Created sample online tests.');

    // 5. Create Sample Fee Records
    await Fee.create([
      {
        studentId: student1._id,
        studentName: student1.name,
        class: '10',
        month: 'September',
        year: 2024,
        amount: 4500,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        status: 'pending'
      },
      {
        studentId: student1._id,
        studentName: student1.name,
        class: '10',
        month: 'August',
        year: 2024,
        amount: 4500,
        dueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        paidDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
        status: 'paid',
        paymentMethod: 'Online - UPI',
        transactionId: 'UPI-984729103',
        receiptNumber: 'RCP-2024-8821'
      },
      {
        studentId: student2._id,
        studentName: student2.name,
        class: '10',
        month: 'September',
        year: 2024,
        amount: 4500,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        status: 'pending'
      }
    ]);
    console.log('💳 Created sample fee records.');

    // 6. Create Sample Announcements
    await Announcement.create([
      {
        title: '📢 Annual Sports Day 2024 Registration',
        content: 'Registration for Track & Field, Football, and Chess events is now open. Submit entries by Friday.',
        priority: 'high',
        targetRoles: ['student', 'teacher', 'parent'],
        isPublished: true
      },
      {
        title: '📆 Mid-Term Examination Schedule Released',
        content: 'The date sheet for Term 1 board preparation examinations has been uploaded to the student portal.',
        priority: 'urgent',
        targetRoles: ['student', 'teacher', 'parent'],
        isPublished: true
      },
      {
        title: '🤖 Kashvi AI Tutor 2.0 Feature Activated',
        content: 'Students can now generate personalized revision blueprints and flashcards inside the AI Study Plans module.',
        priority: 'medium',
        targetRoles: ['student', 'teacher'],
        isPublished: true
      }
    ]);
    console.log('📢 Created sample announcements.');

    // 7. Create Sample Report Cards
    await Report.create({
      studentId: student1._id,
      studentName: student1.name,
      class: '10',
      rollNumber: '12',
      academicYear: '2024-2025',
      term: 'Term 1',
      subjects: [
        { name: 'Mathematics', marks: 94, maxMarks: 100, grade: 'A1', remarks: 'Exceptional algebraic insight' },
        { name: 'Physics', marks: 88, maxMarks: 100, grade: 'A2', remarks: 'Strong theoretical grasp' },
        { name: 'Chemistry', marks: 91, maxMarks: 100, grade: 'A1', remarks: 'Great lab skills' },
        { name: 'English Literature', marks: 85, maxMarks: 100, grade: 'A2', remarks: 'Creative expressions' },
        { name: 'Computer Science', marks: 98, maxMarks: 100, grade: 'A1', remarks: 'Outstanding programming abilities' }
      ],
      totalMarks: 456,
      percentage: 91.2,
      overallGrade: 'A1',
      teacherRemarks: 'Aarav is an exceptionally dedicated student with consistent leadership qualities.',
      attendancePercentage: 96.5
    });

    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
};

seedDB();
