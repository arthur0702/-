import { ConvertedPayload, EndianOrder } from '../types/protocol';

/**
 * Reorders 4 bytes according to the selected Endianness pattern:
 * - ABCD: [b0, b1, b2, b3] (Big Endian / Motorola / Modbus Standard)
 * - CDAB: [b2, b3, b0, b1] (Word Swap / Mid-Big Endian)
 * - BADC: [b1, b0, b3, b2] (Byte Swap / Mid-Little Endian)
 * - DCBA: [b3, b2, b1, b0] (Little Endian / Intel)
 */
export function reorder4Bytes(b0: number, b1: number, b2: number, b3: number, order: EndianOrder): [number, number, number, number] {
  switch (order) {
    case 'ABCD':
      return [b0, b1, b2, b3];
    case 'CDAB':
      return [b2, b3, b0, b1];
    case 'BADC':
      return [b1, b0, b3, b2];
    case 'DCBA':
      return [b3, b2, b1, b0];
  }
}

/**
 * Reorders 8 bytes for 64-bit float/double according to endian order
 */
export function reorder8Bytes(bytes: number[], order: EndianOrder): number[] {
  if (bytes.length < 8) return bytes;
  const [b0, b1, b2, b3, b4, b5, b6, b7] = bytes;
  switch (order) {
    case 'ABCD':
      return [b0, b1, b2, b3, b4, b5, b6, b7];
    case 'CDAB':
      // Word swap in 16-bit blocks: 3-2-1-0 or pairwise? Usually pair reverse:
      return [b6, b7, b4, b5, b2, b3, b0, b1];
    case 'BADC':
      return [b1, b0, b3, b2, b5, b4, b7, b6];
    case 'DCBA':
      return [b7, b6, b5, b4, b3, b2, b1, b0];
  }
}

/**
 * Converts raw payload bytes to multi-format data representations
 */
export function convertPayloadBytes(bytes: number[]): ConvertedPayload {
  const int16_signed: number[] = [];
  const int16_unsigned: number[] = [];
  const binaryWords: string[] = [];

  // Parse 16-bit words (Big Endian standard pairs)
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      const b0 = bytes[i];
      const b1 = bytes[i + 1];
      const uint16 = ((b0 << 8) | b1) >>> 0;
      const int16 = uint16 >= 0x8000 ? uint16 - 0x10000 : uint16;

      int16_unsigned.push(uint16);
      int16_signed.push(int16);

      const binStr = uint16.toString(2).padStart(16, '0');
      // Format as 4 nibbles: 0000 0000 0000 0000
      binaryWords.push(`${binStr.slice(0, 4)} ${binStr.slice(4, 8)} ${binStr.slice(8, 12)} ${binStr.slice(12, 16)}`);
    } else {
      // Single trailing byte
      const uint16 = bytes[i];
      int16_unsigned.push(uint16);
      int16_signed.push(uint16);
      binaryWords.push(uint16.toString(2).padStart(8, '0'));
    }
  }

  // Parse 32-bit values for all 4 Endians
  const orders: EndianOrder[] = ['ABCD', 'CDAB', 'BADC', 'DCBA'];
  const int32_signed: Record<EndianOrder, number[]> = { ABCD: [], CDAB: [], BADC: [], DCBA: [] };
  const int32_unsigned: Record<EndianOrder, number[]> = { ABCD: [], CDAB: [], BADC: [], DCBA: [] };
  const float32: Record<EndianOrder, number[]> = { ABCD: [], CDAB: [], BADC: [], DCBA: [] };
  const float64: Record<EndianOrder, number[]> = { ABCD: [], CDAB: [], BADC: [], DCBA: [] };

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);

  for (const order of orders) {
    // 32-bit loop (groups of 4 bytes)
    for (let i = 0; i + 3 < bytes.length; i += 4) {
      const [re0, re1, re2, re3] = reorder4Bytes(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3], order);
      view.setUint8(0, re0);
      view.setUint8(1, re1);
      view.setUint8(2, re2);
      view.setUint8(3, re3);

      const u32 = view.getUint32(0, false);
      const s32 = view.getInt32(0, false);
      const f32 = view.getFloat32(0, false);

      int32_unsigned[order].push(u32);
      int32_signed[order].push(s32);
      // Clean float rounding display for NaN or precision
      float32[order].push(Number.isNaN(f32) ? 0 : f32);
    }

    // 64-bit loop (groups of 8 bytes)
    for (let i = 0; i + 7 < bytes.length; i += 8) {
      const slice = bytes.slice(i, i + 8);
      const reordered = reorder8Bytes(slice, order);
      for (let j = 0; j < 8; j++) {
        view.setUint8(j, reordered[j]);
      }
      const f64 = view.getFloat64(0, false);
      float64[order].push(Number.isNaN(f64) ? 0 : f64);
    }
  }

  // Parse ASCII representation
  let ascii = '';
  for (const b of bytes) {
    if (b >= 32 && b <= 126) {
      ascii += String.fromCharCode(b);
    } else if (b === 0) {
      ascii += '∅'; // NUL indicator
    } else {
      ascii += '·'; // Unprintable
    }
  }

  // Parse coil bits (LSB first per byte, Modbus standard)
  const coilsBits: boolean[] = [];
  for (const b of bytes) {
    for (let bit = 0; bit < 8; bit++) {
      coilsBits.push(((b >> bit) & 1) === 1);
    }
  }

  return {
    rawBytes: bytes,
    int16_signed,
    int16_unsigned,
    int32_signed,
    int32_unsigned,
    float32,
    float64,
    ascii,
    binaryWords,
    coilsBits,
  };
}

/**
 * Format float with intelligent precision (e.g., 123.25 rather than 123.25000000000001)
 */
export function formatFloat(val: number): string {
  if (Number.isNaN(val)) return 'NaN';
  if (!Number.isFinite(val)) return val > 0 ? '+Infinity' : '-Infinity';
  if (Math.abs(val) < 1e-6 && val !== 0) {
    return val.toExponential(4);
  }
  if (Math.abs(val) > 1e9) {
    return val.toExponential(4);
  }
  const str = val.toFixed(4);
  return parseFloat(str).toString();
}
