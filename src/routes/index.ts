import { Router } from 'express';
import { AppDataSource } from '../bootstrap.js';
import paymentRoutes, { initRepository as initPaymentRepository } from './payments.js';
import userRoutes, { initRepository as initUserRepository } from './users.js';

const router = Router();

// Initialize repositories function
export function initRepositories() {
  // Make sure AppDataSource is initialized
  if (!AppDataSource || !AppDataSource.isInitialized) {
    throw new Error('DataSource not initialized when setting up routes');
  }
  
  // Initialize repositories
  initUserRepository();
  initPaymentRepository();
  console.log('Repositories initialized successfully');
}

router.use('/users', userRoutes);
router.use('/payments', paymentRoutes);

export default router; 