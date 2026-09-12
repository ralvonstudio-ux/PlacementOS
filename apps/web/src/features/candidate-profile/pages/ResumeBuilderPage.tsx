import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Upload, Save, Loader2, FileText } from 'lucide-react';
import { PageContainer } from '@/components/workspace/PageContainer';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { useMyProfile, useSaveMyProfile, useUploadResume } from '../hooks/useCandidateProfile';
import { extractErrorMessage } from '@/services/api';
import type { ResumeEducationEntry, ResumeExperienceEntry, ResumeProjectEntry } from '@placementos/types';

function Section({ title, children, onAdd, addLabel }: { title: string; children: React.ReactNode; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {onAdd && (
          <button onClick={onAdd} type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700">
            <Plus className="w-3.5 h-3.5" /> {addLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

const inputCls = 'w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500';

export function ResumeBuilderPage() {
  const { data: profile, isLoading } = useMyProfile();
  const { mutateAsync: save, isPending: isSaving } = useSaveMyProfile();
  const { mutateAsync: uploadResume, isPending: isUploading } = useUploadResume();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [education, setEducation] = useState<ResumeEducationEntry[]>([]);
  const [experience, setExperience] = useState<ResumeExperienceEntry[]>([]);
  const [projects, setProjects] = useState<ResumeProjectEntry[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [links, setLinks] = useState({ github: '', linkedin: '', portfolio: '' });
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setHeadline(profile.headline ?? '');
    setSummary(profile.summary ?? '');
    setEducation(profile.education);
    setExperience(profile.experience);
    setProjects(profile.projects);
    setSkills(profile.skills);
    setLinks({ github: profile.links.github ?? '', linkedin: profile.links.linkedin ?? '', portfolio: profile.links.portfolio ?? '' });
  }, [profile]);

  async function handleSave() {
    setStatus(null);
    try {
      await save({ headline, summary, education, experience, projects, skills, links });
      setStatus({ type: 'success', message: 'Resume saved.' });
    } catch (err) {
      setStatus({ type: 'error', message: extractErrorMessage(err) });
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    try {
      await uploadResume(file);
      setStatus({ type: 'success', message: 'Resume file uploaded.' });
    } catch (err) {
      setStatus({ type: 'error', message: extractErrorMessage(err) });
    }
  }

  if (isLoading) return <PageContainer><div className="h-64 bg-gray-100 rounded-2xl animate-pulse" /></PageContainer>;

  return (
    <PageContainer narrow>
      <WorkspaceHeader
        title="Resume"
        subtitle="Build your resume, or upload a finished PDF"
        action={
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        }
      />

      {status && (
        <div className={`mb-5 rounded-xl px-4 py-3 border ${status.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
          <p className="text-sm">{status.message}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Resume File</h3>
        <div className="flex items-center gap-3">
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload PDF
          </button>
          {profile?.resumeFileUrl && (
            <a href={profile.resumeFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700">
              <FileText className="w-3.5 h-3.5" /> View current file
            </a>
          )}
        </div>
      </div>

      <Section title="Basics">
        <div className="space-y-3">
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline — e.g. Final-year CSE student, aspiring SDE" className={inputCls} maxLength={150} />
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="A short summary about yourself" rows={3} maxLength={1000} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
        </div>
      </Section>

      <Section title="Education" addLabel="Add" onAdd={() => setEducation((p) => [...p, { degree: '', institution: '', year: '', score: '' }])}>
        <div className="space-y-3">
          {education.map((ed, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 relative pr-8">
              <input value={ed.degree} onChange={(e) => setEducation((p) => p.map((x, idx) => idx === i ? { ...x, degree: e.target.value } : x))} placeholder="Degree" className={inputCls} />
              <input value={ed.institution} onChange={(e) => setEducation((p) => p.map((x, idx) => idx === i ? { ...x, institution: e.target.value } : x))} placeholder="Institution" className={inputCls} />
              <input value={ed.year} onChange={(e) => setEducation((p) => p.map((x, idx) => idx === i ? { ...x, year: e.target.value } : x))} placeholder="Year" className={inputCls} />
              <input value={ed.score ?? ''} onChange={(e) => setEducation((p) => p.map((x, idx) => idx === i ? { ...x, score: e.target.value } : x))} placeholder="Score / CGPA" className={inputCls} />
              <button onClick={() => setEducation((p) => p.filter((_, idx) => idx !== i))} className="absolute top-1 right-0 p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {education.length === 0 && <p className="text-sm text-gray-400">No education entries yet.</p>}
        </div>
      </Section>

      <Section title="Experience" addLabel="Add" onAdd={() => setExperience((p) => [...p, { company: '', role: '', duration: '', description: '' }])}>
        <div className="space-y-3">
          {experience.map((ex, i) => (
            <div key={i} className="space-y-2 relative pr-8 pb-2 border-b border-gray-50 last:border-0">
              <div className="grid grid-cols-2 gap-2">
                <input value={ex.company} onChange={(e) => setExperience((p) => p.map((x, idx) => idx === i ? { ...x, company: e.target.value } : x))} placeholder="Company" className={inputCls} />
                <input value={ex.role} onChange={(e) => setExperience((p) => p.map((x, idx) => idx === i ? { ...x, role: e.target.value } : x))} placeholder="Role" className={inputCls} />
              </div>
              <input value={ex.duration} onChange={(e) => setExperience((p) => p.map((x, idx) => idx === i ? { ...x, duration: e.target.value } : x))} placeholder="Duration — e.g. Jun 2025 - Aug 2025" className={inputCls} />
              <textarea value={ex.description ?? ''} onChange={(e) => setExperience((p) => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Description" rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
              <button onClick={() => setExperience((p) => p.filter((_, idx) => idx !== i))} className="absolute top-1 right-0 p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {experience.length === 0 && <p className="text-sm text-gray-400">No experience entries yet.</p>}
        </div>
      </Section>

      <Section title="Projects" addLabel="Add" onAdd={() => setProjects((p) => [...p, { title: '', description: '', techStack: [], link: '' }])}>
        <div className="space-y-3">
          {projects.map((proj, i) => (
            <div key={i} className="space-y-2 relative pr-8 pb-2 border-b border-gray-50 last:border-0">
              <input value={proj.title} onChange={(e) => setProjects((p) => p.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} placeholder="Project title" className={inputCls} />
              <textarea value={proj.description ?? ''} onChange={(e) => setProjects((p) => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Description" rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
              <input
                value={proj.techStack.join(', ')}
                onChange={(e) => setProjects((p) => p.map((x, idx) => idx === i ? { ...x, techStack: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : x))}
                placeholder="Tech stack (comma separated)"
                className={inputCls}
              />
              <input value={proj.link ?? ''} onChange={(e) => setProjects((p) => p.map((x, idx) => idx === i ? { ...x, link: e.target.value } : x))} placeholder="Link (GitHub / live demo)" className={inputCls} />
              <button onClick={() => setProjects((p) => p.filter((_, idx) => idx !== i))} className="absolute top-1 right-0 p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {projects.length === 0 && <p className="text-sm text-gray-400">No projects yet.</p>}
        </div>
      </Section>

      <Section title="Skills">
        <div className="flex flex-wrap gap-2 mb-3">
          {skills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">
              {s}
              <button onClick={() => setSkills((p) => p.filter((x) => x !== s))}><Trash2 className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && skillInput.trim()) { e.preventDefault(); setSkills((p) => [...new Set([...p, skillInput.trim()])]); setSkillInput(''); } }}
            placeholder="Type a skill and press Enter"
            className={inputCls}
          />
        </div>
      </Section>

      <Section title="Links">
        <div className="space-y-2">
          <input value={links.github} onChange={(e) => setLinks((p) => ({ ...p, github: e.target.value }))} placeholder="GitHub URL" className={inputCls} />
          <input value={links.linkedin} onChange={(e) => setLinks((p) => ({ ...p, linkedin: e.target.value }))} placeholder="LinkedIn URL" className={inputCls} />
          <input value={links.portfolio} onChange={(e) => setLinks((p) => ({ ...p, portfolio: e.target.value }))} placeholder="Portfolio URL" className={inputCls} />
        </div>
      </Section>
    </PageContainer>
  );
}
