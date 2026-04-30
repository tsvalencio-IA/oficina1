package br.com.thiaguinho.cliente;

import com.getcapacitor.BridgeActivity;

/**
 * thIAguinho — MainActivity
 *
 * Registra plugins customizados (ELM Bluetooth Clássico).
 *
 * Powered by thIAguinho Soluções Digitais
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Registra plugin customizado ANTES do super.onCreate
        registerPlugin(ELMBluetoothClassicPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
