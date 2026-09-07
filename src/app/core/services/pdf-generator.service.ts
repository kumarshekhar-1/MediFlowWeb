import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Prescription, Invoice } from '../models/clinic.models';

@Injectable({
  providedIn: 'root'
})
export class PdfGeneratorService {

  /**
   * Generates a Medical Prescription PDF with AutoTable
   */
  generatePrescriptionPdf(rx: Prescription, options: { action: 'download' | 'print' | 'blob' } = { action: 'download' }): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryNavy = [11, 21, 46];     // #0b152e
    const sapphireBlue = [30, 58, 138];   // #1e3a8a
    const textDark = [15, 23, 42];        // #0f172a
    const lightBg = [241, 245, 249];      // #f1f5f9
    const accentGreen = [5, 150, 105];    // #059669

    // --- Header Banner (Clinic Branding) ---
    doc.setFillColor(11, 21, 46);
    doc.rect(0, 0, 210, 32, 'F');

    // Accent line
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 32, 210, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(rx.clinicName || 'Apollo Care Polyclinic', 14, 14);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('Smart Healthcare & Digital Consultation Network • NABH Accredited', 14, 20);
    doc.text('Contact: +91 80 4123 4567 • Emergency: 108 • support@mediflow.health', 14, 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('DIGITAL Rx', 196, 14, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${rx.prescriptionNumber}`, 196, 20, { align: 'right' });
    doc.text(`Date: ${new Date(rx.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 196, 25, { align: 'right' });

    // --- Doctor & Patient Demographics Cards ---
    let y = 42;

    // Doctor Meta (Left)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 88, 30, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 88, 30, 2, 2, 'S');

    doc.setTextColor(11, 21, 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(rx.doctorName, 18, y + 8);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 58, 138);
    doc.text(rx.doctorSpecialization, 18, y + 14);
    doc.setTextColor(100, 116, 139);
    doc.text(`Reg No: ${rx.doctorRegNo || 'KMC-78492-2016'}`, 18, y + 20);
    doc.text('Consultant Physician & Surgeon', 18, y + 25);

    // Patient Meta (Right)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(108, y, 88, 30, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(108, y, 88, 30, 2, 2, 'S');

    doc.setTextColor(11, 21, 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Patient: ${rx.patientName}`, 112, y + 8);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Age / Gender: ${rx.patientAge || '30'} yrs • ${rx.patientGender || 'Male'}`, 112, y + 14);
    doc.text(`Rx ID: ${rx.prescriptionNumber}`, 112, y + 20);
    doc.text(`Issued On: ${new Date(rx.issuedAt).toLocaleString()}`, 112, y + 25);

    y += 36;

    // --- Clinical Assessment Bar ---
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, y, 182, 18, 2, 2, 'F');
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(14, y, 182, 18, 2, 2, 'S');

    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CLINICAL DIAGNOSIS:', 18, y + 7);
    doc.setTextColor(11, 21, 46);
    doc.setFontSize(10.5);
    doc.text(rx.diagnosis || 'Clinical Assessment', 60, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Chief Symptoms:', 18, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(rx.symptoms && rx.symptoms.length ? rx.symptoms.join(', ') : 'As discussed in clinical consultation', 48, y + 13);

    y += 24;

    // --- Rx Symbol & Section Title ---
    doc.setTextColor(11, 21, 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Rx  Prescribed Medications', 14, y);

    y += 3;

    // --- AutoTable for Rx Medications ---
    const tableBody = rx.items.map((it, idx) => [
      `${idx + 1}`,
      `${it.medicineName}\n(${it.genericName || it.strength})`,
      it.form || 'Tablet',
      it.dosage || '1 unit',
      it.frequency,
      it.duration,
      it.route || 'Oral',
      it.instructions || 'After meals'
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['#', 'Medicine & Composition', 'Form', 'Dosage', 'Frequency', 'Duration', 'Route', 'Special Instructions']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [11, 21, 46],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 3
      },
      styles: {
        fontSize: 8,
        textColor: [15, 23, 42],
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.2
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { fontStyle: 'bold', cellWidth: 44 },
        2: { cellWidth: 16 },
        3: { cellWidth: 16 },
        4: { fontStyle: 'bold', textColor: [30, 58, 138], cellWidth: 32 },
        5: { fontStyle: 'bold', cellWidth: 18 },
        6: { cellWidth: 16 },
        7: { cellWidth: 32 }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    // Get table bottom position
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : y + 60;

    // --- Advice, Dietary Instructions & Follow-up ---
    let adviceY = finalY;

    if (adviceY > 230) {
      doc.addPage();
      adviceY = 20;
    }

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, adviceY, 182, 28, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, adviceY, 182, 28, 2, 2, 'S');

    doc.setTextColor(11, 21, 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Doctor\'s General Advice & Dietary Guidelines:', 18, adviceY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const adviceLines = rx.advice && rx.advice.length ? rx.advice.map(a => `• ${a}`).join('   ') : '• Drink adequate warm water   • Adequate rest   • Take medications as scheduled';
    doc.text(adviceLines, 18, adviceY + 13, { maxWidth: 174 });

    if (rx.customAdvice) {
      doc.text(`Special Note: ${rx.customAdvice}`, 18, adviceY + 19, { maxWidth: 174 });
    }

    // Follow-up Highlight
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(18, adviceY + 21, 100, 5, 1, 1, 'F');
    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`Next Follow-up: ${rx.followUpDate || `In ${rx.followUpDays || 5} Days`} (or SOS if symptoms worsen)`, 20, adviceY + 24.5);

    // --- Signature & Stamp Block ---
    const sigY = adviceY + 34;

    doc.setDrawColor(203, 213, 225);
    doc.line(134, sigY + 12, 196, sigY + 12);

    doc.setTextColor(11, 21, 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(rx.doctorName, 165, sigY + 16, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Digitally Verified & Authorized Signature', 165, sigY + 20, { align: 'center' });
    doc.text(`License No: ${rx.doctorRegNo || 'KMC-78492-2016'}`, 165, sigY + 24, { align: 'center' });

    // --- Bottom Disclaimer Footer ---
    doc.setFillColor(11, 21, 46);
    doc.rect(0, 287, 210, 10, 'F');
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(7);
    doc.text('This is an electronically generated and digitally signed medical prescription compliant with Telemedicine & EHR Standards.', 105, 293, { align: 'center' });

    this.handleDocOutput(doc, `Prescription_${rx.prescriptionNumber || 'Doc'}.pdf`, options.action);
    return doc;
  }

  /**
   * Generates a Clinic Tax Invoice / Bill Receipt PDF with AutoTable
   */
  generateInvoicePdf(inv: Invoice, options: { action: 'download' | 'print' | 'blob' } = { action: 'download' }): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // --- Header ---
    doc.setFillColor(11, 21, 46);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 32, 210, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Apollo Care Polyclinic', 14, 14);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('GSTIN: 29AABCB1234F1Z5 • Outpatient Clinical Billing & Pharmacy Services', 14, 20);
    doc.text('Indiranagar 100ft Road, Bengaluru, KA 560038 • Ph: +91 80 4123 4567', 14, 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TAX INVOICE', 196, 14, { align: 'right' });
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice: ${inv.invoiceNumber}`, 196, 20, { align: 'right' });
    doc.text(`Date: ${new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 196, 25, { align: 'right' });

    // --- Bill To & Meta ---
    let y = 42;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 88, 26, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 88, 26, 2, 2, 'S');

    doc.setTextColor(11, 21, 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Billed To: ${inv.patientName}`, 18, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Patient ID: ${inv.patientId}`, 18, y + 14);
    doc.text('Status: Outpatient Consultation', 18, y + 20);

    // Payment Meta (Right)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(108, y, 88, 26, 2, 2, 'F');
    doc.roundedRect(108, y, 88, 26, 2, 2, 'S');

    doc.setTextColor(11, 21, 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Payment Status: PAID', 112, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Payment Mode: ${inv.paymentMethod || 'UPI Instant'}`, 112, y + 14);
    doc.text(`Txn Ref: ${inv.transactionRef || 'UPI-' + Math.random().toString(36).substring(2, 9).toUpperCase()}`, 112, y + 20);

    y += 32;

    // --- AutoTable for Invoice Items ---
    const tableData = inv.items.map((it, idx) => [
      `${idx + 1}`,
      it.description,
      `${it.quantity}`,
      `₹${it.unitPrice.toFixed(2)}`,
      `₹${it.amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['#', 'Item Description / Service', 'Qty', 'Unit Price', 'Total Amount (INR)']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [11, 21, 46],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8.5,
        textColor: [15, 23, 42],
        cellPadding: 3.5
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { fontStyle: 'bold', cellWidth: 100 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 26 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 28 }
      }
    });

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : y + 60;

    // --- Summary & Total Breakdown ---
    const totalBoxX = 114;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(totalBoxX, finalY, 82, 34, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(totalBoxX, finalY, 82, 34, 2, 2, 'S');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Subtotal:', totalBoxX + 6, finalY + 8);
    doc.text(`₹${inv.subtotal.toFixed(2)}`, totalBoxX + 76, finalY + 8, { align: 'right' });

    doc.text('Clinic Discount:', totalBoxX + 6, finalY + 15);
    doc.text(`- ₹${(inv.discount || 0).toFixed(2)}`, totalBoxX + 76, finalY + 15, { align: 'right' });

    doc.setDrawColor(191, 219, 254);
    doc.line(totalBoxX + 6, finalY + 20, totalBoxX + 76, finalY + 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 21, 46);
    doc.text('Total Paid:', totalBoxX + 6, finalY + 28);
    doc.setTextColor(5, 150, 105);
    doc.text(`₹${(inv.total || inv.subtotal || 0).toFixed(2)}`, totalBoxX + 76, finalY + 28, { align: 'right' });

    // Terms (Left)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(11, 21, 46);
    doc.text('Terms & Conditions:', 14, finalY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('1. All fees paid are non-refundable.\n2. Invoices are valid for medical insurance reimbursement claim.\n3. For billing support, contact billing@apollo-clinic.com', 14, finalY + 14);

    // Footer
    doc.setFillColor(11, 21, 46);
    doc.rect(0, 287, 210, 10, 'F');
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(7);
    doc.text('Thank you for choosing MediFlow Clinic OS • System Generated Computer Receipt', 105, 293, { align: 'center' });

    this.handleDocOutput(doc, `Invoice_${inv.invoiceNumber}.pdf`, options.action);
    return doc;
  }

  /**
   * Helper to download or trigger print
   */
  private handleDocOutput(doc: jsPDF, filename: string, action: 'download' | 'print' | 'blob') {
    if (action === 'download') {
      doc.save(filename);
    } else if (action === 'print') {
      const blobUrl = doc.output('bloburl');
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl.toString();
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
      };
    }
  }
}
