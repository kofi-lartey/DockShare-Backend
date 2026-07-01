export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: messages
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      message: `${field} already exists`
    });
  }
  
  if (err.message === 'File type not allowed') {
    return res.status(400).json({
      success: false,
      message: 'File type not allowed'
    });
  }
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error'
  });
};