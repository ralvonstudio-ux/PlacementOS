import { z } from 'zod';

const educationSchema = z.object({
  degree: z.string().min(1).trim(),
  institution: z.string().min(1).trim(),
  year: z.string().min(1).trim(),
  score: z.string().trim().optional(),
});

const experienceSchema = z.object({
  company: z.string().min(1).trim(),
  role: z.string().min(1).trim(),
  duration: z.string().min(1).trim(),
  description: z.string().trim().max(500).optional(),
});

const projectSchema = z.object({
  title: z.string().min(1).trim(),
  description: z.string().trim().max(500).optional(),
  techStack: z.array(z.string()).default([]),
  link: z.string().trim().optional(),
});

const linksSchema = z.object({
  github: z.string().trim().optional(),
  linkedin: z.string().trim().optional(),
  portfolio: z.string().trim().optional(),
});

export const saveCandidateProfileSchema = z.object({
  headline: z.string().trim().max(150).optional(),
  summary: z.string().trim().max(1000).optional(),
  education: z.array(educationSchema).optional(),
  experience: z.array(experienceSchema).optional(),
  projects: z.array(projectSchema).optional(),
  skills: z.array(z.string().trim()).optional(),
  links: linksSchema.optional(),
  leetcodeUsername: z.string().trim().optional(),
});

export type SaveCandidateProfileInput = z.infer<typeof saveCandidateProfileSchema>;
