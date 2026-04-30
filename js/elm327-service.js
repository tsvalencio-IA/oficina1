/**
 * ELM327Service — Implementação Robusta via Web Bluetooth
 * Baseado no Teste Funcional CHX
 * Powered by thIAguinho Soluções Digitais
 */

class ELM327Service {
  constructor() {
    this.device         = null;
    this.txChar         = null;
    this.rxChar         = null;
    this.isConnected    = false;

    this._rxBuffer       = '';
    this._pendingResolve = null;
    this._pendingReject  = null;
    this._pendingTimer   = null;

    this._onConnectionChange = null;
    this._onDataReceived     = null;

    this.KNOWN_UUIDS = {
        SERVICE: "0000fff0-0000-1000-8000-00805f9b34fb",
        TX_CHAR: "0000fff1-0000-1000-8000-00805f9b34fb",
        RX_CHAR: "0000fff2-0000-1000-8000-00805f9b34fb",
        ALT_SERVICE: "00001101-0000-1000-8000-00805f9b34fb",
        ALT_TX: "00001143-0000-1000-8000-00805f9b34fb",
        ALT_RX: "00001142-0000-1000-8000-00805f9b34fb"
    };

    this.PIDS = {
      rpm:      { cmd: '010C', label: 'RPM', unit: 'rpm' },
      speed:    { cmd: '010D', label: 'Velocidade', unit: 'km/h' },
      temp:     { cmd: '0105', label: 'Temperatura', unit: '°C' },
      throttle: { cmd: '0111', label: 'Acelerador', unit: '%' },
      fuel:     { cmd: '012F', label: 'Combustível', unit: '%' },
      voltage:  { cmd: 'ATRV', label: 'Bateria', unit: 'V' }
    };
  }

  async connect() {
    try {
      this.device = await navigator.bluetooth.requestDevice({
          filters: [
              { namePrefix: 'CHX' },
              { namePrefix: 'ELM' },
              { namePrefix: 'OBD' }
          ],
          optionalServices: [
              this.KNOWN_UUIDS.SERVICE,
              this.KNOWN_UUIDS.ALT_SERVICE,
              '00001101-0000-1000-8000-00805f9b34fb'
          ]
      });

      this.device.addEventListener('gattserverdisconnected', () => this._handleDisconnect());

      const server = await this.device.gatt.connect();
      const services = await server.getPrimaryServices();

      let foundService = null;
      let foundTx = null;
      let foundRx = null;

      for (const svc of services) {
          const uuid = svc.uuid.toString();
          if (uuid === this.KNOWN_UUIDS.SERVICE || uuid === this.KNOWN_UUIDS.ALT_SERVICE || uuid === '00001101-0000-1000-8000-00805f9b34fb') {
              foundService = svc;
              const characteristics = await svc.getCharacteristics();

              for (const char of characteristics) {
                  const charUuid = char.uuid.toString();
                  const props = char.properties;

                  if ((charUuid === this.KNOWN_UUIDS.TX_CHAR || charUuid === this.KNOWN_UUIDS.ALT_TX) && props.write) {
                      foundTx = char;
                  }
                  if ((charUuid === this.KNOWN_UUIDS.RX_CHAR || charUuid === this.KNOWN_UUIDS.ALT_RX) && (props.read || props.notify)) {
                      foundRx = char;
                  }
                  if (!foundTx && props.write) {
                      foundTx = char;
                  }
                  if (!foundRx && (props.read || props.notify)) {
                      foundRx = char;
                  }
              }
          }
      }

      if (!foundService || !foundTx || !foundRx) {
          throw new Error("Não foi possível identificar TX/RX corretamente no adaptador.");
      }

      this.txChar = foundTx;
      this.rxChar = foundRx;

      if (this.rxChar.properties.notify) {
          await this.rxChar.startNotifications();
          this.rxChar.addEventListener('characteristicvaluechanged', (e) => this._handleData(e));
      }

      this.isConnected = true;
      
      await this.sendCommand('ATZ');
      await this.sendCommand('ATE0');
      await this.sendCommand('ATL0');
      await this.sendCommand('ATH0');
      await this.sendCommand('ATSP0');

      if (this._onConnectionChange) this._onConnectionChange(true);
      return true;

    } catch (err) {
      this.isConnected = false;
      if (this._onConnectionChange) this._onConnectionChange(false, err.message);
      throw err;
    }
  }

  async disconnect() {
    if (this.device && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
    }
    this._handleDisconnect();
  }

  _handleDisconnect() {
    this.isConnected = false;
    this.txChar = null;
    this.rxChar = null;
    this.device = null;
    if (this._onConnectionChange) this._onConnectionChange(false);
  }

  async sendCommand(cmd, timeout = 3000) {
    if (!this.isConnected || !this.txChar) throw new Error("Scanner desconectado ou TX indisponível.");

    return new Promise((resolve, reject) => {
      this._rxBuffer = '';
      this._pendingResolve = resolve;
      this._pendingReject = reject;

      this._pendingTimer = setTimeout(() => {
        this._pendingResolve = null;
        this._pendingReject = null;
        reject(new Error(`Timeout no comando: ${cmd}`));
      }, timeout);

      const encoder = new TextEncoder();
      this.txChar.writeValue(encoder.encode(cmd + '\r'))
        .catch(err => {
          clearTimeout(this._pendingTimer);
          reject(err);
        });
    });
  }

  _handleData(event) {
    const decoder = new TextDecoder();
    const chunk = decoder.decode(event.target.value);
    this._rxBuffer += chunk;

    if (this._rxBuffer.includes('>')) {
      if (this._pendingTimer) clearTimeout(this._pendingTimer);
      
      const response = this._rxBuffer.replace('>', '').trim();
      const resolve = this._pendingResolve;
      
      this._rxBuffer = '';
      this._pendingResolve = null;
      this._pendingReject = null;

      if (resolve) resolve(response);
    }
  }

  async readDTCs() {
    const res = await this.sendCommand('03');
    return this._parseDTCs(res);
  }

  async readPendingDTCs() {
    const res = await this.sendCommand('07');
    return this._parseDTCs(res);
  }

  async clearDTCs() {
    const res = await this.sendCommand('04');
    return res.includes('OK') || res.includes('44');
  }

  _parseDTCs(hex) {
    if (hex.includes('NO DATA') || hex.includes('43 00')) return [];
    
    const codes = [];
    const parts = hex.split('\n').join(' ').split(' ');
    
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '43' || parts[i] === '47') {
        let j = i + 1;
        while (j + 1 < parts.length) {
          const byte1 = parts[j];
          const byte2 = parts[j+1];
          if (byte1 === '00' && byte2 === '00') break;
          
          codes.push({
            code: this._hexToDTC(byte1, byte2),
            status: parts[i] === '43' ? 'Confirmado' : 'Pendente'
          });
          j += 2;
        }
      }
    }
    return codes;
  }

  _hexToDTC(b1, b2) {
    const charMap = ['P', 'C', 'B', 'U'];
    const firstDigit = parseInt(b1[0], 16);
    const category = charMap[firstDigit >> 2];
    const secondDigit = firstDigit & 3;
    return category + secondDigit + b1[1] + b2;
  }

  async readLiveData() {
    const data = {};
    try {
      const rpmRes = await this.sendCommand('010C');
      data.rpm = this._parseRPM(rpmRes);

      const speedRes = await this.sendCommand('010D');
      data.speed = parseInt(speedRes.split(' ').pop(), 16);

      const tempRes = await this.sendCommand('0105');
      data.temp = parseInt(tempRes.split(' ').pop(), 16) - 40;

      if (this._onDataReceived) this._onDataReceived({ type: 'liveData', data });
      return data;
    } catch (e) {
      console.warn("Falha na leitura de sensores:", e);
      return null;
    }
  }

  async fullScan() {
    const dtcs = await this.readDTCs();
    const pending = await this.readPendingDTCs();
    const live = await this.readLiveData();
    return { dtcs, pending, live };
  }

  _parseRPM(hex) {
    const parts = hex.split(' ');
    if (parts.length < 4) return 0;
    const a = parseInt(parts[parts.length - 2], 16);
    const b = parseInt(parts[parts.length - 1], 16);
    return ((a * 256) + b) / 4;
  }

  onConnectionChange(callback) { this._onConnectionChange = callback; }
  onDataReceived(callback) { this._onDataReceived = callback; }
}

window.elm327 = new ELM327Service();
