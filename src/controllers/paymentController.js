import { Invoice } from '../models/Invoice.js';
import { User } from '../models/User.js';

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
    
    res.json({
      success: true,
      data: { ...invoice.toObject(), userId: user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to download invoice',
      error: error.message
    });
  }
};