# PlacementOS — Source Mapping & Conventions

Source repo to copy/adapt from: `C:\Users\HP\Desktop\SchoolOS AI` (npm workspaces monorepo: `apps/server` Express+Mongoose+TS, `apps/web` React18+Vite+TS+Tailwind+react-router-dom+react-query, `packages/types`/`packages/utils` shared TS).
Target repo (already scaffolded — root package.json, tsconfig.base.json, docker-compose, .env.example, apps/server & apps/web package.json/tsconfig, vite/tailwind/postcss configs): `C:\Users\HP\Desktop\PlacementOS`.
Full plan: `C:\Users\HP\.claude\plans\velvety-popping-lemur.md`.

Package names: `@schoolos/types` → `@placementos/types`, `@schoolos/utils` → `@placementos/utils`. Fix all imports accordingly.

## Terminology mapping (apply to model names, field names, route paths, role strings, UI copy)

| SchoolOS | PlacementOS |
|---|---|
| School / `schoolId` | Institute / `instituteId` |
| Teacher (role `teacher`) | Faculty (role `faculty`) |
| Principal (role `principal`) | TPO (role `tpo`) |
| Student | Candidate |
| Class / Section | Batch |
| Subject | Track |
| Timetable | Training Schedule |
| Syllabus Chapter | Training Module |
| Academic Year | Placement Year |
| "academic-plan" feature | "training-plan" |
| "teacher-workspace" feature | "faculty-workspace" |
| "principal" feature | "tpo" |
| "principal-assistant" feature | "tpo-assistant" |

Non-domain plumbing (JWT/auth internals, generic middleware, AI provider wrapper, R2 storage, image upload) is copied as-is — do not rename generic code, only domain nouns above.

## API route prefixes (backend must expose these; frontend api/*.api.ts must call these — keep both sides in sync)

- `/api/v1/auth`, `/api/v1/users`
- `/api/v1/faculty` (was `/teachers`)
- `/api/v1/institutes` (tenancy)
- `/api/v1/attendance`
- `/api/v1/leave-requests`
- `/api/v1/training-schedule` (was `/timetable`)
- `/api/v1/training-plan` (was `/academic-plan`)
- `/api/v1/question-bank` (name kept; internals renamed chapter→module, class/subject→batch/track)
- `/api/v1/worksheet-generator`
- `/api/v1/tpo` (was `/principal`)
- `/api/v1/tpo-assistant` (was `/principal-assistant`; AI attendance Q&A)
- `GET /api/v1/question-bank/tpo/overview` (was `/principal/overview`)

## Frontend route base paths / role guards

- Faculty area: `/faculty/*`, `allowedRoles={['faculty']}`
- TPO area: `/tpo/*`, `allowedRoles={['tpo']}`
- Feature folders under `apps/web/src/features/`: `faculty-workspace`, `attendance`, `leave-requests`, `training-plan`, `question-bank`, `worksheet-generator`, `tpo`, `auth`.

## Skip / do not port

- `features/teacher-planner` (backend) and its frontend counterpart — legacy, superseded by academic-plan/training-plan per source code's own comments.
- Anything fee/payroll/transport/reception/ops-center/communications-engine related — out of scope.
- Firebase push notifications, WebAuthn/passkeys, Vapi/ElevenLabs voice — optional, skip unless trivial to leave stubbed; OpenAI text-based AI (question extraction, TPO assistant) is in scope.
