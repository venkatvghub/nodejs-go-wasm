import { Request, Response, Router } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../bootstrap.js';
import { Payment } from '../entity/Payment.js';
import { User } from '../entity/User.js';
import getTransformer from '../transformer/index.js';

const router = Router();
// Create variables for repositories to avoid immediate initialization
let paymentRepository: Repository<Payment>;
let userRepository: Repository<User>;

// Initialize repositories
export function initRepository() {
  paymentRepository = AppDataSource.getRepository(Payment);
  userRepository = AppDataSource.getRepository(User);
}

// Get all payments (decrypted)
router.get('/', async (req: Request, res: Response) => {
  try {
    const payments = await paymentRepository.find({
      relations: ['user']
    });
    
    // Create decrypted version of payments
    const decryptedPayments = payments.map(payment => {
      // Create a new object with the same properties
      const decryptedPayment = { ...payment };
      
      // Manually decrypt payment fields
      if (payment.card_number_key_version) {
        try {
          decryptedPayment.card_number = getTransformer().from(payment.card_number, payment.card_number_key_version);
        } catch (error) {
          console.error('Error decrypting card_number:', error);
          decryptedPayment.card_number = '[encrypted]';
        }
      }
      
      if (payment.cvv_key_version) {
        try {
          decryptedPayment.cvv = getTransformer().from(payment.cvv, payment.cvv_key_version);
        } catch (error) {
          console.error('Error decrypting cvv:', error);
          decryptedPayment.cvv = '[encrypted]';
        }
      }
      
      // Handle user fields if available
      if (payment.user) {
        const decryptedUser = { ...payment.user };
        
        if (payment.user.first_name_key_version) {
          try {
            decryptedUser.first_name = getTransformer().from(payment.user.first_name, payment.user.first_name_key_version);
          } catch (error) {
            console.error('Error decrypting user.first_name:', error);
            decryptedUser.first_name = '[encrypted]';
          }
        }
        
        if (payment.user.last_name_key_version) {
          try {
            decryptedUser.last_name = getTransformer().from(payment.user.last_name, payment.user.last_name_key_version);
          } catch (error) {
            console.error('Error decrypting user.last_name:', error);
            decryptedUser.last_name = '[encrypted]';
          }
        }
        
        if (payment.user.email_key_version) {
          try {
            decryptedUser.email = getTransformer().from(payment.user.email, payment.user.email_key_version);
          } catch (error) {
            console.error('Error decrypting user.email:', error);
            decryptedUser.email = '[encrypted]';
          }
        }
        
        decryptedPayment.user = decryptedUser;
      }
      
      return decryptedPayment;
    });
    
    res.json(decryptedPayments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get payment by ID (decrypted)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const payment = await paymentRepository.findOne({
      where: { id: parseInt(req.params.id) },
      relations: ['user']
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Create decrypted version of payment
    const decryptedPayment = { ...payment };
    
    // Manually decrypt payment fields
    if (payment.card_number_key_version) {
      try {
        decryptedPayment.card_number = getTransformer().from(payment.card_number, payment.card_number_key_version);
        console.log(`Decrypted card_number: ${decryptedPayment.card_number}`);
      } catch (error) {
        console.error('Error decrypting card_number:', error);
        decryptedPayment.card_number = '[encrypted]';
      }
    }
    
    if (payment.cvv_key_version) {
      try {
        decryptedPayment.cvv = getTransformer().from(payment.cvv, payment.cvv_key_version);
        console.log(`Decrypted cvv: ${decryptedPayment.cvv}`);
      } catch (error) {
        console.error('Error decrypting cvv:', error);
        decryptedPayment.cvv = '[encrypted]';
      }
    }
    
    // Handle user fields if available
    if (payment.user) {
      const decryptedUser = { ...payment.user };
      
      if (payment.user.first_name_key_version) {
        try {
          decryptedUser.first_name = getTransformer().from(payment.user.first_name, payment.user.first_name_key_version);
        } catch (error) {
          console.error('Error decrypting user.first_name:', error);
          decryptedUser.first_name = '[encrypted]';
        }
      }
      
      if (payment.user.last_name_key_version) {
        try {
          decryptedUser.last_name = getTransformer().from(payment.user.last_name, payment.user.last_name_key_version);
        } catch (error) {
          console.error('Error decrypting user.last_name:', error);
          decryptedUser.last_name = '[encrypted]';
        }
      }
      
      if (payment.user.email_key_version) {
        try {
          decryptedUser.email = getTransformer().from(payment.user.email, payment.user.email_key_version);
        } catch (error) {
          console.error('Error decrypting user.email:', error);
          decryptedUser.email = '[encrypted]';
        }
      }
      
      decryptedPayment.user = decryptedUser;
    }
    
    res.json(decryptedPayment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({ error: 'Failed to fetch payment', details: error instanceof Error ? error.message : String(error) });
  }
});

// Create new payment (data will be automatically encrypted)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, card_number, cvv } = req.body;
    
    if (!user_id || !card_number || !cvv) {
      return res.status(400).json({ error: 'User ID, card number, and CVV are required' });
    }
    
    // Find the user
    const user = await userRepository.findOne({
      where: { id: user_id }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('Creating payment:', { user_id, card_number: '*****', cvv: '***' });
    console.log('Encryption enabled:', process.env.ENCRYPTION_ENABLED === 'true' ? 'Yes' : 'No');
    
    // Save original values for response
    const originalValues = {
      card_number,
      cvv
    };
    
    // Create payment entity (encryption happens via subscribers)
    const payment = paymentRepository.create({
      user,
      card_number,
      cvv
    });
    
    const savedPayment = await paymentRepository.save(payment);
    
    // Check if encryption was applied
    const encryptionApplied = 
      Boolean(savedPayment.card_number_key_version) || 
      Boolean(savedPayment.cvv_key_version);
    
    console.log('Payment created with encryption:', encryptionApplied ? 'Yes' : 'No');
    
    // Return original values in response
    const responsePayment = {
      ...savedPayment,
      ...originalValues,
      user // Include user info
    };
    
    res.status(201).json(responsePayment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment', details: error instanceof Error ? error.message : String(error) });
  }
});

// Update payment (data will be automatically encrypted)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const payment = await paymentRepository.findOne({
      where: { id: parseInt(req.params.id) },
      relations: ['user']
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const { card_number, cvv } = req.body;
    console.log('Updating payment with data:', { card_number: card_number ? '*****' : undefined, cvv: cvv ? '***' : undefined });
    console.log('Encryption enabled:', process.env.ENCRYPTION_ENABLED === 'true' ? 'Yes' : 'No');
    
    // Save original values for response
    const originalValues: any = {};
    if (card_number) originalValues.card_number = card_number;
    if (cvv) originalValues.cvv = cvv;
    
    // Update payment entity (encryption happens via subscribers)
    if (card_number) payment.card_number = card_number;
    if (cvv) payment.cvv = cvv;
    
    const updatedPayment = await paymentRepository.save(payment);
    
    // Check if encryption was applied
    const encryptionApplied = 
      Boolean(updatedPayment.card_number_key_version) || 
      Boolean(updatedPayment.cvv_key_version);
    
    console.log('Payment updated with encryption:', encryptionApplied ? 'Yes' : 'No');
    
    // Return original values in response
    const responsePayment = {
      ...updatedPayment,
      ...originalValues
    };
    
    res.json(responsePayment);
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment', details: error instanceof Error ? error.message : String(error) });
  }
});

// Delete payment
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const payment = await paymentRepository.findOne({
      where: { id: parseInt(req.params.id) }
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    await paymentRepository.remove(payment);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment', details: error instanceof Error ? error.message : String(error) });
  }
});

export default router; 