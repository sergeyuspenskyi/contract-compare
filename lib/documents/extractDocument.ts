import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { unzipSync } from 'fflate';
import { AppError } from '../errors';
import { fileProblem, MAX_TEXT_CHARS } from '../limits';
export const normalizeText = (text: string) => text.replace(/\r\n?/g, '\n').replace(/[\t\u00a0 ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
export async function extractDocument(file: File): Promise<string> {
  const problem = fileProblem(file);
  if (problem) throw new AppError(problem);
  const buffer = Buffer.from(await file.arrayBuffer());
  const pdf = file.name.toLowerCase().endsWith('.pdf');
  try {
    let raw: string;
    if (pdf) {
      if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid PDF signature');
      const parser = new PDFParse({ data: buffer });
      try {
        const info = await parser.getInfo();
        if (info.total > 200) throw new AppError('Document too large. Please use a PDF with at most 200 pages.');
        const result = await parser.getText();
        // Use individual pages: the aggregate text includes synthetic page footers.
        raw = result.pages.map(page => page.text).join('\n\n');
      } finally { await parser.destroy(); }
      if (!raw.trim()) throw new AppError('This PDF appears to contain scanned images and no extractable text. OCR is not supported in this MVP.');
    } else {
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error('Invalid DOCX signature');
      let expanded = 0;
      let documentFound = false;
      // Inspect declared sizes before decompression to reject ZIP bombs.
      unzipSync(buffer, { filter: entry => {
        expanded += entry.originalSize;
        if (expanded > 40 * 1024 * 1024 || !Number.isFinite(expanded)) throw new AppError('Document too large after decompression. Please use a smaller DOCX.');
        if (entry.name === 'word/document.xml') documentFound = true;
        return false;
      } });
      if (!documentFound) throw new Error('Not a Word document');
      raw = (await mammoth.extractRawText({ buffer })).value;
    }
    const text = normalizeText(raw);
    if (!text) throw new AppError('This document contains no readable text. Please choose another document.');
    if (text.length > MAX_TEXT_CHARS) throw new AppError('Document too large. The maximum is 100,000 extracted characters per document. Please split the agreement.');
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('This document could not be read. It may be corrupted or password-protected. Please upload an unprotected PDF or DOCX.');
  }
}
