import { AppError } from './errors';
import { MAX_REQUEST_BYTES } from './limits';
export async function readForm(request: Request): Promise<FormData> {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new AppError('Please upload both documents as multipart form data.');
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) throw new AppError('Upload too large. The maximum is 10 MB per document.', 413);
  if (!request.body) throw new AppError('Please upload both documents.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new AppError('Upload too large. The maximum is 10 MB per document.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const data = Buffer.concat(chunks);
    return await new Response(data, { headers: { 'content-type': request.headers.get('content-type')! } }).formData();
  } catch { throw new AppError('The upload could not be read. Please select the documents again.'); }
}
