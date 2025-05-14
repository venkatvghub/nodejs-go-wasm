import { Request, Response, Router } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../bootstrap.js';
import { User } from '../entity/User.js';
import getTransformer from '../transformer/index.js';

const router = Router();
// Create a function that returns the repository to avoid immediate initialization
let userRepository: Repository<User>;

// Initialize repository
export function initRepository() {
  userRepository = AppDataSource.getRepository(User);
}

// Get all users (decrypted)
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await userRepository.find();
    
    // Manually create a decrypted version of the response
    const decryptedUsers = users.map(user => {
      // Create a new object with the same properties
      const decryptedUser = { ...user };
      
      // Manually decrypt fields if they have a key version
      if (user.first_name_key_version) {
        try {
          decryptedUser.first_name = getTransformer().from(user.first_name, user.first_name_key_version);
        } catch (error) {
          console.error('Error decrypting first_name:', error);
          decryptedUser.first_name = '[encrypted]';
        }
      }
      
      if (user.last_name_key_version) {
        try {
          decryptedUser.last_name = getTransformer().from(user.last_name, user.last_name_key_version);
        } catch (error) {
          console.error('Error decrypting last_name:', error);
          decryptedUser.last_name = '[encrypted]';
        }
      }
      
      if (user.email_key_version) {
        try {
          decryptedUser.email = getTransformer().from(user.email, user.email_key_version);
        } catch (error) {
          console.error('Error decrypting email:', error);
          decryptedUser.email = '[encrypted]';
        }
      }
      
      return decryptedUser;
    });
    
    res.json(decryptedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID (decrypted)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await userRepository.findOne({
      where: { id: req.params.id }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create a decrypted version of the user
    const decryptedUser = { ...user };
    
    // Manually decrypt fields if they have a key version
    if (user.first_name_key_version) {
      try {
        decryptedUser.first_name = getTransformer().from(user.first_name, user.first_name_key_version);
        console.log(`Decrypted first_name: "${decryptedUser.first_name}"`);
      } catch (error) {
        console.error('Error decrypting first_name:', error);
        decryptedUser.first_name = '[encrypted]';
      }
    }
    
    if (user.last_name_key_version) {
      try {
        decryptedUser.last_name = getTransformer().from(user.last_name, user.last_name_key_version);
        console.log(`Decrypted last_name: "${decryptedUser.last_name}"`);
      } catch (error) {
        console.error('Error decrypting last_name:', error);
        decryptedUser.last_name = '[encrypted]';
      }
    }
    
    if (user.email_key_version) {
      try {
        decryptedUser.email = getTransformer().from(user.email, user.email_key_version);
        console.log(`Decrypted email: "${decryptedUser.email}"`);
      } catch (error) {
        console.error('Error decrypting email:', error);
        decryptedUser.email = '[encrypted]';
      }
    }
    
    res.json(decryptedUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user (data will be automatically encrypted)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email } = req.body;
    
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }
    
    console.log('Creating user:', { first_name, last_name, email });
    console.log('Encryption enabled:', process.env.ENCRYPTION_ENABLED === 'true' ? 'Yes' : 'No');
    
    // Save the original values to return in the response
    const originalValues = {
      first_name,
      last_name,
      email
    };
    
    // Create and save the user entity (encryption happens via subscribers)
    const user = userRepository.create({
      first_name,
      last_name,
      email
    });
    
    const savedUser = await userRepository.save(user);
    
    // Check if encryption was applied
    const encryptionApplied = 
      Boolean(savedUser.first_name_key_version) || 
      Boolean(savedUser.last_name_key_version) || 
      Boolean(savedUser.email_key_version);
    
    console.log('User created with encryption:', encryptionApplied ? 'Yes' : 'No');
    
    // Return a response with the original plaintext values
    const responseUser = {
      ...savedUser,
      ...originalValues
    };
    
    res.status(201).json(responseUser);
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// Update user (data will be automatically encrypted)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = await userRepository.findOne({
      where: { id: req.params.id }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const { first_name, last_name, email } = req.body;
    console.log('Updating user with data:', { first_name, last_name, email });
    console.log('Encryption enabled:', process.env.ENCRYPTION_ENABLED === 'true' ? 'Yes' : 'No');
    
    // Save the original values to return in the response
    const originalValues: any = {};
    if (first_name) originalValues.first_name = first_name;
    if (last_name) originalValues.last_name = last_name;
    if (email) originalValues.email = email;
    
    // Update the user entity (encryption happens via subscribers)
    if (first_name) user.first_name = first_name;
    if (last_name) user.last_name = last_name;
    if (email) user.email = email;
    
    const updatedUser = await userRepository.save(user);
    
    // Check if encryption was applied
    const encryptionApplied = 
      Boolean(updatedUser.first_name_key_version) || 
      Boolean(updatedUser.last_name_key_version) || 
      Boolean(updatedUser.email_key_version);
    
    console.log('User updated with encryption:', encryptionApplied ? 'Yes' : 'No');
    
    // Return a response with the original plaintext values
    const responseUser = {
      ...updatedUser,
      ...originalValues
    };
    
    res.json(responseUser);
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// Delete user
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await userRepository.findOne({
      where: { id: req.params.id }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await userRepository.remove(user);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router; 