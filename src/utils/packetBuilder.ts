import { calculateCRC16Modbus, calculateLRC, formatBytes } from './crc';

export interface ModbusBuilderParams {
  protocol: 'modbus-rtu' | 'modbus-tcp' | 'modbus-ascii';
  slaveId: number;
  functionCode: number;
  startAddress: number;
  quantity: number;
  singleCoilValue?: boolean;
  singleRegValue?: number;
  multiRegValues?: number[];
  multiCoilValues?: boolean[];
  transactionId?: number;
}

export interface MC3EBuilderParams {
  command: number;       // 0x0401 (Read) or 0x1401 (Write)
  subcommand: number;    // 0x0000 (Word) or 0x0001 (Bit)
  deviceCode: number;    // 0xA8 (D), 0x90 (M), etc.
  headDeviceNumber: number;
  points: number;
  monitoringTimer?: number;
  writeData?: number[];
}

/**
 * Builds Modbus RTU / TCP / ASCII packet bytes
 */
export function buildModbusPacket(params: ModbusBuilderParams): {
  bytes: number[];
  hexString: string;
  asciiString?: string;
} {
  const pdu: number[] = [params.functionCode];

  switch (params.functionCode) {
    case 0x01:
    case 0x02:
    case 0x03:
    case 0x04: {
      // Start Address (2 Bytes) + Quantity (2 Bytes)
      const addrHi = (params.startAddress >> 8) & 0xFF;
      const addrLo = params.startAddress & 0xFF;
      const qtyHi = (params.quantity >> 8) & 0xFF;
      const qtyLo = params.quantity & 0xFF;
      pdu.push(addrHi, addrLo, qtyHi, qtyLo);
      break;
    }
    case 0x05: {
      // Write Single Coil: Addr (2B) + Value (0xFF00 for ON, 0x0000 for OFF)
      const addrHi = (params.startAddress >> 8) & 0xFF;
      const addrLo = params.startAddress & 0xFF;
      const valHi = params.singleCoilValue ? 0xFF : 0x00;
      const valLo = 0x00;
      pdu.push(addrHi, addrLo, valHi, valLo);
      break;
    }
    case 0x06: {
      // Write Single Register: Addr (2B) + Value (2B)
      const addrHi = (params.startAddress >> 8) & 0xFF;
      const addrLo = params.startAddress & 0xFF;
      const regVal = (params.singleRegValue ?? 0) & 0xFFFF;
      const valHi = (regVal >> 8) & 0xFF;
      const valLo = regVal & 0xFF;
      pdu.push(addrHi, addrLo, valHi, valLo);
      break;
    }
    case 0x10: {
      // Write Multiple Registers (FC 16):
      // Addr (2B) + Qty (2B) + ByteCount (1B) + Data (2 * Qty B)
      const addrHi = (params.startAddress >> 8) & 0xFF;
      const addrLo = params.startAddress & 0xFF;
      const qty = params.quantity > 0 ? params.quantity : 1;
      const qtyHi = (qty >> 8) & 0xFF;
      const qtyLo = qty & 0xFF;
      const byteCount = qty * 2;
      pdu.push(addrHi, addrLo, qtyHi, qtyLo, byteCount);

      const vals = params.multiRegValues || [];
      for (let i = 0; i < qty; i++) {
        const v = (vals[i] ?? 0) & 0xFFFF;
        pdu.push((v >> 8) & 0xFF, v & 0xFF);
      }
      break;
    }
    case 0x0F: {
      // Write Multiple Coils (FC 15):
      const addrHi = (params.startAddress >> 8) & 0xFF;
      const addrLo = params.startAddress & 0xFF;
      const qty = params.quantity > 0 ? params.quantity : 1;
      const qtyHi = (qty >> 8) & 0xFF;
      const qtyLo = qty & 0xFF;
      const byteCount = Math.ceil(qty / 8);
      pdu.push(addrHi, addrLo, qtyHi, qtyLo, byteCount);

      const coils = params.multiCoilValues || [];
      for (let byteIdx = 0; byteIdx < byteCount; byteIdx++) {
        let byteVal = 0;
        for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
          const overallBit = byteIdx * 8 + bitIdx;
          if (overallBit < qty && coils[overallBit]) {
            byteVal |= (1 << bitIdx);
          }
        }
        pdu.push(byteVal);
      }
      break;
    }
    default: {
      const addrHi = (params.startAddress >> 8) & 0xFF;
      const addrLo = params.startAddress & 0xFF;
      pdu.push(addrHi, addrLo);
      break;
    }
  }

  if (params.protocol === 'modbus-rtu') {
    const raw = [params.slaveId & 0xFF, ...pdu];
    const crc = calculateCRC16Modbus(raw);
    const full = [...raw, crc.lowByte, crc.highByte];
    return {
      bytes: full,
      hexString: formatBytes(full),
    };
  } else if (params.protocol === 'modbus-tcp') {
    const transId = params.transactionId ?? 1;
    const protoId = 0x0000;
    const length = 1 + pdu.length; // Unit ID (1B) + PDU
    const mbap = [
      (transId >> 8) & 0xFF,
      transId & 0xFF,
      (protoId >> 8) & 0xFF,
      protoId & 0xFF,
      (length >> 8) & 0xFF,
      length & 0xFF,
      params.slaveId & 0xFF,
    ];
    const full = [...mbap, ...pdu];
    return {
      bytes: full,
      hexString: formatBytes(full),
    };
  } else {
    // Modbus ASCII
    const raw = [params.slaveId & 0xFF, ...pdu];
    const lrc = calculateLRC(raw);
    const full = [...raw, lrc.lrc];
    const hexChars = formatBytes(full, '').toUpperCase();
    const asciiString = `:${hexChars}\\r\\n`;
    return {
      bytes: full,
      hexString: formatBytes(full),
      asciiString,
    };
  }
}

/**
 * Builds Mitsubishi MC Protocol 3E Binary frame
 */
export function buildMC3EPacket(params: MC3EBuilderParams): {
  bytes: number[];
  hexString: string;
} {
  // Command & Subcommand in Little Endian
  const cmdLo = params.command & 0xFF;
  const cmdHi = (params.command >> 8) & 0xFF;

  const subcmdLo = params.subcommand & 0xFF;
  const subcmdHi = (params.subcommand >> 8) & 0xFF;

  // Head Device (3 Bytes, Little Endian)
  const devNum = params.headDeviceNumber;
  const dev0 = devNum & 0xFF;
  const dev1 = (devNum >> 8) & 0xFF;
  const dev2 = (devNum >> 16) & 0xFF;

  const devCode = params.deviceCode & 0xFF;

  // Device points (2 Bytes, Little Endian)
  const ptsLo = params.points & 0xFF;
  const ptsHi = (params.points >> 8) & 0xFF;

  // Content following Monitoring Timer
  const requestContent = [
    cmdLo, cmdHi,
    subcmdLo, subcmdHi,
    dev0, dev1, dev2,
    devCode,
    ptsLo, ptsHi,
  ];

  if (params.command === 0x1401 && params.writeData) {
    requestContent.push(...params.writeData);
  }

  // Monitoring timer: 2 Bytes (e.g. 0x0010 = 4000ms)
  const timer = params.monitoringTimer ?? 0x0010;
  const timerLo = timer & 0xFF;
  const timerHi = (timer >> 8) & 0xFF;

  // Request Data Length = 2 (Timer) + requestContent.length
  const dataLen = 2 + requestContent.length;
  const dataLenLo = dataLen & 0xFF;
  const dataLenHi = (dataLen >> 8) & 0xFF;

  const full = [
    0x50, 0x00,               // Subheader (3E Binary Request)
    0x00,                     // Network No
    0xFF,                     // PC No
    0xFF, 0x03,               // Request Destination Module I/O (CPU: 0x03FF in Little Endian)
    0x00,                     // Destination Station No
    dataLenLo, dataLenHi,     // Request Data Length
    timerLo, timerHi,         // CPU Monitoring Timer
    ...requestContent,
  ];

  return {
    bytes: full,
    hexString: formatBytes(full),
  };
}
