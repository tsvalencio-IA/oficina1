/**
 * thIAguinho ERP — ELM327 Bridge
 *
 * Camada de adaptação que escolhe automaticamente entre:
 *   1) Plugin nativo Capacitor (APK Android) → Bluetooth Clássico SPP/RFCOMM (CHX, V-Link, qualquer ELM327 antigo)
 *   2) Web Bluetooth (navegador comum) → Apenas BLE 4.0+ (Vgate iCar Pro BLE, etc.)
 *
 * Como o JavaScript do cliente.html chama:
 *   await window.elmBridge.connect()
 *   await window.elmBridge.sendCommand("010C")
 *   await window.elmBridge.disconnect()
 *
 * Powered by thIAguinho Soluções Digitais
 */
(function() {
  'use strict';

  // Detecta ambiente: APK Capacitor expõe window.Capacitor.isNativePlatform()
  const isCapacitor = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

  // Plugin nativo (só existe no APK)
  const NativePlugin = isCapacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ELMBluetoothClassic
    ? window.Capacitor.Plugins.ELMBluetoothClassic
    : null;

  /**
   * Bridge unificada para ELM327.
   * Independente da plataforma, expõe a mesma API.
   */
  window.elmBridge = {
    /** Indica se estamos rodando no APK (Bluetooth Clássico disponível) */
    isNative: isCapacitor && !!NativePlugin,

    /** Indica se estamos rodando no navegador (apenas BLE) */
    isWeb: !isCapacitor,

    /** Lista dispositivos pareados (só funciona no APK) */
    async listPaired() {
      if (NativePlugin) {
        try {
          const result = await NativePlugin.listPaired();
          return result.devices || [];
        } catch(e) {
          console.error('[elmBridge] listPaired falhou:', e);
          throw e;
        }
      }
      throw new Error('Listar dispositivos pareados só funciona no APK Android');
    },

    /**
     * Conecta no ELM. No APK precisa do MAC. No navegador abre seletor BLE.
     */
    async connect(options) {
      if (NativePlugin) {
        // APK: precisa do address (MAC) — usuário escolhe da lista de pareados
        if (!options || !options.address) {
          throw new Error('No APK, é preciso passar o MAC address do ELM (use listPaired primeiro)');
        }
        return await NativePlugin.connect({ address: options.address });
      } else if (window.elm327) {
        // Navegador: usa o serviço Web Bluetooth BLE existente
        return await window.elm327.connect();
      }
      throw new Error('Nenhum método de conexão disponível');
    },

    /** Envia comando AT/OBD e espera resposta até receber '>' */
    async sendCommand(cmd, timeout) {
      if (NativePlugin) {
        const result = await NativePlugin.sendCommand({ cmd: cmd, timeout: timeout || 3000 });
        return result.response || '';
      } else if (window.elm327) {
        return await window.elm327.sendCommand(cmd, timeout);
      }
      throw new Error('Não conectado');
    },

    /** Desconecta limpo */
    async disconnect() {
      if (NativePlugin) {
        return await NativePlugin.disconnect();
      } else if (window.elm327) {
        return await window.elm327.disconnect();
      }
    },

    /** Status da conexão */
    async isConnected() {
      if (NativePlugin) {
        const result = await NativePlugin.isConnected();
        return result.connected;
      } else if (window.elm327) {
        return window.elm327.isConnected;
      }
      return false;
    },

    /**
     * Helpers OBD2 — usam sendCommand internamente para padronizar leitura
     * de DTCs, dados ao vivo etc, independente do canal (BLE ou Clássico).
     */
    async readDTCs() {
      const res = await this.sendCommand('03');
      return _parseDTCs(res);
    },

    async clearDTCs() {
      const res = await this.sendCommand('04');
      return res.indexOf('OK') >= 0 || res.indexOf('44') >= 0;
    },

    async readLiveData() {
      const data = {};
      try {
        const rpmRes = await this.sendCommand('010C');
        data.rpm = _parseRPM(rpmRes);
        const speedRes = await this.sendCommand('010D');
        data.speed = parseInt(speedRes.split(' ').pop(), 16);
        const tempRes = await this.sendCommand('0105');
        data.temp = parseInt(tempRes.split(' ').pop(), 16) - 40;
      } catch(e) { console.warn('Erro live data:', e); }
      return data;
    }
  };

  // Helpers privados (usados pelos helpers públicos acima)
  function _parseDTCs(hex) {
    if (!hex || hex.indexOf('NO DATA') >= 0 || hex.indexOf('43 00') >= 0) return [];
    const codes = [];
    const parts = hex.split('\n').join(' ').split(' ');
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '43' || parts[i] === '47') {
        let j = i + 1;
        while (j + 1 < parts.length) {
          const b1 = parts[j], b2 = parts[j+1];
          if (b1 === '00' && b2 === '00') break;
          codes.push({ code: _hexToDTC(b1, b2), status: parts[i] === '43' ? 'Confirmado' : 'Pendente' });
          j += 2;
        }
      }
    }
    return codes;
  }

  function _hexToDTC(b1, b2) {
    const charMap = ['P', 'C', 'B', 'U'];
    const firstDigit = parseInt(b1[0], 16);
    return charMap[firstDigit >> 2] + (firstDigit & 3) + b1[1] + b2;
  }

  function _parseRPM(hex) {
    const parts = hex.split(' ');
    if (parts.length < 4) return 0;
    const a = parseInt(parts[parts.length - 2], 16);
    const b = parseInt(parts[parts.length - 1], 16);
    return ((a * 256) + b) / 4;
  }

  console.log('[elmBridge]', isCapacitor ? '✓ APK detectado — Bluetooth Clássico ATIVO' : '⚠ Navegador — apenas BLE');
})();

/* Powered by thIAguinho Soluções Digitais */
