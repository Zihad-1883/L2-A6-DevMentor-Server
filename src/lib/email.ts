import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export interface ISendReceiptEmailInput {
  toEmail: string;
  studentName: string;
  invoiceNumber: string;
  amount: number;
  creditsEarned: number;
  pdfBuffer: Buffer;
}

export interface ISendOTPEmailInput {
  toEmail: string;
  subject: string;
  title: string;
  otp: string;
  description: string;
}

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // true for 465, false for 587
  auth:
    env.SMTP_USER && env.SMTP_PASS
      ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      }
      : undefined,
});


export const sendOTPEmail = async (input: ISendOTPEmailInput): Promise<boolean> => {
  const { toEmail, subject, title, otp, description } = input;

  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.log(`\n========================================\n📧 [DEV OTP LOG] ${title}\nTo: ${toEmail}\nOTP Code: ${otp}\nSubject: ${subject}\n========================================\n`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: toEmail,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #4f46e5; margin-top: 0; text-align: center;">${title}</h2>
          <p style="color: #374151; font-size: 14px; line-height: 1.5;">${description}</p>
          <div style="background-color: #f3f4f6; padding: 18px; border-radius: 8px; margin: 24px 0; text-align: center; letter-spacing: 6px;">
            <span style="font-size: 32px; font-weight: bold; color: #111827;">${otp}</span>
          </div>
          <p style="font-size: 12px; color: #6b7280; text-align: center;">This code will expire in 5 minutes. Please do not share it with anyone.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center;">DevMentor Platform • Credit-Based Mentorship & Learning</p>
        </div>
      `,
    });

    return true;
  } catch (err) {
    console.error("❌ Failed to send OTP email via Nodemailer:", err);
    return false;
  }
};


export const sendPaymentReceiptEmail = async (input: ISendReceiptEmailInput): Promise<boolean> => {
  const { toEmail, studentName, invoiceNumber, amount, creditsEarned, pdfBuffer } = input;

  if (!env.SMTP_USER || !env.SMTP_PASS) {
    console.warn("SMTP credentials not fully set up in .env. Skipping receipt email send.");
    return false;
  }

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: toEmail,
      subject: `Payment Receipt: ${invoiceNumber} - DevMentor`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #4f46e5; margin-top: 0;">Payment Received! 🎉</h2>
          <p>Hi <strong>${studentName}</strong>,</p>
          <p>Thank you for purchasing credits on DevMentor. Your top-up of <strong>${amount} BDT (${creditsEarned} Credits)</strong> was successfully processed via bKash.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
            <p style="margin: 5px 0;"><strong>Amount Paid:</strong> BDT ${amount.toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>Credits Added:</strong> ${creditsEarned} Credits</p>
          </div>
          <p>We have attached your official PDF payment receipt to this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 12px; color: #6b7280; text-align: center;">DevMentor Platform • High-Impact Mentorship</p>
        </div>
      `,
      attachments: [
        {
          filename: `Receipt-${invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return true;
  } catch (err) {
    console.error("❌ Failed to send receipt email via Nodemailer:", err);
    return false;
  }
};
