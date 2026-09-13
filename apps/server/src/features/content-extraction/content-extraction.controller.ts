import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../lib/response';
import { ValidationError } from '../../middlewares/errorHandler';
import { extractTextFromUpload } from '../../lib/content-extraction';

export const contentExtractionController = {
  /** POST /content-extraction/extract — shared "upload a file, get its text back" endpoint
   *  used by the Academic Plan, Worksheet, and Test creation flows so a faculty member can
   *  either paste content directly or upload a PDF/image and have it transcribed first. */
  async extract(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = req.file;
      if (!file) throw new ValidationError('No file uploaded.');
      const text = await extractTextFromUpload(file);
      sendSuccess(res, { text, fileName: file.originalname });
    } catch (err) {
      next(err);
    }
  },
};
