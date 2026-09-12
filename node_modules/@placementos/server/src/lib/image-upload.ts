import multer from 'multer';
import { ValidationError } from '../middlewares/errorHandler';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// A phone camera photo routinely runs 3-8MB. This image is forwarded to the AI vision model as a
// data URI and never persisted as-is, so this stays generous — well under OpenAI's request limit.
const MAX_AI_IMAGE_SIZE = 15 * 1024 * 1024; // 15 MB

export const aiImageUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AI_IMAGE_SIZE, files: 1 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new ValidationError('Only JPEG, PNG, WEBP, or GIF images are allowed.'));
  },
}).single('file');

// Multi-page module capture — a faculty member can photograph 5-20+ pages in one sitting and
// process them as a single batch, rather than firing one request per page.
const MAX_MODULE_PAGES = 30;

export const moduleImagesUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AI_IMAGE_SIZE, files: MAX_MODULE_PAGES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new ValidationError('Only JPEG, PNG, WEBP, or GIF images are allowed.'));
  },
}).array('images', MAX_MODULE_PAGES);

const ALLOWED_DOC_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];
const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5 MB

export const documentUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOC_SIZE, files: 1 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_DOC_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new ValidationError('Only images, PDF, or Word documents are allowed.'));
  },
}).single('file');

/** Converts a multer in-memory file into a data URI string. */
export function fileToDataUri(file: Express.Multer.File): string {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}
