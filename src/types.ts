export type ProviderId = 'gemini' | 'openai' | 'anthropic' | 'nvidia';

export type OutputFormat = 'table-first' | 'mixed' | 'markdown' | 'json';

export type FileCategory = 'document' | 'spreadsheet' | 'image' | 'audio';

export interface ParsedAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  textContent: string;
  base64?: string;
  dataUrl?: string;
}

export interface GemConfig {
  id: string;
  name: string;
  icon: string;
  provider: ProviderId;
  model: string;
  format: OutputFormat;
  temperature: number;
  prompt: string;
  refFiles: ParsedAttachment[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  gemName?: string;
  provider?: ProviderId;
  model?: string;
  attachments?: Array<{ name: string; category: FileCategory }>;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  gemId: string;
  updatedAt: number;
  messages: ChatMessage[];
}

export type ApiKeysMap = Record<ProviderId, string>;

export type CustomModelsMap = Record<ProviderId, string[]>;

export interface AppSettings {
  theme: 'dark' | 'light';
  demoMode: boolean;
  apiKeys: ApiKeysMap;
  customModels: CustomModelsMap;
}

export type ContentBlock =
  | { type: 'markdown'; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] };
