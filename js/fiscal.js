/**
 * thIAguinho ERP — js/fiscal.js (STUB / PLACEHOLDER)
 *
 * Este arquivo é um stub intencional. O Lote Fiscal completo
 * (NFe / NFSe / CBS 2026 / IBS / certificado A1 / integração ABRASF /
 * gateways Focus NFe / NFE.io / Brasil NFe) será implementado em
 * turnos futuros.
 *
 * Enquanto isso, este arquivo apenas expõe um namespace seguro
 * para evitar ReferenceError caso algum trecho do sistema já
 * tente chamar window.Fiscal.
 *
 * Powered by thIAguinho Soluções Digitais
 */
'use strict';

window.Fiscal = window.Fiscal || {
  pronto: false,
  versao: 'stub-0.1',

  // Placeholders — retornam mensagens claras para o usuário
  emitirNFe: async function() {
    if (typeof window.toast === 'function') {
      window.toast('⚠ Emissão de NFe ainda não está disponível. Em desenvolvimento.', 'warn');
    } else {
      alert('⚠ Emissão de NFe ainda não está disponível. Em desenvolvimento.');
    }
    return { ok: false, motivo: 'modulo_nao_implementado' };
  },

  emitirNFSe: async function() {
    if (typeof window.toast === 'function') {
      window.toast('⚠ Emissão de NFSe ainda não está disponível. Em desenvolvimento.', 'warn');
    } else {
      alert('⚠ Emissão de NFSe ainda não está disponível. Em desenvolvimento.');
    }
    return { ok: false, motivo: 'modulo_nao_implementado' };
  },

  /**
   * Cálculo simbólico do IVA Dual 2026 (fase de teste).
   * Conforme Lei Complementar 214/2025:
   *   • CBS (federal) = 0,9% sobre a base
   *   • IBS (estadual + municipal) = 0,1% sobre a base
   *   • Total IVA de teste = 1,0%
   * Empresas do Simples Nacional estão DISPENSADAS nas alíquotas-teste.
   * Valores compensáveis com PIS/COFINS — não geram aumento efetivo de carga.
   */
  calcularIVA2026: function(valor, optanteSimples) {
    const v = parseFloat(valor) || 0;
    if (optanteSimples) {
      return { cbs: 0, ibs: 0, total: 0, dispensado: true, motivo: 'Simples Nacional dispensado em 2026' };
    }
    return {
      cbs: +(v * 0.009).toFixed(2),       // 0,9%
      ibs: +(v * 0.001).toFixed(2),       // 0,1%
      total: +(v * 0.010).toFixed(2),     // 1,0% total
      dispensado: false,
      aliquotaCBS: 0.009,
      aliquotaIBS: 0.001
    };
  }
};

/* Powered by thIAguinho Soluções Digitais */
