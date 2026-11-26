import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import {
  Download,
  FileDown,
  FolderOpen,
  History,
  MessageSquare,
  Moon,
  Paperclip,
  Play,
  Plus,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { AppSettings, ChatSession, GemConfig, ParsedAttachment, ProviderId, StoredFile } from './types';
import { DEFAULT_GEMS, PROVIDER_META, getProviderModels } from './data/defaultGems';
import {
  deleteGem,
  deleteSession,
  deleteStoredFile,
  exportFullBackup,
  importFullBackup,
  loadGems,
  loadSessions,
  loadSettings,
  loadStoredFiles,
  saveGem,
  saveSession,
  saveSettings,
  saveStoredFile,
} from './services/storage';
import { parseFile } from './services/fileParser';
import { runGem } from './services/aiProviders';
import {
  exportMarkdown,
  parseMarkdownBlocks,
  serializeBlocksToMarkdown,
} from './services/markdownParser';
import { DataTableWorkspace } from './components/DataTableWorkspace';
import { Logo } from './components/Logo';

export default function App() {
  const [tab, setTab] = useState<'chat' | 'history' | 'files' | 'gems' | 'settings'>('chat');
  const [gems, setGems] = useState<GemConfig[]>(DEFAULT_GEMS);
  const [activeGemId, setActiveGemId] = useState<string>(DEFAULT_GEMS[0].id);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    demoMode: true,
    apiKeys: { gemini: '', openai: '', anthropic: '', nvidia: '' },
    customModels: { gemini: [], openai: [], anthropic: [], nvidia: [] },
  });
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<ParsedAttachment[]>([]);
  const [running, setRunning] = useState(false);
  const [editingGem, setEditingGem] = useState<GemConfig | null>(null);
  const [newModelInput, setNewModelInput] = useState('');
  const [settingsModelProvider, setSettingsModelProvider] = useState<ProviderId>('gemini');
  const [settingsModelInput, setSettingsModelInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const libraryFileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [loadedGems, loadedSessions, loadedSettings, loadedFiles] = await Promise.all([
        loadGems(),
        loadSessions(),
        loadSettings(),
        loadStoredFiles(),
      ]);
      setGems(loadedGems);
      setActiveGemId(loadedGems[0]?.id || DEFAULT_GEMS[0].id);
      setSettings(loadedSettings);
      setStoredFiles(loadedFiles);
      if (loadedSessions.length) {
        setSessions(loadedSessions);
        setActiveSessionId(loadedSessions[0].id);
      } else {
        const fresh: ChatSession = {
          id: `sess-${Date.now()}`,
          title: 'New Chat',
          gemId: loadedGems[0]?.id || DEFAULT_GEMS[0].id,
          updatedAt: Date.now(),
          messages: [],
        };
        await saveSession(fresh);
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
      }
    })();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const activeGem = gems.find((g) => g.id === activeGemId) || gems[0];
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const updateSettings = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const addCustomModel = async (provider: ProviderId, rawId: string): Promise<string | null> => {
    const modelId = rawId.trim();
    if (!modelId) return null;
    const existing = getProviderModels(provider, settings.customModels);
    if (!existing.includes(modelId)) {
      const nextList = [...(settings.customModels[provider] || []), modelId];
      await updateSettings({
        ...settings,
        customModels: { ...settings.customModels, [provider]: nextList },
      });
    }
    return modelId;
  };

  const removeCustomModel = async (provider: ProviderId, modelId: string) => {
    const nextList = (settings.customModels[provider] || []).filter((m) => m !== modelId);
    await updateSettings({
      ...settings,
      customModels: { ...settings.customModels, [provider]: nextList },
    });
  };

  const handleQuickModelChange = async (modelId: string) => {
    if (!activeGem) return;
    const updated = { ...activeGem, model: modelId };
    await saveGem(updated);
    setGems((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const parsed = await Promise.all(files.map(parseFile));
    const saved: StoredFile[] = parsed.map((p) => ({ ...p, savedAt: Date.now() }));
    await Promise.all(saved.map(saveStoredFile));
    setStoredFiles((prev) => [...saved, ...prev]);
    setAttachments((prev) => [...prev, ...parsed]);
    e.target.value = '';
  };

  const handleLibraryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const parsed = await Promise.all(files.map(parseFile));
    const saved: StoredFile[] = parsed.map((p) => ({ ...p, savedAt: Date.now() }));
    await Promise.all(saved.map(saveStoredFile));
    setStoredFiles((prev) => [...saved, ...prev]);
    e.target.value = '';
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteSession(sessionId);
    const remaining = sessions.filter((s) => s.id !== sessionId);
    if (remaining.length === 0) {
      const fresh: ChatSession = {
        id: `sess-${Date.now()}`,
        title: 'New Chat',
        gemId: activeGem.id,
        updatedAt: Date.now(),
        messages: [],
      };
      await saveSession(fresh);
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    } else {
      setSessions(remaining);
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  const handleRun = async () => {
    if ((!prompt.trim() && !attachments.length) || !activeSession || running) return;
    setRunning(true);

    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user' as const,
      content: prompt.trim() || `Run ${activeGem.name} on attached files`,
      attachments: attachments.map((a) => ({ name: a.name, category: a.category })),
      timestamp: Date.now(),
    };

    const updatedSession: ChatSession = {
      ...activeSession,
      title: activeSession.messages.length
        ? activeSession.title
        : attachments[0]?.name || prompt.trim().slice(0, 28) || activeGem.name,
      gemId: activeGem.id,
      updatedAt: Date.now(),
      messages: [...activeSession.messages, userMsg],
    };

    const currentAttachments = [...attachments];
    const currentPrompt = prompt.trim();
    setPrompt('');
    setAttachments([]);
    setSessions((prev) => prev.map((s) => (s.id === updatedSession.id ? updatedSession : s)));

    let replyText = '';
    try {
      replyText = await runGem(
        activeGem,
        currentPrompt,
        currentAttachments,
        settings.apiKeys,
        settings.demoMode
      );
    } catch (err) {
      replyText = `### Error\n> ${err instanceof Error ? err.message : String(err)}`;
    }

    const finalSession: ChatSession = {
      ...updatedSession,
      updatedAt: Date.now(),
      messages: [
        ...updatedSession.messages,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: replyText,
          gemName: activeGem.name,
          provider: activeGem.provider,
          model: activeGem.model,
          timestamp: Date.now(),
        },
      ],
    };

    await saveSession(finalSession);
    setSessions((prev) => prev.map((s) => (s.id === finalSession.id ? finalSession : s)));
    setRunning(false);
  };

  const updateTableInMessage = async (msgId: string, tableIdx: number, nextRows: string[][]) => {
    if (!activeSession) return;
    const nextMessages = activeSession.messages.map((m) => {
      if (m.id !== msgId) return m;
      const blocks = parseMarkdownBlocks(m.content);
      let seen = 0;
      const patched = blocks.map((b) => {
        if (b.type === 'table') {
          const out = seen === tableIdx ? { ...b, rows: nextRows } : b;
          seen++;
          return out;
        }
        return b;
      });
      return { ...m, content: serializeBlocksToMarkdown(patched) };
    });
    const nextSession = { ...activeSession, messages: nextMessages, updatedAt: Date.now() };
    await saveSession(nextSession);
    setSessions((prev) => prev.map((s) => (s.id === nextSession.id ? nextSession : s)));
  };

  const startNewChat = async () => {
    const fresh: ChatSession = {
      id: `sess-${Date.now()}`,
      title: 'New Chat',
      gemId: activeGem.id,
      updatedAt: Date.now(),
      messages: [],
    };
    await saveSession(fresh);
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setTab('chat');
  };

  const handleSaveGem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGem) return;
    await saveGem(editingGem);
    setGems((prev) => {
      const exists = prev.some((g) => g.id === editingGem.id);
      return exists ? prev.map((g) => (g.id === editingGem.id ? editingGem : g)) : [editingGem, ...prev];
    });
    setActiveGemId(editingGem.id);
    setEditingGem(null);
  };

  return (
    <div className="min-h-screen flex justify-center bg-slate-100 dark:bg-surface-950">
      <div className="w-full max-w-2xl h-[100dvh] bg-white dark:bg-surface-900 flex flex-col overflow-hidden sm:border-x border-slate-200 dark:border-slate-800">
        {/* Header */}
        <header className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo className="w-8 h-8 shrink-0 rounded-lg shadow-sm" />
            <div className="min-w-0">
              <div className="font-bold text-base flex items-center gap-2">
                <span>GemDeck AI</span>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                  {settings.demoMode ? 'Demo' : 'Live'}
                </span>
              </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span>{activeGem.icon} {activeGem.name} · {PROVIDER_META[activeGem.provider].short} ·</span>
              <select
                aria-label="Active model"
                value={activeGem.model}
                onChange={(e) => handleQuickModelChange(e.target.value)}
                className="bg-slate-100 dark:bg-surface-800 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded-md font-mono text-[11px] border border-slate-200 dark:border-slate-700 max-w-[170px] truncate"
              >
                {getProviderModels(activeGem.provider, settings.customModels, activeGem.model).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={startNewChat} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <SquarePen className="w-5 h-5" />
            </button>
            <button
              onClick={() =>
                updateSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })
              }
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {settings.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {tab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {!activeSession?.messages.length && (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 space-y-2">
                    <div className="text-3xl">{activeGem.icon}</div>
                    <h2 className="font-bold">{activeGem.name}</h2>
                    <p className="text-xs text-slate-500 max-w-sm">{activeGem.prompt}</p>
                  </div>
                )}
                {activeSession?.messages.map((msg) =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl bg-indigo-600 text-white px-3.5 py-2.5 text-sm space-y-1.5">
                        {msg.attachments?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {msg.attachments.map((a, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-white/15 text-[11px]">
                                📎 {a.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div>{msg.content}</div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={msg.id}
                      className="rounded-2xl bg-slate-50 dark:bg-surface-800 border border-slate-200 dark:border-slate-800 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs border-b border-slate-200 dark:border-slate-700 pb-1.5">
                        <span className="font-semibold">
                          {msg.gemName} · <span className="font-mono opacity-60">{msg.model}</span>
                        </span>
                        <button
                          onClick={() => exportMarkdown(msg.content)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Export .md"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                      </div>
                      {(() => {
                        let tIdx = 0;
                        return parseMarkdownBlocks(msg.content).map((block, bIdx) => {
                          if (block.type === 'markdown') {
                            return (
                              <div
                                key={bIdx}
                                className="prose-md text-sm"
                                dangerouslySetInnerHTML={{ __html: marked.parse(block.content) as string }}
                              />
                            );
                          }
                          const currentIdx = tIdx++;
                          return (
                            <DataTableWorkspace
                              key={bIdx}
                              headers={block.headers}
                              rows={block.rows}
                              onUpdateRows={(nextRows) => updateTableInMessage(msg.id, currentIdx, nextRows)}
                            />
                          );
                        });
                      })()}
                    </div>
                  )
                )}
              </div>

              {attachments.length > 0 && (
                <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto">
                  {attachments.map((att, idx) => (
                    <span
                      key={att.id}
                      className="shrink-0 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-surface-800 text-xs flex items-center gap-1.5"
                    >
                      📎 {att.name}
                      <button
                        onClick={() => setAttachments((p) => p.filter((_, i) => i !== idx))}
                        className="text-rose-500"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="shrink-0 p-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-end gap-2 bg-slate-100 dark:bg-surface-800 rounded-2xl p-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.csv,.json,.xlsx,.xls,.docx,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a,.ogg"
                    onChange={handleAttach}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-slate-500 hover:text-indigo-500"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <textarea
                    rows={1}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Optional prompt or hit Run..."
                    className="flex-1 bg-transparent resize-none outline-none text-sm py-2"
                  />
                  <button
                    disabled={running}
                    onClick={handleRun}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {running ? '...' : 'Run'}
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'history' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h1 className="font-bold text-base">Chat History ({sessions.length})</h1>
                <button
                  onClick={startNewChat}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> New Chat
                </button>
              </div>
              {sessions.map((s) => {
                const gem = gems.find((g) => g.id === s.gemId) || gems[0];
                const isActive = s.id === activeSession?.id;
                return (
                  <div
                    key={s.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                      isActive
                        ? 'bg-indigo-500/10 border-indigo-500/40'
                        : 'bg-slate-50 dark:bg-surface-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActiveSessionId(s.id);
                        if (gem) setActiveGemId(gem.id);
                        setTab('chat');
                      }}
                      className="text-left min-w-0 flex-1"
                    >
                      <div className="font-semibold text-sm truncate">
                        {gem?.icon} {s.title || 'New Chat'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {s.messages.length} message{s.messages.length === 1 ? '' : 's'} ·{' '}
                        {new Date(s.updatedAt).toLocaleString()}
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeleteSession(s.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-500 shrink-0"
                      aria-label={`Delete chat ${s.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'files' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="font-bold text-base">Stored Files ({storedFiles.length})</h1>
                  <p className="text-xs text-slate-500">Saved on-device across chats and restarts</p>
                </div>
                <button
                  onClick={() => libraryFileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Store File
                </button>
                <input
                  ref={libraryFileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleLibraryUpload}
                />
              </div>
              {!storedFiles.length && (
                <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                  No stored files yet. Files you attach in Chat or upload here are saved on-device so you can reuse them anytime.
                </div>
              )}
              {storedFiles.map((f) => (
                <div
                  key={f.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-surface-800 border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{f.name}</div>
                      <div className="text-xs text-slate-500">
                        {f.category} · {(f.size / 1024).toFixed(1)} KB · {new Date(f.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setAttachments((prev) =>
                            prev.some((a) => a.id === f.id) ? prev : [...prev, f]
                          );
                          setTab('chat');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                      >
                        Use in Chat
                      </button>
                      <button
                        onClick={async () => {
                          await deleteStoredFile(f.id);
                          setStoredFiles((prev) => prev.filter((item) => item.id !== f.id));
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500"
                        aria-label={`Delete ${f.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {f.textContent && (
                    <div className="text-[11px] font-mono text-slate-500 bg-white dark:bg-surface-900 rounded-xl p-2 max-h-20 overflow-hidden">
                      {f.textContent.slice(0, 200)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'gems' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="font-bold text-lg">Your Gems</h1>
                <button
                  onClick={() =>
                    setEditingGem({
                      id: `gem-${Date.now()}`,
                      name: '',
                      icon: '✨',
                      provider: 'gemini',
                      model: 'gemini-2.5-flash',
                      format: 'table-first',
                      temperature: 0.2,
                      prompt: '',
                      refFiles: [],
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> New Gem
                </button>
              </div>
              {gems.map((g) => (
                <div
                  key={g.id}
                  className={`p-4 rounded-2xl border ${
                    g.id === activeGemId
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-surface-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-sm">
                      {g.icon} {g.name}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setActiveGemId(g.id);
                          setTab('chat');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => setEditingGem(g)}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs"
                      >
                        Edit
                      </button>
                      {gems.length > 1 && (
                        <button
                          onClick={async () => {
                            await deleteGem(g.id);
                            setGems((prev) => prev.filter((x) => x.id !== g.id));
                          }}
                          className="p-1 text-rose-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">
                    {PROVIDER_META[g.provider].short} · {g.model} · {g.format}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{g.prompt}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <h1 className="font-bold text-lg">Settings & Local Keys</h1>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">Demo Mode</div>
                  <div className="text-xs text-slate-500">Simulate outputs locally when API keys are blank</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.demoMode}
                  onChange={(e) => updateSettings({ ...settings, demoMode: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <h2 className="font-semibold text-sm">BYOK API Keys (Stored On-Device)</h2>
                {(Object.keys(PROVIDER_META) as ProviderId[]).map((pid) => (
                  <div key={pid}>
                    <label className="block text-xs text-slate-500 mb-1">{PROVIDER_META[pid].name}</label>
                    <input
                      type="password"
                      value={settings.apiKeys[pid]}
                      placeholder={PROVIDER_META[pid].placeholder}
                      onChange={(e) =>
                        updateSettings({
                          ...settings,
                          apiKeys: { ...settings.apiKeys, [pid]: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <div>
                  <h2 className="font-semibold text-sm">Custom Models</h2>
                  <p className="text-xs text-slate-500">Add any model ID or name (e.g. gemini-2.5-flash-preview-05-20) to use it in Gems and Chat.</p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={settingsModelProvider}
                    onChange={(e) => setSettingsModelProvider(e.target.value as ProviderId)}
                    className="px-2.5 py-2 rounded-xl bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    {(Object.keys(PROVIDER_META) as ProviderId[]).map((pid) => (
                      <option key={pid} value={pid}>
                        {PROVIDER_META[pid].short}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={settingsModelInput}
                    onChange={(e) => setSettingsModelInput(e.target.value)}
                    placeholder="Model ID (e.g. gemini-2.5-flash)"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const added = await addCustomModel(settingsModelProvider, settingsModelInput);
                      if (added) setSettingsModelInput('');
                    }}
                    className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shrink-0"
                  >
                    Add
                  </button>
                </div>
                {(Object.keys(PROVIDER_META) as ProviderId[]).some(
                  (pid) => (settings.customModels[pid] || []).length > 0
                ) && (
                  <div className="space-y-1.5 pt-1">
                    {(Object.keys(PROVIDER_META) as ProviderId[]).map((pid) => {
                      const list = settings.customModels[pid] || [];
                      if (!list.length) return null;
                      return (
                        <div key={pid} className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-500 mr-1">
                            {PROVIDER_META[pid].short}:
                          </span>
                          {list.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono"
                            >
                              {m}
                              <button
                                type="button"
                                onClick={() => removeCustomModel(pid, m)}
                                className="text-slate-400 hover:text-rose-500"
                                aria-label={`Remove ${m}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    const raw = await exportFullBackup();
                    await exportMarkdown(raw, 'gemdeck-backup.json');
                  }}
                  className="py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> Export Backup
                </button>
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-4 h-4" /> Import Backup
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const restored = await importFullBackup(await f.text());
                    setGems(restored.gems);
                    setSessions(restored.sessions);
                    setStoredFiles(restored.files);
                  }}
                />
              </div>
            </div>
          )}
        </main>

        {/* Bottom Nav */}
        <nav className="shrink-0 border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 p-1.5">
          <button
            onClick={() => setTab('chat')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] ${
              tab === 'chat' ? 'text-indigo-500 bg-indigo-500/10 font-semibold' : 'text-slate-500'
            }`}
          >
            <MessageSquare className="w-5 h-5" /> Chat
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] ${
              tab === 'history' ? 'text-indigo-500 bg-indigo-500/10 font-semibold' : 'text-slate-500'
            }`}
          >
            <History className="w-5 h-5" /> History
          </button>
          <button
            onClick={() => setTab('files')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] ${
              tab === 'files' ? 'text-indigo-500 bg-indigo-500/10 font-semibold' : 'text-slate-500'
            }`}
          >
            <FolderOpen className="w-5 h-5" /> Files
          </button>
          <button
            onClick={() => setTab('gems')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] ${
              tab === 'gems' ? 'text-indigo-500 bg-indigo-500/10 font-semibold' : 'text-slate-500'
            }`}
          >
            <Sparkles className="w-5 h-5" /> Gems
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] ${
              tab === 'settings' ? 'text-indigo-500 bg-indigo-500/10 font-semibold' : 'text-slate-500'
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" /> Settings
          </button>
        </nav>

        {/* Gem Editor Modal */}
        {editingGem && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
            <form
              onSubmit={handleSaveGem}
              className="w-full max-w-lg bg-white dark:bg-surface-900 rounded-t-3xl sm:rounded-3xl p-4 space-y-3 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="font-bold text-sm">Configure Gem</h2>
              <div className="grid grid-cols-[64px_1fr] gap-2">
                <input
                  value={editingGem.icon}
                  onChange={(e) => setEditingGem({ ...editingGem, icon: e.target.value })}
                  className="text-center py-2 rounded-xl bg-slate-100 dark:bg-surface-800"
                />
                <input
                  required
                  placeholder="Gem Name"
                  value={editingGem.name}
                  onChange={(e) => setEditingGem({ ...editingGem, name: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-surface-800 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={editingGem.provider}
                  onChange={(e) => {
                    const p = e.target.value as ProviderId;
                    setEditingGem({ ...editingGem, provider: p, model: PROVIDER_META[p].models[0] });
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-surface-800 text-xs"
                >
                  {(Object.keys(PROVIDER_META) as ProviderId[]).map((pid) => (
                    <option key={pid} value={pid}>
                      {PROVIDER_META[pid].name}
                    </option>
                  ))}
                </select>
                <select
                  value={editingGem.model}
                  onChange={(e) => setEditingGem({ ...editingGem, model: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-surface-800 text-xs font-mono"
                >
                  {getProviderModels(editingGem.provider, settings.customModels, editingGem.model).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newModelInput}
                  onChange={(e) => setNewModelInput(e.target.value)}
                  placeholder={`Add custom ${PROVIDER_META[editingGem.provider].short} model ID...`}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-100 dark:bg-surface-800 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const added = await addCustomModel(editingGem.provider, newModelInput);
                    if (added) {
                      setEditingGem({ ...editingGem, model: added });
                      setNewModelInput('');
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shrink-0"
                >
                  + Add Model
                </button>
              </div>
              <textarea
                required
                rows={4}
                placeholder="Custom instructions..."
                value={editingGem.prompt}
                onChange={(e) => setEditingGem({ ...editingGem, prompt: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-surface-800 text-xs"
              />
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span>Persistent Reference Files ({editingGem.refFiles.length})</span>
                  <button
                    type="button"
                    onClick={() => refFileInputRef.current?.click()}
                    className="text-indigo-500 font-semibold"
                  >
                    + Add
                  </button>
                  <input
                    ref={refFileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const list = Array.from(e.target.files || []);
                      const parsed = await Promise.all(list.map(parseFile));
                      setEditingGem({ ...editingGem, refFiles: [...editingGem.refFiles, ...parsed] });
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGem(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                >
                  Save Gem
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
