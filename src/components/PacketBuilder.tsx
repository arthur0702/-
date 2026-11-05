import React, { useState, useMemo } from 'react';
import { ArrowRight, Check, Code, Copy, PlusCircle, Sparkles, Terminal } from 'lucide-react';
import { buildMC3EPacket, buildModbusPacket } from '../utils/packetBuilder';
import { formatCArray, formatPythonBytes } from '../utils/crc';

interface PacketBuilderProps {
  onLoadIntoAnalyzer: (hex: string) => void;
}

export const PacketBuilder: React.FC<PacketBuilderProps> = ({ onLoadIntoAnalyzer }) => {
  const [protocol, setProtocol] = useState<'modbus-rtu' | 'modbus-tcp' | 'modbus-ascii' | 'mc-3e-binary'>('modbus-rtu');
  const [slaveId, setSlaveId] = useState<number>(1);
  const [functionCode, setFunctionCode] = useState<number>(3); // 03 Read Holding Registers
  const [addressMode, setAddressMode] = useState<'0-based' | 'plc-40001'>('0-based');
  const [addressInput, setAddressInput] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(2);

  // Write values
  const [coilValue, setCoilValue] = useState<boolean>(true);
  const [singleRegVal, setSingleRegVal] = useState<number>(100);
  const [multiRegsVal, setMultiRegsVal] = useState<string>('100, 200');

  // Modbus TCP Transaction ID
  const [transId, setTransId] = useState<number>(1);

  // Mitsubishi MC 3E state
  const [mcCommand, setMcCommand] = useState<number>(0x0401); // 0401 Read
  const [mcDeviceCode, setMcDeviceCode] = useState<number>(0xA8); // D register
  const [mcHeadNumber, setMcHeadNumber] = useState<number>(100); // D100
  const [mcPoints, setMcPoints] = useState<number>(2);
  const [mcWriteValues, setMcWriteValues] = useState<string>('100, 200');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Calculate actual 0-based address
  const effectiveAddress = useMemo(() => {
    if (addressMode === 'plc-40001') {
      if (addressInput >= 40001) return addressInput - 40001;
      if (addressInput >= 30001) return addressInput - 30001;
      if (addressInput >= 10001) return addressInput - 10001;
      if (addressInput >= 1) return addressInput - 1;
    }
    return Math.max(0, addressInput);
  }, [addressMode, addressInput]);

  // Build the packet
  const builtPacket = useMemo(() => {
    try {
      if (protocol === 'mc-3e-binary') {
        const writeBytes: number[] = [];
        if (mcCommand === 0x1401) {
          const numbers = mcWriteValues
            .split(/[,;\s]+/)
            .filter(Boolean)
            .map(s => parseInt(s.trim(), 10))
            .filter(n => !Number.isNaN(n));
          for (const num of numbers) {
            writeBytes.push(num & 0xFF, (num >> 8) & 0xFF); // Little Endian
          }
        }
        return buildMC3EPacket({
          command: mcCommand,
          subcommand: 0x0000, // Word unit
          deviceCode: mcDeviceCode,
          headDeviceNumber: mcHeadNumber,
          points: mcPoints,
          writeData: writeBytes,
        });
      } else {
        // Parse multi registers
        const multiRegs = multiRegsVal
          .split(/[,;\s]+/)
          .filter(Boolean)
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !Number.isNaN(n));

        return buildModbusPacket({
          protocol: protocol as any,
          slaveId,
          functionCode,
          startAddress: effectiveAddress,
          quantity,
          singleCoilValue: coilValue,
          singleRegValue: singleRegVal,
          multiRegValues: multiRegs,
          transactionId: transId,
        });
      }
    } catch {
      return { bytes: [], hexString: '' };
    }
  }, [
    protocol,
    slaveId,
    functionCode,
    effectiveAddress,
    quantity,
    coilValue,
    singleRegVal,
    multiRegsVal,
    transId,
    mcCommand,
    mcDeviceCode,
    mcHeadNumber,
    mcPoints,
    mcWriteValues,
  ]);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-slate-100 text-sm">快速組包工具 (Packet Builder)</h3>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30">
            自動計算 CRC / LRC
          </span>
        </div>
        <p className="text-xs text-slate-400">
          設定通訊參數，自動產生標準十六進制封包與 C/Python 程式碼字面量
        </p>
      </div>

      {/* Protocol Toggle */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'modbus-rtu', label: 'Modbus RTU (Serial)' },
          { id: 'modbus-tcp', label: 'Modbus TCP (Ethernet)' },
          { id: 'modbus-ascii', label: 'Modbus ASCII' },
          { id: 'mc-3e-binary', label: 'Mitsubishi MC 3E (Binary)' },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setProtocol(p.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              protocol === p.id
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Form Fields */}
      {protocol !== 'mc-3e-binary' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-xs font-mono">
          {/* Slave ID */}
          <div>
            <label className="text-slate-400 block mb-1">
              {protocol === 'modbus-tcp' ? '單元 ID (Unit ID):' : '從站站號 (Slave ID):'}
            </label>
            <input
              type="number"
              min={0}
              max={247}
              value={slaveId}
              onChange={e => setSlaveId(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Function Code */}
          <div>
            <label className="text-slate-400 block mb-1">功能碼 (Function Code):</label>
            <select
              value={functionCode}
              onChange={e => setFunctionCode(parseInt(e.target.value, 10))}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value={3}>03 (0x03) 讀取保持暫存器 (Holding Regs)</option>
              <option value={4}>04 (0x04) 讀取輸入暫存器 (Input Regs)</option>
              <option value={1}>01 (0x01) 讀取線圈 (Read Coils)</option>
              <option value={2}>02 (0x02) 讀取離散輸入 (Discrete Inputs)</option>
              <option value={6}>06 (0x06) 寫入單個暫存器 (Write Single Reg)</option>
              <option value={16}>16 (0x10) 寫入多個暫存器 (Write Multi Regs)</option>
              <option value={5}>05 (0x05) 寫入單個線圈 (Write Single Coil)</option>
            </select>
          </div>

          {/* Address Mode and Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400">起始暫存器位址:</label>
              <button
                type="button"
                onClick={() => setAddressMode(m => (m === '0-based' ? 'plc-40001' : '0-based'))}
                className="text-[10px] text-cyan-400 hover:underline"
              >
                {addressMode === '0-based' ? '切換為 PLC 40001' : '切換為 0-based'}
              </button>
            </div>
            <input
              type="number"
              min={0}
              value={addressInput}
              onChange={e => setAddressInput(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400"
              placeholder={addressMode === 'plc-40001' ? '40001' : '0'}
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              實際訊框 Offset: 0x{effectiveAddress.toString(16).padStart(4, '0').toUpperCase()} ({effectiveAddress})
            </span>
          </div>

          {/* Quantity or Values */}
          {[1, 2, 3, 4, 16].includes(functionCode) ? (
            <div>
              <label className="text-slate-400 block mb-1">讀寫點數 / 數量 (Quantity):</label>
              <input
                type="number"
                min={1}
                max={125}
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>
          ) : functionCode === 5 ? (
            <div>
              <label className="text-slate-400 block mb-1">線圈狀態 (Coil State):</label>
              <select
                value={coilValue ? 'true' : 'false'}
                onChange={e => setCoilValue(e.target.value === 'true')}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400"
              >
                <option value="true">ON (0xFF00 導通)</option>
                <option value="false">OFF (0x0000 斷開)</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="text-slate-400 block mb-1">寫入暫存器數值 (Value):</label>
              <input
                type="number"
                value={singleRegVal}
                onChange={e => setSingleRegVal(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>
          )}

          {/* Additional Multi-Register inputs */}
          {functionCode === 16 && (
            <div className="col-span-full">
              <label className="text-slate-400 block mb-1">
                寫入各暫存器數值 (逗號或空格分隔，共 {quantity} 個):
              </label>
              <input
                type="text"
                value={multiRegsVal}
                onChange={e => setMultiRegsVal(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                placeholder="100, 200, 300"
              />
            </div>
          )}
        </div>
      ) : (
        /* Mitsubishi MC 3E Form */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-xs font-mono">
          <div>
            <label className="text-slate-400 block mb-1">指令 (Command):</label>
            <select
              value={mcCommand}
              onChange={e => setMcCommand(parseInt(e.target.value, 10))}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value={0x0401}>0401 (批次讀取 Batch Read)</option>
              <option value={0x1401}>1401 (批次寫入 Batch Write)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">軟元件種類 (Device):</label>
            <select
              value={mcDeviceCode}
              onChange={e => setMcDeviceCode(parseInt(e.target.value, 10))}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value={0xA8}>D (資料暫存器 - 0xA8)</option>
              <option value={0x90}>M (內部繼電器 - 0x90)</option>
              <option value={0x9C}>X (輸入繼電器 - 0x9C)</option>
              <option value={0x9D}>Y (輸出繼電器 - 0x9D)</option>
              <option value={0xB4}>W (鏈結暫存器 - 0xB4)</option>
              <option value={0xAF}>R (檔案暫存器 - 0xAF)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">起始軟元件編號 (Head No.):</label>
            <input
              type="number"
              min={0}
              value={mcHeadNumber}
              onChange={e => setMcHeadNumber(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400"
              placeholder="例如 100 代表 D100"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">存取點數 (Points):</label>
            <input
              type="number"
              min={1}
              max={960}
              value={mcPoints}
              onChange={e => setMcPoints(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {mcCommand === 0x1401 && (
            <div className="col-span-full">
              <label className="text-slate-400 block mb-1">寫入數值 (逗號分隔):</label>
              <input
                type="text"
                value={mcWriteValues}
                onChange={e => setMcWriteValues(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
                placeholder="100, 200"
              />
            </div>
          )}
        </div>
      )}

      {/* Generated Results Area */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">產出標準十六進制發送字串 (Hex Output):</span>
            <span className="text-[11px] text-slate-400">({builtPacket.bytes.length} Bytes)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy('cleanHex', builtPacket.hexString)}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 rounded border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              {copiedKey === 'cleanHex' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">已複製 Hex</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>複製 Hex</span>
                </>
              )}
            </button>

            <button
              onClick={() => onLoadIntoAnalyzer(builtPacket.hexString)}
              className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <span>送入解析器檢驗</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Big Hex Display */}
        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg text-emerald-300 font-bold text-base tracking-widest break-all select-all">
          {builtPacket.hexString || '<無輸出>'}
        </div>

        {/* Code Snippets Accordion / Quick Previews */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
          <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Python Byte Literal:</span>
              <button
                onClick={() => handleCopy('pyLiteral', formatPythonBytes(builtPacket.bytes))}
                className="text-slate-400 hover:text-slate-200"
              >
                {copiedKey === 'pyLiteral' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
            <div className="text-amber-300 truncate select-all">{formatPythonBytes(builtPacket.bytes)}</div>
          </div>

          <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>C-Array:</span>
              <button
                onClick={() => handleCopy('cArray', formatCArray(builtPacket.bytes))}
                className="text-slate-400 hover:text-slate-200"
              >
                {copiedKey === 'cArray' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
            <div className="text-sky-300 truncate select-all">{formatCArray(builtPacket.bytes)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
