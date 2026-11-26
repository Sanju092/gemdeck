import type { GemConfig, ProviderId } from '../types';

export const PROVIDER_META: Record<
  ProviderId,
  { name: string; short: string; placeholder: string; models: string[] }
> = {
  gemini: {
    name: 'Google Gemini',
    short: 'Gemini',
    placeholder: 'AIzaSy...',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  },
  openai: {
    name: 'OpenAI',
    short: 'OpenAI',
    placeholder: 'sk-proj-...',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o'],
  },
  anthropic: {
    name: 'Anthropic',
    short: 'Claude',
    placeholder: 'sk-ant-...',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
  },
  nvidia: {
    name: 'NVIDIA NIM',
    short: 'NVIDIA',
    placeholder: 'nvapi-...',
    models: [
      'meta/llama-3.3-70b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'qwen/qwen2.5-72b-instruct',
    ],
  },
};

export const DEFAULT_GEMS: GemConfig[] = [
  {
    id: 'gem-invoices',
    name: 'Invoice & Receipt Extractor',
    icon: '🧾',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    format: 'table-first',
    temperature: 0.1,
    prompt:
      'Extract every expense, invoice, or receipt line item from the uploaded files. Return a brief 2-line summary followed by a clean Markdown table with columns: Date | Vendor | Category | Amount (USD) | Status | Notes.',
    refFiles: [],
  },
  {
    id: 'gem-analyst',
    name: 'CSV & Dataset Analyst',
    icon: '📊',
    provider: 'nvidia',
    model: 'meta/llama-3.3-70b-instruct',
    format: 'mixed',
    temperature: 0.2,
    prompt:
      'Analyze the uploaded spreadsheet, CSV, or JSON files. Provide key trends in bullet points, followed by a sortable Markdown summary table with metrics, totals, and priority flags.',
    refFiles: [],
  },
  {
    id: 'gem-meeting',
    name: 'Meeting & Doc Summarizer',
    icon: '📝',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    format: 'mixed',
    temperature: 0.3,
    prompt:
      'Summarize the uploaded document or meeting notes into clear Markdown sections and an Action Items table with columns: Task | Owner | Due Date | Priority | Status.',
    refFiles: [],
  },
  {
    id: 'gem-audio',
    name: 'Audio Action Tracker',
    icon: '🎙️',
    provider: 'openai',
    model: 'gpt-4o',
    format: 'table-first',
    temperature: 0.2,
    prompt:
      'Process the uploaded audio memo or transcript. Extract speaker highlights and build a sortable Markdown table of tasks, timestamps, owners, and urgency levels.',
    refFiles: [],
  },
];
