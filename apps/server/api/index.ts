// Vercel serverless entrypoint. Files under /api become individual serverless
// functions; api/index.ts maps to the function that this project's vercel.json
// rewrites every request to. The Express app itself is a plain (req, res) => void
// handler, so it can be exported directly — no adapter/wrapper needed.
//
// app.ts already calls connectDatabase() at module load and is written for this
// exact case (see the comment above that call), so nothing else is required here.
import app from '../src/app';

export default app;
