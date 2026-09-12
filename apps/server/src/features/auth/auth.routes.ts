import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authLimiter, authAccountLimiter } from '../../middlewares/rateLimiter';
import { env } from '../../config/env';

const router = Router();

// Public — rate limited.
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authAccountLimiter, authController.login);
router.post('/refresh', authLimiter, authController.refresh);

// Dev-only seed endpoint.
if (env.NODE_ENV === 'development') {
  router.post('/seed', authController.seed);
}

// Protected
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);

export default router;
