export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_CHARS = 100_000;
export const MAX_REQUEST_BYTES = MAX_FILE_BYTES * 2 + 64 * 1024;
export function fileProblem(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'pdf' && ext !== 'docx') return 'Unsupported file format. Please upload a PDF or DOCX.';
  const mime = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (file.type && file.type !== mime && file.type !== 'application/octet-stream') return 'The file type does not match its extension. Please upload a valid PDF or DOCX.';
  if (!file.size) return 'This document is empty. Please choose another file.';
  if (file.size > MAX_FILE_BYTES) return 'Document too large. The maximum size is 10 MB per document.';
  return null;
}
