import { zipSync, strToU8 } from 'fflate';
import type { ComparisonResult } from '../types/contract';
export const companyText = 'All invoices are payable within fifteen calendar days.';
export const clientText = 'Undisputed invoices shall be paid within forty-five days following receipt.';
export const fixture: ComparisonResult = { summary: { aligned: 0, modified: 1, missing: 0, added: 0 }, clauses: [{ id: 'payment', name: 'Payment Terms', status: 'modified', companySection: null, clientSection: null, companyPosition: 'Payment is due within 15 days.', clientPosition: 'Undisputed invoices are due within 45 days of receipt.', companySourceText: companyText, clientSourceText: clientText, difference: 'The payment period increased from 15 to 45 days and an undisputed-invoice condition was added.', suggestedAction: 'Confirm whether Net 45 and the undisputed-invoice condition are commercially acceptable.', confidence: 'high' }] };
export function docx(text: string) {
  const xml = text.split('\n').map(p => `<w:p><w:r><w:t>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>`).join('');
  return Buffer.from(zipSync({ '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'), '_rels/.rels': strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'), 'word/document.xml': strToU8(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${xml}</w:body></w:document>`) }));
}
export function pdf(text = '') {
  const content = text ? `BT /F1 12 Tf 40 700 Td (${text}) Tj ET` : '';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let output = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((o, i) => { offsets.push(output.length); output += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = output.length;
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}
export function upload(bytes: Buffer, name = 'contract.docx') { return new File([new Uint8Array(bytes)], name, { type: name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }); }
