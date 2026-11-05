import React, { useState, useMemo } from 'react';
import { Check, Copy, Download, FileCode, Play, Settings, Terminal } from 'lucide-react';
import { AnalysisResult } from '../types/protocol';
import { generatePythonScript, ScriptOptions } from '../utils/scriptGenerator';

interface ScriptGeneratorProps {
  analysisResult: AnalysisResult;
}

export const ScriptGenerator: React.FC<ScriptGeneratorProps> = ({ analysisResult }) => {
  const isTCP = analysisResult.protocol === 'modbus-tcp' || analysisResult.protocol === 'mc-3e-binary';

  const [library, setLibrary] = useState<'pyserial' | 'pymodbus' | 'socket'>(
    isTCP ? 'socket' : 'pyserial'
  );
  const [serialPort, setSerialPort] = useState<string>('COM3');
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [tcpHost, setTcpHost] = useState<string>('192.168.1.100');
  const [tcpPort, setTcpPort] = useState<number>(analysisResult.protocol === 'mc-3e-binary' ? 5000 : 502);
  const [timeout, setTimeoutVal] = useState<number>(2.0);

  const [copied, setCopied] = useState(false);

  const scriptOptions: ScriptOptions = useMemo(
    () => ({
      library,
      serialPort,
      baudRate,
      tcpHost,
      tcpPort,
      timeout,
    }),
    [library, serialPort, baudRate, tcpHost, tcpPort, timeout]
  );

  const pythonCode = useMemo(() => {
    return generatePythonScript(analysisResult, scriptOptions);
  }, [analysisResult, scriptOptions]);

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([pythonCode], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_${analysisResult.protocol}_packet.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-sm">
              Python 自動測試腳本產生器 (Script Generator)
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
              {analysisResult.protocolDisplayName.split(' ')[0]}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            一鍵產生對應此封包的自動化測試程式碼，支援 pyserial、pymodbus 與原生 socket
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">已複製</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>複製腳本</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下載 .py 檔案</span>
          </button>
        </div>
      </div>

      {/* Configuration Bar */}
      <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center gap-3 text-xs font-mono">
        {/* Library Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">庫別:</span>
          <div className="flex bg-slate-900 rounded border border-slate-800 p-0.5">
            <button
              onClick={() => setLibrary('pyserial')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                library === 'pyserial'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              pyserial (串列)
            </button>
            <button
              onClick={() => setLibrary('pymodbus')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                library === 'pymodbus'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              pymodbus (模組)
            </button>
            <button
              onClick={() => setLibrary('socket')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                library === 'socket'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              socket (原生免安裝)
            </button>
          </div>
        </div>

        {/* Dynamic Params based on mode */}
        {library === 'pyserial' || (!isTCP && library === 'pymodbus') ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">埠名:</span>
              <input
                type="text"
                value={serialPort}
                onChange={e => setSerialPort(e.target.value)}
                className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
                placeholder="COM3"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">鮑率:</span>
              <select
                value={baudRate}
                onChange={e => setBaudRate(parseInt(e.target.value, 10))}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
              >
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">PLC/伺服器 IP:</span>
              <input
                type="text"
                value={tcpHost}
                onChange={e => setTcpHost(e.target.value)}
                className="w-32 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Port:</span>
              <input
                type="number"
                value={tcpPort}
                onChange={e => setTcpPort(parseInt(e.target.value, 10) || 502)}
                className="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
              />
            </div>
          </>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">逾時:</span>
          <input
            type="number"
            step="0.5"
            value={timeout}
            onChange={e => setTimeoutVal(parseFloat(e.target.value) || 2.0)}
            className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200"
          />
          <span className="text-slate-400">s</span>
        </div>
      </div>

      {/* Code Editor Preview */}
      <div className="relative">
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
          <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70"></span>
              <span className="ml-2 text-slate-300">test_packet.py</span>
            </div>
            <span>
              {library === 'pyserial'
                ? '依賴: pip install pyserial'
                : library === 'pymodbus'
                ? '依賴: pip install pymodbus'
                : '免依賴 Python 原生模組'}
            </span>
          </div>

          <pre className="p-4 text-slate-300 overflow-x-auto max-h-[380px] leading-relaxed selection:bg-cyan-500/30 selection:text-cyan-200">
            <code>{pythonCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
