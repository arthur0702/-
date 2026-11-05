import React, { useState } from 'react';
import { Binary, Check, Copy, Cpu, Eye, Layers } from 'lucide-react';
import { ConvertedPayload, EndianOrder } from '../types/protocol';
import { formatFloat } from '../utils/dataConversion';

interface DataInspectorProps {
  convertedPayload?: ConvertedPayload;
  rawPayloadBytes: number[];
}

export const DataInspector: React.FC<DataInspectorProps> = ({
  convertedPayload,
  rawPayloadBytes,
}) => {
  const [selectedEndian, setSelectedEndian] = useState<EndianOrder>('ABCD');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  if (!convertedPayload || rawPayloadBytes.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <Cpu className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm">此封包未包含數值資料 (Payload)，或無須解碼之數值內容。</p>
        <p className="text-xs text-slate-400 mt-1">
          提示：讀取暫存器回應 (0x03/0x04 Response) 或寫入資料 (0x06/0x10 Request) 包含 Payload 時將自動啟用此面板。
        </p>
      </div>
    );
  }

  const {
    int16_signed,
    int16_unsigned,
    int32_signed,
    int32_unsigned,
    float32,
    float64,
    ascii,
    binaryWords,
    coilsBits,
  } = convertedPayload;

  const currentFloat32 = float32[selectedEndian] || [];
  const currentInt32 = int32_signed[selectedEndian] || [];
  const currentUint32 = int32_unsigned[selectedEndian] || [];
  const currentFloat64 = float64[selectedEndian] || [];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
      {/* Header and Endian Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-slate-100 text-sm">
              數值資料多格式解析器 (Data Inspector)
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
              {rawPayloadBytes.length} Bytes
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            同步轉換為 16/32-bit 整數、浮點數、端序 (Endianness)、二進制位元與 ASCII
          </p>
        </div>

        {/* Endian Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <span className="text-slate-400 px-2 font-mono text-[11px] hidden md:inline">端序:</span>
          {(['ABCD', 'CDAB', 'BADC', 'DCBA'] as EndianOrder[]).map(order => {
            const isSelected = selectedEndian === order;
            let label = '';
            if (order === 'ABCD') label = 'ABCD (Big)';
            else if (order === 'CDAB') label = 'CDAB (Word Swap)';
            else if (order === 'BADC') label = 'BADC (Byte Swap)';
            else if (order === 'DCBA') label = 'DCBA (Little)';

            return (
              <button
                key={order}
                onClick={() => setSelectedEndian(order)}
                className={`px-2.5 py-1 rounded font-mono text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={
                  order === 'ABCD'
                    ? '標準大端序 (Big Endian / Motorola)'
                    : order === 'CDAB'
                    ? '字節交換 / 中大端 (Word Swap / Mid-Big)'
                    : order === 'BADC'
                    ? '位元組交換 / 中小端 (Byte Swap / Mid-Little)'
                    : '標準小端序 (Little Endian / Intel)'
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 32-bit Float & 32-bit Integer Cards (If >= 4 Bytes) */}
      {currentFloat32.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                32-Bit 數值解析 ({selectedEndian})
              </span>
              <span className="text-[11px] text-slate-400">
                (每 2 個暫存器 / 4 Bytes 組合)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentFloat32.map((fVal, idx) => {
              const u32Val = currentUint32[idx];
              const s32Val = currentInt32[idx];
              const offset = idx * 2;
              const formattedF = formatFloat(fVal);

              return (
                <div
                  key={idx}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-1.5 mb-2 border-b border-slate-800">
                    <span className="font-mono text-cyan-400 font-semibold">
                      Offset +{offset} ~ +{offset + 1}
                    </span>
                    <button
                      onClick={() => handleCopy(`f32_${idx}`, formattedF)}
                      className="text-slate-400 hover:text-slate-200"
                      title="複製 Float32 數值"
                    >
                      {copiedKey === `f32_${idx}` ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex items-baseline justify-between">
                      <span className="text-slate-400">IEEE 754 Float:</span>
                      <span className="text-sm font-bold text-emerald-300">{formattedF}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-slate-400">UINT32 無符號:</span>
                      <span className="text-slate-200">{u32Val}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-slate-400">INT32 帶符號:</span>
                      <span className="text-slate-200">{s32Val}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 16-bit Registers Table */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-sky-300 uppercase tracking-wide flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            16-Bit 暫存器解析 (單個暫存器 / Word)
          </span>
          <span className="text-[11px] text-slate-400">
            共 {int16_unsigned.length} 個 16-bit 暫存器
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="py-2 px-2.5">Offset</th>
                <th className="py-2 px-2.5">Hex</th>
                <th className="py-2 px-2.5">UINT16 (無符號)</th>
                <th className="py-2 px-2.5">INT16 (帶符號)</th>
                <th className="py-2 px-2.5">二進制 Bit (15 ~ 0)</th>
                <th className="py-2 px-2.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {int16_unsigned.map((u16, idx) => {
                const s16 = int16_signed[idx];
                const hexVal = '0x' + u16.toString(16).padStart(4, '0').toUpperCase();
                const binStr = binaryWords[idx] || '';

                return (
                  <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2 px-2.5 font-bold text-cyan-400">+{idx}</td>
                    <td className="py-2 px-2.5 text-amber-300 font-semibold">{hexVal}</td>
                    <td className="py-2 px-2.5 text-slate-200">{u16}</td>
                    <td className="py-2 px-2.5 text-slate-200">{s16}</td>
                    <td className="py-2 px-2.5 text-slate-400 text-[11px] tracking-wider">
                      {binStr}
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <button
                        onClick={() => handleCopy(`u16_${idx}`, `${u16}`)}
                        className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
                        title="複製整數值"
                      >
                        {copiedKey === `u16_${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 inline" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 inline" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bit/Coils & ASCII Decoder View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* ASCII String View */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wide flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              ASCII 字串解碼 (String)
            </span>
            <button
              onClick={() => handleCopy('ascii', ascii)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
            >
              {copiedKey === 'ascii' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">已複製</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>複製</span>
                </>
              )}
            </button>
          </div>
          <div className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-sm text-slate-200 tracking-wider break-all select-all">
            {ascii || '<無可視字元>'}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            不可視字元以「·」顯示，0x00 以「∅」表示。適用於條碼槍、RFID 或設備型號暫存器。
          </span>
        </div>

        {/* Coil / Bit Status Indicators */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-teal-300 uppercase tracking-wide flex items-center gap-1.5">
              <Binary className="w-3.5 h-3.5" />
              線圈 / 旗標狀態檢視 (Bit Indicators)
            </span>
            <span className="text-[11px] text-slate-400">
              顯示前 {Math.min(coilsBits.length, 32)} 點
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 p-2 rounded bg-slate-900 border border-slate-800 max-h-24 overflow-y-auto">
            {coilsBits.slice(0, 32).map((bitOn, bitIdx) => (
              <div
                key={bitIdx}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono border ${
                  bitOn
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60 shadow-xs'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
                title={`Bit ${bitIdx}: ${bitOn ? '1 (ON)' : '0 (OFF)'}`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    bitOn ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-700'
                  }`}
                />
                <span>b{bitIdx}:{bitOn ? '1' : '0'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
