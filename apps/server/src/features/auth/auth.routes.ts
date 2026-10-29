import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middlewares/authenticate';
import { authLimiter, authAccountLimiter, registerLimiter, refreshLimiter } from '../../middlewares/rateLimiter';
import { env } from '../../config/env';

const router = Router();

// Public — rate limited.
router.post('/register', registerLimiter, authController.register);
router.post('/login', authLimiter, authAccountLimiter, authController.login);
router.post('/refresh', refreshLimiter, authController.refresh);
// Forgot password — the per-account limiter keys on `identifier`, capping codes and guesses per account.
router.post('/forgot-password', authLimiter, authAccountLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authAccountLimiter, authController.resetPassword);

// Dev-only seed endpoint.
if (env.NODE_ENV === 'development') {
  router.post('/seed', authController.seed);
}

// Protected
router.get('/me', authenticate, authController.me);
router.patch('/me', authenticate, authController.updateMe);
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);

export default router;
