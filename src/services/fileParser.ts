import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import type { FileCategory, ParsedAttachment } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

function fileToBase64(file: File): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
      resolve({ dataUrl, base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages: string[] = [];
    const maxPages = Math.min(pdf.numPages, 30);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      pages.push(`--- Page ${i} ---
${text}`);
    }
    return pages.join('

').slice(0, 80000);
  } catch {
    return '[PDF attached as binary payload]';
  }
}

export async function parseFile(file: File): Promise<ParsedAttachment> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    const { dataUrl, base64 } = await fileToBase64(file);
    return {
      id,
      name: file.name,
      mimeType: file.type || 'image/png',
      size: file.size,
      category: 'image',
      base64,
      dataUrl,
      textContent: `[Image attached: ${file.name}]`,
    };
  }

  if (file.type.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) {
    const { base64 } = await fileToBase64(file);
    return {
      id,
      name: file.name,
      mimeType: file.type || 'audio/mpeg',
      size: file.size,
      category: 'audio',
      base64,
      textContent: `[Audio file attached: ${file.name}]`,
    };
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheets = wb.SheetNames.map((name) => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
      return `### Sheet: ${name}
${csv}`;
    });
    return {
      id,
      name: file.name,
      mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: file.size,
      category: 'spreadsheet',
      textContent: sheets.join('

').slice(0, 80000),
    };
  }

  if (ext === 'docx') {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return {
      id,
      name: file.name,
      mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: file.size,
      category: 'document',
      textContent: result.value.slice(0, 80000),
    };
  }

  if (ext === 'pdf' || file.type === 'application/pdf') {
    const [buf, b64] = await Promise.all([file.arrayBuffer(), fileToBase64(file)]);
    const text = await extractPdfText(buf);
    return {
      id,
      name: file.name,
      mimeType: 'application/pdf',
      size: file.size,
      category: 'document',
      base64: b64.base64,
      textContent: text,
    };
  }

  const category: FileCategory = ext === 'csv' ? 'spreadsheet' : 'document';
  const textContent = (await file.text()).slice(0, 80000);
  return {
    id,
    name: file.name,
    mimeType: file.type || 'text/plain',
    size: file.size,
    category,
    textContent,
  };
}
