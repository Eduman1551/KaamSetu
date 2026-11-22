// Parse a multipart upload with formidable, keeping the file in memory only
// (no temp file is written to disk).
import formidable from 'formidable';
import { Writable } from 'stream';
import type { NextApiRequest } from 'next';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class UploadError extends Error {}

export async function readPdfUpload(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const form = formidable({
    maxFiles: 1,
    maxFileSize: MAX_UPLOAD_BYTES,
    allowEmptyFiles: false,
    // Collect the bytes in memory instead of writing a temp file.
    fileWriteStreamHandler: () =>
      new Writable({
        write(chunk, _enc, cb) {
          chunks.push(Buffer.from(chunk));
          cb();
        },
      }),
  });
  const [, files] = await form.parse(req);
  const f = Object.values(files).flat()[0];
  if (!f) throw new UploadError('Please choose a PDF file to upload.');
  const buffer = Buffer.concat(chunks);
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new UploadError('That file is not a valid PDF. Please export your resume as a PDF.');
  }
  return buffer;
}

/** Turn formidable's errors into a friendly message. */
export function friendlyUploadError(err: unknown): string {
  if (err instanceof UploadError) return err.message;
  const e = err as { httpCode?: number; message?: string };
  if (e?.httpCode === 413 || /maxFileSize|exceeded/i.test(e?.message || '')) {
    return 'That PDF is larger than 5 MB. Please upload a smaller file.';
  }
  return 'We could not read that upload. Please try again with a PDF.';
}
