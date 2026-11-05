import React, { useState } from 'react';
import { BookOpen, HelpCircle, Server, Table, Wrench, X } from 'lucide-react';

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferenceModal: React.FC<ReferenceModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'modbus-fc' | 'addressing' | 'exceptions' | 'mc-3e' | 'rs485'>('modbus-fc');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">
                工控通訊協定快速速查手冊 (Protocol Reference Manual)
              </h3>
              <p className="text-xs text-slate-400">
                Modbus RTU/TCP/ASCII 與三菱 MELSEC MC Protocol 3E 工程實務對照
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

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 gap-2 text-xs overflow-x-auto">
          {[
            { id: 'modbus-fc', label: 'Modbus 功能碼' },
            { id: 'addressing', label: '暫存器位址 (40001 規則)' },
            { id: 'exceptions', label: 'Modbus 異常碼清單' },
            { id: 'mc-3e', label: '三菱 MC 3E 協議規範' },
            { id: 'rs485', label: 'RS-485 實體層排錯指南' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-300">
          {activeTab === 'modbus-fc' && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-cyan-300">常見 Modbus 功能碼 (Function Codes)</h4>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">代碼 (Dec/Hex)</th>
                      <th className="p-2.5">功能名稱</th>
                      <th className="p-2.5">操作對象</th>
                      <th className="p-2.5">典型用途</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-cyan-400 font-bold">01 (0x01)</td>
                      <td className="p-2.5 text-slate-200">Read Coils</td>
                      <td className="p-2.5">線圈 (0x) 讀寫位元</td>
                      <td className="p-2.5">讀取電磁閥、接觸器、馬達啟動繼電器輸出狀態</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-cyan-400 font-bold">02 (0x02)</td>
                      <td className="p-2.5 text-slate-200">Read Discrete Inputs</td>
                      <td className="p-2.5">離散輸入 (1x) 唯讀位元</td>
                      <td className="p-2.5">讀取光電開關、極限開關、按鈕輸入等外部訊號</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-cyan-400 font-bold">03 (0x03)</td>
                      <td className="p-2.5 text-slate-200">Read Holding Registers</td>
                      <td className="p-2.5">保持暫存器 (4x) 讀寫 16-bit</td>
                      <td className="p-2.5">最廣泛使用：讀取溫度、壓力、流量、變頻器轉速與參數</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-cyan-400 font-bold">04 (0x04)</td>
                      <td className="p-2.5 text-slate-200">Read Input Registers</td>
                      <td className="p-2.5">輸入暫存器 (3x) 唯讀 16-bit</td>
                      <td className="p-2.5">儀表出廠類比輸入即時量測值 (不可被寫入)</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-amber-400 font-bold">05 (0x05)</td>
                      <td className="p-2.5 text-slate-200">Write Single Coil</td>
                      <td className="p-2.5">單個線圈 (0x)</td>
                      <td className="p-2.5">開關控制：0xFF00 強制為 ON，0x0000 強制為 OFF</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-amber-400 font-bold">06 (0x06)</td>
                      <td className="p-2.5 text-slate-200">Write Single Register</td>
                      <td className="p-2.5">單個保持暫存器 (4x)</td>
                      <td className="p-2.5">寫入單一參數或目標值 (例如設定變頻器頻率 50.0Hz)</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-amber-400 font-bold">15 (0x0F)</td>
                      <td className="p-2.5 text-slate-200">Write Multiple Coils</td>
                      <td className="p-2.5">多個線圈 (0x)</td>
                      <td className="p-2.5">批次設定多個 DO 輸出點</td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-amber-400 font-bold">16 (0x10)</td>
                      <td className="p-2.5 text-slate-200">Write Multiple Registers</td>
                      <td className="p-2.5">多個保持暫存器 (4x)</td>
                      <td className="p-2.5">寫入 32-bit Float 或整批配方參數</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'addressing' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-cyan-300">PLC 暫存器表示法 vs 封包實體位址 (0-based vs 1-based)</h4>
              <p>
                現場工程師最容易遇到的問題是：<strong>PLC 手冊標註暫存器 40001，但封包送出 00 00 還是 00 01？</strong>
              </p>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono space-y-2">
                <div className="text-amber-300 font-semibold">對照公式：</div>
                <ul className="space-y-1 list-disc pl-5">
                  <li><strong>40001 (PLC 保持暫存器 #1)</strong> ➔ 通訊封包中的 Offset 位址為 <strong>0x0000 (0)</strong></li>
                  <li><strong>40002 (PLC 保持暫存器 #2)</strong> ➔ 通訊封包中的 Offset 位址為 <strong>0x0001 (1)</strong></li>
                  <li><strong>40101 (PLC 保持暫存器 #101)</strong> ➔ 通訊封包中的 Offset 位址為 <strong>0x0064 (100)</strong></li>
                  <li><strong>30001 (PLC 輸入暫存器 #1)</strong> ➔ 搭配功能碼 04，Offset 為 <strong>0x0000 (0)</strong></li>
                </ul>
              </div>
              <p className="text-amber-200 bg-amber-950/30 p-2.5 rounded border border-amber-500/30">
                <strong>除錯心法：</strong> 若讀取到的數值整體偏移了一格（例如讀到下一個暫存器的值），或是收到 <code>Exception 02: Illegal Data Address</code>，通常就是 0-based 與 1-based 差異！
              </p>
            </div>
          )}

          {activeTab === 'exceptions' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-rose-300">Modbus 異常回應碼速查 (Exception Codes)</h4>
              <p>當從站無法執行請求時，會將功能碼最高位設為 1 (即 <code>0x80 + FC</code>)，並附帶一個 Byte 的異常診斷碼：</p>
              <div className="overflow-x-auto rounded-lg border border-slate-800 font-mono">
                <table className="w-full text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2">碼</th>
                      <th className="p-2">名稱</th>
                      <th className="p-2">常見原因與除錯手段</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr>
                      <td className="p-2 text-rose-400 font-bold">01</td>
                      <td className="p-2 text-slate-200">Illegal Function</td>
                      <td className="p-2">從站韌體未實作該功能碼（例如向唯讀感測器發送 0x06 寫入暫存器）。</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-rose-400 font-bold">02</td>
                      <td className="p-2 text-slate-200">Illegal Data Address</td>
                      <td className="p-2">目標暫存器超出範圍。請檢查 0-based 偏移量或是否超過最大點位。</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-rose-400 font-bold">03</td>
                      <td className="p-2 text-slate-200">Illegal Data Value</td>
                      <td className="p-2">寫入數值或讀取點數 (Quantity) 超過限制（如 FC03 超過 125 點）。</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-rose-400 font-bold">04</td>
                      <td className="p-2 text-slate-200">Slave Device Failure</td>
                      <td className="p-2">從站硬體內部故障、EEPROM 損壞或感測器模組離線。</td>
                    </tr>
                    <tr>
                      <td className="p-2 text-rose-400 font-bold">06</td>
                      <td className="p-2 text-slate-200">Slave Device Busy</td>
                      <td className="p-2">從站正在處理耗時背景作業，請放慢 Master Polling 間隔時間。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'mc-3e' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-cyan-300">三菱 MELSEC MC Protocol (3E 訊框) 規範</h4>
              <p>MC 3E 是廣泛應用於三菱 Q 系列、L 系列與 iQ-R / FX5U PLC 乙太網路連線的工業協定：</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-cyan-400 font-bold mb-1">常用的軟元件代碼 (Device Codes)：</div>
                  <ul className="space-y-1 text-slate-300">
                    <li><code>0xA8</code>: D (資料暫存器 - 16-bit Word)</li>
                    <li><code>0x90</code>: M (內部繼電器 - Bit)</li>
                    <li><code>0x9C</code>: X (輸入 - Bit)</li>
                    <li><code>0x9D</code>: Y (輸出 - Bit)</li>
                    <li><code>0xB4</code>: W (鏈結暫存器 - Word)</li>
                    <li><code>0xAF</code>: R (檔案暫存器 - Word)</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-cyan-400 font-bold mb-1">端序注意事項 (Endianness)：</div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    三菱 PLC 內部指令、位址編號、點數與資料長度均為 <strong>Little Endian (小端序，低位元在前)</strong>！例如讀取 D100 時，位址 100 以 <code>64 00 00</code> 表示。
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rs485' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-amber-300">RS-485 現場實體層排錯五大黃金準則</h4>
              <ul className="space-y-2 list-decimal pl-5">
                <li>
                  <strong>A / B (Data+ / Data-) 極性檢查：</strong> 各家廠牌標示不一，例如有些將 A 標為 Data+，有些將 A 標為 Data-。若通訊逾時，請先將 A/B 對調測試。
                </li>
                <li>
                  <strong>終端電阻 (120Ω)：</strong> 匯流排頭尾兩端必須各加一顆 120Ω 終端電阻，避免長距離或高速時訊號反射 (Reflection)。
                </li>
                <li>
                  <strong>訊號地線 (GND / Common)：</strong> 雖然 RS-485 為差動訊號，但在不同配電箱之間必須拉一條遮蔽地線 (Shield GND)，以防地電位差造成晶片燒毀或封包 CRC 錯誤。
                </li>
                <li>
                  <strong>鮑率與同位檢查 (Baud Rate & Parity)：</strong> RS-485 同一匯流排上的所有節點必須保持完全相同的鮑率 (例如 9600 8-N-1 或 19200 8-E-1)。
                </li>
                <li>
                  <strong>雙主站衝突 (Multiple Masters Conflict)：</strong> Modbus RTU 標準為單一主站輪詢架構。同一組 RS-485 實體線上不可同時存在兩個 Master 發送請求，否則電氣訊號撞車必產生 CRC 錯誤。
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
