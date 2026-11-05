import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  Binary,
  BookOpen,
  CheckCircle2,
  Code2,
  Cpu,
  Layers,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { PacketInput } from './components/PacketInput';
import { ByteViewer } from './components/ByteViewer';
import { FieldBreakdown } from './components/FieldBreakdown';
import { DiagnosticsCard } from './components/DiagnosticsCard';
import { DataInspector } from './components/DataInspector';
import { PacketBuilder } from './components/PacketBuilder';
import { ScriptGenerator } from './components/ScriptGenerator';
import { CrcCalculatorModal } from './components/CrcCalculatorModal';
import { ReferenceModal } from './components/ReferenceModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { PresetSample, ProtocolType, SavedPacketRecord } from './types/protocol';
import { parsePacket } from './utils/protocolParsers';
import { PRESET_SAMPLES } from './utils/presets';

const STORAGE_KEY = 'industrial_analyzer_packet_history';

export default function App() {
  // Input state
  const [inputHex, setInputHex] = useState<string>('01 03 00 00 00 02 C4 0B');
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>('auto');

  // Interactive highlighting
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [selectedByteIndex, setSelectedByteIndex] = useState<number | null>(null);

  // Active workspace tab
  const [activeTab, setActiveTab] = useState<'breakdown' | 'data' | 'builder' | 'script'>('breakdown');

  // Modals & Drawers
  const [crcModalOpen, setCrcModalOpen] = useState(false);
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // History state
  const [history, setHistory] = useState<SavedPacketRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return [
      {
        id: 'init-1',
        timestamp: Date.now() - 3600000,
        title: '預設測試：FC03 讀取暫存器',
        protocol: 'Modbus RTU',
        hex: '01 03 00 00 00 02 C4 0B',
        summary: '主站向從站 [1] 發送【讀取保持暫存器】請求，起始位址 0x0000，共 2 點',
        isValid: true,
      },
    ];
  });

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage error
    }
  }, [history]);

  // Execute protocol parsing
  const analysisResult = useMemo(() => {
    return parsePacket(inputHex, selectedProtocol);
  }, [inputHex, selectedProtocol]);

  // Record into history when input changes to a valid packet (debounced)
  useEffect(() => {
    if (!analysisResult.cleanHex || analysisResult.rawBytes.length < 3) return;

    const timer = setTimeout(() => {
      setHistory(prev => {
        // Avoid duplicate top entry
        if (prev.length > 0 && prev[0].hex === analysisResult.formattedHex) {
          return prev;
        }
        const newRecord: SavedPacketRecord = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: Date.now(),
          title: `${analysisResult.protocolDisplayName.split(' ')[0]} ${analysisResult.directionDisplayName.split(' ')[0]}`,
          protocol: analysisResult.protocolDisplayName.split(' ')[0],
          hex: analysisResult.formattedHex,
          summary: analysisResult.summary,
          isValid: analysisResult.isValid,
        };
        return [newRecord, ...prev.slice(0, 49)]; // Keep up to 50
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [analysisResult.formattedHex, analysisResult.summary, analysisResult.isValid]);

  const handleSelectPreset = (preset: PresetSample) => {
    setInputHex(preset.hex);
    if (preset.expectedProtocol) {
      setSelectedProtocol(preset.expectedProtocol);
    }
  };

  const handleLoadFromBuilder = (hex: string) => {
    setInputHex(hex);
    setActiveTab('breakdown');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navbar */}
      <Navbar
        onSelectPreset={handleSelectPreset}
        onOpenCrcModal={() => setCrcModalOpen(true)}
        onOpenRefModal={() => setRefModalOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        historyCount={history.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Status & Summary Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Protocol Badge */}
            <span className="px-3 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              {analysisResult.protocolDisplayName}
            </span>

            {/* Direction Badge */}
            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold">
              {analysisResult.directionDisplayName}
            </span>

            {/* Checksum Badge */}
            {analysisResult.checksum.type !== 'None' && (
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border flex items-center gap-1 ${
                  analysisResult.checksum.matches
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                    : 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                }`}
              >
                {analysisResult.checksum.matches ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                )}
                {analysisResult.checksum.type}: {analysisResult.checksum.matches ? 'PASS' : 'FAIL'}
              </span>
            )}

            {/* Length / Byte Count indicator */}
            <span className="text-xs font-mono text-slate-400 px-2 py-1 rounded bg-slate-950 border border-slate-800">
              長度: {analysisResult.rawBytes.length} Bytes
            </span>
          </div>

          {/* Quick Summary text */}
          <div className="text-xs text-slate-300 md:text-right max-w-xl truncate font-mono">
            {analysisResult.summary}
          </div>
        </div>

        {/* Input Component */}
        <PacketInput
          inputHex={inputHex}
          onChangeInput={setInputHex}
          selectedProtocol={selectedProtocol}
          onChangeProtocol={setSelectedProtocol}
          onClear={() => setInputHex('')}
        />

        {/* Interactive Byte Stream Viewer */}
        <ByteViewer
          rawBytes={analysisResult.rawBytes}
          fields={analysisResult.fields}
          activeFieldId={activeFieldId}
          onHoverField={setActiveFieldId}
          selectedByteIndex={selectedByteIndex}
          onSelectByte={setSelectedByteIndex}
        />

        {/* Workspace Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'breakdown'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900/50 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>結構拆解與診斷 (Field Breakdown)</span>
            {analysisResult.fields.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                {analysisResult.fields.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'data'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900/50 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>數值資料解碼器 (Data Inspector)</span>
            {analysisResult.payloadBytes.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
                {analysisResult.payloadBytes.length}B
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'builder'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900/50 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>快速組包工具 (Packet Builder)</span>
          </button>

          <button
            onClick={() => setActiveTab('script')}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'script'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900/50 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
            }`}
          >
            <Code2 className="w-4 h-4 text-purple-400" />
            <span>Python 測試腳本產生 (Script Generator)</span>
          </button>
        </div>

        {/* Tab 1: Breakdown & Diagnostics */}
        {activeTab === 'breakdown' && (
          <div className="space-y-4">
            <DiagnosticsCard
              checksum={analysisResult.checksum}
              exception={analysisResult.exception}
              warnings={analysisResult.warnings}
              protocol={analysisResult.protocol}
            />

            <FieldBreakdown
              fields={analysisResult.fields}
              activeFieldId={activeFieldId}
              onHoverField={setActiveFieldId}
            />

            {/* If there is payload data, show teaser button to Data Inspector */}
            {analysisResult.payloadBytes.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Binary className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-200">
                    此封包包含 <strong>{analysisResult.payloadBytes.length} Bytes</strong> 的數值資料 (Payload)，已備妥多端序轉換。
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('data')}
                  className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg font-semibold transition-colors"
                >
                  切換至數值解碼器 ➔
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Multi-format Data Inspector */}
        {activeTab === 'data' && (
          <DataInspector
            convertedPayload={analysisResult.convertedPayload}
            rawPayloadBytes={analysisResult.payloadBytes}
          />
        )}

        {/* Tab 3: Packet Builder */}
        {activeTab === 'builder' && (
          <PacketBuilder onLoadIntoAnalyzer={handleLoadFromBuilder} />
        )}

        {/* Tab 4: Python Script Generator */}
        {activeTab === 'script' && (
          <ScriptGenerator analysisResult={analysisResult} />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-400 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Industrial Protocol Packet Analyzer • Modbus RTU / ASCII / TCP & MELSEC MC 3E</span>
          <div className="flex items-center gap-4 text-slate-400 text-[11px]">
            <span>CRC-16 Modbus (0xA001)</span>
            <span>•</span>
            <span>LRC Two's Complement</span>
            <span>•</span>
            <span>IEEE 754 Float32</span>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <CrcCalculatorModal
        isOpen={crcModalOpen}
        onClose={() => setCrcModalOpen(false)}
      />

      <ReferenceModal
        isOpen={refModalOpen}
        onClose={() => setRefModalOpen(false)}
      />

      <HistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        onSelectPacket={hex => {
          setInputHex(hex);
          setActiveTab('breakdown');
        }}
        onDeletePacket={id => setHistory(prev => prev.filter(p => p.id !== id))}
        onClearHistory={() => setHistory([])}
        onImportHistory={records => setHistory(records)}
      />
    </div>
  );
}
