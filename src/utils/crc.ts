/**
 * CRC-16 (Modbus) and LRC (Modbus ASCII) calculation & verification utilities.
 */

export interface CRC16Result {
  crc: number;          // e.g. 0x0BC4
  lowByte: number;      // e.g. 0xC4
  highByte: number;     // e.g. 0x0B
  hexLowFirst: string;  // e.g. "C4 0B" (Standard Modbus RTU order)
  hexHighFirst: string; // e.g. "0B C4"
  hexInt: string;       // e.g. "0x0BC4"
}

/**
 * Calculates standard Modbus RTU CRC-16.
 * Polynomial: 0xA001, Initial: 0xFFFF
 */
export function calculateCRC16Modbus(bytes: number[]): CRC16Result {
  let crc = 0xFFFF;

  for (let i = 0; i < bytes.length; i++) {
    crc ^= (bytes[i] & 0xFF);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
    }
  }

  const lowByte = crc & 0xFF;
  const highByte = (crc >> 8) & 0xFF;

  const hexLow = lowByte.toString(16).padStart(2, '0').toUpperCase();
  const hexHigh = highByte.toString(16).padStart(2, '0').toUpperCase();
  const hexInt = '0x' + crc.toString(16).padStart(4, '0').toUpperCase();

  return {
    crc,
    lowByte,
    highByte,
    hexLowFirst: `${hexLow} ${hexHigh}`,
    hexHighFirst: `${hexHigh} ${hexLow}`,
    hexInt,
  };
}

/**
 * Calculates Modbus ASCII LRC (Longitudinal Redundancy Check).
 * Sum of all bytes modulo 256, then two's complement.
 */
export function calculateLRC(bytes: number[]): { lrc: number; hex: string } {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    sum = (sum + bytes[i]) & 0xFF;
  }
  const lrc = ((-sum) & 0xFF);
  const hex = lrc.toString(16).padStart(2, '0').toUpperCase();
  return { lrc, hex };
}

/**
 * Cleans user raw string input and parses into byte array.
 * Tolerates: 0x, spaces, commas, colons, newlines, brackets, \x
 */
export function cleanHexInput(rawInput: string): {
  bytes: number[];
  cleanHex: string;
  isAsciiFrame: boolean;
  warnings: string[];
  error?: string;
} {
  const warnings: string[] = [];
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return { bytes: [], cleanHex: '', isAsciiFrame: false, warnings, error: '請輸入十六進制封包資料' };
  }

  // Check if it's Modbus ASCII frame starting with ':' and ending with \r\n or just hex string
  let isAsciiFrame = trimmed.startsWith(':');
  let hexText = trimmed;

  if (isAsciiFrame) {
    // Strip leading colon and trailing \r \n or CRLF
    hexText = hexText.replace(/^:/, '').replace(/[\r\n\s]+$/, '');
  }

  // Remove common prefixes/separators like 0x, \x, commas, semicolons, brackets, spaces
  let cleaned = hexText
    .replace(/0x/gi, '')
    .replace(/\\x/gi, '')
    .replace(/[,\s;:\[\]{}()\\\/_-]/g, '');

  // Validate hex characters
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) {
    const invalidChars = cleaned.match(/[^0-9a-fA-F]/g) || [];
    return {
      bytes: [],
      cleanHex: '',
      isAsciiFrame,
      warnings,
      error: `輸入含有無效的非十六進制字元: ${Array.from(new Set(invalidChars)).slice(0, 5).join(', ')}`,
    };
  }

  // Check for odd length
  if (cleaned.length % 2 !== 0) {
    warnings.push('十六進制長度為奇數，最後一個半字節已補 0 (以符合 Byte 對齊)');
    cleaned = cleaned.slice(0, -1) + '0' + cleaned.slice(-1);
  }

  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes.push(parseInt(cleaned.slice(i, i + 2), 16));
  }

  return {
    bytes,
    cleanHex: cleaned.toUpperCase(),
    isAsciiFrame,
    warnings,
  };
}

/**
 * Format bytes array to space separated hex string
 */
export function formatBytes(bytes: number[], separator = ' '): string {
  return bytes.map(b => (b & 0xFF).toString(16).padStart(2, '0').toUpperCase()).join(separator);
}

/**
 * Formats bytes to C-style array: 0x01, 0x03, ...
 */
export function formatCArray(bytes: number[]): string {
  return bytes.map(b => '0x' + (b & 0xFF).toString(16).padStart(2, '0').toUpperCase()).join(', ');
}

/**
 * Formats bytes to Python byte literal: b'\x01\x03...'
 */
export function formatPythonBytes(bytes: number[]): string {
  return `b'` + bytes.map(b => '\\x' + (b & 0xFF).toString(16).padStart(2, '0').toLowerCase()).join('') + `'`;
}
