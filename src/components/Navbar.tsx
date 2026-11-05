import React, { useState } from 'react';
import {
  Activity,
  BookOpen,
  Calculator,
  ChevronDown,
  Clock,
  Cpu,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PRESET_SAMPLES } from '../utils/presets';
import { PresetSample } from '../types/protocol';

interface NavbarProps {
  onSelectPreset: (preset: PresetSample) => void;
  onOpenCrcModal: () => void;
  onOpenRefModal: () => void;
  onOpenHistory: () => void;
  historyCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onSelectPreset,
  onOpenCrcModal,
  onOpenRefModal,
  onOpenHistory,
  historyCount,
}) => {
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);

  return (
    <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-600 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-100 text-base sm:text-lg tracking-tight">
                Industrial Protocol Analyzer
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/40 text-[10px] font-mono font-semibold">
                v2.4 Pro
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono hidden sm:block">
              工控通訊封包解析與除錯工具 | Modbus RTU / ASCII / TCP & MELSEC MC 3E
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Preset Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">常規測試範例</span>
              <span className="md:hidden">範例</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {presetDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setPresetDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-30 max-h-96 overflow-y-auto divide-y divide-slate-800">
                  <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    常用標準工控封包 (一鍵填入測試)
                  </div>
                  {PRESET_SAMPLES.map(sample => (
                    <button
                      key={sample.id}
                      onClick={() => {
                        onSelectPreset(sample);
                        setPresetDropdownOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800 transition-colors group block"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300">
                          {sample.title}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                          {sample.category}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-amber-300 truncate mb-1">
                        {sample.hex}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight">
                        {sample.description}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* CRC & LRC Standalone Calculator Button */}
          <button
            onClick={onOpenCrcModal}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700/80 transition-colors"
            title="開啟獨立 CRC-16 / LRC 即時計算機"
          >
            <Calculator className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">CRC 計算機</span>
          </button>

          {/* Protocol Reference Manual Button */}
          <button
            onClick={onOpenRefModal}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700/80 transition-colors"
            title="開啟協定速查手冊"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">速查手冊</span>
          </button>

          {/* History Button */}
          <button
            onClick={onOpenHistory}
            className="relative px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700/80 transition-colors"
            title="檢視歷史封包紀錄"
          >
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">歷史</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-slate-950 font-mono font-bold text-[10px]">
                {historyCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
