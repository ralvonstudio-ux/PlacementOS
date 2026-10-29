import bcrypt from 'bcrypt';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { sendEmail } from '../../lib/mailer';
import { userRepository } from '../users/user.repository';
import { Candidate } from '../candidates/candidate.model';
import { Institute } from '../institutes/institute.model';
import { PasswordReset } from './password-reset.model';
import { ValidationError } from '../../middlewares/errorHandler';
import { resetCodeEmail, passwordChangedEmail } from './password-reset.emails';
import type { IUser } from '../users/user.model';

const SALT_ROUNDS = 12;
const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;
// Bulk-created student logins get a placeholder address that can't receive mail.
const PLACEHOLDER_DOMAIN = '@students.placementos.local';

const forgotSchema = z.object({ identifier: z.string().trim().min(1, 'Enter your email or roll number').max(200) });
const resetSchema = z.object({
  identifier: z.string().trim().min(1).max(200),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

const hashCode = (userId: string, code: string) => createHmac('sha256', env.JWT_ACCESS_SECRET).update(`${userId}:${code}`).digest('hex');
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Web app origin for links in emails — FRONTEND_URL may list several, the first is canonical. */
const appUrl = () => env.FRONTEND_URL.split(',')[0].trim().replace(/\/$/, '');

async function findUser(identifier: string): Promise<IUser | null> {
  const id = identifier.trim().toLowerCase();
  const user = id.includes('@') ? await userRepository.findByEmail(id) : await userRepository.findByUsername(id);
  return user && user.status === 'active' ? user : null;
}

/** Where the code can actually be delivered: the login email when it's real, otherwise a
 *  student's own email from their record. */
async function deliveryAddress(user: IUser): Promise<string | null> {
  if (!user.email.endsWith(PLACEHOLDER_DOMAIN)) return user.email;
  if (user.role !== 'candidate') return null;
  const candidate = (await Candidate.findOne({ instituteId: user.instituteId, loginEmail: user.email, isDeleted: false }).select('email').lean()) as { email?: string } | null;
  return candidate?.email?.trim() || null;
}

async function brandFor(instituteId: string) {
  const institute = (await Institute.findById(instituteId).select('name').lean().catch(() => null)) as { name?: string } | null;
  return {
    instituteName: institute?.name ?? env.INSTITUTE_NAME,
    supportLine: 'Questions? Contact your Training & Placement Cell.',
  };
}

export const passwordResetService = {
  /** Emails a 6-digit code. Always resolves the same way whether or not the account exists, so
   *  the endpoint can't be used to find out who has an account. */
  async requestCode(rawInput: unknown): Promise<void> {
    const { identifier } = forgotSchema.parse(rawInput);
    const user = await findUser(identifier);
    if (!user) {
      logger.info('Password reset requested for unknown or inactive account');
      return;
    }
    const userId = String(user._id);

    const existing = await PasswordReset.findOne({ userId });
    if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) return;

    const to = await deliveryAddress(user);
    if (!to) {
      logger.warn('Password reset: no deliverable email on file', { userId });
      return;
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const now = new Date();
    await PasswordReset.findOneAndUpdate(
      { userId },
      { $set: { codeHash: hashCode(userId, code), expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000), attempts: 0, lastSentAt: now } },
      { upsert: true }
    );

    await sendEmail(
      resetCodeEmail({
        to,
        firstName: user.firstName,
        code,
        expiresMinutes: CODE_TTL_MINUTES,
        resetUrl: `${appUrl()}/forgot-password?step=code&id=${encodeURIComponent(identifier.trim())}`,
        ...(await brandFor(user.instituteId)),
      })
    );
    logger.info('Password reset code sent', { userId });
  },

  /** Checks the code and sets the new password; every other session is signed out. */
  async resetWithCode(rawInput: unknown): Promise<void> {
    const { identifier, code, newPassword } = resetSchema.parse(rawInput);
    const invalid = () => new ValidationError('That code is invalid or has expired. Request a new one.');

    const user = await findUser(identifier);
    if (!user) throw invalid();
    const userId = String(user._id);

    const reset = await PasswordReset.findOne({ userId });
    if (!reset || reset.expiresAt.getTime() < Date.now()) throw invalid();
    if (reset.attempts >= MAX_ATTEMPTS) {
      await PasswordReset.deleteOne({ userId });
      throw new ValidationError('Too many wrong attempts. Request a new code.');
    }
    if (!sameHash(reset.codeHash, hashCode(userId, code))) {
      await PasswordReset.updateOne({ userId }, { $inc: { attempts: 1 } });
      const left = MAX_ATTEMPTS - reset.attempts - 1;
      throw new ValidationError(left > 0 ? `That code is incorrect — ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new code.');
    }

    // updatePassword also bumps tokenVersion, revoking every existing session's refresh token.
    await userRepository.updatePassword(userId, await bcrypt.hash(newPassword, SALT_ROUNDS));
    await PasswordReset.deleteOne({ userId });
    logger.info('Password reset completed', { userId });

    const to = await deliveryAddress(user);
    if (to) {
      await sendEmail(passwordChangedEmail({ to, firstName: user.firstName, when: new Date(), loginUrl: `${appUrl()}/login`, ...(await brandFor(user.instituteId)) }));
    }
  },
};
