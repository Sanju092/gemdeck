import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { ContentBlock } from '../types';

export function parseMarkdownBlocks(md: string): ContentBlock[] {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ContentBlock[] = [];
  let textBuf: string[] = [];
  let i = 0;

  const flush = () => {
    const joined = textBuf.join('\n').trim();
    if (joined) blocks.push({ type: 'markdown', content: joined });
    textBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1] || '';
    const isTable =
      line.includes('|') &&
      /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(next);

    if (isTable) {
      flush();
      const splitRow = (r: string) =>
        r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const headers = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        const cells = splitRow(lines[i]);
        while (cells.length < headers.length) cells.push('');
        rows.push(cells.slice(0, headers.length));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
    } else {
      textBuf.push(line);
      i++;
    }
  }
  flush();
  return blocks;
}

export function serializeBlocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'markdown') return b.content;
      const head = `| ${b.headers.join(' | ')} |`;
      const sep = `| ${b.headers.map(() => '---').join(' | ')} |`;
      const body = b.rows.map(
        (r) => `| ${r.map((c) => String(c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`
      );
      return [head, sep, ...body].join('\n');
    })
    .join('\n\n');
}

export function smartCompare(a: string, b: string): number {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  const na = parseFloat(sa.replace(/[$€£₹,%\s]/g, ''));
  const nb = parseFloat(sb.replace(/[$€£₹,%\s]/g, ''));
  const isNumA = sa !== '' && !Number.isNaN(na) && /^[$€£₹+\-]?\d[\d,.]*%?$/.test(sa);
  const isNumB = sb !== '' && !Number.isNaN(nb) && /^[$€£₹+\-]?\d[\d,.]*%?$/.test(sb);
  if (isNumA && isNumB) return na - nb;
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
}

async function saveOrDownload(filename: string, content: Blob | string, isBinary = false) {
  if (Capacitor.isNativePlatform()) {
    let dataStr = '';
    if (typeof content === 'string') {
      dataStr = content;
    } else {
      const buf = await content.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      bytes.forEach((b) => (bin += String.fromCharCode(b)));
      dataStr = btoa(bin);
    }
    const written = await Filesystem.writeFile({
      path: filename,
      data: dataStr,
      directory: Directory.Cache,
      encoding: isBinary ? undefined : Encoding.UTF8,
    });
    await Share.share({ title: filename, url: written.uri });
    return;
  }

  const blob = typeof content === 'string' ? new Blob([content], { type: 'text/plain;charset=utf-8' }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportCSV(headers: string[], rows: string[][], name = 'gemdeck-table.csv') {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  await saveOrDownload(name, csv, false);
}

export async function exportMarkdown(content: string, name = 'gemdeck-result.md') {
  await saveOrDownload(name, content, false);
}

export async function exportXLSX(headers: string[], rows: string[][], name = 'gemdeck-table.xlsx') {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'GemDeck');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  await saveOrDownload(name, blob, true);
}
