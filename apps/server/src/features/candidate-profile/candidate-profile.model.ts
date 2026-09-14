import mongoose, { Document, Schema } from 'mongoose';

export interface IResumeEducationEntry {
  degree: string;
  institution: string;
  year: string;
  score?: string;
}

export interface IResumeExperienceEntry {
  company: string;
  role: string;
  duration: string;
  description?: string;
}

export interface IResumeProjectEntry {
  title: string;
  description?: string;
  techStack: string[];
  link?: string;
}

export interface IResumeLinks {
  github?: string;
  linkedin?: string;
  portfolio?: string;
}

export interface IResumeCertificationEntry {
  name: string;
  issuer?: string;
  year?: string;
  link?: string;
}

export interface ICandidateProfile extends Document {
  instituteId: string;
  candidateId: string;
  headline?: string;
  summary?: string;
  phone?: string;
  location?: string;
  education: IResumeEducationEntry[];
  experience: IResumeExperienceEntry[];
  projects: IResumeProjectEntry[];
  skills: string[];
  certifications: IResumeCertificationEntry[];
  links: IResumeLinks;
  leetcodeUsername?: string;
  resumeFileUrl?: string;
  resumeFileName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const educationSchema = new Schema<IResumeEducationEntry>(
  { degree: { type: String, required: true, trim: true }, institution: { type: String, required: true, trim: true }, year: { type: String, required: true, trim: true }, score: { type: String, trim: true } },
  { _id: false }
);

const experienceSchema = new Schema<IResumeExperienceEntry>(
  { company: { type: String, required: true, trim: true }, role: { type: String, required: true, trim: true }, duration: { type: String, required: true, trim: true }, description: { type: String, trim: true } },
  { _id: false }
);

const projectSchema = new Schema<IResumeProjectEntry>(
  { title: { type: String, required: true, trim: true }, description: { type: String, trim: true }, techStack: { type: [String], default: [] }, link: { type: String, trim: true } },
  { _id: false }
);

const linksSchema = new Schema<IResumeLinks>(
  { github: { type: String, trim: true }, linkedin: { type: String, trim: true }, portfolio: { type: String, trim: true } },
  { _id: false }
);

const certificationSchema = new Schema<IResumeCertificationEntry>(
  { name: { type: String, required: true, trim: true }, issuer: { type: String, trim: true }, year: { type: String, trim: true }, link: { type: String, trim: true } },
  { _id: false }
);

const candidateProfileSchema = new Schema<ICandidateProfile>(
  {
    instituteId: { type: String, required: true, index: true },
    candidateId: { type: String, required: true },
    headline: { type: String, trim: true, maxlength: 150 },
    summary: { type: String, trim: true, maxlength: 1000 },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    education: { type: [educationSchema], default: [] },
    experience: { type: [experienceSchema], default: [] },
    projects: { type: [projectSchema], default: [] },
    skills: { type: [String], default: [] },
    certifications: { type: [certificationSchema], default: [] },
    links: { type: linksSchema, default: {} },
    leetcodeUsername: { type: String, trim: true },
    resumeFileUrl: { type: String },
    resumeFileName: { type: String, trim: true },
  },
  { timestamps: true, versionKey: false }
);

candidateProfileSchema.index({ instituteId: 1, candidateId: 1 }, { unique: true });

export const CandidateProfile = mongoose.model<ICandidateProfile>('CandidateProfile', candidateProfileSchema);
