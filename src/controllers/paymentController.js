import { Invoice } from '../models/Invoice.js';
import { User } from '../models/User.js';
import { generateInvoicePdf } from '../services/invoicePdfService.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

export const downloadInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ 
      _id: req.params.id, 
      userId: req.user._id 
    });
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    const user = await User.findById(invoice.userId).select('fullName email');

    const buffer = await generateInvoicePdf(invoice, user);

    // Persist a shareable copy (best-effort; does not block the download).
    if (!invoice.pdfUrl) {
      try {
        const result = await uploadToCloudinary(
          buffer,
          `invoice-${invoice.invoiceNumber}.pdf`,
          'application/pdf'
        );
        invoice.pdfUrl = result.secure_url;
        await invoice.save();
      } catch (uploadErr) {
        console.error('Failed to persist invoice PDF:', uploadErr.message);
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`
    );
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to download invoice',
      error: error.message
    });
  }
};