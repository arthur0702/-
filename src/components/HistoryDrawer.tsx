import React, { useState } from 'react';
import { Clock, Download, FileText, Trash2, Upload, X } from 'lucide-react';
import { SavedPacketRecord } from '../types/protocol';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: SavedPacketRecord[];
  onSelectPacket: (hex: string) => void;
  onDeletePacket: (id: string) => void;
  onClearHistory: () => void;
  onImportHistory: (records: SavedPacketRecord[]) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectPacket,
  onDeletePacket,
  onClearHistory,
  onImportHistory,
}) => {
  const [filter, setFilter] = useState('');

  if (!isOpen) return null;

  const filtered = history.filter(
    h =>
      h.title.toLowerCase().includes(filter.toLowerCase()) ||
      h.hex.toLowerCase().includes(filter.toLowerCase()) ||
      h.summary.toLowerCase().includes(filter.toLowerCase())
  );

  const handleExport = () => {
    const jsonStr = JSON.stringify(history, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `industrial_packets_history_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportHistory(parsed);
        }
      } catch {
        alert('匯入失敗：請確認檔案為正確的 JSON 格式。');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end">
      <div className="bg-slate-900 border-l border-slate-700 w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-sm">封包歷史記錄 (Packet History)</h3>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono">
              {history.length} 筆
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Actions Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/40 space-y-2">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="搜尋站號、功能碼或 Hex..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
          />

          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
                title="匯出 JSON 備份"
              >
                <Download className="w-3.5 h-3.5" />
                <span>匯出</span>
              </button>

              <label className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>匯入</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>

            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空全部</span>
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>目前尚無歷史記錄</p>
              <p className="text-[11px] text-slate-400 mt-1">
                每次解析或測試封包時，系統將自動儲存於此。
              </p>
            </div>
          ) : (
            filtered.map(item => (
              <div
                key={item.id}
                className="bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 rounded-xl p-3 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {item.protocol}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        item.isValid
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {item.isValid ? 'OK' : 'ERR'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <button
                    onClick={() => onDeletePacket(item.id)}
                    className="text-slate-400 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="刪除此筆記錄"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Hex */}
                <div
                  onClick={() => {
                    onSelectPacket(item.hex);
                    onClose();
                  }}
                  className="font-mono text-xs text-amber-300 font-semibold cursor-pointer hover:underline truncate mb-1"
                >
                  {item.hex}
                </div>

                {/* Summary */}
                <div className="text-[11px] text-slate-400 truncate">{item.summary}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
