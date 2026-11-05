export type ProtocolType = 'modbus-rtu' | 'modbus-ascii' | 'modbus-tcp' | 'mc-3e-binary' | 'auto';

export type PacketDirection = 'request' | 'response' | 'exception' | 'unknown';

export type EndianOrder = 'ABCD' | 'CDAB' | 'BADC' | 'DCBA';

export interface FieldBreakdown {
  id: string;
  name: string;
  labelZh: string;
  startIndex: number; // Start byte index in rawBytes
  length: number;     // Number of bytes
  rawHex: string;
  parsedValue: string | number;
  description: string;
  color: {
    bg: string;
    border: string;
    text: string;
    badge: string;
  };
  isError?: boolean;
}

export interface ChecksumInfo {
  type: 'CRC16-Modbus' | 'LRC' | 'MC-Length' | 'None';
  expectedHex: string;
  actualHex: string;
  matches: boolean;
  algorithmDetail: string;
  isByteSwapped?: boolean;
}

export interface ExceptionInfo {
  code: number;
  hex: string;
  name: string;
  nameZh: string;
  description: string;
  troubleshooting: string[];
}

export interface ConvertedPayload {
  rawBytes: number[];
  int16_signed: number[];
  int16_unsigned: number[];
  int32_signed: Record<EndianOrder, number[]>;
  int32_unsigned: Record<EndianOrder, number[]>;
  float32: Record<EndianOrder, number[]>;
  float64: Record<EndianOrder, number[]>;
  ascii: string;
  binaryWords: string[];
  coilsBits: boolean[];
}

export interface AnalysisResult {
  protocol: 'modbus-rtu' | 'modbus-ascii' | 'modbus-tcp' | 'mc-3e-binary';
  protocolDisplayName: string;
  direction: PacketDirection;
  directionDisplayName: string;
  rawBytes: number[];
  cleanHex: string;
  formattedHex: string;
  isValid: boolean;
  fields: FieldBreakdown[];
  checksum: ChecksumInfo;
  exception?: ExceptionInfo;
  payloadBytes: number[];
  payloadStartIndex: number;
  convertedPayload?: ConvertedPayload;
  summary: string;
  warnings: string[];
}

export interface PresetSample {
  id: string;
  category: 'Modbus RTU' | 'Modbus TCP' | 'Modbus ASCII' | 'Mitsubishi MC 3E';
  title: string;
  description: string;
  hex: string;
  expectedProtocol: ProtocolType;
}

export interface SavedPacketRecord {
  id: string;
  timestamp: number;
  title: string;
  protocol: string;
  hex: string;
  summary: string;
  isValid: boolean;
}
