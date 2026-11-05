import {
  AnalysisResult,
  ChecksumInfo,
  ExceptionInfo,
  FieldBreakdown,
  PacketDirection,
  ProtocolType,
} from '../types/protocol';
import { calculateCRC16Modbus, calculateLRC, cleanHexInput, formatBytes } from './crc';
import { convertPayloadBytes } from './dataConversion';

// Color themes for field breakdown
const COLORS = {
  header: {
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/40',
    text: 'text-indigo-300',
    badge: 'bg-indigo-950 text-indigo-300 border border-indigo-500/30',
  },
  station: {
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/40',
    text: 'text-purple-300',
    badge: 'bg-purple-950 text-purple-300 border border-purple-500/30',
  },
  functionCode: {
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/40',
    text: 'text-sky-300',
    badge: 'bg-sky-950 text-sky-300 border border-sky-500/30',
  },
  address: {
    bg: 'bg-teal-500/15',
    border: 'border-teal-500/40',
    text: 'text-teal-300',
    badge: 'bg-teal-950 text-teal-300 border border-teal-500/30',
  },
  count: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-300',
    badge: 'bg-amber-950 text-amber-300 border border-amber-500/30',
  },
  payload: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-300',
    badge: 'bg-emerald-950 text-emerald-300 border border-emerald-500/30',
  },
  checksumOk: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/60',
    text: 'text-emerald-400',
    badge: 'bg-emerald-950 text-emerald-300 border border-emerald-500/40',
  },
  checksumErr: {
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/60',
    text: 'text-rose-400',
    badge: 'bg-rose-950 text-rose-300 border border-rose-500/40',
  },
  exception: {
    bg: 'bg-red-500/25',
    border: 'border-red-500/60',
    text: 'text-red-300',
    badge: 'bg-red-950 text-red-300 border border-red-500/40',
  },
  general: {
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/40',
    text: 'text-slate-300',
    badge: 'bg-slate-900 text-slate-300 border border-slate-700',
  },
};

// Modbus function code descriptions
const MODBUS_FUNCTIONS: Record<number, { name: string; zh: string; type: 'read' | 'write' | 'diag' }> = {
  0x01: { name: 'Read Coils', zh: '讀取線圈 (0x)', type: 'read' },
  0x02: { name: 'Read Discrete Inputs', zh: '讀取離散輸入 (1x)', type: 'read' },
  0x03: { name: 'Read Holding Registers', zh: '讀取保持暫存器 (4x)', type: 'read' },
  0x04: { name: 'Read Input Registers', zh: '讀取輸入暫存器 (3x)', type: 'read' },
  0x05: { name: 'Write Single Coil', zh: '寫入單個線圈 (0x)', type: 'write' },
  0x06: { name: 'Write Single Register', zh: '寫入單個保持暫存器 (4x)', type: 'write' },
  0x07: { name: 'Read Exception Status', zh: '讀取異常狀態', type: 'diag' },
  0x08: { name: 'Diagnostics', zh: '診斷功能', type: 'diag' },
  0x0B: { name: 'Get Comm Event Counter', zh: '獲取通訊事件計數', type: 'diag' },
  0x0F: { name: 'Write Multiple Coils', zh: '寫入多個線圈 (0x)', type: 'write' },
  0x10: { name: 'Write Multiple Registers', zh: '寫入多個保持暫存器 (4x)', type: 'write' },
  0x11: { name: 'Report Server ID', zh: '回報伺服器/從站 ID', type: 'diag' },
  0x14: { name: 'Read File Record', zh: '讀取檔案記錄', type: 'read' },
  0x15: { name: 'Write File Record', zh: '寫入檔案記錄', type: 'write' },
  0x16: { name: 'Mask Write Register', zh: '遮罩寫入暫存器', type: 'write' },
  0x17: { name: 'Read/Write Multiple Registers', zh: '讀寫多個暫存器', type: 'write' },
};

// Modbus Exception Codes
const MODBUS_EXCEPTIONS: Record<number, { name: string; zh: string; desc: string; troubles: string[] }> = {
  0x01: {
    name: 'Illegal Function',
    zh: '不合法功能碼',
    desc: '伺服器/從站不支援或未實現該功能碼。',
    troubles: [
      '檢查從站設備型號手冊，確認該功能碼 (例如 0x03 / 0x10) 是否在支援清單中。',
      '確認設備是否處於特殊程式設計或維護模式而停用該功能。',
    ],
  },
  0x02: {
    name: 'Illegal Data Address',
    zh: '不合法資料位址',
    desc: '請求的暫存器位址在從站中不存在或超出允許位址範圍。',
    troubles: [
      '檢查位址基底偏移 (0-based vs 1-based)：PLC 習慣從 40001 (Offset 0) 開始，請確認是否相差 1。',
      '檢查起始位址加上點數是否超過設備最大允許暫存器編號。',
      '確認從站特定暫存器區域是否需要特殊存取權限。',
    ],
  },
  0x03: {
    name: 'Illegal Data Value',
    zh: '不合法資料數值',
    desc: '封包中的數值或點數不在從站允許的範圍內。',
    troubles: [
      '檢查讀取點數 (Quantity)：例如功能碼 03 單次讀取上限通常為 125 個暫存器。',
      '線圈寫入值只能為 0xFF00 (ON) 或 0x0000 (OFF)，其他值皆不合法。',
      '檢查寫入暫存器數值是否超過設備的上下限範圍。',
    ],
  },
  0x04: {
    name: 'Slave Device Failure',
    zh: '從站設備故障',
    desc: '從站在試圖執行請求的動作時發生無法恢復的內部錯誤。',
    troubles: [
      '檢查從站 PLC / 感測器硬體狀態燈號或系統警報記錄。',
      '確認感測器探針或周邊模組是否未連接或通訊逾時。',
    ],
  },
  0x05: {
    name: 'Acknowledge',
    zh: '確認接收 (正在執行長任務)',
    desc: '從站已接受請求並正在處理，但需要較長時間才能完成。',
    troubles: ['設備正在進行耗時運算或燒錄，請增加輪詢間隔或稍後再查詢狀態。'],
  },
  0x06: {
    name: 'Slave Device Busy',
    zh: '從站忙碌',
    desc: '從站正在處理其他命令，無法立即處理此請求。',
    troubles: ['通常發生在雙主站競碰或從站 CPU 負載過重，請降低輪詢頻率 (Polling Cycle)。'],
  },
  0x08: {
    name: 'Memory Parity Error',
    zh: '記憶體同位檢查錯誤',
    desc: '從站讀取內部延伸記憶體或檔案時檢測到同位校驗錯誤。',
    troubles: ['從站硬體 EEPROM/RAM 可能損壞，建議重新開機或備份更換。'],
  },
  0x0A: {
    name: 'Gateway Path Unavailable',
    zh: '閘道路徑不可用',
    desc: 'Modbus 閘道器無法將請求路由到下層 RS-485 匯流排。',
    troubles: ['檢查閘道器串列傳輸埠 (RS-485) 接線、鮑率與通道配置。'],
  },
  0x0B: {
    name: 'Gateway Target Device Failed to Respond',
    zh: '閘道目標設備逾時未回應',
    desc: '閘道器向下層發送封包，但目標從站逾時未回應。',
    troubles: [
      '檢查終端設備是否通電開機。',
      '確認下層從站站號 (Slave ID) 是否完全吻合。',
      '檢查 RS-485 終端電阻 (120Ω)、A/B 接線是否反接。',
    ],
  },
};

// MC Protocol 3E Device Code Mapping
const MC_DEVICE_CODES: Record<number, { code: string; zh: string; unit: 'word' | 'bit' }> = {
  0x90: { code: 'M', zh: '內部繼電器 M', unit: 'bit' },
  0x91: { code: 'SM', zh: '特殊繼電器 SM', unit: 'bit' },
  0x92: { code: 'L', zh: '鎖存繼電器 L', unit: 'bit' },
  0x93: { code: 'F', zh: '報警器 F', unit: 'bit' },
  0x94: { code: 'V', zh: '邊沿繼電器 V', unit: 'bit' },
  0x9C: { code: 'X', zh: '輸入 X', unit: 'bit' },
  0x9D: { code: 'Y', zh: '輸出 Y', unit: 'bit' },
  0x98: { code: 'B', zh: '鏈結繼電器 B', unit: 'bit' },
  0xA0: { code: 'TN', zh: '計時器當前值 TN', unit: 'word' },
  0xA8: { code: 'D', zh: '資料暫存器 D', unit: 'word' },
  0xA9: { code: 'SD', zh: '特殊暫存器 SD', unit: 'word' },
  0xB4: { code: 'W', zh: '鏈結暫存器 W', unit: 'word' },
  0xAF: { code: 'R', zh: '檔案暫存器 R', unit: 'word' },
  0xB0: { code: 'ZR', zh: '連續檔案暫存器 ZR', unit: 'word' },
};

// MC Protocol End Codes
const MC_END_CODES: Record<number, { name: string; desc: string; troubles: string[] }> = {
  0x0000: {
    name: 'Normal Completion',
    desc: '正常完成，PLC 已成功處理請求。',
    troubles: [],
  },
  0xC050: {
    name: 'Communication data code error',
    desc: '通訊資料格式碼設定錯誤 (例如 Binary 與 ASCII 混淆)。',
    troubles: ['確認 PLC 乙太網路模組設定為二進制 (Binary) 還是 ASCII 通訊。'],
  },
  0xC051: {
    name: 'Maximum number of points exceeded',
    desc: '超過單次通訊最大點數上限。',
    troubles: ['3E 二進制讀取上限為 960 點 (Word) 或 7168 點 (Bit)，請減少點數分批讀取。'],
  },
  0xC059: {
    name: 'Command / Subcommand error',
    desc: '指定的指令或子指令不存在，或者讀寫單位 (Bit/Word) 不匹配。',
    troubles: [
      '檢查指令是否為 0401 (讀取) 或 1401 (寫入)。',
      '檢查子指令：0000 (Word單位) 還是 0001 (Bit單位)。點存取 D 暫存器需使用對應指令。',
    ],
  },
  0xC05B: {
    name: 'Cannot write to specified device',
    desc: '指定之裝置為唯讀或處於寫入保護中。',
    troubles: ['檢查該暫存器是否受 PLC 程式重複寫入或密碼鎖定。'],
  },
  0xC05C: {
    name: 'Specified device does not exist',
    desc: '指定之軟元件超出該 PLC CPU 的容量範圍。',
    troubles: ['檢查 CPU 型號的 D/M 暫存器最大上限 (例如 FX5U vs Q03UDE)。'],
  },
  0xC061: {
    name: 'Data length mismatch',
    desc: '請求資料長度 (Request Data Length) 與實際內容長度不符。',
    troubles: ['重新計算 Request Data Length 欄位 (後續所有 Byte 的總數)。'],
  },
};

/**
 * Auto-detect protocol based on packet features
 */
export function detectProtocol(bytes: number[], isAsciiFrame: boolean): 'modbus-rtu' | 'modbus-ascii' | 'modbus-tcp' | 'mc-3e-binary' {
  if (isAsciiFrame) {
    return 'modbus-ascii';
  }

  // MC Protocol 3E binary check:
  // Request begins with Subheader 50 00 (or 54 00), Response begins with D0 00 (or D4 00)
  if (bytes.length >= 11) {
    if ((bytes[0] === 0x50 || bytes[0] === 0x54) && bytes[1] === 0x00 && bytes[3] === 0xFF) {
      return 'mc-3e-binary';
    }
    if ((bytes[0] === 0xD0 || bytes[0] === 0xD4) && bytes[1] === 0x00 && bytes[3] === 0xFF) {
      return 'mc-3e-binary';
    }
  }

  // Modbus TCP check:
  // Starts with Transaction ID (2B), Protocol ID (0x0000), Length (2B), Unit ID (1B)
  // Protocol ID is always 0x0000 in standard Modbus TCP
  if (bytes.length >= 8 && bytes[2] === 0x00 && bytes[3] === 0x00) {
    const declaredLen = (bytes[4] << 8) | bytes[5];
    if (declaredLen + 6 === bytes.length && bytes[6] > 0 && bytes[6] <= 247) {
      return 'modbus-tcp';
    }
  }

  // Check if Modbus RTU CRC matches
  if (bytes.length >= 4) {
    const dataPart = bytes.slice(0, -2);
    const expectedCrc = calculateCRC16Modbus(dataPart);
    const actualLow = bytes[bytes.length - 2];
    const actualHigh = bytes[bytes.length - 1];
    if (actualLow === expectedCrc.lowByte && actualHigh === expectedCrc.highByte) {
      return 'modbus-rtu';
    }
  }

  // Default to Modbus RTU if unknown
  return 'modbus-rtu';
}

/**
 * Parse Modbus RTU Packet
 */
export function parseModbusRTU(bytes: number[]): AnalysisResult {
  const fields: FieldBreakdown[] = [];
  const warnings: string[] = [];
  let isValid = true;
  let direction: PacketDirection = 'unknown';
  let summary = '';
  let payloadBytes: number[] = [];
  let payloadStartIndex = -1;
  let exception: ExceptionInfo | undefined;

  const len = bytes.length;
  if (len < 3) {
    return createInvalidResult('modbus-rtu', 'Modbus RTU', bytes, '封包長度過短 (至少需 3 Bytes: 站號 + 功能碼/異常碼 + 校驗碼)');
  }

  // 1. Station ID (1 Byte)
  const stationId = bytes[0];
  fields.push({
    id: 'station',
    name: 'Slave Address',
    labelZh: '從站站號 (Slave ID)',
    startIndex: 0,
    length: 1,
    rawHex: formatBytes([stationId]),
    parsedValue: `${stationId} (0x${stationId.toString(16).padStart(2, '0').toUpperCase()})`,
    description: stationId === 0 ? '廣播位址 (Broadcast: 0)' : `從站位址 ${stationId}`,
    color: COLORS.station,
  });

  // 2. Function Code (1 Byte)
  const funcCode = bytes[1];
  const isException = funcCode >= 0x80;
  const baseFunc = isException ? funcCode - 0x80 : funcCode;
  const funcInfo = MODBUS_FUNCTIONS[baseFunc];

  // 3. CRC-16 Check
  const dataPart = bytes.slice(0, len >= 2 ? len - 2 : len);
  const crcCalc = calculateCRC16Modbus(dataPart);
  let checksum: ChecksumInfo = {
    type: 'CRC16-Modbus',
    expectedHex: crcCalc.hexLowFirst,
    actualHex: len >= 2 ? formatBytes([bytes[len - 2], bytes[len - 1]]) : 'N/A',
    matches: false,
    algorithmDetail: `Poly: 0xA001, Init: 0xFFFF -> 0x${crcCalc.crc.toString(16).padStart(4, '0').toUpperCase()} (Low First: ${crcCalc.hexLowFirst})`,
  };

  if (len >= 2) {
    const rxLow = bytes[len - 2];
    const rxHigh = bytes[len - 1];
    if (rxLow === crcCalc.lowByte && rxHigh === crcCalc.highByte) {
      checksum.matches = true;
    } else if (rxLow === crcCalc.highByte && rxHigh === crcCalc.lowByte) {
      checksum.matches = false;
      checksum.isByteSwapped = true;
      warnings.push('偵測到 CRC-16 位元組顛倒！發送端採用了 High Byte 在前，而標準 Modbus RTU 應為 Low Byte 在前。');
    } else {
      checksum.matches = false;
      isValid = false;
      warnings.push(`CRC-16 校驗不符：計算值為 ${crcCalc.hexLowFirst}，封包尾部為 ${formatBytes([rxLow, rxHigh])}`);
    }
  }

  if (isException) {
    direction = 'exception';
    fields.push({
      id: 'function',
      name: 'Exception Function',
      labelZh: '異常功能碼 (0x80 + FC)',
      startIndex: 1,
      length: 1,
      rawHex: formatBytes([funcCode]),
      parsedValue: `0x${funcCode.toString(16).toUpperCase()} (原功能碼: 0x${baseFunc.toString(16).padStart(2, '0').toUpperCase()})`,
      description: `從站回報異常 (對應 ${funcInfo?.zh || `功能碼 0x${baseFunc.toString(16)}`})`,
      color: COLORS.exception,
      isError: true,
    });

    if (len >= 3) {
      const exCode = bytes[2];
      const exDetail = MODBUS_EXCEPTIONS[exCode];
      exception = {
        code: exCode,
        hex: `0x${exCode.toString(16).padStart(2, '0').toUpperCase()}`,
        name: exDetail?.name || 'Unknown Exception',
        nameZh: exDetail?.zh || '未知異常碼',
        description: exDetail?.desc || '從站回傳了自定義或未知的異常碼。',
        troubleshooting: exDetail?.troubles || ['請參閱設備原廠手冊通訊協議說明。'],
      };

      fields.push({
        id: 'exception_code',
        name: 'Exception Code',
        labelZh: '異常診斷碼 (Exception Code)',
        startIndex: 2,
        length: 1,
        rawHex: formatBytes([exCode]),
        parsedValue: `${exception.hex}: ${exception.nameZh}`,
        description: exception.description,
        color: COLORS.exception,
        isError: true,
      });

      summary = `從站 [${stationId}] 回覆異常：[${exception.hex}] ${exception.nameZh} (${exception.name})`;
    }
  } else {
    // Normal function code
    fields.push({
      id: 'function',
      name: 'Function Code',
      labelZh: '功能碼 (FC)',
      startIndex: 1,
      length: 1,
      rawHex: formatBytes([funcCode]),
      parsedValue: `0x${funcCode.toString(16).padStart(2, '0').toUpperCase()} (${funcInfo ? funcInfo.name : 'Unknown'})`,
      description: funcInfo ? funcInfo.zh : '未知功能碼',
      color: COLORS.functionCode,
    });

    // Detect Request vs Response by analyzing standard frame layouts
    // Standard Modbus Request for FC 01, 02, 03, 04 is 8 bytes: [Slave][FC][StartHi][StartLo][QtyHi][QtyLo][CRCLo][CRCHi]
    if ([0x01, 0x02, 0x03, 0x04].includes(funcCode)) {
      if (len === 8) {
        // Typical read request
        direction = 'request';
        const startAddr = (bytes[2] << 8) | bytes[3];
        const qty = (bytes[4] << 8) | bytes[5];

        fields.push({
          id: 'start_address',
          name: 'Starting Address',
          labelZh: '起始暫存器位址',
          startIndex: 2,
          length: 2,
          rawHex: formatBytes([bytes[2], bytes[3]]),
          parsedValue: `${startAddr} (0x${startAddr.toString(16).padStart(4, '0').toUpperCase()})`,
          description: `PLC 位址表示法: 40001 + ${startAddr} = ${40001 + startAddr} (若為 1-based)`,
          color: COLORS.address,
        });

        fields.push({
          id: 'quantity',
          name: 'Quantity of Points',
          labelZh: '讀取數量 (點數)',
          startIndex: 4,
          length: 2,
          rawHex: formatBytes([bytes[4], bytes[5]]),
          parsedValue: `${qty} 點 (${qty * 2} Bytes / ${qty} Words)`,
          description: `請求讀取 ${qty} 個連續${[0x01, 0x02].includes(funcCode) ? '線圈/輸入點' : '暫存器'}`,
          color: COLORS.count,
        });

        summary = `主站向從站 [${stationId}] 發送【${funcInfo?.zh || funcCode}】請求，起始位址 0x${startAddr.toString(16).padStart(4, '0').toUpperCase()} (${startAddr})，共 ${qty} 點`;
      } else {
        // Read response: [Slave][FC][ByteCount][Data...][CRCLo][CRCHi]
        direction = 'response';
        const byteCount = bytes[2];

        fields.push({
          id: 'byte_count',
          name: 'Byte Count',
          labelZh: '資料位元組數 (Byte Count)',
          startIndex: 2,
          length: 1,
          rawHex: formatBytes([byteCount]),
          parsedValue: `${byteCount} Bytes`,
          description: `後續回傳 ${byteCount} 個位元組 (${Math.floor(byteCount / 2)} 個 16-bit 暫存器)`,
          color: COLORS.count,
        });

        const dataBytes = bytes.slice(3, 3 + byteCount);
        payloadBytes = dataBytes;
        payloadStartIndex = 3;

        fields.push({
          id: 'payload_data',
          name: 'Data Payload',
          labelZh: '暫存器數值資料 (Payload)',
          startIndex: 3,
          length: byteCount,
          rawHex: formatBytes(dataBytes),
          parsedValue: `${dataBytes.length} 位元組`,
          description: '回傳之即時數值資料，已載入數值解碼器',
          color: COLORS.payload,
        });

        if (3 + byteCount + 2 !== len) {
          warnings.push(`封包長度警告：宣告 Byte Count 為 ${byteCount}，但實際資料長度為 ${len - 5}`);
        }

        summary = `從站 [${stationId}] 回覆【${funcInfo?.zh || funcCode}】，共回傳 ${byteCount} Bytes (${Math.floor(byteCount / 2)} 個暫存器)`;
      }
    } else if (funcCode === 0x05) {
      // Write Single Coil (8 bytes request or response)
      const outAddr = (bytes[2] << 8) | bytes[3];
      const outVal = (bytes[4] << 8) | bytes[5];
      direction = len === 8 ? 'request' : 'unknown';

      fields.push({
        id: 'coil_address',
        name: 'Output Address',
        labelZh: '線圈位址 (Coil Address)',
        startIndex: 2,
        length: 2,
        rawHex: formatBytes([bytes[2], bytes[3]]),
        parsedValue: `${outAddr} (0x${outAddr.toString(16).padStart(4, '0').toUpperCase()})`,
        description: `目標線圈位址 00001 + ${outAddr}`,
        color: COLORS.address,
      });

      const stateStr = outVal === 0xFF00 ? 'ON (閉合 1)' : outVal === 0x0000 ? 'OFF (斷開 0)' : `不合法值: 0x${outVal.toString(16)}`;
      fields.push({
        id: 'coil_value',
        name: 'Output Value',
        labelZh: '線圈設定值',
        startIndex: 4,
        length: 2,
        rawHex: formatBytes([bytes[4], bytes[5]]),
        parsedValue: stateStr,
        description: outVal === 0xFF00 ? '0xFF00 強制為 ON' : outVal === 0x0000 ? '0x0000 強制為 OFF' : 'Modbus 協定要求線圈僅能是 0xFF00 或 0x0000',
        color: outVal === 0xFF00 || outVal === 0x0000 ? COLORS.payload : COLORS.exception,
      });

      summary = `寫入線圈 [${stationId}] 位址 0x${outAddr.toString(16).padStart(4, '0').toUpperCase()} 狀態設為 ${stateStr}`;
    } else if (funcCode === 0x06) {
      // Write Single Register (8 bytes)
      const regAddr = (bytes[2] << 8) | bytes[3];
      const regVal = (bytes[4] << 8) | bytes[5];
      direction = 'request';

      fields.push({
        id: 'register_address',
        name: 'Register Address',
        labelZh: '暫存器位址',
        startIndex: 2,
        length: 2,
        rawHex: formatBytes([bytes[2], bytes[3]]),
        parsedValue: `${regAddr} (0x${regAddr.toString(16).padStart(4, '0').toUpperCase()})`,
        description: `目標暫存器位址 (PLC 40001 + ${regAddr})`,
        color: COLORS.address,
      });

      const signedVal = regVal >= 0x8000 ? regVal - 0x10000 : regVal;
      payloadBytes = [bytes[4], bytes[5]];
      payloadStartIndex = 4;

      fields.push({
        id: 'register_value',
        name: 'Register Value',
        labelZh: '寫入數值',
        startIndex: 4,
        length: 2,
        rawHex: formatBytes([bytes[4], bytes[5]]),
        parsedValue: `UINT: ${regVal} | INT: ${signedVal}`,
        description: `寫入 16-bit 數值: 0x${regVal.toString(16).padStart(4, '0').toUpperCase()}`,
        color: COLORS.payload,
      });

      summary = `寫入單個暫存器 [${stationId}] 位址 0x${regAddr.toString(16).padStart(4, '0').toUpperCase()} 數值為 ${regVal}`;
    } else if (funcCode === 0x10) {
      // Write Multiple Registers (FC 16)
      if (len === 8) {
        // Write Multiple Response: [Slave][FC][StartHi][StartLo][QtyHi][QtyLo][CRC]
        direction = 'response';
        const startAddr = (bytes[2] << 8) | bytes[3];
        const qty = (bytes[4] << 8) | bytes[5];

        fields.push({
          id: 'start_address',
          name: 'Starting Address',
          labelZh: '起始位址',
          startIndex: 2,
          length: 2,
          rawHex: formatBytes([bytes[2], bytes[3]]),
          parsedValue: `${startAddr}`,
          description: `寫入成功之起始暫存器位址`,
          color: COLORS.address,
        });

        fields.push({
          id: 'quantity',
          name: 'Quantity Written',
          labelZh: '成功寫入數量',
          startIndex: 4,
          length: 2,
          rawHex: formatBytes([bytes[4], bytes[5]]),
          parsedValue: `${qty} 點`,
          description: `已確認寫入 ${qty} 個暫存器`,
          color: COLORS.count,
        });

        summary = `從站 [${stationId}] 回覆寫入成功：已寫入 ${qty} 個暫存器 (起始位址 0x${startAddr.toString(16).padStart(4, '0')})`;
      } else {
        // Write Multiple Request: [Slave][FC][StartHi][StartLo][QtyHi][QtyLo][ByteCount][Data...][CRC]
        direction = 'request';
        const startAddr = (bytes[2] << 8) | bytes[3];
        const qty = (bytes[4] << 8) | bytes[5];
        const byteCount = bytes[6];

        fields.push({
          id: 'start_address',
          name: 'Starting Address',
          labelZh: '起始位址',
          startIndex: 2,
          length: 2,
          rawHex: formatBytes([bytes[2], bytes[3]]),
          parsedValue: `${startAddr} (0x${startAddr.toString(16).padStart(4, '0').toUpperCase()})`,
          description: `寫入目標起始位址`,
          color: COLORS.address,
        });

        fields.push({
          id: 'quantity',
          name: 'Quantity',
          labelZh: '寫入暫存器點數',
          startIndex: 4,
          length: 2,
          rawHex: formatBytes([bytes[4], bytes[5]]),
          parsedValue: `${qty} 點`,
          description: `預計連續寫入 ${qty} 個暫存器`,
          color: COLORS.count,
        });

        fields.push({
          id: 'byte_count',
          name: 'Byte Count',
          labelZh: '寫入位元組數',
          startIndex: 6,
          length: 1,
          rawHex: formatBytes([byteCount]),
          parsedValue: `${byteCount} Bytes`,
          description: `寫入資料長度 (${byteCount} Bytes = ${qty} Words)`,
          color: COLORS.count,
        });

        const dataBytes = bytes.slice(7, 7 + byteCount);
        payloadBytes = dataBytes;
        payloadStartIndex = 7;

        fields.push({
          id: 'write_data',
          name: 'Write Data',
          labelZh: '寫入資料內容 (Payload)',
          startIndex: 7,
          length: byteCount,
          rawHex: formatBytes(dataBytes),
          parsedValue: `${dataBytes.length} 位元組`,
          description: '寫入各暫存器的資料，已載入數值解碼器',
          color: COLORS.payload,
        });

        summary = `發送連續寫入暫存器請求 [${stationId}]，起始位址 0x${startAddr.toString(16).padStart(4, '0')}，共寫入 ${qty} 點 (${byteCount} Bytes)`;
      }
    } else {
      // Generic Modbus payload
      direction = len > 8 ? 'response' : 'request';
      const dataBytes = bytes.slice(2, len - 2);
      payloadBytes = dataBytes;
      payloadStartIndex = 2;
      fields.push({
        id: 'generic_data',
        name: 'Data Payload',
        labelZh: '通訊內容資料 (Payload)',
        startIndex: 2,
        length: dataBytes.length,
        rawHex: formatBytes(dataBytes),
        parsedValue: `${dataBytes.length} Bytes`,
        description: '功能碼特定資料區段',
        color: COLORS.payload,
      });
      summary = `Modbus RTU 封包 [從站: ${stationId}, 功能碼: 0x${funcCode.toString(16).padStart(2, '0').toUpperCase()}]`;
    }
  }

  // Add CRC Field
  if (len >= 2) {
    const crcBytes = [bytes[len - 2], bytes[len - 1]];
    fields.push({
      id: 'crc16',
      name: 'CRC-16 Checksum',
      labelZh: 'CRC-16 校驗碼 (Low / High)',
      startIndex: len - 2,
      length: 2,
      rawHex: formatBytes(crcBytes),
      parsedValue: checksum.matches
        ? `0x${crcCalc.crc.toString(16).padStart(4, '0').toUpperCase()} (校驗正確)`
        : `校驗失敗 (應為 0x${crcCalc.crc.toString(16).padStart(4, '0').toUpperCase()})`,
      description: `CRC-16 (Modbus): 0x${crcCalc.crc.toString(16).padStart(4, '0').toUpperCase()} (封包內低位元在先: ${crcCalc.hexLowFirst})`,
      color: checksum.matches ? COLORS.checksumOk : COLORS.checksumErr,
      isError: !checksum.matches,
    });
  }

  const convertedPayload = payloadBytes.length > 0 ? convertPayloadBytes(payloadBytes) : undefined;

  return {
    protocol: 'modbus-rtu',
    protocolDisplayName: 'Modbus RTU (Serial RS-485 / RS-232)',
    direction,
    directionDisplayName: direction === 'request' ? '發送請求 (Request)' : direction === 'response' ? '從站回應 (Response)' : direction === 'exception' ? '異常回傳 (Exception)' : '未知方向',
    rawBytes: bytes,
    cleanHex: formatBytes(bytes, ''),
    formattedHex: formatBytes(bytes, ' '),
    isValid: isValid && checksum.matches,
    fields,
    checksum,
    exception,
    payloadBytes,
    payloadStartIndex,
    convertedPayload,
    summary,
    warnings,
  };
}

/**
 * Parse Modbus TCP Packet
 */
export function parseModbusTCP(bytes: number[]): AnalysisResult {
  const fields: FieldBreakdown[] = [];
  const warnings: string[] = [];
  let isValid = true;
  let direction: PacketDirection = 'unknown';
  let summary = '';
  let payloadBytes: number[] = [];
  let payloadStartIndex = -1;
  let exception: ExceptionInfo | undefined;

  const len = bytes.length;
  if (len < 8) {
    return createInvalidResult('modbus-tcp', 'Modbus TCP', bytes, '封包長度過短 (Modbus TCP 至少需 8 Bytes: MBAP Header 7B + 功能碼 1B)');
  }

  // MBAP Header (7 Bytes)
  // 1. Transaction Identifier (2 Bytes)
  const transId = (bytes[0] << 8) | bytes[1];
  fields.push({
    id: 'transaction_id',
    name: 'Transaction ID',
    labelZh: '交易序號 (Transaction ID)',
    startIndex: 0,
    length: 2,
    rawHex: formatBytes([bytes[0], bytes[1]]),
    parsedValue: `${transId} (0x${transId.toString(16).padStart(4, '0').toUpperCase()})`,
    description: '客戶端發起請求時的序列識別號，伺服端回應時複製此號',
    color: COLORS.header,
  });

  // 2. Protocol Identifier (2 Bytes, always 0x0000 for Modbus)
  const protoId = (bytes[2] << 8) | bytes[3];
  fields.push({
    id: 'protocol_id',
    name: 'Protocol ID',
    labelZh: '協定識別碼 (Protocol ID)',
    startIndex: 2,
    length: 2,
    rawHex: formatBytes([bytes[2], bytes[3]]),
    parsedValue: `${protoId} (${protoId === 0 ? 'Modbus 協定' : '非標準協定'})`,
    description: 'Modbus TCP 規定固定為 0x0000',
    color: COLORS.header,
    isError: protoId !== 0,
  });
  if (protoId !== 0) {
    warnings.push(`Protocol ID 為 0x${protoId.toString(16)}，標準 Modbus TCP 應為 0x0000`);
  }

  // 3. Length (2 Bytes, remaining length of packet including Unit ID)
  const declaredLen = (bytes[4] << 8) | bytes[5];
  const actualRemaining = len - 6;
  const lenMatches = declaredLen === actualRemaining;

  fields.push({
    id: 'length_field',
    name: 'Length Field',
    labelZh: '後續長度 (Length)',
    startIndex: 4,
    length: 2,
    rawHex: formatBytes([bytes[4], bytes[5]]),
    parsedValue: `${declaredLen} Bytes`,
    description: `宣告後續長度 (包含 Unit ID 與 PDU): ${declaredLen} 位元組`,
    color: lenMatches ? COLORS.count : COLORS.exception,
    isError: !lenMatches,
  });

  if (!lenMatches) {
    warnings.push(`MBAP 長度欄位不符：宣告為 ${declaredLen} Bytes，但實際剩餘為 ${actualRemaining} Bytes`);
  }

  // 4. Unit ID (1 Byte)
  const unitId = bytes[6];
  fields.push({
    id: 'unit_id',
    name: 'Unit ID',
    labelZh: '單元/從站位址 (Unit ID)',
    startIndex: 6,
    length: 1,
    rawHex: formatBytes([unitId]),
    parsedValue: `${unitId} (0x${unitId.toString(16).padStart(2, '0').toUpperCase()})`,
    description: '目標從站位址或 TCP 閘道下層設備號',
    color: COLORS.station,
  });

  // 5. Function Code (Byte 7)
  const funcCode = bytes[7];
  const isException = funcCode >= 0x80;
  const baseFunc = isException ? funcCode - 0x80 : funcCode;
  const funcInfo = MODBUS_FUNCTIONS[baseFunc];

  if (isException) {
    direction = 'exception';
    fields.push({
      id: 'function',
      name: 'Exception Function',
      labelZh: '異常功能碼 (0x80 + FC)',
      startIndex: 7,
      length: 1,
      rawHex: formatBytes([funcCode]),
      parsedValue: `0x${funcCode.toString(16).toUpperCase()}`,
      description: `從站回報異常 (對應 ${funcInfo?.zh || `功能碼 0x${baseFunc.toString(16)}`})`,
      color: COLORS.exception,
      isError: true,
    });

    if (len >= 9) {
      const exCode = bytes[8];
      const exDetail = MODBUS_EXCEPTIONS[exCode];
      exception = {
        code: exCode,
        hex: `0x${exCode.toString(16).padStart(2, '0').toUpperCase()}`,
        name: exDetail?.name || 'Unknown Exception',
        nameZh: exDetail?.zh || '未知異常碼',
        description: exDetail?.desc || '從站回傳了自定義或未知的異常碼。',
        troubleshooting: exDetail?.troubles || ['請參閱設備原廠手冊通訊協議說明。'],
      };

      fields.push({
        id: 'exception_code',
        name: 'Exception Code',
        labelZh: '異常診斷碼 (Exception Code)',
        startIndex: 8,
        length: 1,
        rawHex: formatBytes([exCode]),
        parsedValue: `${exception.hex}: ${exception.nameZh}`,
        description: exception.description,
        color: COLORS.exception,
        isError: true,
      });

      summary = `Modbus TCP 異常回應：交易 [${transId}] 單元 [${unitId}] 回覆 [${exception.hex}] ${exception.nameZh}`;
    }
  } else {
    fields.push({
      id: 'function',
      name: 'Function Code',
      labelZh: '功能碼 (FC)',
      startIndex: 7,
      length: 1,
      rawHex: formatBytes([funcCode]),
      parsedValue: `0x${funcCode.toString(16).padStart(2, '0').toUpperCase()} (${funcInfo ? funcInfo.name : 'Unknown'})`,
      description: funcInfo ? funcInfo.zh : '未知功能碼',
      color: COLORS.functionCode,
    });

    // Parse PDU based on FC
    if ([0x01, 0x02, 0x03, 0x04].includes(funcCode)) {
      if (len === 12) {
        // Read Request: 7 (MBAP) + 1 (FC) + 2 (Addr) + 2 (Qty) = 12
        direction = 'request';
        const startAddr = (bytes[8] << 8) | bytes[9];
        const qty = (bytes[10] << 8) | bytes[11];

        fields.push({
          id: 'start_address',
          name: 'Starting Address',
          labelZh: '起始暫存器位址',
          startIndex: 8,
          length: 2,
          rawHex: formatBytes([bytes[8], bytes[9]]),
          parsedValue: `${startAddr} (0x${startAddr.toString(16).padStart(4, '0').toUpperCase()})`,
          description: `PLC 位址: 40001 + ${startAddr} = ${40001 + startAddr}`,
          color: COLORS.address,
        });

        fields.push({
          id: 'quantity',
          name: 'Quantity',
          labelZh: '讀取點數 (Quantity)',
          startIndex: 10,
          length: 2,
          rawHex: formatBytes([bytes[10], bytes[11]]),
          parsedValue: `${qty} 點 (${qty * 2} Bytes)`,
          description: `請求讀取 ${qty} 個點位`,
          color: COLORS.count,
        });

        summary = `Modbus TCP 請求 [交易: ${transId}, 單元: ${unitId}]：${funcInfo?.zh || funcCode}，起始位址 ${startAddr}，共 ${qty} 點`;
      } else {
        // Read Response: 7 (MBAP) + 1 (FC) + 1 (ByteCount) + Data...
        direction = 'response';
        const byteCount = bytes[8];

        fields.push({
          id: 'byte_count',
          name: 'Byte Count',
          labelZh: '資料位元組數 (Byte Count)',
          startIndex: 8,
          length: 1,
          rawHex: formatBytes([byteCount]),
          parsedValue: `${byteCount} Bytes`,
          description: `回傳 ${byteCount} 位元組 (${Math.floor(byteCount / 2)} 暫存器)`,
          color: COLORS.count,
        });

        const dataBytes = bytes.slice(9, 9 + byteCount);
        payloadBytes = dataBytes;
        payloadStartIndex = 9;

        fields.push({
          id: 'payload_data',
          name: 'Data Payload',
          labelZh: '暫存器數值資料 (Payload)',
          startIndex: 9,
          length: dataBytes.length,
          rawHex: formatBytes(dataBytes),
          parsedValue: `${dataBytes.length} 位元組`,
          description: '數值資料已解碼於右側/下方多格式視圖',
          color: COLORS.payload,
        });

        summary = `Modbus TCP 回應 [交易: ${transId}, 單元: ${unitId}]：${funcInfo?.zh || funcCode}，回傳 ${byteCount} Bytes`;
      }
    } else {
      // General PDU
      direction = len > 12 ? 'response' : 'request';
      const dataBytes = bytes.slice(8);
      payloadBytes = dataBytes;
      payloadStartIndex = 8;
      fields.push({
        id: 'tcp_pdu_data',
        name: 'PDU Payload',
        labelZh: 'PDU 負載資料',
        startIndex: 8,
        length: dataBytes.length,
        rawHex: formatBytes(dataBytes),
        parsedValue: `${dataBytes.length} 位元組`,
        description: 'Modbus TCP 應用層資料',
        color: COLORS.payload,
      });
      summary = `Modbus TCP 封包 [交易: ${transId}, 單元: ${unitId}, 功能碼: 0x${funcCode.toString(16).padStart(2, '0').toUpperCase()}]`;
    }
  }

  const checksum: ChecksumInfo = {
    type: 'MC-Length',
    expectedHex: `${declaredLen} B`,
    actualHex: `${actualRemaining} B`,
    matches: lenMatches,
    algorithmDetail: 'Modbus TCP 由底層 TCP/IP 校驗保護，MBAP Header 透過 Length 欄位驗證封包完整性。',
  };

  const convertedPayload = payloadBytes.length > 0 ? convertPayloadBytes(payloadBytes) : undefined;

  return {
    protocol: 'modbus-tcp',
    protocolDisplayName: 'Modbus TCP (Ethernet / Port 502)',
    direction,
    directionDisplayName: direction === 'request' ? '發送請求 (Request)' : direction === 'response' ? '伺服器回應 (Response)' : direction === 'exception' ? '異常回傳 (Exception)' : '未知方向',
    rawBytes: bytes,
    cleanHex: formatBytes(bytes, ''),
    formattedHex: formatBytes(bytes, ' '),
    isValid: isValid && lenMatches,
    fields,
    checksum,
    exception,
    payloadBytes,
    payloadStartIndex,
    convertedPayload,
    summary,
    warnings,
  };
}

/**
 * Parse Modbus ASCII Packet
 */
export function parseModbusASCII(bytes: number[]): AnalysisResult {
  const fields: FieldBreakdown[] = [];
  const warnings: string[] = [];
  let isValid = true;
  let summary = '';
  let payloadBytes: number[] = [];
  let payloadStartIndex = -1;

  const len = bytes.length;
  if (len < 3) {
    return createInvalidResult('modbus-ascii', 'Modbus ASCII', bytes, '封包長度過短 (至少需 3 Bytes: 站號 + 功能碼 + LRC)');
  }

  // LRC is the last byte
  const lrcCalc = calculateLRC(bytes.slice(0, len - 1));
  const receivedLrc = bytes[len - 1];
  const lrcMatches = receivedLrc === lrcCalc.lrc;

  const checksum: ChecksumInfo = {
    type: 'LRC',
    expectedHex: lrcCalc.hex,
    actualHex: formatBytes([receivedLrc]),
    matches: lrcMatches,
    algorithmDetail: `LRC (Longitudinal Redundancy Check): 所有字節累加和之二補數 -> 0x${lrcCalc.hex}`,
  };

  if (!lrcMatches) {
    warnings.push(`LRC 校驗碼不符：計算值為 0x${lrcCalc.hex}，封包尾部為 0x${receivedLrc.toString(16).padStart(2, '0').toUpperCase()}`);
    isValid = false;
  }

  // Station ID
  const stationId = bytes[0];
  fields.push({
    id: 'station',
    name: 'Slave Address',
    labelZh: '從站站號 (Slave ID)',
    startIndex: 0,
    length: 1,
    rawHex: formatBytes([stationId]),
    parsedValue: `${stationId}`,
    description: `從站位址 ${stationId}`,
    color: COLORS.station,
  });

  // Function Code
  const funcCode = bytes[1];
  const isException = funcCode >= 0x80;
  const baseFunc = isException ? funcCode - 0x80 : funcCode;
  const funcInfo = MODBUS_FUNCTIONS[baseFunc];

  fields.push({
    id: 'function',
    name: 'Function Code',
    labelZh: '功能碼 (FC)',
    startIndex: 1,
    length: 1,
    rawHex: formatBytes([funcCode]),
    parsedValue: `0x${funcCode.toString(16).padStart(2, '0').toUpperCase()} (${funcInfo ? funcInfo.name : 'Unknown'})`,
    description: funcInfo ? funcInfo.zh : '未知功能碼',
    color: isException ? COLORS.exception : COLORS.functionCode,
  });

  // Middle payload
  const midBytes = bytes.slice(2, len - 1);
  if (midBytes.length > 0) {
    payloadBytes = midBytes;
    payloadStartIndex = 2;
    fields.push({
      id: 'ascii_payload',
      name: 'Payload Data',
      labelZh: '資料欄位 (PDU Data)',
      startIndex: 2,
      length: midBytes.length,
      rawHex: formatBytes(midBytes),
      parsedValue: `${midBytes.length} Bytes`,
      description: 'ASCII 封包解碼後之資料內容',
      color: COLORS.payload,
    });
  }

  // LRC Field
  fields.push({
    id: 'lrc_check',
    name: 'LRC Checksum',
    labelZh: 'LRC 校驗碼 (1 Byte)',
    startIndex: len - 1,
    length: 1,
    rawHex: formatBytes([receivedLrc]),
    parsedValue: lrcMatches ? `0x${lrcCalc.hex} (校驗相符)` : `0x${receivedLrc.toString(16).padStart(2, '0').toUpperCase()} (校驗失敗)`,
    description: `LRC 縱向冗餘校驗碼 (標準以 : 開頭、CRLF 結尾)`,
    color: lrcMatches ? COLORS.checksumOk : COLORS.checksumErr,
    isError: !lrcMatches,
  });

  summary = `Modbus ASCII 封包 [站號: ${stationId}, 功能碼: 0x${funcCode.toString(16).padStart(2, '0')}]，LRC 校驗 ${lrcMatches ? '通過' : '失敗'}`;

  const convertedPayload = payloadBytes.length > 0 ? convertPayloadBytes(payloadBytes) : undefined;

  return {
    protocol: 'modbus-ascii',
    protocolDisplayName: 'Modbus ASCII (Serial with LRC)',
    direction: isException ? 'exception' : (bytes.length <= 8 ? 'request' : 'response'),
    directionDisplayName: isException ? '異常回傳 (Exception)' : '標準訊框',
    rawBytes: bytes,
    cleanHex: formatBytes(bytes, ''),
    formattedHex: formatBytes(bytes, ' '),
    isValid: isValid && lrcMatches,
    fields,
    checksum,
    payloadBytes,
    payloadStartIndex,
    convertedPayload,
    summary,
    warnings,
  };
}

/**
 * Parse Mitsubishi MELSEC MC Protocol (3E Binary Frame)
 */
export function parseMC3EBinary(bytes: number[]): AnalysisResult {
  const fields: FieldBreakdown[] = [];
  const warnings: string[] = [];
  let isValid = true;
  let direction: PacketDirection = 'unknown';
  let summary = '';
  let payloadBytes: number[] = [];
  let payloadStartIndex = -1;
  let exception: ExceptionInfo | undefined;

  const len = bytes.length;
  if (len < 11) {
    return createInvalidResult('mc-3e-binary', 'Mitsubishi MC Protocol 3E', bytes, '封包長度過短 (MC 3E 標頭至少需 11 Bytes)');
  }

  // 1. Subheader (2 Bytes: Little Endian: 50 00 = Request, D0 00 = Response)
  const subheaderRaw = formatBytes([bytes[0], bytes[1]]);
  const isRequest = bytes[0] === 0x50 || bytes[0] === 0x54;
  const isResponse = bytes[0] === 0xD0 || bytes[0] === 0xD4;

  if (isRequest) {
    direction = 'request';
  } else if (isResponse) {
    direction = 'response';
  }

  fields.push({
    id: 'mc_subheader',
    name: 'Subheader',
    labelZh: '子標頭 (Subheader)',
    startIndex: 0,
    length: 2,
    rawHex: subheaderRaw,
    parsedValue: isRequest ? '0x5000 (3E 請求訊框)' : isResponse ? '0xD000 (3E 回應訊框)' : `0x${bytes[1].toString(16)}${bytes[0].toString(16)}`,
    description: 'Qna / iQ-R 兼容 3E 訊框格式代號',
    color: COLORS.header,
  });

  // 2. Network No (Byte 2)
  const netNo = bytes[2];
  fields.push({
    id: 'mc_net_no',
    name: 'Network No.',
    labelZh: '網路編號 (Network No.)',
    startIndex: 2,
    length: 1,
    rawHex: formatBytes([netNo]),
    parsedValue: `${netNo} (0x${netNo.toString(16).padStart(2, '0').toUpperCase()})`,
    description: netNo === 0 ? '自身網路 (0: Own Station Network)' : `網路編號 ${netNo}`,
    color: COLORS.general,
  });

  // 3. PC No (Byte 3)
  const pcNo = bytes[3];
  fields.push({
    id: 'mc_pc_no',
    name: 'PLC / PC No.',
    labelZh: 'PLC 站號 (PC No.)',
    startIndex: 3,
    length: 1,
    rawHex: formatBytes([pcNo]),
    parsedValue: pcNo === 0xFF ? '0xFF (本機站號)' : `${pcNo}`,
    description: pcNo === 0xFF ? '0xFF: 自身 CPU / 連線目標本機' : `PLC 站號 ${pcNo}`,
    color: COLORS.general,
  });

  // 4. Request Destination Module I/O No (Bytes 4-5, Little Endian: FF 03 = CPU)
  const moduleIo = (bytes[5] << 8) | bytes[4];
  const moduleIoStr = moduleIo === 0x03FF ? '0x03FF (本機主 CPU)' : `0x${moduleIo.toString(16).padStart(4, '0').toUpperCase()}`;
  fields.push({
    id: 'mc_module_io',
    name: 'Target Module I/O',
    labelZh: '要求目標模組 I/O 編號',
    startIndex: 4,
    length: 2,
    rawHex: formatBytes([bytes[4], bytes[5]]),
    parsedValue: moduleIoStr,
    description: '0x03FF 表示本機主 CPU 模組',
    color: COLORS.general,
  });

  // 5. Destination Module Station No (Byte 6)
  const stationNo = bytes[6];
  fields.push({
    id: 'mc_station_no',
    name: 'Target Station No.',
    labelZh: '要求目標多 CPU 號',
    startIndex: 6,
    length: 1,
    rawHex: formatBytes([stationNo]),
    parsedValue: `${stationNo}`,
    description: stationNo === 0 ? '自身站 / 單一 CPU 系統' : `多 CPU 系統站號 ${stationNo}`,
    color: COLORS.general,
  });

  // 6. Request/Response Data Length (Bytes 7-8, Little Endian)
  const dataLen = (bytes[8] << 8) | bytes[7];
  const actualLen = len - 9;
  const lenMatches = dataLen === actualLen;

  fields.push({
    id: 'mc_data_len',
    name: 'Data Length',
    labelZh: '後續資料長度 (Length)',
    startIndex: 7,
    length: 2,
    rawHex: formatBytes([bytes[7], bytes[8]]),
    parsedValue: `${dataLen} Bytes (Little Endian)`,
    description: `宣告後續資料總長度: ${dataLen} 位元組`,
    color: lenMatches ? COLORS.count : COLORS.exception,
    isError: !lenMatches,
  });

  if (!lenMatches) {
    warnings.push(`MC 3E 資料長度欄位不符：宣告為 ${dataLen} Bytes，但實際剩餘 ${actualLen} Bytes`);
  }

  if (isRequest) {
    // Request fields:
    // CPU Monitoring Timer (Bytes 9-10, Little Endian, units of 250ms)
    if (len >= 11) {
      const timerVal = (bytes[10] << 8) | bytes[9];
      fields.push({
        id: 'mc_timer',
        name: 'CPU Monitoring Timer',
        labelZh: 'CPU 監視計時器',
        startIndex: 9,
        length: 2,
        rawHex: formatBytes([bytes[9], bytes[10]]),
        parsedValue: `${timerVal} (${timerVal * 250} ms)`,
        description: `等待 PLC CPU 回應超時時間 (每單位 250ms)`,
        color: COLORS.count,
      });
    }

    // Command (Bytes 11-12, Little Endian: 01 04 = 0x0401 Batch Read, 01 14 = 0x1401 Batch Write)
    if (len >= 13) {
      const cmd = (bytes[12] << 8) | bytes[11];
      const cmdStr = cmd === 0x0401 ? '0401 (批次讀取 Batch Read)' : cmd === 0x1401 ? '1401 (批次寫入 Batch Write)' : cmd === 0x0403 ? '0403 (隨機讀取 Random Read)' : `0x${cmd.toString(16).padStart(4, '0').toUpperCase()}`;

      fields.push({
        id: 'mc_command',
        name: 'Command',
        labelZh: '指令 (Command)',
        startIndex: 11,
        length: 2,
        rawHex: formatBytes([bytes[11], bytes[12]]),
        parsedValue: cmdStr,
        description: 'MC 協定主命令代碼 (Little Endian)',
        color: COLORS.functionCode,
      });

      // Subcommand (Bytes 13-14, Little Endian: 00 00 = Word, 01 00 = Bit)
      if (len >= 15) {
        const subcmd = (bytes[14] << 8) | bytes[13];
        const subcmdStr = subcmd === 0x0000 ? '0000 (字 Word 單位存取)' : subcmd === 0x0001 ? '0001 (位元 Bit 單位存取)' : `0x${subcmd.toString(16).padStart(4, '0')}`;

        fields.push({
          id: 'mc_subcommand',
          name: 'Subcommand',
          labelZh: '子指令 (Subcommand)',
          startIndex: 13,
          length: 2,
          rawHex: formatBytes([bytes[13], bytes[14]]),
          parsedValue: subcmdStr,
          description: '存取單位指定 (Word 或 Bit)',
          color: COLORS.functionCode,
        });
      }

      // Head Device Number (3 Bytes: Bytes 15-17, Little Endian)
      if (len >= 18) {
        const headDevNum = bytes[15] | (bytes[16] << 8) | (bytes[17] << 16);
        // Device Code (Byte 18)
        const devCode = bytes[18];
        const devInfo = MC_DEVICE_CODES[devCode];
        const devName = devInfo ? `${devInfo.code}${headDevNum}` : `未知裝置代碼 0x${devCode.toString(16)} No.${headDevNum}`;

        fields.push({
          id: 'mc_device_head',
          name: 'Head Device Address',
          labelZh: '起始軟元件編號',
          startIndex: 15,
          length: 3,
          rawHex: formatBytes([bytes[15], bytes[16], bytes[17]]),
          parsedValue: `${headDevNum} (0x${headDevNum.toString(16).padStart(6, '0').toUpperCase()})`,
          description: `起始暫存器/繼電器位址編號`,
          color: COLORS.address,
        });

        fields.push({
          id: 'mc_device_code',
          name: 'Device Code',
          labelZh: '軟元件代碼 (Device Code)',
          startIndex: 18,
          length: 1,
          rawHex: formatBytes([devCode]),
          parsedValue: `${devInfo ? devInfo.zh : '未知'} [${devName}]`,
          description: `指定軟元件種類 (例如 A8=D, 90=M, 9C=X, 9D=Y)`,
          color: COLORS.address,
        });

        // Device Points (Bytes 19-20, Little Endian)
        if (len >= 21) {
          const points = (bytes[20] << 8) | bytes[19];
          fields.push({
            id: 'mc_points',
            name: 'Device Points',
            labelZh: '讀寫點數 (Points)',
            startIndex: 19,
            length: 2,
            rawHex: formatBytes([bytes[19], bytes[20]]),
            parsedValue: `${points} 點`,
            description: `讀寫點數數量 (Little Endian)`,
            color: COLORS.count,
          });

          // If write command (1401), write data follows
          if (cmd === 0x1401 && len > 21) {
            const writeData = bytes.slice(21);
            payloadBytes = writeData;
            payloadStartIndex = 21;
            fields.push({
              id: 'mc_write_data',
              name: 'Write Data Payload',
              labelZh: '寫入資料內容 (Payload)',
              startIndex: 21,
              length: writeData.length,
              rawHex: formatBytes(writeData),
              parsedValue: `${writeData.length} Bytes`,
              description: '預備寫入 PLC 軟元件的數值資料',
              color: COLORS.payload,
            });
          }

          summary = `MC Protocol 3E 請求：${cmd === 0x0401 ? '讀取' : cmd === 0x1401 ? '寫入' : '操作'}【${devName}】共 ${points} 點`;
        }
      }
    }
  } else if (isResponse) {
    // Response fields:
    // End Code / Completion Code (Bytes 9-10, Little Endian: 00 00 = Success)
    if (len >= 11) {
      const endCode = (bytes[10] << 8) | bytes[9];
      const endDetail = MC_END_CODES[endCode];
      const isSuccess = endCode === 0x0000;

      if (!isSuccess) {
        direction = 'exception';
        exception = {
          code: endCode,
          hex: `0x${endCode.toString(16).padStart(4, '0').toUpperCase()}`,
          name: endDetail?.name || 'Error Completion Code',
          nameZh: endDetail ? endDetail.name : 'PLC 異常結束碼',
          description: endDetail?.desc || '三菱 PLC 回傳了通訊錯誤碼。',
          troubleshooting: endDetail?.troubles || ['請參閱三菱 MELSEC 3E 協議通訊手冊錯誤代碼章節。'],
        };
      }

      fields.push({
        id: 'mc_end_code',
        name: 'End Code',
        labelZh: '結束碼 (End Code)',
        startIndex: 9,
        length: 2,
        rawHex: formatBytes([bytes[9], bytes[10]]),
        parsedValue: isSuccess ? '0x0000 (正常完成)' : `0x${endCode.toString(16).padStart(4, '0').toUpperCase()} (${endDetail?.name || '異常'})`,
        description: isSuccess ? 'PLC 正常處理完畢' : endDetail?.desc || '處理發生錯誤',
        color: isSuccess ? COLORS.checksumOk : COLORS.exception,
        isError: !isSuccess,
      });

      // Data payload in response starts at byte 11
      if (isSuccess && len > 11) {
        const respData = bytes.slice(11);
        payloadBytes = respData;
        payloadStartIndex = 11;

        fields.push({
          id: 'mc_response_data',
          name: 'Response Data Payload',
          labelZh: 'PLC 回傳數值 (Payload)',
          startIndex: 11,
          length: respData.length,
          rawHex: formatBytes(respData),
          parsedValue: `${respData.length} Bytes (${Math.floor(respData.length / 2)} Words)`,
          description: 'PLC 軟元件讀取資料，已載入數值解碼器 (請注意三菱多為 Little Endian / DCBA 格式)',
          color: COLORS.payload,
        });

        summary = `MC Protocol 3E 回應：PLC 正常完成，回傳 ${respData.length} 位元組資料`;
      } else if (!isSuccess) {
        summary = `MC Protocol 3E 異常：結束碼 0x${endCode.toString(16).padStart(4, '0').toUpperCase()} (${endDetail?.name || '錯誤'})`;
      }
    }
  }

  const checksum: ChecksumInfo = {
    type: 'MC-Length',
    expectedHex: `${dataLen} B`,
    actualHex: `${actualLen} B`,
    matches: lenMatches,
    algorithmDetail: 'MC Protocol 3E 乙太網訊框以 Data Length 欄位進行長度完整性檢核。',
  };

  const convertedPayload = payloadBytes.length > 0 ? convertPayloadBytes(payloadBytes) : undefined;

  return {
    protocol: 'mc-3e-binary',
    protocolDisplayName: 'Mitsubishi MC Protocol (3E Binary Frame / QnA-iQR)',
    direction,
    directionDisplayName: direction === 'request' ? 'PLC 請求 (Request)' : direction === 'response' ? 'PLC 回應 (Response)' : direction === 'exception' ? 'PLC 異常 (Exception)' : '未知方向',
    rawBytes: bytes,
    cleanHex: formatBytes(bytes, ''),
    formattedHex: formatBytes(bytes, ' '),
    isValid: isValid && lenMatches && (exception === undefined),
    fields,
    checksum,
    exception,
    payloadBytes,
    payloadStartIndex,
    convertedPayload,
    summary,
    warnings,
  };
}

/**
 * Universal Packet Parser Entry Point
 */
export function parsePacket(rawInput: string, forcedProtocol?: ProtocolType): AnalysisResult {
  // 1. Clean input
  const { bytes, cleanHex, isAsciiFrame, warnings, error } = cleanHexInput(rawInput);

  if (error || bytes.length === 0) {
    return createInvalidResult('modbus-rtu', 'Auto-Detect', [], error || '未輸入有效封包');
  }

  // 2. Select protocol
  let protocolToUse: 'modbus-rtu' | 'modbus-ascii' | 'modbus-tcp' | 'mc-3e-binary';
  if (forcedProtocol && forcedProtocol !== 'auto') {
    protocolToUse = forcedProtocol;
  } else {
    protocolToUse = detectProtocol(bytes, isAsciiFrame);
  }

  let result: AnalysisResult;
  switch (protocolToUse) {
    case 'modbus-rtu':
      result = parseModbusRTU(bytes);
      break;
    case 'modbus-tcp':
      result = parseModbusTCP(bytes);
      break;
    case 'modbus-ascii':
      result = parseModbusASCII(bytes);
      break;
    case 'mc-3e-binary':
      result = parseMC3EBinary(bytes);
      break;
  }

  // Append any input warnings (e.g. odd length padded)
  result.warnings.push(...warnings);
  return result;
}

function createInvalidResult(
  protocol: 'modbus-rtu' | 'modbus-ascii' | 'modbus-tcp' | 'mc-3e-binary',
  displayName: string,
  bytes: number[],
  errorMsg: string
): AnalysisResult {
  return {
    protocol,
    protocolDisplayName: displayName,
    direction: 'unknown',
    directionDisplayName: '未知',
    rawBytes: bytes,
    cleanHex: formatBytes(bytes, ''),
    formattedHex: formatBytes(bytes, ' '),
    isValid: false,
    fields: [],
    checksum: {
      type: 'None',
      expectedHex: '-',
      actualHex: '-',
      matches: false,
      algorithmDetail: '封包不完整，無法執行校驗',
    },
    payloadBytes: [],
    payloadStartIndex: -1,
    summary: errorMsg,
    warnings: [errorMsg],
  };
}
