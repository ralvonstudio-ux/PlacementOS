import { openaiProvider } from '../features/ai/providers/llm/openai.provider';
import { ValidationError } from '../middlewares/errorHandler';
import { fileToDataUri } from './image-upload';

/** Turns an uploaded PDF or image into plain text, standalone from the question-bank's
 *  BankQuestionSource pipeline (which requires a batch/track/module and persists a
 *  record) — used by features that just want "the text of what was uploaded" once,
 *  e.g. as a syllabus or worksheet/test source. Word docs aren't supported (no parser
 *  dependency in this project yet) — callers should ask for a PDF, image, or pasted text. */
export async function extractTextFromUpload(file: Express.Multer.File): Promise<string> {
  if (file.mimetype === 'application/pdf') {
    // Loaded lazily, same as question-extraction.service.ts — a broken native dependency
    // in pdf-parse's chain then only breaks this one path at request time.
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: file.buffer });
    const { text } = await parser.getText();
    await parser.destroy();

    if (!text.trim() || text.trim().length < 20) {
      throw new ValidationError('This PDF has no readable text layer (likely a scanned document) — upload a photo instead, or paste the content as text.');
    }
    return text;
  }

  if (file.mimetype.startsWith('image/')) {
    if (!openaiProvider.isAvailable()) throw new ValidationError('AI extraction is not configured on this server.');
    const result = await openaiProvider.complete({
      systemPrompt: 'Transcribe every word of readable text from this image exactly as written, preserving structure (headings, bullet points, numbering, paragraph breaks). Return only the transcribed text — no commentary, no markdown fences.',
      userPrompt: 'Transcribe this page.',
      imageDataUri: fileToDataUri(file),
      maxTokens: 3000,
      temperature: 0,
    });
    if (!result.content.trim()) throw new ValidationError('No readable text was found in that image.');
    return result.content;
  }

  throw new ValidationError('Unsupported file type — upload a PDF or image, or paste the content as text.');
}
