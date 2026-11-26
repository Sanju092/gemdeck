import React, { useMemo, useState } from 'react';
import { Columns3, Search, X } from 'lucide-react';
import {
  exportCSV,
  exportMarkdown,
  exportXLSX,
  serializeBlocksToMarkdown,
  smartCompare,
} from '../services/markdownParser';

interface Props {
  headers: string[];
  rows: string[][];
  onUpdateRows: (nextRows: string[][]) => void;
}

export const DataTableWorkspace: React.FC<Props> = ({ headers, rows, onUpdateRows }) => {
  const [sortCol, setSortCol] = useState<number>(-1);
  const [sortDir, setSortDir] = useState<0 | 1 | -1>(0);
  const [filter, setFilter] = useState('');
  const [hiddenCols, setHiddenCols] = useState<Set<number>>(new Set());
  const [showCols, setShowCols] = useState(false);
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
  const [draftRow, setDraftRow] = useState<string[]>([]);

  const visibleCols = useMemo(
    () => headers.map((_, idx) => idx).filter((idx) => !hiddenCols.has(idx)),
    [headers, hiddenCols]
  );

  const displayed = useMemo(() => {
    let list = rows.map((row, origIdx) => ({ row, origIdx }));
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      list = list.filter(({ row }) =>
        visibleCols.some((ci) => String(row[ci] ?? '').toLowerCase().includes(q))
      );
    }
    if (sortCol >= 0 && sortDir !== 0) {
      list.sort((a, b) => sortDir * smartCompare(a.row[sortCol], b.row[sortCol]));
    }
    return list;
  }, [rows, filter, visibleCols, sortCol, sortDir]);

  const toggleSort = (ci: number) => {
    if (sortCol !== ci) {
      setSortCol(ci);
      setSortDir(1);
    } else if (sortDir === 1) {
      setSortDir(-1);
    } else {
      setSortCol(-1);
      setSortDir(0);
    }
  };

  const toggleColumn = (ci: number) => {
    const next = new Set(hiddenCols);
    if (next.has(ci)) {
      next.delete(ci);
    } else if (visibleCols.length > 1) {
      next.add(ci);
    }
    setHiddenCols(next);
  };

  const openEditor = (origIdx: number) => {
    setEditingRowIdx(origIdx);
    setDraftRow([...rows[origIdx]]);
  };

  const saveRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRowIdx === null) return;
    const next = rows.map((r, i) => (i === editingRowIdx ? draftRow : r));
    onUpdateRows(next);
    setEditingRowIdx(null);
  };

  const removeRow = () => {
    if (editingRowIdx === null) return;
    onUpdateRows(rows.filter((_, i) => i !== editingRowIdx));
    setEditingRowIdx(null);
  };

  const expHeaders = visibleCols.map((ci) => headers[ci]);
  const expRows = displayed.map(({ row }) => visibleCols.map((ci) => row[ci]));

  return (
    <div className="my-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-900 overflow-hidden shadow-sm">
      <div className="p-2.5 bg-slate-50 dark:bg-surface-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[130px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${rows.length} rows...`}
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowCols((v) => !v)}
            className="px-2 py-1.5 rounded-lg bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium flex items-center gap-1"
          >
            <Columns3 className="w-3.5 h-3.5" /> Cols
          </button>
          <button
            type="button"
            onClick={() => exportCSV(expHeaders, expRows)}
            className="px-2 py-1.5 rounded-lg bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => exportXLSX(expHeaders, expRows)}
            className="px-2 py-1.5 rounded-lg bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium"
          >
            XLSX
          </button>
          <button
            type="button"
            onClick={() =>
              exportMarkdown(
                serializeBlocksToMarkdown([{ type: 'table', headers: expHeaders, rows: expRows }])
              )
            }
            className="px-2 py-1.5 rounded-lg bg-white dark:bg-surface-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium"
          >
            MD
          </button>
        </div>
      </div>

      {showCols && (
        <div className="px-2.5 py-2 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-1.5">
          {headers.map((h, ci) => {
            const active = !hiddenCols.has(ci);
            return (
              <button
                key={ci}
                type="button"
                onClick={() => toggleColumn(ci)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium border ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-surface-800 text-slate-500 border-slate-300 dark:border-slate-700'
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-100 dark:bg-surface-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              {visibleCols.map((ci) => (
                <th
                  key={ci}
                  onClick={() => toggleSort(ci)}
                  className="px-3 py-2.5 font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                >
                  {headers[ci]}{' '}
                  <span className="text-[10px] opacity-60">
                    {sortCol === ci ? (sortDir === 1 ? '▲' : '▼') : '⇅'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayed.map(({ row, origIdx }) => (
              <tr
                key={origIdx}
                onClick={() => openEditor(origIdx)}
                className="hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 cursor-pointer"
              >
                {visibleCols.map((ci) => (
                  <td key={ci} className="px-3 py-2.5 whitespace-nowrap max-w-[180px] truncate">
                    {row[ci]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-1.5 bg-slate-50 dark:bg-surface-800/60 border-t border-slate-200 dark:border-slate-700 flex justify-between text-[10px] text-slate-500">
        <span>
          Showing {displayed.length} of {rows.length} rows
        </span>
        <span>Tap any row to inspect & edit</span>
      </div>

      {editingRowIdx !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="w-full max-w-2xl bg-white dark:bg-surface-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 max-h-[82vh] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-bold text-sm">Row {editingRowIdx + 1} Editor</span>
              <button type="button" onClick={() => setEditingRowIdx(null)} className="p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={saveRow} className="overflow-y-auto p-4 space-y-3">
              {headers.map((h, ci) => (
                <div key={ci}>
                  <label className="block text-xs text-slate-500 mb-1">{h}</label>
                  <input
                    value={draftRow[ci] ?? ''}
                    onChange={(e) => {
                      const next = [...draftRow];
                      next[ci] = e.target.value;
                      setDraftRow(next);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-surface-800 border border-slate-200 dark:border-slate-700 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={removeRow}
                  className="px-3.5 py-2.5 rounded-xl border border-rose-400 text-rose-500 text-xs font-semibold"
                >
                  Delete Row
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
