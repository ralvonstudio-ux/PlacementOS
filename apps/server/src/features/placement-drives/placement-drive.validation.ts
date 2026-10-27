import { z } from 'zod';

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), 'Invalid date');

const stringList = z.array(z.string().trim().min(1)).default([]);

export const driveSchema = z
  .object({
    companyName: z.string().trim().min(1, 'Company name is required').max(120),
    companyWebsite: z.string().trim().max(300).optional(),
    roleTitle: z.string().trim().min(1, 'Role is required').max(120),
    description: z.string().trim().max(5000).optional(),
    jobType: z.enum(['full_time', 'internship', 'internship_ppo']),
    ctcLpa: z.number().min(0).max(500).optional(),
    stipendPerMonth: z.number().min(0).optional(),
    location: z.string().trim().max(200).optional(),
    eligibility: z
      .object({
        minCgpa: z.number().min(0).max(10).optional(),
        maxBacklogs: z.number().int().min(0).optional(),
        departments: stringList,
        batches: stringList,
        placementYears: stringList,
        excludePlaced: z.boolean().default(true),
      })
      .default({}),
    rounds: z
      .array(
        z.object({
          name: z.string().trim().min(1, 'Round name is required').max(80),
          type: z.enum(['aptitude', 'technical', 'coding', 'group_discussion', 'interview', 'hr', 'other']).default('other'),
          scheduledAt: optionalDate,
        })
      )
      .max(10)
      .default([]),
    applicationDeadline: optionalDate,
    driveDate: optionalDate,
  });

export const updateDriveSchema = driveSchema.partial();

export const setDriveStatusSchema = z.object({
  status: z.enum(['draft', 'open', 'closed', 'completed']),
});

const applicationIds = z.array(z.string().min(1)).min(1, 'Select at least one applicant').max(1000);

export const recordRoundResultSchema = z.object({
  applicationIds,
  roundIndex: z.number().int().min(0),
  result: z.enum(['pending', 'cleared', 'rejected', 'absent']),
});

export const setApplicationStatusSchema = z.object({
  applicationIds,
  status: z.enum(['applied', 'shortlisted', 'selected', 'rejected']),
  offerCtcLpa: z.number().min(0).max(500).optional(),
});

export const statsQuerySchema = z.object({
  placementYear: z.string().trim().optional(),
});

export type DriveInput = z.infer<typeof driveSchema>;
