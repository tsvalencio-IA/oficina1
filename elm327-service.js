/**
 * ELM327Service — Implementação Real via Web Bluetooth
 *
 * COMO FUNCIONA:
 * O ELM327 é serial sobre BLE. Você envia um comando ASCII (ex: "010C\r"),
 * a resposta chega fragmentada em múltiplos eventos characteristicvaluechanged,
 * e termina com o prompt ">". O truque é acumular os fragmentos num buffer
 * e resolver a Promise quando o ">" aparecer.
 *
 * SUPORTE:
 * - Chrome/Edge desktop e Android (Web Bluetooth)
 * - iOS: não suporta Web Bluetooth nativamente
 * - Adaptadores: ELM327 BLE (UUID FFE0/FFE1), OBDLINK MX+ (UUID FFF0/FFF1)
 *
 * Powered by thIAguinho Soluções Digitais
 */

class ELM327Service {
  constructor() {
    this.device         = null;
    this.characteristic = null;
    this.isConnected    = false;

    // Buffer de resposta + resolver da promise em espera
    this._rxBuffer      = '';
    this._pendingResolve = null;
    this._pendingReject  = null;
    this._pendingTimer   = null;

    // Callbacks externos
    this._onConnect    = null;
    this._onDisconnect = null;
    this._onLiveData   = null;
    this._onDTCs       = null;
    this._onLog        = null;

    // Loop de dados em tempo real
    this._liveLoopTimer = null;
    this._liveActive    = false;

    // UUIDs dos adaptadores mais comuns
    // FFE0/FFE1 = ELM327 genérico (OBDLink, Vgate, etc.)
    // FFF0/FFF1 = Alternativo (alguns clones chineses)
    this.PROFILES = [
      { service: '0000ffe0-0000-1000-8000-00805f9b34fb', char: '0000ffe1-0000-1000-8000-00805f9b34fb', label: 'ELM327 BLE (FFE0)' },
      { service: '0000fff0-0000-1000-8000-00805f9b34fb', char: '0000fff1-0000-1000-8000-00805f9b34fb', label: 'ELM327 BLE (FFF0)' },
      { service: '00001800-0000-1000-8000-00805f9b34fb', char: '00002a00-0000-1000-8000-00805f9b34fb', label: 'Generic Access' },
    ];

    // Todos os PIDs que vamos monitorar em tempo real
    this.PIDS = {
      rpm:         { cmd: '010C', parse: (b) => ((b[2]*256 + b[3]) / 4),           unit: 'RPM',  label: 'RPM'               },
      speed:       { cmd: '010D', parse: (b) => b[2],                               unit: 'km/h', label: 'Velocidade'        },
      temp:        { cmd: '0105', parse: (b) => b[2] - 40,                          unit: '°C',   label: 'Temp. Motor'       },
      throttle:    { cmd: '0111', parse: (b) => Math.round(b[2] * 100 / 255),       unit: '%',    label: 'Acelerador'        },
      fuel:        { cmd: '012F', parse: (b) => Math.round(b[2] * 100 / 255),       unit: '%',    label: 'Combustível'       },
      maf:         { cmd: '0110', parse: (b) => ((b[2]*256 + b[3]) / 100),          unit: 'g/s',  label: 'Fluxo MAF'        },
      intakeTemp:  { cmd: '010F', parse: (b) => b[2] - 40,                          unit: '°C',   label: 'Temp. Admissão'   },
      intakePres:  { cmd: '010B', parse: (b) => b[2],                               unit: 'kPa',  label: 'Pressão Admissão' },
      voltage:     { cmd: 'ATRV', parse: null,                                      unit: 'V',    label: 'Tensão Bateria'   },
    };

    // Base de DTCs (P, B, C, U)
    this.DTC_DB = {
      // Powertrain — Combustível/Ar
      P0100:'Sensor MAF — circuito com problema',
      P0101:'Sensor MAF — variação fora do intervalo',
      P0102:'Sensor MAF — sinal baixo',
      P0103:'Sensor MAF — sinal alto',
      P0107:'Sensor MAP — sinal baixo',
      P0108:'Sensor MAP — sinal alto',
      P0110:'Sensor temperatura admissão — circuito',
      P0113:'Sensor temperatura admissão — sinal alto',
      P0115:'Sensor temperatura arrefecimento — circuito',
      P0116:'Sensor temperatura arrefecimento — variação',
      P0117:'Sensor temperatura arrefecimento — sinal baixo',
      P0118:'Sensor temperatura arrefecimento — sinal alto',
      P0120:'Sensor posição borboleta — circuito',
      P0121:'Sensor posição borboleta — variação',
      P0122:'Sensor posição borboleta — sinal baixo',
      P0123:'Sensor posição borboleta — sinal alto',
      P0125:'Temperatura insuficiente para controle de mistura',
      P0128:'Termostato — temperatura abaixo do esperado',
      P0130:'Sonda lambda B1S1 — circuito',
      P0131:'Sonda lambda B1S1 — sinal baixo',
      P0132:'Sonda lambda B1S1 — sinal alto',
      P0133:'Sonda lambda B1S1 — resposta lenta',
      P0134:'Sonda lambda B1S1 — sem atividade',
      P0135:'Sonda lambda B1S1 — aquecedor',
      P0136:'Sonda lambda B1S2 — circuito',
      P0141:'Sonda lambda B1S2 — aquecedor',
      P0170:'Sistema combustível banco 1 — ajuste fora',
      P0171:'Sistema combustível banco 1 — mistura pobre',
      P0172:'Sistema combustível banco 1 — mistura rica',
      P0174:'Sistema combustível banco 2 — mistura pobre',
      P0175:'Sistema combustível banco 2 — mistura rica',
      // Ignição / Falta de chama
      P0300:'Falha de ignição randômica / múltiplos cilindros',
      P0301:'Falha de ignição — cilindro 1',
      P0302:'Falha de ignição — cilindro 2',
      P0303:'Falha de ignição — cilindro 3',
      P0304:'Falha de ignição — cilindro 4',
      P0305:'Falha de ignição — cilindro 5',
      P0306:'Falha de ignição — cilindro 6',
      P0325:'Sensor detonação banco 1 — circuito',
      P0335:'Sensor posição virabrequim — circuito',
      P0340:'Sensor posição árvore de cames banco 1 — circuito',
      // Catalisador / Emissões
      P0400:'Recirculação gases escape — fluxo excessivo',
      P0401:'Recirculação gases escape — fluxo insuficiente',
      P0420:'Eficiência catalisador banco 1 — abaixo do limite',
      P0421:'Eficiência catalisador banco 1 — baixa (aquecimento)',
      P0430:'Eficiência catalisador banco 2 — abaixo do limite',
      P0440:'Sistema evaporativo — problema geral',
      P0441:'Sistema evaporativo — fluxo purga incorreto',
      P0442:'Sistema evaporativo — vazamento pequeno',
      P0455:'Sistema evaporativo — vazamento grande',
      P0456:'Sistema evaporativo — vazamento muito pequeno',
      // Transmissão / Velocidade
      P0500:'Sensor velocidade veículo — circuito',
      P0505:'Sistema marcha lenta — circuito',
      P0600:'Comunicação serial link — falha',
      P0700:'Falha no sistema de controle da transmissão',
      // Bateria / Carga
      P0560:'Tensão sistema — intermitente',
      P0562:'Tensão sistema — baixa',
      P0563:'Tensão sistema — alta',
      P0600:'Falha comunicação serial',
      // Comuns extras
      P1000:'Ciclo de condução OBD não completo (após reset)',
      U0001:'Barramento CAN de alta velocidade — falha comunicação',
      U0100:'Comunicação perdida com ECM/PCM',
    };
  }

  // ─────────────────────────────────────────────────────────
  // CALLBACKS EXTERNOS (API pública)
  // ─────────────────────────────────────────────────────────
  onConnect(fn)    { this._onConnect    = fn; }
  onDisconnect(fn) { this._onDisconnect = fn; }
  onLiveData(fn)   { this._onLiveData   = fn; }
  onDTCs(fn)       { this._onDTCs       = fn; }
  onLog(fn)        { this._onLog        = fn; }

  _log(msg, type='info') {
    console.log(`[ELM327] ${msg}`);
    if (this._onLog) this._onLog(msg, type);
  }

  // ─────────────────────────────────────────────────────────
  // CONEXÃO
  // ─────────────────────────────────────────────────────────
  async connect() {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth não suportado. Use Chrome/Edge no Android ou Desktop.');
    }

    this._log('Abrindo seletor de dispositivos Bluetooth…');

    // Tenta com todos os UUIDs de serviço conhecidos
    const allServiceUUIDs = this.PROFILES.map(p => p.service);

    this.device = await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: 'ELM327' },
        { namePrefix: 'OBDII'  },
        { namePrefix: 'OBD'    },
        { namePrefix: 'Vgate'  },
        { namePrefix: 'OBDLINK'},
        { namePrefix: 'LELink' },
        { namePrefix: 'Kiwi'   },
      ],
      optionalServices: allServiceUUIDs,
    });

    this._log(`Dispositivo selecionado: ${this.device.name}`);

    this.device.addEventListener('gattserverdisconnected', () => this._onGattDisconnect());

    const server = await this.device.gatt.connect();
    this._log('GATT conectado. Detectando perfil…');

    // Detecta qual perfil (UUID) o dispositivo usa
    let found = false;
    for (const profile of this.PROFILES) {
      try {
        const service = await server.getPrimaryService(profile.service);
        this.characteristic = await service.getCharacteristic(profile.char);
        this._log(`Perfil detectado: ${profile.label}`);
        found = true;
        break;
      } catch (_) { /* tenta o próximo */ }
    }

    if (!found) throw new Error('Perfil BLE do ELM327 não reconhecido. Tente desemparelhar e reconectar.');

    // Inicia notificações — respostas chegam aqui
    await this.characteristic.startNotifications();
    this.characteristic.addEventListener('characteristicvaluechanged', (e) => this._onRx(e));

    this.isConnected = true;
    this._log('Notificações ativas. Inicializando ELM327…');

    await this._initELM();

    this._log('ELM327 pronto!', 'ok');
    if (this._onConnect) this._onConnect({ device: this.device.name });
  }

  async disconnect() {
    this.stopLiveData();
    if (this.device?.gatt?.connected) {
      await this.device.gatt.disconnect();
    }
    this._reset();
  }

  _onGattDisconnect() {
    this._log('Dispositivo desconectado.', 'warn');
    this.stopLiveData();
    this._reset();
    if (this._onDisconnect) this._onDisconnect();
  }

  _reset() {
    this.isConnected    = false;
    this.device         = null;
    this.characteristic = null;
    this._rxBuffer      = '';
    this._clearPending('Desconectado');
  }

  // ─────────────────────────────────────────────────────────
  // ENVIO / RECEPÇÃO — NÚCLEO
  // A resposta do ELM327 termina com ">" (prompt).
  // Acumulamos fragmentos até aparecer o ">".
  // ─────────────────────────────────────────────────────────
  _onRx(event) {
    const chunk = new TextDecoder().decode(event.target.value);
    this._rxBuffer += chunk;

    // Resposta completa quando tiver o prompt ">"
    if (this._rxBuffer.includes('>') && this._pendingResolve) {
      clearTimeout(this._pendingTimer);
      const response = this._rxBuffer;
      this._rxBuffer = '';
      const resolve = this._pendingResolve;
      this._pendingResolve = null;
      this._pendingReject  = null;
      resolve(response);
    }
  }

  _clearPending(reason) {
    if (this._pendingReject) {
      clearTimeout(this._pendingTimer);
      const reject = this._pendingReject;
      this._pendingResolve = null;
      this._pendingReject  = null;
      reject(new Error(reason));
    }
  }

  /**
   * Envia um comando e aguarda resposta completa (termina com ">").
   * @param {string} cmd  - Comando OBD/AT sem CR
   * @param {number} timeout - Timeout em ms (padrão 3000)
   */
  async cmd(command, timeout = 3000) {
    if (!this.isConnected || !this.characteristic) throw new Error('Não conectado');

    // Aguarda qualquer comando anterior terminar
    if (this._pendingResolve) {
      await new Promise(r => setTimeout(r, 200));
    }

    return new Promise((resolve, reject) => {
      this._pendingResolve = resolve;
      this._pendingReject  = reject;
      this._rxBuffer       = '';

      this._pendingTimer = setTimeout(() => {
        this._rxBuffer = '';
        this._pendingResolve = null;
        this._pendingReject  = null;
        reject(new Error(`Timeout aguardando resposta de: ${command}`));
      }, timeout);

      const bytes = new TextEncoder().encode(command + '\r');
      this.characteristic.writeValue(bytes).catch(e => {
        clearTimeout(this._pendingTimer);
        this._pendingResolve = null;
        this._pendingReject  = null;
        reject(e);
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // INICIALIZAÇÃO ELM327
  // ─────────────────────────────────────────────────────────
  async _initELM() {
    const seq = [
      ['ATZ',   500],   // Reset completo
      ['ATE0',  200],   // Echo off
      ['ATL0',  200],   // Linefeed off
      ['ATH0',  200],   // Headers off
      ['ATS0',  200],   // Spaces off
      ['ATSP0', 300],   // Protocolo automático
      ['ATST62',200],   // Timeout = 620ms (suficiente para CAN lento)
    ];
    for (const [c, delay] of seq) {
      try { await this.cmd(c, 2000); } catch (_) {}
      await this._sleep(delay);
    }
  }

  // ─────────────────────────────────────────────────────────
  // PARSE DE RESPOSTA OBD
  // Ex: "41 0C 1A F8\r>" → bytes [0x41, 0x0C, 0x1A, 0xF8]
  // ─────────────────────────────────────────────────────────
  _parseBytes(raw) {
    // Remove tudo que não é hex ou espaço, split, converte
    const clean = raw.replace(/[^0-9A-Fa-f ]/g, ' ').trim();
    return clean.split(/\s+/).filter(s => s.length === 2).map(s => parseInt(s, 16));
  }

  _parsePID(raw, pid) {
    const def = this.PIDS[pid];
    if (!def) return null;

    // ATRV retorna algo como "12.3V" — parse especial
    if (def.cmd === 'ATRV') {
      const m = raw.match(/([\d.]+)\s*[Vv]/);
      return m ? parseFloat(m[1]) : null;
    }

    const bytes = this._parseBytes(raw);
    if (bytes.length < 2) return null;
    // bytes[0] = modo+0x40, bytes[1] = PID, bytes[2..] = dados
    try { return def.parse(bytes); } catch (_) { return null; }
  }

  // ─────────────────────────────────────────────────────────
  // LEITURA DE DTCs
  // ─────────────────────────────────────────────────────────
  async readDTCs() {
    this._log('Lendo DTCs…');
    const raw = await this.cmd('03'); // Modo 03 = DTCs confirmados
    return this._parseDTCResponse(raw, 'Confirmado');
  }

  async readPendingDTCs() {
    this._log('Lendo DTCs pendentes…');
    const raw = await this.cmd('07'); // Modo 07 = DTCs pendentes
    return this._parseDTCResponse(raw, 'Pendente');
  }

  /**
   * Parse da resposta do modo 03/07.
   * Formato: "43 01 P0171 P0301 00 00 00\r>"
   * Cada DTC é 2 bytes. Prefixo: bits 7-6 do 1º byte.
   *   00 = P (Powertrain)
   *   01 = C (Chassis)
   *   10 = B (Body)
   *   11 = U (Network)
   */
  _parseDTCResponse(raw, status) {
    const bytes = this._parseBytes(raw);
    const dtcs  = [];

    // Pula byte de modo (0x43) e quantidade, pega pares
    for (let i = 1; i + 1 < bytes.length; i += 2) {
      const hi = bytes[i];
      const lo = bytes[i + 1];
      if (hi === 0x00 && lo === 0x00) continue; // Vazio

      const prefix = ['P', 'C', 'B', 'U'][(hi >> 6) & 0x03];
      const d1     = (hi >> 4) & 0x03;
      const d2     = hi & 0x0F;
      const d3     = (lo >> 4) & 0x0F;
      const d4     = lo & 0x0F;
      const code   = `${prefix}${d1}${d2.toString(16).toUpperCase()}${d3.toString(16).toUpperCase()}${d4.toString(16).toUpperCase()}`;

      const info   = this.DTC_DB[code];
      dtcs.push({
        code,
        description: info || 'Código desconhecido — consulte manual do fabricante',
        status,
        severity: this._dtcSeverity(code),
        raw: `${hi.toString(16).padStart(2,'0').toUpperCase()} ${lo.toString(16).padStart(2,'0').toUpperCase()}`,
      });
    }

    this._log(`DTCs lidos: ${dtcs.length === 0 ? 'Nenhum' : dtcs.map(d=>d.code).join(', ')}`, dtcs.length > 0 ? 'warn' : 'ok');
    return dtcs;
  }

  _dtcSeverity(code) {
    if (/P03[0-9]{2}/.test(code)) return 'Alto';     // Falhas de ignição
    if (/P0[1-2][0-9]{2}/.test(code)) return 'Médio'; // Combustível/sensors
    if (/U/.test(code)) return 'Alto';                  // Rede CAN
    return 'Baixo';
  }

  async clearDTCs() {
    this._log('Limpando DTCs…');
    const raw = await this.cmd('04');
    const ok  = raw.includes('44') || raw.includes('OK') || !raw.includes('NO DATA');
    this._log(ok ? 'DTCs limpos com sucesso.' : 'Possível falha ao limpar DTCs.', ok ? 'ok' : 'warn');
    return { success: ok, raw };
  }

  // ─────────────────────────────────────────────────────────
  // DADOS EM TEMPO REAL
  // ─────────────────────────────────────────────────────────

  /** Lê um PID único e retorna o valor parseado */
  async readPID(pid) {
    const def = this.PIDS[pid];
    if (!def) throw new Error(`PID desconhecido: ${pid}`);
    const raw = await this.cmd(def.cmd);
    if (raw.includes('NO DATA') || raw.includes('UNABLE')) return null;
    return this._parsePID(raw, pid);
  }

  /** Lê um conjunto de PIDs e retorna objeto com todos os valores */
  async readLiveData(pids = ['rpm','speed','temp','throttle','fuel']) {
    const result = { timestamp: Date.now() };
    for (const pid of pids) {
      try {
        result[pid] = await this.readPID(pid);
      } catch (_) {
        result[pid] = null;
      }
      await this._sleep(30); // Pequena pausa entre PIDs
    }
    return result;
  }

  /**
   * Inicia polling contínuo de dados em tempo real.
   * Chama onLiveData(data) a cada intervalo.
   */
  startLiveData(pids = ['rpm','speed','temp','throttle','fuel'], intervalMs = 1000) {
    this.stopLiveData();
    this._liveActive = true;
    this._log(`Iniciando monitoramento (${pids.join(', ')}) a cada ${intervalMs}ms`);

    const loop = async () => {
      if (!this._liveActive || !this.isConnected) return;
      try {
        const data = await this.readLiveData(pids);
        if (this._onLiveData) this._onLiveData(data);
      } catch (e) {
        this._log('Erro no loop de leitura: ' + e.message, 'warn');
      }
      if (this._liveActive) {
        this._liveLoopTimer = setTimeout(loop, intervalMs);
      }
    };
    loop();
  }

  stopLiveData() {
    this._liveActive = false;
    if (this._liveLoopTimer) {
      clearTimeout(this._liveLoopTimer);
      this._liveLoopTimer = null;
    }
  }

  // ─────────────────────────────────────────────────────────
  // INFORMAÇÕES DO ADAPTADOR / VIN
  // ─────────────────────────────────────────────────────────
  async getAdapterInfo() {
    const [ver, volt, prot] = await Promise.allSettled([
      this.cmd('ATI'),
      this.cmd('ATRV'),
      this.cmd('ATDP'),
    ]);
    return {
      version:  ver.status  === 'fulfilled' ? ver.value.replace(/[\r\n>]/g,'').trim()  : '?',
      voltage:  volt.status === 'fulfilled' ? volt.value.replace(/[\r\n>]/g,'').trim() : '?',
      protocol: prot.status === 'fulfilled' ? prot.value.replace(/[\r\n>]/g,'').trim() : '?',
    };
  }

  async readVIN() {
    const raw = await this.cmd('0902', 5000);
    // VIN vem em múltiplas linhas: "49 02 01 XX XX XX…"
    const bytes  = this._parseBytes(raw);
    // Filtra bytes de modo/PID e pega ASCII
    const chars  = bytes.filter(b => b >= 0x20 && b <= 0x7E);
    return chars.length >= 10 ? String.fromCharCode(...chars) : null;
  }

  // ─────────────────────────────────────────────────────────
  // DIAGNÓSTICO COMPLETO (para salvar no Firebase)
  // ─────────────────────────────────────────────────────────
  async fullScan() {
    this._log('Iniciando varredura completa…');
    const [dtcs, pending, adapter, liveSnap] = await Promise.allSettled([
      this.readDTCs(),
      this.readPendingDTCs(),
      this.getAdapterInfo(),
      this.readLiveData(['rpm','speed','temp','throttle','fuel','voltage']),
    ]);

    let vin = null;
    try { vin = await this.readVIN(); } catch (_) {}

    return {
      timestamp:  new Date().toISOString(),
      device:     this.device?.name || 'ELM327',
      vin,
      adapter:    adapter.status  === 'fulfilled' ? adapter.value  : {},
      dtcs:       dtcs.status     === 'fulfilled' ? dtcs.value     : [],
      pending:    pending.status  === 'fulfilled' ? pending.value  : [],
      live:       liveSnap.status === 'fulfilled' ? liveSnap.value : {},
    };
  }

  // ─────────────────────────────────────────────────────────
  // UTILITÁRIOS
  // ─────────────────────────────────────────────────────────
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  get pidLabels() {
    return Object.fromEntries(Object.entries(this.PIDS).map(([k,v]) => [k, { label: v.label, unit: v.unit }]));
  }

  getStatus() {
    return {
      connected:  this.isConnected,
      device:     this.device?.name || null,
      monitoring: this._liveActive,
    };
  }
}

// Instância global
const elm327 = new ELM327Service();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ELM327Service, elm327 };
}