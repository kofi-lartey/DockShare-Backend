import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { connectDB } from './config/database.js';
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from './routes/authRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import userRoutes from './routes/userRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import ogRoutes from './routes/ogRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { corsMiddleware } from './config/cors.js';

dotenv.config();

const app = express();

app.set('trust proxy', 1);

connectDB();

app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/og', ogRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.1.0'
  });
});

app.use(errorHandler);

export default app;