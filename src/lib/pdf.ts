import PDFDocument from "pdfkit";

export interface IPaymentReceiptData {
  invoiceNumber: string;
  trxID: string;
  amount: number;
  date: Date;
  studentName: string;
  studentEmail: string;
}

// Generates a branded payment receipt PDF as a Node.js Buffer array.
export const generatePaymentReceiptPDF = (data: IPaymentReceiptData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      doc
        .fillColor("#4F46E5")
        .fontSize(24)
        .text("Kōdex / DevMentor", { align: "left" })
        .fontSize(10)
        .fillColor("#6B7280")
        .text("Official Payment Receipt", { align: "left" })
        .moveDown();

      doc
        .strokeColor("#E5E7EB")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1.5);

      doc
        .fillColor("#111827")
        .fontSize(14)
        .text(`Receipt #: ${data.invoiceNumber}`)
        .fontSize(10)
        .fillColor("#4B5563")
        .text(`Transaction ID (TrxID): ${data.trxID}`)
        .text(`Date: ${data.date.toLocaleString()}`)
        .text(`Status: COMPLETED (PAID via bKash)`)
        .moveDown();

      doc
        .fillColor("#111827")
        .fontSize(12)
        .text("Billed To:")
        .fontSize(10)
        .fillColor("#4B5563")
        .text(`Student Name: ${data.studentName}`)
        .text(`Email: ${data.studentEmail}`)
        .moveDown(1.5);

      const tableTop = doc.y;
      doc
        .fillColor("#374151")
        .fontSize(10)
        .text("Description", 50, tableTop)
        .text("Payment Gateway", 300, tableTop)
        .text("Amount (BDT)", 450, tableTop, { align: "right" });

      doc
        .moveTo(50, tableTop + 15)
        .lineTo(545, tableTop + 15)
        .stroke();

      const itemTop = tableTop + 25;
      doc
        .fillColor("#111827")
        .text("DevMentor Credit Top-Up", 50, itemTop)
        .text("bKash PGW", 300, itemTop)
        .text(`৳${data.amount.toFixed(2)}`, 450, itemTop, { align: "right" });

      doc
        .moveTo(50, itemTop + 20)
        .lineTo(545, itemTop + 20)
        .stroke()
        .moveDown(2);

      doc
        .fillColor("#4F46E5")
        .fontSize(14)
        .text(`Total Credits Added: ${data.amount} Credits`, { align: "right" })
        .moveDown(2);

      doc
        .fillColor("#9CA3AF")
        .fontSize(9)
        .text("Thank you for learning with DevMentor! If you have questions regarding this receipt, please contact support@devmentor.com.", 50, doc.y, {
          align: "center",
          width: 495,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
