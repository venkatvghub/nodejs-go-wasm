import 'dotenv/config';
import express, { Request, Response } from 'express';
import { initDataSource } from './bootstrap.js';
import routes, { initRepositories } from './routes/index.js';

(async () => {
  try {
    // Initialize data source first
    await initDataSource();
    console.log('DataSource initialized successfully');
    
    // Initialize repositories after DataSource is ready
    initRepositories();
    
    // Create and configure Express app
    const app = express();
    
    // Middleware to parse JSON requests
    app.use(express.json());
    
    // Base route
    app.get('/', (_: Request, res: Response) => {
      res.send('PII Encryption Service running');
    });
    
    // API routes
    app.use('/api', routes);
    
    // Start server
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log('Server listening on port', port));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
