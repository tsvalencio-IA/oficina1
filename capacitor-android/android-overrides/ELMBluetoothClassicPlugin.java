package br.com.thiaguinho.cliente;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * thIAguinho — Plugin Bluetooth Clássico para ELM327 CHX
 *
 * Resolve o problema do Web Bluetooth não suportar SPP/RFCOMM.
 * Este plugin faz a ponte entre o JavaScript do nosso sistema (rodando no
 * WebView) e o serviço Android nativo de Bluetooth Clássico.
 *
 * Métodos expostos pro JavaScript:
 *   - listPaired()              → lista dispositivos pareados
 *   - connect({ address })      → conecta no MAC do CHX (já pareado)
 *   - disconnect()              → encerra
 *   - sendCommand({ cmd })      → envia ATZ, 010C, etc, retorna resposta
 *   - isConnected()             → status
 *
 * UUID padrão SPP: 00001101-0000-1000-8000-00805F9B34FB
 *
 * Powered by thIAguinho Soluções Digitais
 */
@CapacitorPlugin(
    name = "ELMBluetoothClassic",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH }),
        @Permission(strings = { Manifest.permission.BLUETOOTH_ADMIN }),
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }),
        @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN })
    }
)
public class ELMBluetoothClassicPlugin extends Plugin {

    // UUID padrão para Serial Port Profile (SPP). ELM327 usa este.
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothAdapter adapter;
    private BluetoothSocket socket;
    private InputStream input;
    private OutputStream output;
    private boolean connected = false;

    @Override
    public void load() {
        adapter = BluetoothAdapter.getDefaultAdapter();
    }

    /**
     * Lista dispositivos Bluetooth Clássico já pareados no Android.
     * O ELM327 CHX deve aparecer aqui (já que você disse que pareou com senha 6789).
     */
    @PluginMethod
    public void listPaired(PluginCall call) {
        if (adapter == null) {
            call.reject("Bluetooth não disponível neste dispositivo");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth está desligado. Ligue o Bluetooth e tente novamente.");
            return;
        }

        // Permissão BLUETOOTH_CONNECT (Android 12+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                call.reject("Permissão BLUETOOTH_CONNECT negada");
                return;
            }
        }

        try {
            Set<BluetoothDevice> paired = adapter.getBondedDevices();
            JSONArray devices = new JSONArray();
            for (BluetoothDevice d : paired) {
                JSONObject obj = new JSONObject();
                obj.put("name", d.getName() != null ? d.getName() : "Sem nome");
                obj.put("address", d.getAddress());
                obj.put("type", d.getType());  // 1=clássico, 2=BLE, 3=DUAL
                devices.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("devices", devices);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Erro ao listar pareados: " + e.getMessage());
        }
    }

    /**
     * Conecta no dispositivo (precisa do MAC address obtido do listPaired).
     */
    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("Endereço MAC obrigatório");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                call.reject("Permissão BLUETOOTH_CONNECT negada");
                return;
            }
        }

        try {
            // Encerra conexão anterior se houver
            if (connected) {
                disconnectInternal();
            }

            BluetoothDevice device = adapter.getRemoteDevice(address);
            // Cancela descoberta para ganhar performance no socket
            adapter.cancelDiscovery();

            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            input = socket.getInputStream();
            output = socket.getOutputStream();
            connected = true;

            JSObject ret = new JSObject();
            ret.put("connected", true);
            ret.put("name", device.getName());
            ret.put("address", device.getAddress());
            call.resolve(ret);

        } catch (IOException e) {
            connected = false;
            call.reject("Falha ao conectar: " + e.getMessage());
        } catch (SecurityException e) {
            connected = false;
            call.reject("Permissão Bluetooth negada: " + e.getMessage());
        }
    }

    /**
     * Envia comando AT/OBD para o ELM327 e aguarda resposta até receber o '>' (prompt).
     */
    @PluginMethod
    public void sendCommand(PluginCall call) {
        String cmd = call.getString("cmd");
        Integer timeoutMs = call.getInt("timeout", 3000);

        if (cmd == null || cmd.isEmpty()) {
            call.reject("Comando obrigatório");
            return;
        }
        if (!connected || output == null || input == null) {
            call.reject("Não conectado");
            return;
        }

        try {
            // Envia comando seguido de \r (ELM327 padrão)
            String fullCmd = cmd + "\r";
            output.write(fullCmd.getBytes());
            output.flush();

            // Lê resposta até receber '>' (prompt do ELM)
            StringBuilder response = new StringBuilder();
            byte[] buffer = new byte[1024];
            long startTime = System.currentTimeMillis();

            while (System.currentTimeMillis() - startTime < timeoutMs) {
                if (input.available() > 0) {
                    int bytesRead = input.read(buffer);
                    String chunk = new String(buffer, 0, bytesRead);
                    response.append(chunk);
                    if (chunk.contains(">")) {
                        // Resposta completa
                        String result = response.toString().replace(">", "").trim();
                        JSObject ret = new JSObject();
                        ret.put("response", result);
                        call.resolve(ret);
                        return;
                    }
                } else {
                    Thread.sleep(20);
                }
            }
            // Timeout
            call.reject("Timeout aguardando resposta de: " + cmd);
        } catch (Exception e) {
            call.reject("Erro ao enviar comando: " + e.getMessage());
        }
    }

    /**
     * Desconecta limpo.
     */
    @PluginMethod
    public void disconnect(PluginCall call) {
        disconnectInternal();
        JSObject ret = new JSObject();
        ret.put("connected", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("connected", connected);
        call.resolve(ret);
    }

    private void disconnectInternal() {
        try {
            if (input != null) input.close();
            if (output != null) output.close();
            if (socket != null) socket.close();
        } catch (IOException ignored) {}
        input = null;
        output = null;
        socket = null;
        connected = false;
    }
}

/* Powered by thIAguinho Soluções Digitais */
