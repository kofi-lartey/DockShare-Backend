export const validateRegistration = ({ fullName, email, password, confirmPassword, terms }) => {
  const errors = [];

  if (!fullName || fullName.length < 2) {
    errors.push({ field: 'fullName', message: 'Full name must be at least 2 characters' });
  }
  if (!email || !email.includes('@')) {
    errors.push({ field: 'email', message: 'Please enter a valid email address' });
  }
  if (!password || password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }
  if (!confirmPassword || password !== confirmPassword) {
    errors.push({ field: 'confirmPassword', message: "Passwords don't match" });
  }
  if (!terms) {
    errors.push({ field: 'terms', message: 'You must accept the terms and conditions' });
  }

  return errors.length > 0 ? errors : null;
};

export const validateLogin = ({ email, password }) => {
  const errors = [];

  if (!email || !email.includes('@')) {
    errors.push({ field: 'email', message: 'Please enter a valid email address' });
  }
  if (!password || password.length < 1) {
    errors.push({ field: 'password', message: 'Password is required' });
  }

  return errors.length > 0 ? errors : null;
};

export const validatePassword = ({ password, confirmPassword }) => {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  }
  if (!confirmPassword || password !== confirmPassword) {
    errors.push({ field: 'confirmPassword', message: "Passwords don't match" });
  }

  return errors.length > 0 ? errors : null;
};

export const validateProfileUpdate = ({ fullName, email, bio }) => {
  const errors = [];

  if (fullName && fullName.length < 2) {
    errors.push({ field: 'fullName', message: 'Full name must be at least 2 characters' });
  }
  if (email && (!email.includes('@') || !email.includes('.'))) {
    errors.push({ field: 'email', message: 'Please enter a valid email address' });
  }
  if (bio && bio.length > 500) {
    errors.push({ field: 'bio', message: 'Bio must be less than 500 characters' });
  }

  return errors.length > 0 ? errors : null;
};

export const validatePasswordChange = ({ currentPassword, newPassword, confirmPassword }) => {
  const errors = [];

  if (!currentPassword || currentPassword.length < 1) {
    errors.push({ field: 'currentPassword', message: 'Current password is required' });
  }
  if (!newPassword || newPassword.length < 8) {
    errors.push({ field: 'newPassword', message: 'Password must be at least 8 characters' });
  }
  if (!confirmPassword || newPassword !== confirmPassword) {
    errors.push({ field: 'confirmPassword', message: "Passwords don't match" });
  }

  return errors.length > 0 ? errors : null;
};

export const validateFileUpload = ({ fileName, fileSize, fileType, requirePassword, password }) => {
  const errors = [];

  if (!fileName) {
    errors.push({ field: 'fileName', message: 'File name is required' });
  }
  if (!fileSize || fileSize < 1) {
    errors.push({ field: 'fileSize', message: 'File size is required' });
  }
  if (requirePassword && password && password.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters' });
  }

  return errors.length > 0 ? errors : null;
};