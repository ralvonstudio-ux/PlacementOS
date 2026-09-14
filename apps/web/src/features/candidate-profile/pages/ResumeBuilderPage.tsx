import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import {
  Plus, Trash2, Upload, Save, Loader2, FileText, X, Eye,
  User, GraduationCap, Briefcase, FolderKanban, BarChart3, Award, UploadCloud,
  Mail, Phone, MapPin, Linkedin, CheckCircle2, Sparkles,
} from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useMyProfile, useSaveMyProfile, useUploadResume } from '../hooks/useCandidateProfile';
import { extractErrorMessage } from '@/services/api';
import { cn } from '@/lib/utils';
import type {
  ResumeEducationEntry, ResumeExperienceEntry, ResumeProjectEntry, ResumeCertificationEntry,
} from '@placementos/types';

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';
const textareaCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';

type StepId = 'personal' | 'education' | 'experience' | 'projects' | 'skills' | 'certifications' | 'resume';

interface StepDef {
  id: StepId;
  index: number;
  label: string;
  hint: string;
  icon: typeof User;
}

const STEPS: StepDef[] = [
  { id: 'personal', index: 1, label: 'Personal Details', hint: 'Your basics & contact info', icon: User },
  { id: 'education', index: 2, label: 'Education', hint: 'Your academic background', icon: GraduationCap },
  { id: 'experience', index: 3, label: 'Experience', hint: 'Add your work experience', icon: Briefcase },
  { id: 'projects', index: 4, label: 'Projects', hint: 'Showcase your work', icon: FolderKanban },
  { id: 'skills', index: 5, label: 'Skills', hint: 'Add your key skills', icon: BarChart3 },
  { id: 'certifications', index: 6, label: 'Certifications', hint: 'Add your certificates', icon: Award },
  { id: 'resume', index: 7, label: 'Resume Upload', hint: 'Or import from PDF', icon: FileText },
];

const EXPERIENCE_TYPES = ['Internship', 'Full Time', 'Freelance', 'Volunteer'];

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-medium text-gray-500 mb-1">{children}</label>;
}

function EmptyState({ icon: Icon, title, subtitle, onAdd, addLabel }: { icon: typeof User; title: string; subtitle: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">{subtitle}</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors"
      >
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}

function EntryCard({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div className="relative rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-600 transition-colors"
        aria-label="Remove"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {children}
    </div>
  );
}

function PreviewSection({ title, children, empty }: { title: string; children: ReactNode; empty: boolean }) {
  return (
    <div className="pt-4 border-t border-gray-100 first:border-0 first:pt-0">
      <h4 className="text-[11px] font-bold tracking-wide text-gray-400 mb-2">{title}</h4>
      {empty ? <p className="text-xs text-gray-300 italic">Not added yet</p> : children}
    </div>
  );
}

export function ResumeBuilderPage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useMyProfile();
  const { mutateAsync: save, isPending: isSaving } = useSaveMyProfile();
  const { mutateAsync: uploadResume, isPending: isUploading } = useUploadResume();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeStep, setActiveStep] = useState<StepId>('personal');
  const [isDragging, setIsDragging] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showTip, setShowTip] = useState(true);

  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [education, setEducation] = useState<ResumeEducationEntry[]>([]);
  const [experience, setExperience] = useState<ResumeExperienceEntry[]>([]);
  const [projects, setProjects] = useState<ResumeProjectEntry[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<ResumeCertificationEntry[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [links, setLinks] = useState({ github: '', linkedin: '', portfolio: '' });
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setHeadline(profile.headline ?? '');
    setSummary(profile.summary ?? '');
    setPhone(profile.phone ?? '');
    setLocation(profile.location ?? '');
    setEducation(profile.education);
    setExperience(profile.experience);
    setProjects(profile.projects);
    setSkills(profile.skills);
    setCertifications(profile.certifications ?? []);
    setLinks({ github: profile.links.github ?? '', linkedin: profile.links.linkedin ?? '', portfolio: profile.links.portfolio ?? '' });
  }, [profile]);

  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';

  const completion = useMemo(() => {
    const checks = [
      !!headline.trim(),
      !!summary.trim(),
      !!phone.trim() || !!location.trim(),
      education.length > 0,
      experience.length > 0,
      projects.length > 0,
      skills.length > 0,
      certifications.length > 0,
      !!(links.github || links.linkedin || links.portfolio),
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [headline, summary, phone, location, education, experience, projects, skills, certifications, links]);

  const stepComplete: Record<StepId, boolean> = {
    personal: !!headline.trim() && !!summary.trim(),
    education: education.length > 0,
    experience: experience.length > 0,
    projects: projects.length > 0,
    skills: skills.length > 0,
    certifications: certifications.length > 0,
    resume: !!profile?.resumeFileUrl,
  };

  async function handleSave() {
    setStatus(null);
    try {
      await save({ headline, summary, phone, location, education, experience, projects, skills, certifications, links });
      setStatus({ type: 'success', message: 'Resume saved.' });
    } catch (err) {
      setStatus({ type: 'error', message: extractErrorMessage(err) });
    }
  }

  async function uploadFile(file: File) {
    setStatus(null);
    try {
      await uploadResume(file);
      setStatus({ type: 'success', message: 'Resume file uploaded.' });
    } catch (err) {
      setStatus({ type: 'error', message: extractErrorMessage(err) });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  if (isLoading) return <PageContainer><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /></PageContainer>;

  const previewContent = (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900">{fullName || 'Your Name'}</h3>
        {headline && <p className="text-sm text-violet-600 font-medium mt-0.5">{headline}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-500">
          {user?.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</span>}
          {phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {phone}</span>}
          {location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {location}</span>}
          {links.linkedin && <span className="inline-flex items-center gap-1"><Linkedin className="w-3 h-3" /> {links.linkedin}</span>}
        </div>
      </div>

      <PreviewSection title="SUMMARY" empty={!summary.trim()}>
        <p className="text-xs text-gray-600 leading-relaxed">{summary}</p>
      </PreviewSection>

      <PreviewSection title="EDUCATION" empty={education.length === 0}>
        <div className="space-y-2">
          {education.map((ed, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-800">{ed.degree || 'Degree'}</p>
                <p className="text-[11px] text-gray-500">{ed.institution}{ed.score ? ` · CGPA: ${ed.score}` : ''}</p>
              </div>
              <span className="text-[11px] text-gray-400 whitespace-nowrap">{ed.year}</span>
            </div>
          ))}
        </div>
      </PreviewSection>

      <PreviewSection title="EXPERIENCE" empty={experience.length === 0}>
        <div className="space-y-2">
          {experience.map((ex, i) => (
            <div key={i}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-gray-800">{ex.role || 'Role'} {ex.company && `· ${ex.company}`}</p>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">{ex.duration}</span>
              </div>
              {ex.description && <p className="text-[11px] text-gray-500 mt-0.5">{ex.description}</p>}
            </div>
          ))}
        </div>
      </PreviewSection>

      <PreviewSection title="PROJECTS" empty={projects.length === 0}>
        <div className="space-y-2">
          {projects.map((p, i) => (
            <div key={i}>
              <p className="text-xs font-semibold text-gray-800">{p.title || 'Project'}</p>
              {p.description && <p className="text-[11px] text-gray-500 mt-0.5">{p.description}</p>}
              {p.techStack.length > 0 && <p className="text-[11px] text-violet-500 mt-0.5">{p.techStack.join(' · ')}</p>}
            </div>
          ))}
        </div>
      </PreviewSection>

      <PreviewSection title="SKILLS" empty={skills.length === 0}>
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">{s}</span>
          ))}
        </div>
      </PreviewSection>

      <PreviewSection title="CERTIFICATIONS" empty={certifications.length === 0}>
        <div className="space-y-1.5">
          {certifications.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-700">{c.name}{c.issuer ? ` — ${c.issuer}` : ''}</p>
              {c.year && <span className="text-[11px] text-gray-400">{c.year}</span>}
            </div>
          ))}
        </div>
      </PreviewSection>
    </div>
  );

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Resume Builder</h1>
            <p className="text-sm text-gray-500">Create a professional resume and stand out</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-gray-200">
            <div className="relative w-11 h-11">
              <svg viewBox="0 0 40 40" className="w-11 h-11 -rotate-90">
                <circle cx="20" cy="20" r="16" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                <circle
                  cx="20" cy="20" r="16" fill="none" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 16}
                  strokeDashoffset={2 * Math.PI * 16 * (1 - completion / 100)}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-violet-700">{completion}%</span>
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold text-gray-900">Profile Completion</p>
              <p className="text-[11px] text-gray-400">{completion === 100 ? 'All set!' : 'Keep going.'}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors"
          >
            <Eye className="w-4 h-4" /> Preview Resume
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
        </div>
      </div>

      {status && (
        <div className={`mb-5 rounded-xl px-4 py-3 border ${status.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
          <p className="text-sm">{status.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_360px] gap-6 items-start">
        {/* Stepper */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:sticky lg:top-6">
          <ol className="space-y-1">
            {STEPS.map((step) => {
              const isActive = activeStep === step.id;
              const isDone = stepComplete[step.id];
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={cn(
                      'w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      isActive ? 'bg-violet-50' : 'hover:bg-gray-50'
                    )}
                  >
                    <span
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5',
                        isDone ? 'bg-green-500 text-white' : isActive ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-400'
                      )}
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : step.index}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block text-sm font-semibold truncate', isActive ? 'text-violet-700' : 'text-gray-800')}>
                        {step.label}
                      </span>
                      <span className="block text-[11px] text-gray-400 truncate">{step.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="hidden lg:block mt-2">
            <StepperFooterTip />
          </div>
        </div>

        {/* Step content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[420px]">
          {activeStep === 'personal' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-violet-600" />
                <h3 className="text-base font-semibold text-gray-900">Personal Details</h3>
              </div>
              <div>
                <FieldLabel>Headline</FieldLabel>
                <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Final-year CSE student, aspiring SDE" className={inputCls} maxLength={150} />
              </div>
              <div>
                <FieldLabel>Summary</FieldLabel>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="A short summary about yourself" rows={4} maxLength={1000} className={textareaCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Phone</FieldLabel>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className={inputCls} />
                </div>
                <div>
                  <FieldLabel>Location</FieldLabel>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bengaluru, India" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <FieldLabel>GitHub</FieldLabel>
                  <input value={links.github} onChange={(e) => setLinks((p) => ({ ...p, github: e.target.value }))} placeholder="github.com/you" className={inputCls} />
                </div>
                <div>
                  <FieldLabel>LinkedIn</FieldLabel>
                  <input value={links.linkedin} onChange={(e) => setLinks((p) => ({ ...p, linkedin: e.target.value }))} placeholder="linkedin.com/in/you" className={inputCls} />
                </div>
                <div>
                  <FieldLabel>Portfolio</FieldLabel>
                  <input value={links.portfolio} onChange={(e) => setLinks((p) => ({ ...p, portfolio: e.target.value }))} placeholder="yoursite.com" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {activeStep === 'education' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-violet-600" />
                  <h3 className="text-base font-semibold text-gray-900">Education</h3>
                </div>
                {education.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEducation((p) => [...p, { degree: '', institution: '', year: '', score: '' }])}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                )}
              </div>
              {education.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title="No education added yet"
                  subtitle="Add your degree, institution, and scores to show your academic background."
                  addLabel="Add Education"
                  onAdd={() => setEducation((p) => [...p, { degree: '', institution: '', year: '', score: '' }])}
                />
              ) : (
                <div className="space-y-3">
                  {education.map((ed, i) => (
                    <EntryCard key={i} onRemove={() => setEducation((p) => p.filter((_, idx) => idx !== i))}>
                      <div className="grid grid-cols-2 gap-3 pr-6">
                        <input value={ed.degree} onChange={(e) => setEducation((p) => p.map((x, idx) => idx === i ? { ...x, degree: e.target.value } : x))} placeholder="Degree" className={inputCls} />
                        <input value={ed.institution} onChange={(e) => setEducation((p) => p.map((x, idx) => idx === i ? { ...x, institution: e.target.value } : x))} placeholder="Institution" className={inputCls} />
                        <input value={ed.year} onChange={(e) => setEducation((p) => p.map((x, idx) => idx === i ? { ...x, year: e.target.value } : x))} placeholder="Year — e.g. 2023 - 2027" className={inputCls} />
                        <input value={ed.score ?? ''} onChange={(e) => setEducation((p) => p.map((x, idx) => idx === i ? { ...x, score: e.target.value } : x))} placeholder="Score / CGPA" className={inputCls} />
                      </div>
                    </EntryCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeStep === 'experience' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-violet-600" />
                  <h3 className="text-base font-semibold text-gray-900">Experience</h3>
                </div>
                {experience.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExperience((p) => [...p, { company: '', role: '', duration: '', description: '' }])}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                )}
              </div>
              {experience.length === 0 ? (
                <div>
                  <EmptyState
                    icon={Briefcase}
                    title="No experience added yet"
                    subtitle="Add your internships, part-time jobs, or relevant experience to showcase your journey."
                    addLabel="Add Experience"
                    onAdd={() => setExperience((p) => [...p, { company: '', role: '', duration: '', description: '' }])}
                  />
                  <div className="flex flex-wrap justify-center gap-2 -mt-2">
                    {EXPERIENCE_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setExperience((p) => [...p, { company: '', role: '', duration: '', description: '' }])}
                        className="inline-flex items-center h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {experience.map((ex, i) => (
                    <EntryCard key={i} onRemove={() => setExperience((p) => p.filter((_, idx) => idx !== i))}>
                      <div className="grid grid-cols-2 gap-3 pr-6">
                        <input value={ex.company} onChange={(e) => setExperience((p) => p.map((x, idx) => idx === i ? { ...x, company: e.target.value } : x))} placeholder="Company" className={inputCls} />
                        <input value={ex.role} onChange={(e) => setExperience((p) => p.map((x, idx) => idx === i ? { ...x, role: e.target.value } : x))} placeholder="Role" className={inputCls} />
                      </div>
                      <input value={ex.duration} onChange={(e) => setExperience((p) => p.map((x, idx) => idx === i ? { ...x, duration: e.target.value } : x))} placeholder="Duration — e.g. Jun 2025 - Aug 2025" className={inputCls} />
                      <textarea value={ex.description ?? ''} onChange={(e) => setExperience((p) => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Description" rows={2} className={textareaCls} />
                    </EntryCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeStep === 'projects' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-violet-600" />
                  <h3 className="text-base font-semibold text-gray-900">Projects</h3>
                </div>
                {projects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setProjects((p) => [...p, { title: '', description: '', techStack: [], link: '' }])}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                )}
              </div>
              {projects.length === 0 ? (
                <EmptyState
                  icon={FolderKanban}
                  title="No projects added yet"
                  subtitle="Add academic or personal projects to showcase your work."
                  addLabel="Add Project"
                  onAdd={() => setProjects((p) => [...p, { title: '', description: '', techStack: [], link: '' }])}
                />
              ) : (
                <div className="space-y-3">
                  {projects.map((proj, i) => (
                    <EntryCard key={i} onRemove={() => setProjects((p) => p.filter((_, idx) => idx !== i))}>
                      <input value={proj.title} onChange={(e) => setProjects((p) => p.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} placeholder="Project title" className={cn(inputCls, 'pr-6')} />
                      <textarea value={proj.description ?? ''} onChange={(e) => setProjects((p) => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Description" rows={2} className={textareaCls} />
                      <input
                        value={proj.techStack.join(', ')}
                        onChange={(e) => setProjects((p) => p.map((x, idx) => idx === i ? { ...x, techStack: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : x))}
                        placeholder="Tech stack (comma separated)"
                        className={inputCls}
                      />
                      <input value={proj.link ?? ''} onChange={(e) => setProjects((p) => p.map((x, idx) => idx === i ? { ...x, link: e.target.value } : x))} placeholder="Link (GitHub / live demo)" className={inputCls} />
                    </EntryCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeStep === 'skills' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-violet-600" />
                <h3 className="text-base font-semibold text-gray-900">Skills</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {skills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">
                    {s}
                    <button type="button" onClick={() => setSkills((p) => p.filter((x) => x !== s))}><Trash2 className="w-3 h-3" /></button>
                  </span>
                ))}
                {skills.length === 0 && <p className="text-sm text-gray-400">No skills added yet.</p>}
              </div>
              <input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && skillInput.trim()) { e.preventDefault(); setSkills((p) => [...new Set([...p, skillInput.trim()])]); setSkillInput(''); } }}
                placeholder="Type a skill and press Enter"
                className={inputCls}
              />
            </div>
          )}

          {activeStep === 'certifications' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-violet-600" />
                  <h3 className="text-base font-semibold text-gray-900">Certifications</h3>
                </div>
                {certifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCertifications((p) => [...p, { name: '', issuer: '', year: '', link: '' }])}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                )}
              </div>
              {certifications.length === 0 ? (
                <EmptyState
                  icon={Award}
                  title="No certifications added yet"
                  subtitle="Add relevant certifications to strengthen your resume."
                  addLabel="Add Certification"
                  onAdd={() => setCertifications((p) => [...p, { name: '', issuer: '', year: '', link: '' }])}
                />
              ) : (
                <div className="space-y-3">
                  {certifications.map((c, i) => (
                    <EntryCard key={i} onRemove={() => setCertifications((p) => p.filter((_, idx) => idx !== i))}>
                      <div className="grid grid-cols-2 gap-3 pr-6">
                        <input value={c.name} onChange={(e) => setCertifications((p) => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} placeholder="Certification name" className={inputCls} />
                        <input value={c.issuer ?? ''} onChange={(e) => setCertifications((p) => p.map((x, idx) => idx === i ? { ...x, issuer: e.target.value } : x))} placeholder="Issued by" className={inputCls} />
                        <input value={c.year ?? ''} onChange={(e) => setCertifications((p) => p.map((x, idx) => idx === i ? { ...x, year: e.target.value } : x))} placeholder="Year" className={inputCls} />
                        <input value={c.link ?? ''} onChange={(e) => setCertifications((p) => p.map((x, idx) => idx === i ? { ...x, link: e.target.value } : x))} placeholder="Credential link" className={inputCls} />
                      </div>
                    </EntryCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeStep === 'resume' && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-violet-600" />
                <h3 className="text-base font-semibold text-gray-900">Resume Upload</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">Upload your existing resume (PDF, up to 5MB)</p>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                className={cn(
                  'rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors',
                  isDragging ? 'border-violet-500 bg-violet-50/60' : 'border-gray-200 hover:border-violet-300 hover:bg-gray-50/60'
                )}
              >
                {isUploading ? (
                  <Loader2 className="w-9 h-9 text-violet-500 animate-spin mb-3" />
                ) : (
                  <UploadCloud className="w-9 h-9 text-violet-400 mb-3" />
                )}
                <p className="text-sm font-semibold text-gray-800">Drag &amp; drop your resume here</p>
                <p className="text-sm text-violet-600 font-medium">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">PDF (Max 5MB)</p>
              </div>

              {profile?.resumeFileUrl && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{profile.resumeFileName || 'Uploaded resume'}</span>
                  </div>
                  <a href={profile.resumeFileUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex-shrink-0">
                    View
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:sticky lg:top-6 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-4 h-4 text-violet-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Live Preview</p>
              <p className="text-[11px] text-gray-400">Your resume updates in real-time</p>
            </div>
          </div>
          {previewContent}
        </div>
      </div>

      {showTip && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
          <p className="text-sm text-violet-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0" />
            <span><span className="font-semibold">Pro Tip:</span> A complete resume increases your chances of getting shortlisted by 3x!</span>
          </p>
          <button type="button" onClick={() => setShowTip(false)} className="text-violet-400 hover:text-violet-600 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowPreviewModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Resume Preview</h2>
              <button type="button" onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {previewContent}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function StepperFooterTip() {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-[11px] text-gray-400">
      <Upload className="w-3.5 h-3.5 flex-shrink-0" />
      Complete every step for the best results.
    </div>
  );
}
