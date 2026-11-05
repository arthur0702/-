import { AnalysisResult } from '../types/protocol';
import { formatPythonBytes } from './crc';

export interface ScriptOptions {
  library: 'pyserial' | 'pymodbus' | 'socket';
  serialPort: string;
  baudRate: number;
  tcpHost: string;
  tcpPort: number;
  timeout: number;
}

export function generatePythonScript(result: AnalysisResult, options: ScriptOptions): string {
  const { protocol, rawBytes, fields, direction } = result;
  const hexBytesLiteral = formatPythonBytes(rawBytes);

  if (options.library === 'pyserial' || protocol === 'modbus-rtu' || protocol === 'modbus-ascii') {
    return generatePySerialScript(result, options, hexBytesLiteral);
  } else if (options.library === 'pymodbus') {
    return generatePyModbusScript(result, options);
  } else {
    return generateRawSocketScript(result, options, hexBytesLiteral);
  }
}

function generatePySerialScript(result: AnalysisResult, options: ScriptOptions, hexLiteral: string): string {
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工控通訊測試腳本 - pyserial 封包發送與接收
協定: ${result.protocolDisplayName}
說明: ${result.summary}
產生工具: Industrial Protocol Packet Analyzer
"""

import time
import serial

# ==================== 通訊介面設定 ====================
SERIAL_PORT = "${options.serialPort}"      # Windows 範例: 'COM3', Linux 範例: '/dev/ttyUSB0'
BAUD_RATE = ${options.baudRate}           # 標準鮑率: 9600, 19200, 38400, 115200
TIMEOUT = ${options.timeout}              # 讀取超時時間 (秒)

# 待發送之十六進制資料訊框 (${result.cleanHex})
TX_PACKET = ${hexLiteral}

def calc_crc16_modbus(data: bytes) -> bytes:
    """計算 Modbus RTU CRC-16 (Low byte first)"""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x0001:
                crc = (crc >> 1) ^ 0xA001
            else:
                crc >>= 1
    low = crc & 0xFF
    high = (crc >> 8) & 0xFF
    return bytes([low, high])

def main():
    print(f"[*] 正在開啟串列傳輸埠: {SERIAL_PORT} @ {BAUD_RATE} bps 8-N-1 ...")
    try:
        ser = serial.Serial(
            port=SERIAL_PORT,
            baudrate=BAUD_RATE,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            timeout=TIMEOUT
        )
    except serial.SerialException as err:
        print(f"[!] 無法開啟串列埠: {err}")
        print("    請確認 COM 連接埠名稱是否正確、驅動程式是否已安裝或埠已被其他程式占用。")
        return

    try:
        # 清空輸入/輸出緩衝區
        ser.reset_input_buffer()
        ser.reset_output_buffer()
        time.sleep(0.05)

        # 發送封包
        print(f"[TX] 發送封包 ({len(TX_PACKET)} Bytes): {TX_PACKET.hex(' ').upper()}")
        ser.write(TX_PACKET)
        ser.flush()

        # 等待並讀取從站回應
        time.sleep(0.05)
        rx_data = ser.read(256)

        if rx_data:
            print(f"[RX] 收到回應 ({len(rx_data)} Bytes): {rx_data.hex(' ').upper()}")

            # 檢驗 CRC (若為 Modbus RTU)
            if len(rx_data) >= 3 and "${result.protocol}" == "modbus-rtu":
                expected_crc = calc_crc16_modbus(rx_data[:-2])
                actual_crc = rx_data[-2:]
                if expected_crc == actual_crc:
                    print("  └─ [CRC OK] 校驗碼比對相符!")
                else:
                    print(f"  └─ [CRC ERROR] 校驗碼不符! 計算值: {expected_crc.hex(' ').upper()}, 接收值: {actual_crc.hex(' ').upper()}")
        else:
            print("[!] 未在時限內收到回應 (逾時 Timeout)！")
            print("    請檢查從站 ID、RS-485 接線 (A/B 是否反接)、鮑率與終端電阻。")

    finally:
        ser.close()
        print("[*] 串列埠已關閉。")

if __name__ == '__main__':
    main()
`;
}

function generatePyModbusScript(result: AnalysisResult, options: ScriptOptions): string {
  const isTCP = result.protocol === 'modbus-tcp';

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工控通訊測試腳本 - pymodbus (v3.x)
協定: ${result.protocolDisplayName}
說明: ${result.summary}
"""

import time
${isTCP ? `from pymodbus.client import ModbusTcpClient as ModbusClient` : `from pymodbus.client import ModbusSerialClient as ModbusClient`}

def main():
${isTCP ? `    # 連線至 Modbus TCP 伺服器
    client = ModbusClient(host="${options.tcpHost}", port=${options.tcpPort}, timeout=${options.timeout})` : `    # 連線至 Modbus RTU 串列設備
    client = ModbusClient(
        port="${options.serialPort}",
        baudrate=${options.baudRate},
        parity='N',
        stopbits=1,
        bytesize=8,
        timeout=${options.timeout}
    )`}

    print("[*] 正在建立連線...")
    if not client.connect():
        print("[!] 連線失敗，請確認設備網路或串列設定。")
        return

    try:
        # 直接發送原始位元組 (Raw Frame)
        raw_tx = bytes.fromhex("${result.cleanHex}")
        print(f"[TX] 發送原始封包: {raw_tx.hex(' ').upper()}")

        # 也可使用 pymodbus 高階 API (例如 client.read_holding_registers)
        # 示範使用底層 socket / serial 進行收發以吻合當前分析封包:
        if hasattr(client, 'socket') and client.socket:
            client.socket.sendall(raw_tx)
            rx = client.socket.recv(1024)
            print(f"[RX] 收到回應: {rx.hex(' ').upper()}")
        else:
            print("[*] 建議使用對應高階功能，例如:")
            print("    # response = client.read_holding_registers(address=0, count=2, slave=1)")
            print("    # if not response.is_error(): print(response.registers)")

    finally:
        client.close()
        print("[*] 連線已中斷。")

if __name__ == '__main__':
    main()
`;
}

function generateRawSocketScript(result: AnalysisResult, options: ScriptOptions, hexLiteral: string): string {
  const isMC = result.protocol === 'mc-3e-binary';
  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工控通訊測試腳本 - Python 原生 Socket (免安裝任何第三方庫)
協定: ${result.protocolDisplayName}
說明: ${result.summary}
"""

import socket
import time

HOST = "${options.tcpHost}"
PORT = ${options.tcpPort}
TIMEOUT = ${options.timeout}

TX_PACKET = ${hexLiteral}

def main():
    print(f"[*] 正在連線至 {HOST}:{PORT} (逾時: {TIMEOUT}s) ...")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(TIMEOUT)
        try:
            s.connect((HOST, PORT))
            print("[+] TCP 連線已成功建立！")

            print(f"[TX] 發送封包 ({len(TX_PACKET)} Bytes): {TX_PACKET.hex(' ').upper()}")
            s.sendall(TX_PACKET)

            # 接收回應
            rx_data = s.recv(4096)
            if rx_data:
                print(f"[RX] 收到回應 ({len(rx_data)} Bytes): {rx_data.hex(' ').upper()}")
${isMC ? `
                # 解析三菱 MC 3E 回應結束碼 (End Code)
                if len(rx_data) >= 11:
                    # Bytes 9-10 為 Little Endian 結束碼
                    end_code = rx_data[9] | (rx_data[10] << 8)
                    if end_code == 0:
                        print("  └─ [MELSEC OK] PLC 回應正常結束 (End Code: 0x0000)")
                        payload = rx_data[11:]
                        print(f"  └─ 資料載荷 ({len(payload)} Bytes): {payload.hex(' ').upper()}")
                    else:
                        print(f"  └─ [MELSEC ERROR] PLC 回報異常結束碼: 0x{end_code:04X}")
` : `
                # Modbus TCP 標頭驗證
                if len(rx_data) >= 7:
                    trans_id = (rx_data[0] << 8) | rx_data[1]
                    declared_len = (rx_data[4] << 8) | rx_data[5]
                    unit_id = rx_data[6]
                    print(f"  └─ Transaction ID: {trans_id}, Length: {declared_len}, Unit ID: {unit_id}")
`}
            else:
                print("[!] 伺服端中斷連線或未回傳資料。")

        except socket.timeout:
            print("[!] 連線或接收逾時 (Timeout)，請確認 PLC/閘道器 IP 及通訊埠是否開啟。")
        except ConnectionRefusedError:
            print("[!] 連線遭拒絕 (Connection Refused)，目標連接埠未監聽。")
        except Exception as e:
            print(f"[!] 發生異常: {e}")

if __name__ == '__main__':
    main()
`;
}
