import { Test, TestAttempt, TestAssignment } from './test.model';
import { logger } from '../../lib/logger';

/** One-time, self-applying, idempotent migration from the old shape (batch/scheduledAt/access
 *  code living directly on Test, with status including 'published'/'closed') to the new shape
 *  (Test is a reusable paper; a separate TestAssignment carries batch/schedule/access
 *  code/active-closed per sendout).
 *
 *  Idempotency: `Test.find({ batch: { $exists: true } })` is both the "needs migrating" filter
 *  and the completion signal, since step 3 below `$unset`s `batch` from every doc it touches —
 *  a second run simply finds nothing. Safe under concurrent serverless cold starts because the
 *  per-test assignment upsert is guarded by the partial unique index on
 *  `{ testId: 1 }` where `migratedFromLegacy: true` (see test.model.ts) — two racing instances
 *  converge on the same single assignment doc instead of creating duplicates. */
export async function migrateLegacyTests(): Promise<void> {
  const legacy = await Test.find({ batch: { $exists: true } }).lean<
    Array<{ _id: unknown; instituteId: string; batch: string; scheduledAt?: Date; accessCodeHash?: string; accessCodeIssuedAt?: Date; status: string; createdBy: string }>
  >();
  if (legacy.length === 0) return;

  let migrated = 0;
  for (const test of legacy) {
    const testId = String(test._id);
    const hadRollout = test.status === 'published' || test.status === 'closed';

    if (hadRollout) {
      const assignment = await TestAssignment.findOneAndUpdate(
        { testId, migratedFromLegacy: true },
        {
          $setOnInsert: {
            instituteId: test.instituteId,
            testId,
            targetType: 'batch',
            batch: test.batch,
            scheduledAt: test.scheduledAt,
            accessCodeHash: test.accessCodeHash,
            accessCodeIssuedAt: test.accessCodeIssuedAt,
            status: test.status === 'closed' ? 'closed' : 'active',
            migratedFromLegacy: true,
            createdBy: test.createdBy,
          },
        },
        { upsert: true, new: true }
      );

      await TestAttempt.updateMany(
        { testId, assignmentId: { $exists: false } },
        { $set: { assignmentId: String(assignment!._id) } }
      );
    }

    await Test.updateOne(
      { _id: test._id },
      {
        $unset: { batch: '', scheduledAt: '', accessCodeHash: '', accessCodeIssuedAt: '' },
        $set: { status: hadRollout ? 'approved' : test.status },
      }
    );
    migrated += 1;
  }

  logger.info('Migrated legacy tests to assignments', { count: migrated });
}
