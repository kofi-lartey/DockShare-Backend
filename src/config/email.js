import nodemailer from 'nodemailer';
import axios from 'axios';

const BREVO_API_URL = 'https://api.brevo.com/v3';
const API_KEY = process.env.BREVO_API_KEY;

const headers = {
  'api-key': API_KEY,
  'Content-Type': 'application/json',
};

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const getSender = () => ({
  name: process.env.BREVO_SENDER_NAME || 'DocShare Pro',
  address: process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER
});

const sendViaApi = async ({ to, subject, htmlContent }) => {
  const response = await axios.post(
    `${BREVO_API_URL}/smtp/email`,
    {
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: process.env.BREVO_SENDER_NAME
      },
      to: [{ email: to }],
      subject,
      htmlContent
    },
    { headers }
  );
  return response.data;
};

const sendEmail = async (email, subject, html) => {
  try {
    if (API_KEY && API_KEY.startsWith('xkeysib-')) {
      await sendViaApi({ to: email, subject, htmlContent: html });
    } else {
      await transporter.sendMail({ from: getSender(), to: email, subject, html });
    }
    return { success: true };
  } catch (error) {
    console.error('Email error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

export const sendVerificationEmail = async (email, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/confirm-email/${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366f1;">Welcome to DocShare Pro!</h2>
      <p>Please verify your email address by clicking the button below:</p>
      <a href="${verificationUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
        Verify Email Address
      </a>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't sign up, please ignore this email.</p>
    </div>
  `;
  return sendEmail(email, 'Verify Your Email Address', html);
};

export const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366f1;">Password Reset Request</h2>
      <p>You requested to reset your password. Click the button below:</p>
      <a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
        Reset Password
      </a>
      <p>This link will expire in 1 hour.</p>
    </div>
  `;
  return sendEmail(email, 'Reset Your Password', html);
};

export const sendViewNotification = async (email, fileName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366f1;">Document Viewed</h2>
      <p>Your document <strong>${fileName}</strong> has been viewed.</p>
    </div>
  `;
  return sendEmail(email, 'Document Viewed', html);
};

export const sendNotification = async (email, subject, htmlContent) => {
  return sendEmail(email, subject, htmlContent);
};