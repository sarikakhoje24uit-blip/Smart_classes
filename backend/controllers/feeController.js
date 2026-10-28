import FeeModel from '../models/Fee.js';
import User from '../models/User.js';
import { notifyLinkedParents } from '../utils/userNotifications.js';
import { verifyParentChildAccess } from '../utils/parentAuth.js';
import axios from 'axios';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { recordAuditEvent } from '../utils/auditLog.js';

const razorpayApi = 'https://api.razorpay.com/v1';

const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || typeof signature !== 'string') return false;
  const expected = createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  let received;
  try {
    received = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(expected, received);
};

const getFeeOwnershipError = async (fee, user) => {
  if (!fee.studentId) return 'This fee invoice is not linked to a student';
  if (user.role === 'parent' && !(await verifyParentChildAccess(user, fee.studentId))) {
    return 'Access denied: You can only pay fees for your linked child';
  }
  if (user.role === 'student' && fee.studentId.toString() !== user._id.toString()) {
    return 'Access denied: You can only pay your own fees';
  }
  if (!['parent', 'student', 'admin'].includes(user.role)) return 'Unauthorized role for payments';
  return null;
};

const makeReceipt = (fee) => ({
  receiptNumber: fee.receiptNumber,
  transactionId: fee.transactionId,
  feeId: fee._id,
  studentName: fee.studentName,
  class: fee.class,
  month: fee.month,
  amount: fee.amount,
  paidDate: fee.paidDate,
  paymentMethod: fee.paymentMethod
});

// @desc    Get fees based on user role and permissions
// @route   GET /api/fees
export const getAllFees = async (req, res, next) => {
  try {
    const { status, class: className, studentId, month, year } = req.query;
    let query = {};

    if (req.user.role === 'admin') {
      // Admins have full access across the institution
      if (status) query.status = status;
      if (className) query.class = className;
      if (studentId) query.studentId = studentId;
    } else if (req.user.role === 'teacher') {
      // Teachers only see their assigned class fee summary if class specified
      if (className) {
        query.class = className;
      } else if (req.user.assignedClasses && req.user.assignedClasses.length > 0) {
        query.class = { $in: req.user.assignedClasses };
      }
      if (status) query.status = status;
    } else if (req.user.role === 'student') {
      // If student attempted to query another student's ID explicitly
      if (studentId && studentId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Students can only view their own fee information'
        });
      }
      // Students can ONLY view their own fees
      query.studentId = req.user._id;
      if (status) query.status = status;
    } else if (req.user.role === 'parent') {
      // Parents can ONLY view fees of their linked children
      const allChildIds = (req.user.children || []).map(child => child.studentId).filter(Boolean);

      if (studentId) {
        // If parent requested a specific child ID, verify access
        const isChild = allChildIds.some(id => id.toString() === studentId.toString());
        if (!isChild) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You cannot view fees for an unlinked student'
          });
        }
        query.studentId = studentId;
      } else {
        query.studentId = { $in: allChildIds };
      }

      if (status) query.status = status;
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    if (month && month !== 'all') query.month = month;
    if (year && year !== 'all') {
      const numericYear = Number(year);
      query.year = Number.isNaN(numericYear) ? year : numericYear;
    }

    const fees = await FeeModel.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: fees.length, fees });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single fee invoice by ID
// @route   GET /api/fees/:id
export const getFeeById = async (req, res, next) => {
  try {
    const fee = await FeeModel.findById(req.params.id);
    if (!fee) {
      return res.status(404).json({ success: false, message: 'Fee record not found' });
    }

    // Role-based authorization
    if (req.user.role === 'student') {
      if (fee.studentId && fee.studentId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: You cannot view this fee invoice' });
      }
    } else if (req.user.role === 'parent') {
      if (fee.studentId) {
        const isAuthorized = await verifyParentChildAccess(req.user, fee.studentId);
        if (!isAuthorized) {
          return res.status(403).json({ success: false, message: 'Access denied: You cannot view this fee invoice' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'This fee invoice is not linked to a student' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied to this fee invoice' });
    }

    res.status(200).json({ success: true, fee });
  } catch (error) {
    next(error);
  }
};

// @desc    Create fee invoice (Admin only)
// @route   POST /api/fees
export const createFee = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can create fee invoices' });
    }
    const { studentId, month, year, amount, dueDate, remarks } = req.body;
    if (!studentId || !month || !dueDate || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Student, billing month, positive amount, and due date are required' });
    }
    const student = await User.findOne({ _id: studentId, role: 'student' }).select('name class');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student account not found' });
    }
    const fee = await FeeModel.create({
      studentId: student._id,
      studentName: student.name,
      class: student.class,
      month: month.trim(),
      year: year || new Date().getFullYear(),
      amount: Number(amount),
      dueDate,
      remarks
    });
    await recordAuditEvent(req, {
      action: 'fee.create',
      targetType: 'fee',
      targetId: fee._id,
      summary: 'Created a student fee invoice'
    });
    await notifyLinkedParents(student._id, {
      type: 'fee',
      title: 'New fee invoice',
      message: `A fee invoice for ${fee.month} ${fee.year} is available for ${student.name}.`,
      dedupeKey: `fee:${fee._id}`
    });
    res.status(201).json({ success: true, message: 'Fee invoice created successfully', fee });
  } catch (error) {
    next(error);
  }
};

// @desc    Update fee invoice (Admin only)
// @route   PUT /api/fees/:id
export const updateFee = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can modify fee invoices' });
    }
    const fee = await FeeModel.findById(req.params.id);
    if (!fee) {
      return res.status(404).json({ success: false, message: 'Fee record not found' });
    }
    if (req.body.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Invoices can only be marked paid after gateway verification' });
    }
    const { month, year, amount, dueDate, remarks, status } = req.body;
    if (month !== undefined) fee.month = month;
    if (year !== undefined) fee.year = year;
    if (amount !== undefined) {
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Fee amount must be greater than zero' });
      }
      if (Number(amount) !== fee.amount) fee.razorpayOrderId = undefined;
      fee.amount = Number(amount);
    }
    if (dueDate !== undefined) fee.dueDate = dueDate;
    if (remarks !== undefined) fee.remarks = remarks;
    if (status !== undefined) {
      if (!['pending', 'overdue'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invoice status must be pending or overdue' });
      }
      fee.status = status;
    }
    await fee.save();
    await recordAuditEvent(req, {
      action: 'fee.update',
      targetType: 'fee',
      targetId: fee._id,
      summary: 'Updated a student fee invoice'
    });
    res.status(200).json({ success: true, message: 'Fee invoice updated', fee });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete fee invoice (Admin only)
// @route   DELETE /api/fees/:id
export const deleteFee = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can delete fee invoices' });
    }
    const fee = await FeeModel.findByIdAndDelete(req.params.id);
    if (!fee) {
      return res.status(404).json({ success: false, message: 'Fee record not found' });
    }
    await recordAuditEvent(req, {
      action: 'fee.delete',
      targetType: 'fee',
      targetId: fee._id,
      summary: 'Deleted a student fee invoice'
    });
    res.status(200).json({ success: true, message: 'Fee invoice deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Payment Order for a Fee Invoice (Parent / Student)
// @route   POST /api/fees/:id/order
export const createPaymentOrder = async (req, res, next) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ success: false, message: 'Razorpay payments are not configured on this server' });
    }
    const fee = await FeeModel.findById(req.params.id);
    if (!fee) {
      return res.status(404).json({ success: false, message: 'Fee record not found' });
    }

    if (fee.status === 'paid') {
      return res.status(400).json({ success: false, message: 'This fee invoice is already paid' });
    }

    const ownershipError = await getFeeOwnershipError(fee, req.user);
    if (ownershipError) {
      return res.status(403).json({ success: false, message: ownershipError });
    }

    if (!Number.isFinite(fee.amount) || fee.amount <= 0) {
      return res.status(400).json({ success: false, message: 'Fee amount must be greater than zero' });
    }

    if (!fee.razorpayOrderId) {
      const amountInPaise = Math.round(fee.amount * 100);
      if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
        return res.status(400).json({ success: false, message: 'Fee amount is invalid for online payment' });
      }

      const orderResponse = await axios.post(`${razorpayApi}/orders`, {
        amount: amountInPaise,
        currency: 'INR',
        receipt: `${fee._id}-${Date.now()}`
      }, {
        auth: { username: process.env.RAZORPAY_KEY_ID, password: process.env.RAZORPAY_KEY_SECRET }
      });
      fee.razorpayOrderId = orderResponse.data.id;
      await fee.save();
    }

    res.status(200).json({
      success: true,
      order: {
        orderId: fee.razorpayOrderId,
        feeId: fee._id,
        amount: Math.round(fee.amount * 100),
        currency: 'INR',
        studentName: fee.studentName,
        class: fee.class,
        month: fee.month,
        keyId: process.env.RAZORPAY_KEY_ID
      },
      parent: req.user.role === 'parent' ? { name: req.user.name, email: req.user.email } : undefined
    });
  } catch (error) {
    if (error.response) {
      console.error('Razorpay order creation failed:', error.response.data);
      return res.status(502).json({ success: false, message: 'Razorpay could not create a payment order. Check server credentials and gateway configuration.' });
    }
    next(error);
  }
};

// @desc    Process & Verify Payment for a Fee Invoice (Parent / Student / Webhook)
// @route   POST /api/fees/:id/pay
export const processPayment = async (req, res, next) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ success: false, message: 'Razorpay payments are not configured on this server' });
    }
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    const fee = await FeeModel.findById(req.params.id);
    if (!fee) {
      return res.status(404).json({ success: false, message: 'Fee record not found' });
    }

    if (fee.status === 'paid') {
      if (fee.razorpayPaymentId === paymentId && fee.receiptNumber) {
        return res.status(200).json({ success: true, message: 'Payment was already verified', receipt: makeReceipt(fee) });
      }
      return res.status(409).json({ success: false, message: 'This fee invoice has already been settled' });
    }

    const ownershipError = await getFeeOwnershipError(fee, req.user);
    if (ownershipError) {
      return res.status(403).json({ success: false, message: ownershipError });
    }

    if (!orderId || !paymentId || !signature || orderId !== fee.razorpayOrderId ||
        !verifyRazorpaySignature(orderId, paymentId, signature)) {
      return res.status(400).json({ success: false, message: 'Payment signature is invalid or does not match this invoice' });
    }

    const auth = { username: process.env.RAZORPAY_KEY_ID, password: process.env.RAZORPAY_KEY_SECRET };
    const paymentResponse = await axios.get(`${razorpayApi}/payments/${encodeURIComponent(paymentId)}`, { auth });
    const payment = paymentResponse.data;
    const expectedAmount = Math.round(fee.amount * 100);
    if (payment.order_id !== orderId || payment.amount !== expectedAmount || payment.currency !== 'INR') {
      return res.status(400).json({ success: false, message: 'Gateway payment does not match this invoice amount and order' });
    }

    let capturedPayment = payment;
    if (payment.status === 'authorized') {
      const captureResponse = await axios.post(
        `${razorpayApi}/payments/${encodeURIComponent(paymentId)}/capture`,
        { amount: expectedAmount, currency: 'INR' },
        { auth }
      );
      capturedPayment = captureResponse.data;
    }
    if (capturedPayment.status !== 'captured') {
      return res.status(409).json({ success: false, message: `Payment is not captured (gateway status: ${capturedPayment.status})` });
    }

    const paidFee = await FeeModel.findOneAndUpdate(
      { _id: fee._id, status: { $ne: 'paid' }, razorpayOrderId: orderId },
      {
        $set: {
          status: 'paid',
          paidDate: new Date(),
          paymentMethod: `Razorpay (${capturedPayment.method || 'online'})`,
          transactionId: paymentId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
          receiptNumber: `RCP-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          remarks: 'Payment verified with Razorpay'
        }
      },
      { new: true, runValidators: true }
    );

    if (!paidFee) {
      const latestFee = await FeeModel.findById(fee._id);
      if (latestFee?.razorpayPaymentId === paymentId && latestFee.receiptNumber) {
        return res.status(200).json({ success: true, message: 'Payment was already verified', receipt: makeReceipt(latestFee) });
      }
      return res.status(409).json({ success: false, message: 'Fee invoice was settled by another payment' });
    }

    await recordAuditEvent(req, {
      action: 'fee.payment_verified',
      targetType: 'fee',
      targetId: paidFee._id,
      summary: 'Verified and captured a fee payment'
    });
    return res.status(200).json({
      success: true,
      message: 'Payment captured and verified with Razorpay',
      receipt: makeReceipt(paidFee)
    });
  } catch (error) {
    if (error.response) {
      console.error('Razorpay payment verification failed:', error.response.data);
      return res.status(502).json({ success: false, message: 'Razorpay could not verify or capture this payment. Check the gateway dashboard before retrying.' });
    }
    next(error);
  }
};

export const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.get('x-razorpay-signature');
    if (!webhookSecret) {
      return res.status(503).json({ success: false, message: 'Razorpay webhook is not configured' });
    }
    if (!req.rawBody || typeof signature !== 'string') {
      return res.status(400).json({ success: false, message: 'Webhook body or signature is missing' });
    }

    const expected = createHmac('sha256', webhookSecret).update(req.rawBody).digest();
    const received = Buffer.from(signature, 'hex');
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) {
      return res.status(401).json({ success: false, message: 'Invalid Razorpay webhook signature' });
    }

    let webhookBody;
    try {
      webhookBody = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, message: 'Webhook payload is not valid JSON' });
    }

    const event = webhookBody.event;
    if (event !== 'payment.captured') {
      return res.status(200).json({ success: true, message: 'Event ignored' });
    }
    const payment = webhookBody.payload?.payment?.entity;
    if (!payment?.id || !payment?.order_id || payment.status !== 'captured') {
      return res.status(400).json({ success: false, message: 'Captured payment details are incomplete' });
    }

    const fee = await FeeModel.findOne({ razorpayOrderId: payment.order_id });
    if (!fee) {
      return res.status(404).json({ success: false, message: 'No fee invoice matches this Razorpay order' });
    }
    if (payment.amount !== Math.round(fee.amount * 100) || payment.currency !== 'INR') {
      return res.status(400).json({ success: false, message: 'Captured payment amount does not match the invoice' });
    }
    if (fee.status === 'paid' && fee.razorpayPaymentId === payment.id) {
      return res.status(200).json({ success: true, message: 'Payment was already recorded' });
    }
    if (fee.status === 'paid') {
      return res.status(409).json({ success: false, message: 'Invoice has already been paid by another transaction' });
    }

    const updatedFee = await FeeModel.findOneAndUpdate(
      { _id: fee._id, status: { $ne: 'paid' }, razorpayOrderId: payment.order_id },
      {
        $set: {
          status: 'paid',
          paidDate: payment.created_at ? new Date(payment.created_at * 1000) : new Date(),
          paymentMethod: `Razorpay (${payment.method || 'online'})`,
          transactionId: payment.id,
          razorpayPaymentId: payment.id,
          receiptNumber: `RCP-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          remarks: 'Payment verified by Razorpay capture webhook'
        }
      },
      { new: true, runValidators: true }
    );
    if (!updatedFee) {
      return res.status(409).json({ success: false, message: 'Invoice payment state changed while processing webhook' });
    }
    await recordAuditEvent(req, {
      action: 'fee.payment_webhook',
      targetType: 'fee',
      targetId: updatedFee._id,
      summary: 'Recorded a captured payment from the gateway webhook'
    });
    res.status(200).json({ success: true, message: 'Captured payment recorded' });
  } catch (error) {
    next(error);
  }
};

// @desc    Record or Request Offline / Cash / Cheque Fee Payment
// @route   POST /api/fees/:id/offline
export const recordOfflinePayment = async (req, res, next) => {
  try {
    const fee = await FeeModel.findById(req.params.id);
    if (!fee) {
      return res.status(404).json({ success: false, message: 'Fee record not found' });
    }

    if (fee.status === 'paid') {
      return res.status(400).json({ success: false, message: 'This fee invoice is already marked as paid' });
    }

    const { paymentMethod = 'Cash (Offline)', remarks = 'Paid in cash at institute center' } = req.body;

    const receiptNo = `RCP-OFF-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const txnId = `OFF-${Date.now().toString().slice(-8)}`;

    fee.status = 'paid';
    fee.paidDate = new Date();
    fee.paymentMethod = paymentMethod;
    fee.receiptNumber = receiptNo;
    fee.transactionId = txnId;
    fee.remarks = remarks;

    await fee.save();

    await recordAuditEvent(req, {
      action: 'fee.offline_payment',
      targetType: 'fee',
      targetId: fee._id,
      summary: `Recorded offline payment via ${paymentMethod}`
    });

    res.status(200).json({
      success: true,
      message: 'Offline payment recorded and official receipt generated successfully',
      receipt: makeReceipt(fee)
    });
  } catch (error) {
    next(error);
  }
};

