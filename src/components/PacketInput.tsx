import React, { useState } from 'react';
import {
  ArrowRight,
  Clipboard,
  Eraser,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ProtocolType } from '../types/protocol';
import { cleanHexInput, formatBytes } from '../utils/crc';

interface PacketInputProps {
  inputHex: string;
  onChangeInput: (value: string) => void;
  selectedProtocol: ProtocolType;
  onChangeProtocol: (protocol: ProtocolType) => void;
  onClear: () => void;
}

export const PacketInput: React.FC<PacketInputProps> = ({
  inputHex,
  onChangeInput,
  selectedProtocol,
  onChangeProtocol,
  onClear,
}) => {
  const [copied, setCopied] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChangeInput(text);
    } catch {
      // Fallback if permission denied
    }
  };

  const handleFormatSpaces = () => {
    const { bytes } = cleanHexInput(inputHex);
    if (bytes.length > 0) {
      onChangeInput(formatBytes(bytes, ' '));
    }
  };

  const handleCompact = () => {
    const { bytes } = cleanHexInput(inputHex);
    if (bytes.length > 0) {
      onChangeInput(formatBytes(bytes, ''));
    }
  };

  // Quick preset bar for the top 5 requested examples
  const QUICK_EXAMPLES = [
    { label: 'RTU FC03 讀取請求', hex: '01 03 00 00 00 02 C4 0B' },
    { label: 'RTU 浮點數回應 (123.25)', hex: '01 03 04 42 F6 40 00 95 6B' },
    { label: 'RTU FC06 寫入暫存器', hex: '01 06 00 01 00 64 D9 E1' },
    { label: 'RTU 異常回應 (0x83 0x02)', hex: '01 83 02 C0 F1' },
    { label: 'Modbus TCP 請求', hex: '00 01 00 00 00 06 01 03 00 00 00 02' },
    { label: 'MC 3E 讀取 D100 (2點)', hex: '50 00 00 FF FF 03 00 0C 00 10 00 01 04 00 00 64 00 00 A8 02 00' },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
      {/* Top Header & Protocol Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            封包輸入 (Packet Hex Input)
          </span>
          <span className="text-xs text-slate-400 font-mono hidden md:inline">
            支援 0x、空格、冒號或連字號分隔
          </span>
        </div>

        {/* Protocol Enforcement Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <span className="text-slate-400 px-1 text-[11px] hidden lg:inline">協定:</span>
          {[
            { id: 'auto', label: '自動偵測 (Auto)' },
            { id: 'modbus-rtu', label: 'Modbus RTU' },
            { id: 'modbus-tcp', label: 'Modbus TCP' },
            { id: 'modbus-ascii', label: 'ASCII' },
            { id: 'mc-3e-binary', label: 'MC 3E' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => onChangeProtocol(p.id as ProtocolType)}
              className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                selectedProtocol === p.id
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Textarea */}
      <div className="relative">
        <textarea
          rows={3}
          value={inputHex}
          onChange={e => onChangeInput(e.target.value)}
          placeholder="在此貼上或輸入十六進制封包，例如: 01 03 00 00 00 02 C4 0B 或 :010300000002F0\r\n"
          className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl p-3.5 font-mono text-sm sm:text-base text-cyan-200 placeholder:text-slate-600 focus:outline-none transition-colors tracking-wider leading-relaxed resize-y selection:bg-cyan-500/30"
          spellCheck={false}
        />
      </div>

      {/* Formatting & Utility Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-xs">
        {/* Quick Examples Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 text-[11px] flex items-center gap-1 mr-1">
            <Zap className="w-3 h-3 text-amber-400" />
            範例:
          </span>
          {QUICK_EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => onChangeInput(ex.hex)}
              className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] font-mono transition-colors border border-slate-700/60"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Input tools */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={handlePaste}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition-colors border border-slate-700"
            title="貼上剪貼簿內容"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>貼上</span>
          </button>

          <button
            onClick={handleFormatSpaces}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors border border-slate-700"
            title="標準化為 2-Byte 空格分隔"
          >
            整齊排版
          </button>

          <button
            onClick={handleCompact}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors border border-slate-700"
            title="移除所有空格"
          >
            緊湊模式
          </button>

          <button
            onClick={onClear}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-xs flex items-center gap-1 transition-colors border border-slate-700"
            title="清除全部輸入"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>清除</span>
          </button>
        </div>
      </div>
    </div>
  );
};
