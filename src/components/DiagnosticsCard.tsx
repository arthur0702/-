import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert, Wrench } from 'lucide-react';
import { ChecksumInfo, ExceptionInfo } from '../types/protocol';

interface DiagnosticsCardProps {
  checksum: ChecksumInfo;
  exception?: ExceptionInfo;
  warnings: string[];
  protocol: string;
}

export const DiagnosticsCard: React.FC<DiagnosticsCardProps> = ({
  checksum,
  exception,
  warnings,
  protocol,
}) => {
  const isCrcOrLrc = checksum.type === 'CRC16-Modbus' || checksum.type === 'LRC';

  return (
    <div className="space-y-4">
      {/* Checksum Status Card */}
      {checksum.type !== 'None' && (
        <div
          className={`rounded-xl border p-4 shadow-lg transition-all ${
            checksum.matches
              ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-950/20'
              : 'bg-rose-950/30 border-rose-500/50 shadow-rose-950/30'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              {checksum.matches ? (
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 animate-pulse">
                  <AlertCircle className="w-5 h-5" />
                </div>
              )}
              <div>
                <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                  {checksum.type === 'CRC16-Modbus'
                    ? 'CRC-16 (Modbus RTU) 校驗結果'
                    : checksum.type === 'LRC'
                    ? 'LRC (Modbus ASCII) 校驗結果'
                    : '訊框長度完整性校驗'}
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                      checksum.matches
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {checksum.matches ? 'PASS 正確' : 'FAIL 校驗不符'}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">{checksum.algorithmDetail}</p>
              </div>
            </div>
          </div>

          {/* Comparison Grid */}
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800/80 font-mono text-xs">
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">計算期望值 (Calculated):</span>
              <span className="text-sm font-bold text-cyan-300">{checksum.expectedHex}</span>
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">封包實際值 (Received):</span>
              <span
                className={`text-sm font-bold ${
                  checksum.matches ? 'text-emerald-300' : 'text-rose-400'
                }`}
              >
                {checksum.actualHex}
              </span>
            </div>
          </div>

          {checksum.isByteSwapped && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>診斷提示：</strong>封包內的 2 個 CRC 位元組順序疑似顛倒 (High Byte 在前)！標準
                Modbus RTU 要求 Low Byte 在前。
              </span>
            </div>
          )}
        </div>
      )}

      {/* Exception Diagnostic Card */}
      {exception && (
        <div className="rounded-xl border border-rose-500/50 bg-rose-950/30 p-4 shadow-lg shadow-rose-950/20">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 flex-shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-rose-500 text-slate-950 font-bold text-xs font-mono">
                  {exception.hex}
                </span>
                <h4 className="font-bold text-rose-200 text-base">{exception.nameZh}</h4>
                <span className="text-xs text-rose-400/80 font-mono">({exception.name})</span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{exception.description}</p>
            </div>
          </div>

          {/* Troubleshooting Checklist */}
          {exception.troubleshooting && exception.troubleshooting.length > 0 && (
            <div className="mt-3 pt-3 border-t border-rose-500/30">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-300 mb-2">
                <Wrench className="w-3.5 h-3.5" />
                <span>現場工控除錯建議 (Troubleshooting Guide)：</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 pl-4 list-disc marker:text-rose-400">
                {exception.troubleshooting.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* General Warnings List */}
      {warnings.length > 0 && !exception && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            {warnings.map((warn, i) => (
              <div key={i}>{warn}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
