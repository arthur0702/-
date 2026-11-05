import React, { useState, useMemo } from 'react';
import { Calculator, Check, Copy, Hash, X } from 'lucide-react';
import { calculateCRC16Modbus, calculateLRC, cleanHexInput, formatBytes } from '../utils/crc';

interface CrcCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CrcCalculatorModal: React.FC<CrcCalculatorModalProps> = ({ isOpen, onClose }) => {
  const [inputText, setInputText] = useState('01 03 00 00 00 02');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const cleanResult = useMemo(() => {
    return cleanHexInput(inputText);
  }, [inputText]);

  const crcModbus = useMemo(() => {
    if (cleanResult.bytes.length === 0) return null;
    return calculateCRC16Modbus(cleanResult.bytes);
  }, [cleanResult]);

  const lrc = useMemo(() => {
    if (cleanResult.bytes.length === 0) return null;
    return calculateLRC(cleanResult.bytes);
  }, [cleanResult]);

  // Additional CRC-16 CCITT
  const crcCcitt = useMemo(() => {
    if (cleanResult.bytes.length === 0) return null;
    let crc = 0xFFFF;
    for (const b of cleanResult.bytes) {
      crc = ((crc >> 8) | (crc << 8)) & 0xFFFF;
      crc ^= b;
      crc ^= (crc & 0xFF) >> 4;
      crc ^= (crc << 12) & 0xFFFF;
      crc ^= ((crc & 0xFF) << 5) & 0xFFFF;
    }
    return '0x' + crc.toString(16).padStart(4, '0').toUpperCase();
  }, [cleanResult]);

  if (!isOpen) return null;

  const handleCopy = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">
                CRC-16 / LRC 即時獨立校驗計算機
              </h3>
              <p className="text-xs text-slate-400">
                任意位元組即時比對 Modbus RTU CRC 與 Modbus ASCII LRC
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              輸入待校驗的十六進制資料 (允許含空格、0x 前綴或冒號):
            </label>
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg p-2.5 font-mono text-sm text-slate-100"
              placeholder="01 03 00 00 00 02"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
              <span>有效資料: {cleanResult.bytes.length} Bytes ({formatBytes(cleanResult.bytes)})</span>
              <button
                type="button"
                onClick={() => setInputText('')}
                className="text-cyan-400 hover:underline"
              >
                清空
              </button>
            </div>
          </div>

          {/* Results Grid */}
          {crcModbus && lrc ? (
            <div className="space-y-3 font-mono text-xs">
              {/* Modbus RTU CRC-16 */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-emerald-500/40">
                <div className="flex items-center justify-between text-slate-300 mb-2">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Hash className="w-4 h-4" />
                    Modbus RTU CRC-16 (Poly: 0xA001, Init: 0xFFFF)
                  </span>
                  <span className="text-[11px] text-slate-400">標準低位在前</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <div className="text-slate-400 text-[10px] mb-1">封包結尾發送格式 (Low First):</div>
                    <div className="text-emerald-300 font-bold text-sm flex items-center justify-between">
                      <span>{crcModbus.hexLowFirst}</span>
                      <button
                        onClick={() => handleCopy('crcLow', crcModbus.hexLowFirst)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        {copiedKey === 'crcLow' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <div className="text-slate-400 text-[10px] mb-1">16-bit 暫存器整數值:</div>
                    <div className="text-cyan-300 font-bold text-sm flex items-center justify-between">
                      <span>{crcModbus.hexInt} ({crcModbus.crc})</span>
                      <button
                        onClick={() => handleCopy('crcInt', crcModbus.hexInt)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        {copiedKey === 'crcInt' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modbus ASCII LRC */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-sky-500/40">
                <div className="flex items-center justify-between text-slate-300 mb-2">
                  <span className="font-bold text-sky-400 flex items-center gap-1.5">
                    <Hash className="w-4 h-4" />
                    Modbus ASCII LRC (Longitudinal Redundancy Check)
                  </span>
                  <span className="text-[11px] text-slate-400">累加和之二補數</span>
                </div>

                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-slate-400 text-[10px]">LRC 單字節校驗值 (結尾發送):</div>
                    <div className="text-sky-300 font-bold text-base mt-0.5">0x{lrc.hex} ({lrc.lrc})</div>
                  </div>
                  <button
                    onClick={() => handleCopy('lrc', lrc.hex)}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    {copiedKey === 'lrc' ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Other Industrial Checksums */}
              <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>CRC-16 / CCITT (0x1021): <strong className="text-slate-200 font-mono">{crcCcitt}</strong></span>
                <span className="text-slate-400">適用於 XModem / 部分流量計協議</span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-950 rounded-lg text-center text-xs text-slate-400">
              請輸入至少 1 個位元組以計算校驗碼
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
