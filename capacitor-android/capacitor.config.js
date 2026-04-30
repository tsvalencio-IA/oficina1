/// <reference types="@capacitor/cli" />

/**
 * thIAguinho ERP — Configuração do Capacitor para Android
 *
 * IMPORTANTE: o app aponta para o GitHub Pages.
 * Quando você atualizar o código no GitHub, o app já estará atualizado
 * (não precisa republicar APK toda vez que mexer no HTML/JS).
 *
 * Para fazer um app "offline-only" (sem GitHub Pages), troque:
 *   server: { url: 'https://...', cleartext: true }
 * por:
 *   webDir: 'www'
 *
 * Powered by thIAguinho Soluções Digitais
 */
const config = {
  appId: 'br.com.thiaguinho.cliente',
  appName: 'thIAguinho',
  webDir: 'www',
  bundledWebRuntime: false,
  server: {
    // Aponta para o seletor de perfil (tela com 4 botões: Cliente / Mecânico / Gestor / Admin)
    url: 'https://tsvalencio-ia.github.io/oficinaClaude/selecionar-perfil.html',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'tsvalencio-ia.github.io',
      '*.firebaseio.com',
      '*.firebaseapp.com',
      '*.firestore.googleapis.com',
      '*.googleapis.com',
      '*.gstatic.com',
      'api.cloudinary.com',
      'res.cloudinary.com',
      'wa.me',
      'api.whatsapp.com',
      'generativelanguage.googleapis.com'
    ]
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0e1a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#00D4FF'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0e1a'
    },
    Camera: {
      androidScaleType: 'CENTER_CROP',
      promptLabelHeader: 'Foto do veículo',
      promptLabelCancel: 'Cancelar',
      promptLabelPhoto: 'Da galeria',
      promptLabelPicture: 'Tirar foto'
    }
  }
};

module.exports = config;
