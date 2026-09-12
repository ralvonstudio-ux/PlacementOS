import axios from 'axios';
import { candidateProfileRepository } from './candidate-profile.repository';
import { saveCandidateProfileSchema } from './candidate-profile.validation';
import { ICandidateProfile } from './candidate-profile.model';
import { AuthContext } from '../../lib/auth-context';
import { ValidationError } from '../../middlewares/errorHandler';
import { logger } from '../../lib/logger';
import { r2Storage } from '../../lib/r2-storage';
import { resolveCandidateId } from '../candidates/candidate.service';
import type { CandidateProfile as CandidateProfileApiShape, LeetCodeBadge, LeetCodeStats } from '@placementos/types';

const toApiShape = (p: ICandidateProfile): CandidateProfileApiShape => ({
  _id: String((p as unknown as { _id: { toString(): string } })._id),
  instituteId: p.instituteId,
  candidateId: p.candidateId,
  headline: p.headline,
  summary: p.summary,
  education: p.education,
  experience: p.experience,
  projects: p.projects,
  skills: p.skills,
  links: p.links,
  leetcodeUsername: p.leetcodeUsername,
  resumeFileUrl: p.resumeFileUrl,
  createdAt: new Date(p.createdAt).toISOString(),
  updatedAt: new Date(p.updatedAt).toISOString(),
});

// Unofficial but widely-used LeetCode GraphQL endpoint — no official public API exists for
// per-user stats. Read-only, no auth needed since it only returns what a public profile page
// already shows. Best-effort: LeetCode can change this shape without notice.
const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const LEETCODE_QUERY = `
  query userProfile($username: String!) {
    allQuestionsCount { difficulty count }
    matchedUser(username: $username) {
      username
      profile { ranking }
      submitStatsGlobal {
        acSubmissionNum { difficulty count }
      }
      badges { id displayName icon }
      userCalendar {
        totalActiveDays
        submissionCalendar
      }
    }
  }
`;

/** Longest run of consecutive calendar days with at least one submission. */
function longestStreak(dayTimestamps: number[]): number {
  if (dayTimestamps.length === 0) return 0;
  const sorted = [...dayTimestamps].sort((a, b) => a - b);
  const ONE_DAY = 86_400;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    current = sorted[i] - sorted[i - 1] === ONE_DAY ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

export const candidateProfileService = {
  async getMine(ctx: AuthContext): Promise<CandidateProfileApiShape | null> {
    const candidateId = await resolveCandidateId(ctx);
    const profile = await candidateProfileRepository.findByCandidateId(candidateId, ctx.instituteId);
    return profile ? toApiShape(profile) : null;
  },

  async saveMine(rawInput: unknown, ctx: AuthContext): Promise<CandidateProfileApiShape> {
    const data = saveCandidateProfileSchema.parse(rawInput);
    const candidateId = await resolveCandidateId(ctx);
    const profile = await candidateProfileRepository.upsert(candidateId, ctx.instituteId, data);
    return toApiShape(profile);
  },

  async uploadResume(file: { buffer: Buffer; mimetype: string }, ctx: AuthContext): Promise<CandidateProfileApiShape> {
    if (!r2Storage.isConfigured()) {
      throw new ValidationError('File storage is not configured on this server yet — resume upload is unavailable.');
    }
    const candidateId = await resolveCandidateId(ctx);
    const { url } = await r2Storage.uploadToR2(file.buffer, file.mimetype, 'resumes', ctx.instituteId);
    const profile = await candidateProfileRepository.setResumeFileUrl(candidateId, ctx.instituteId, url);
    return toApiShape(profile);
  },

  /** Fetches a candidate's own LeetCode stats live — never stored, always current as of the call. */
  async getMyLeetCodeStats(ctx: AuthContext): Promise<LeetCodeStats> {
    const candidateId = await resolveCandidateId(ctx);
    const profile = await candidateProfileRepository.findByCandidateId(candidateId, ctx.instituteId);
    if (!profile?.leetcodeUsername) {
      throw new ValidationError('Add your LeetCode username to your profile first.');
    }
    return candidateProfileService.fetchLeetCodeStats(profile.leetcodeUsername);
  },

  async fetchLeetCodeStats(username: string): Promise<LeetCodeStats> {
    try {
      const res = await axios.post(
        LEETCODE_GRAPHQL_URL,
        { query: LEETCODE_QUERY, variables: { username } },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10_000 }
      );

      const matchedUser = res.data?.data?.matchedUser;
      if (!matchedUser) {
        throw new ValidationError(`No public LeetCode profile found for "${username}".`);
      }

      const solvedCounts: Record<string, number> = {};
      for (const row of matchedUser.submitStatsGlobal?.acSubmissionNum ?? []) {
        solvedCounts[row.difficulty] = row.count;
      }

      const totalCounts: Record<string, number> = {};
      for (const row of res.data?.data?.allQuestionsCount ?? []) {
        totalCounts[row.difficulty] = row.count;
      }

      const badges: LeetCodeBadge[] = (matchedUser.badges ?? []).map((b: { id: string; displayName: string; icon: string }) => ({
        id: b.id,
        name: b.displayName,
        iconUrl: b.icon?.startsWith('/') ? `https://leetcode.com${b.icon}` : b.icon,
      }));

      let submissionCalendar: Record<string, number> = {};
      try {
        submissionCalendar = JSON.parse(matchedUser.userCalendar?.submissionCalendar ?? '{}');
      } catch {
        submissionCalendar = {};
      }
      const activeDayTimestamps = Object.entries(submissionCalendar)
        .filter(([, count]) => count > 0)
        .map(([ts]) => Number(ts));

      return {
        username: matchedUser.username,
        ranking: matchedUser.profile?.ranking,
        totalSolved: solvedCounts.All ?? 0,
        totalQuestions: totalCounts.All ?? 0,
        easySolved: solvedCounts.Easy ?? 0,
        easyTotal: totalCounts.Easy ?? 0,
        mediumSolved: solvedCounts.Medium ?? 0,
        mediumTotal: totalCounts.Medium ?? 0,
        hardSolved: solvedCounts.Hard ?? 0,
        hardTotal: totalCounts.Hard ?? 0,
        badgeCount: badges.length,
        recentBadge: badges[0],
        submissionCalendar,
        totalActiveDays: matchedUser.userCalendar?.totalActiveDays ?? activeDayTimestamps.length,
        maxStreak: longestStreak(activeDayTimestamps),
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      logger.error('[CandidateProfile] LeetCode fetch failed', { username, err: err instanceof Error ? err.message : String(err) });
      throw new ValidationError('Could not reach LeetCode right now — try again shortly.');
    }
  },
};
