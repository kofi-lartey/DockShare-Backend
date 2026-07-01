import app from './src/app.js';

const PORT = process.env.PORT || 5678;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Health check at http://localhost:${PORT}/health`);
});