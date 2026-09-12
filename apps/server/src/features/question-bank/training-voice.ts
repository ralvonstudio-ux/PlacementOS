import type { PageFigure, LanguageComplexity } from '@placementos/types';

/**
 * Shared "sound like a real placement trainer, not an AI" style guide, injected into every
 * question-writing prompt (extraction/structuring, synthesis, worksheet authoring) — kept in one
 * place so the prompt builders never drift out of sync with each other.
 *
 * Adapted from SchoolOS's grade-band language guide: PlacementOS trainees are college students
 * (not Nursery-12 schoolchildren), and "batch"/"track" (e.g. "DSA", "Aptitude", "Communication")
 * don't map onto a numeric grade scale the way School class 1-12 did — so there is no automatic
 * grade-band detection here. `languageComplexity` is trainer-controlled instead: 'auto' defaults
 * to standard professional/exam-prep register; 'simple' | 'standard' | 'advanced' let a trainer
 * dial it for a weaker or stronger batch.
 */

const COMPLEXITY_GUIDANCE: Record<LanguageComplexity, string> = {
  auto: 'Use clear, standard professional language appropriate for a college student preparing for a campus placement — the register of a real aptitude/technical-interview prep book, not a children\'s worksheet and not needlessly academic.',
  simple: 'Use SIMPLE, plain language — short sentences, everyday words, avoid jargon-heavy phrasing even where the topic would normally support it. Good for a batch that is still building fundamentals.',
  standard: 'Use STANDARD professional/exam-prep language — normal placement-test register, neither simplified down nor stretched into unnecessarily advanced phrasing.',
  advanced: 'Use ADVANCED, higher-order language — push toward analytical, multi-step, or scenario-based phrasing appropriate for a stronger batch heading into competitive company interviews.',
};

export function languageStyleGuide(override: LanguageComplexity = 'auto'): string {
  return COMPLEXITY_GUIDANCE[override];
}

/** Sentence-starter/phrasing rules shared by every question-writing prompt — the "sound like a
 *  trainer's own notes, not an AI" core of the whole feature. */
export const TRAINER_VOICE_RULES = `Write every question the way a real placement trainer would write it for a practice set — plain, direct, and natural. Avoid stiff, generic AI phrasing such as "What is the main idea of...", "Based on the passage...", "According to the text...", "What can we learn from...", "What can be inferred about...", or "Explain the significance of...", unless that exact register is genuinely how a trainer would phrase it for this track.

Prefer natural, familiar question forms for the track: for technical/aptitude tracks — direct problem statements, "Solve...", "What is the output of...", "Which of the following...", "Write a function that...". For communication/soft-skill tracks — "How would you...", "Give an example of...", "Rewrite the following...". For MCQs, four plausible options with exactly one correct answer.

Every question must be answerable directly from the given content — do not add facts outside it unless the instructions explicitly ask for general/aptitude-style questions. Mix recall, application, and problem-solving questions rather than making every question the same shape. Never write two questions in the same batch that test the same fact or near-duplicate wording.`;

/** Whether/how a batch of questions may reference a picture — conditional on `figures` actually
 *  being available for this call, never a blanket allow. */
export function imageAvailabilityInstruction(figures: PageFigure[], includeImages: boolean): string {
  if (!includeImages || figures.length === 0) {
    return 'This system cannot attach an image to a question right now, so never write a question that depends on looking at a picture/diagram/figure — write only questions answerable from text alone.';
  }

  const list = figures.map((f) => `- "${f.figureId}" (${f.figureType}${f.caption ? `, captioned "${f.caption}"` : ''}): ${f.description}`).join('\n');
  return `The following real images were detected on this page and are available for picture-based questions:
${list}

If — and only if — one of these images genuinely suits a good picture-based question (e.g. a diagram/flowchart to interpret), write it as one of your questions and set "imageFigureId" to that exact figure id string above (copy it exactly, never invent or alter one). Do not force a picture-based question if none of the images genuinely fit — most questions in this batch should still be plain text questions from the content. Never set "imageFigureId" to anything other than one of the exact ids listed above.

If a picture-based question would genuinely help but none of the listed images are a good fit for it, you may instead write the question with "imageRequired": true and an "imagePrompt" describing what a suitable image should show — but only do this occasionally, not for every question, and never set both "imageFigureId" and "imageRequired" on the same question.`;
}

/** Same contract as imageAvailabilityInstruction, but for the one-shot vision extraction path
 *  where figures aren't known ahead of time — this same call is what detects them. */
export function imageAvailabilityInstructionSelfDetect(detectImages: boolean): string {
  if (!detectImages) {
    return 'This system cannot attach an image to a question right now, so never write a question that depends on looking at a picture/diagram/figure — write only questions answerable from text alone. Do not return a "figures" field.';
  }

  return `As you read this page, also identify any meaningful diagrams, charts, flowcharts, or figures on it — not small decorative icons/borders. Return each one you find in a "figures" array, each object shaped:
- "figureId": a short id you invent for this figure, unique within this response (e.g. "fig1", "fig2")
- "boundingBox": {"x", "y", "width", "height"} — the image's position as fractions (0.0-1.0) of the full page's width/height, from the top-left corner. Estimate carefully, don't guess wildly.
- "figureType": one of "decorative", "content_supporting", "diagram", "chart_table", "map", "illustration"
- "caption": the printed caption/label near the image, if any, else omit
- "description": a short, factual description of what the image visually shows — this is the only record of the image's content a later step will have, so be specific
- "usableForQuestion": true if clear/substantial enough to build a question around, false for something too small, blurry, or purely decorative

If the page has no meaningful images, return an empty "figures" array — never invent one that isn't visibly present.

If — and only if — one of the figures you found genuinely suits a good picture-based question, write it as one of your questions and set "imageFigureId" to that figure's exact "figureId" you invented above (copy it exactly). Do not force a picture-based question if none of the images genuinely fit. Never set "imageFigureId" to anything other than one of the exact ids you listed in "figures".

If a picture-based question would genuinely help but none of the found images are a good fit, you may instead write the question with "imageRequired": true and an "imagePrompt" describing what a suitable image should show — but only occasionally, never both "imageFigureId" and "imageRequired" on the same question.`;
}

/** Appended once per prompt as a final self-check instruction — asks the model to silently
 *  re-check its own output rather than adding a separate verification pass/call. */
export const SELF_CHECK_INSTRUCTION = `Before returning your answer, silently check every question against this checklist and rewrite anything that fails it:
1. Is the language and difficulty genuinely appropriate for this track and batch?
2. Does it sound like something a real placement trainer would write, not an AI assistant?
3. Is the answer clearly supported by the given content?
4. Is it meaningfully different from the other questions in this batch (not testing the same fact)?`;
