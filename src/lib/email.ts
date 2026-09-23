import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export interface ISendReceiptEmailInput {
  toEmail: string;
  studentName: string;
  invoiceNumber: string;
  amount: number;
  pdfBuffer: Buffer;
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


export const sendPaymentReceiptEmail = async (input: ISendReceiptEmailInput): Promise<boolean> => {
  const { toEmail, studentName, invoiceNumber, amount, pdfBuffer } = input;

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
          <p>Thank you for purchasing credits on DevMentor. Your top-up of <strong>${amount} BDT (${amount} Credits)</strong> was successfully processed via bKash.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
            <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ৳${amount.toFixed(2)} BDT</p>
            <p style="margin: 5px 0;"><strong>Credits Added:</strong> ${amount} Credits</p>
          </div>
          <p>We have attached your official PDF payment receipt to this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 12px; color: #6b7280; text-align: center;">Kōdex DevMentor Platform • High-Impact Mentorship</p>
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
