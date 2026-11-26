import type { ApiKeysMap, GemConfig, ParsedAttachment } from '../types';
import { serializeBlocksToMarkdown } from './markdownParser';

function buildFormatDirective(format: GemConfig['format']): string {
  switch (format) {
    case 'table-first':
      return '\nAlways include a clean GitHub-flavored Markdown pipe table as the primary result.';
    case 'json':
      return '\nReturn valid formatted JSON inside a ```json fenced code block.';
    case 'markdown':
      return '\nReturn cleanly structured Markdown (.md).';
    default:
      return '\nCombine concise Markdown insights with GitHub-flavored Markdown tables for structured records.';
  }
}

function buildDemoReply(gem: GemConfig, prompt: string, files: ParsedAttachment[]): string {
  const all = [...gem.refFiles, ...files];
  const csv = all.find((f) => f.name.toLowerCase().endsWith('.csv') && f.textContent);
  if (csv) {
    const lines = csv.textContent.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length >= 2) {
      const headers = lines[0].split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1, 30).map((l) => l.split(',').map((s) => s.trim().replace(/^"|"$/g, '')));
      return `### Demo Mode — Parsed \`${csv.name}\`\n\n${serializeBlocksToMarkdown([
        { type: 'table', headers, rows },
      ])}`;
    }
  }
  return `### ${gem.name} (Demo Mode)\nProcessed **${all.length} file(s)**${
    prompt ? ` for *"${prompt}"*` : ''
  }. Add your **${gem.provider.toUpperCase()}** API key in Settings and disable Demo Mode for live runs.\n\n| Item | Source | Category | Score | Status |\n| --- | --- | --- | --- | --- |\n| Extraction | ${
    all[0]?.name || 'Prompt'
  } | Analysis | 96 | Approved |\n| Verification | Workspace | Quality | 92 | Pending |`;
}

export async function runGem(
  gem: GemConfig,
  userPrompt: string,
  attachments: ParsedAttachment[],
  apiKeys: ApiKeysMap,
  demoMode: boolean
): Promise<string> {
  const key = (apiKeys[gem.provider] || '').trim();
  if (demoMode || !key) {
    await new Promise((r) => setTimeout(r, 400));
    return buildDemoReply(gem, userPrompt, attachments);
  }

  const systemPrompt = `${gem.prompt}${buildFormatDirective(gem.format)}`;
  const allFiles = [...gem.refFiles, ...attachments];
  const fileText = allFiles
    .map((f) => `--- FILE: ${f.name} (${f.mimeType}) ---\n${f.textContent}`)
    .join('\n\n');
  const combinedPrompt = [fileText, userPrompt || 'Process the attached files per instructions.']
    .filter(Boolean)
    .join('\n\n');

  if (gem.provider === 'gemini') {
    const parts: Array<Record<string, unknown>> = [{ text: combinedPrompt }];
    for (const f of allFiles) {
      if (f.base64 && (f.category === 'image' || f.category === 'audio' || f.mimeType === 'application/pdf')) {
        parts.push({ inline_data: { mime_type: f.mimeType, data: f.base64 } });
      }
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(gem.model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: gem.temperature },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Gemini HTTP ${res.status}`);
    return data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('\n') || '';
  }

  if (gem.provider === 'openai' || gem.provider === 'nvidia') {
    const endpoint =
      gem.provider === 'nvidia'
        ? 'https://integrate.api.nvidia.com/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
    const userParts: Array<Record<string, unknown>> = [{ type: 'text', text: combinedPrompt }];
    for (const f of allFiles) {
      if (f.dataUrl && f.category === 'image') {
        userParts.push({ type: 'image_url', image_url: { url: f.dataUrl } });
      }
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: gem.model,
        temperature: gem.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userParts.length > 1 ? userParts : combinedPrompt },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `${gem.provider} HTTP ${res.status}`);
    return data.choices?.[0]?.message?.content || '';
  }

  // Anthropic
  const content: Array<Record<string, unknown>> = [];
  for (const f of allFiles) {
    if (f.base64 && f.category === 'image') {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: f.mimeType, data: f.base64 },
      });
    }
  }
  content.push({ type: 'text', text: combinedPrompt });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: gem.model,
      max_tokens: 4096,
      temperature: gem.temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Anthropic HTTP ${res.status}`);
  return data.content?.map((c: { text?: string }) => c.text || '').join('\n') || '';
}
