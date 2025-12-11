import { useState, useEffect, useCallback } from 'react';
import RNBluetoothClassic, {
  BluetoothDevice,
  BluetoothEventSubscription,
} from 'react-native-bluetooth-classic';

/**
 * Tipos de mensajes
 */
type MessageType = 'sent' | 'received' | 'system';

/**
 * Interface para un mensaje del log
 */
interface Message {
  type: MessageType;
  content: string;
  timestamp: string;
}

/**
 * Interface para el estado del hook
 */
interface BluetoothState {
  devices: BluetoothDevice[];
  connectedDevice: BluetoothDevice | null;
  isScanning: boolean;
  isConnecting: boolean;
  isPairing: boolean;
  messages: Message[];
  error: string | null;
  isConnected: boolean;
  mp4Device: BluetoothDevice | null;
}

/**
 * Interface para los métodos del hook
 */
interface BluetoothMethods {
  loadPairedDevices: () => Promise<BluetoothDevice[]>;
  discoverDevices: () => Promise<BluetoothDevice[]>;
  connectToDevice: (device: BluetoothDevice) => Promise<BluetoothDevice>;
  disconnect: () => Promise<void>;
  sendData: (data: string) => Promise<boolean>;
  clearMessages: () => void;
  checkBluetoothEnabled: () => Promise<boolean>;
  requestEnableBluetooth: () => Promise<boolean>;
  pairDevice: (device: BluetoothDevice) => Promise<BluetoothDevice>;
  findAndConnectMP4: () => Promise<BluetoothDevice | undefined>;
}

/**
 * Tipo de retorno completo del hook
 */
type UseBluetoothClassicReturn = BluetoothState & BluetoothMethods;

/**
 * Hook personalizado para manejar conexiones Bluetooth Classic
 *
 * @returns {UseBluetoothClassicReturn} Estado y métodos para manejar Bluetooth
 */
const useBluetoothClassic = (): UseBluetoothClassicReturn => {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] =
    useState<BluetoothDevice | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isPairing, setIsPairing] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mp4Device, setMp4Device] = useState<BluetoothDevice | null>(null);

  // Listener para datos recibidos
  useEffect(() => {
    if (!connectedDevice) return;

    const subscription: BluetoothEventSubscription =
      connectedDevice.onDataReceived(data => {
        const message = data.data as string;
        addMessage('received', message);
      });

    return () => {
      subscription?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedDevice]);

  /**
   * Agregar un mensaje al log
   */
  const addMessage = useCallback((type: MessageType, content: string): void => {
    const timestamp = new Date().toISOString();
    setMessages(prev => [...prev, { type, content, timestamp }]);
  }, []);

  /**
   * Emparejar un dispositivo
   */
  const pairDevice = useCallback(
    async (device: BluetoothDevice): Promise<BluetoothDevice> => {
      try {
        setIsPairing(true);
        setError(null);

        console.log('Intentando emparejar con:', device.name);
        const paired = await RNBluetoothClassic.pairDevice(device.id);

        addMessage('system', `Emparejado con ${device.name}`);
        return paired;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Error desconocido al emparejar';
        setError(errorMessage);
        console.error('Error pairing device:', err);
        throw err;
      } finally {
        setIsPairing(false);
      }
    },
    [addMessage],
  );

  /**
   * Buscar dispositivo MP4 y conectar automáticamente
   */
  const findAndConnectMP4 = useCallback(async (): Promise<
    BluetoothDevice | undefined
  > => {
    try {
      setIsScanning(true);
      setError(null);

      // Primero buscar en dispositivos emparejados
      const paired = await RNBluetoothClassic.getBondedDevices();
      let mp4 = paired.find(
        (device: BluetoothDevice) =>
          device.name && device.name.startsWith('MP4'),
      );

      if (mp4) {
        console.log('MP4 encontrado en dispositivos emparejados:', mp4.name);
        setMp4Device(mp4);
        await connectToDevice(mp4);
        return mp4;
      }

      // Si no está emparejado, buscar en dispositivos disponibles
      const enabled = await RNBluetoothClassic.requestBluetoothEnabled();
      if (!enabled) {
        throw new Error('Bluetooth no está habilitado');
      }

      addMessage('system', 'Buscando dispositivo MP4...');
      const discovered = await RNBluetoothClassic.startDiscovery();

      mp4 = discovered.find(
        (device: BluetoothDevice) =>
          device.name && device.name.startsWith('MP4'),
      );

      if (!mp4) {
        throw new Error('No se encontró ningún dispositivo MP4');
      }

      console.log('MP4 encontrado:', mp4.name);
      setMp4Device(mp4);

      // Intentar emparejar
      addMessage('system', `Emparejando con ${mp4.name}...`);
      await pairDevice(mp4);

      // Conectar
      await connectToDevice(mp4);
      return mp4;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error desconocido al buscar MP4';
      setError(errorMessage);
      console.error('Error finding/connecting MP4:', err);
      throw err;
    } finally {
      setIsScanning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMessage, pairDevice]);

  /**
   * Cargar dispositivos emparejados
   */
  const loadPairedDevices = useCallback(async (): Promise<
    BluetoothDevice[]
  > => {
    try {
      setIsScanning(true);
      setError(null);
      const paired = await RNBluetoothClassic.getBondedDevices();
      setDevices(paired);
      return paired;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al cargar dispositivos';
      setError(errorMessage);
      console.error('Error loading paired devices:', err);
      return [];
    } finally {
      setIsScanning(false);
    }
  }, []);

  /**
   * Descubrir dispositivos cercanos
   */
  const discoverDevices = useCallback(async (): Promise<BluetoothDevice[]> => {
    try {
      setIsScanning(true);
      setError(null);

      const enabled = await RNBluetoothClassic.requestBluetoothEnabled();
      if (!enabled) {
        throw new Error('Bluetooth no está habilitado');
      }

      const discovered = await RNBluetoothClassic.startDiscovery();
      setDevices(discovered);
      return discovered;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al descubrir dispositivos';
      setError(errorMessage);
      console.error('Error discovering devices:', err);
      return [];
    } finally {
      setIsScanning(false);
    }
  }, []);

  /**
   * Conectar a un dispositivo específico
   */
  const connectToDevice = useCallback(
    async (device: BluetoothDevice): Promise<BluetoothDevice> => {
      try {
        setIsConnecting(true);
        setError(null);

        // Verificar si ya está conectado
        const isConnected = await device.isConnected();
        if (isConnected) {
          setConnectedDevice(device);
          addMessage('system', `Ya conectado a ${device.name}`);
          return device;
        }

        // Intentar conectar
        const connected = await RNBluetoothClassic.connectToDevice(device.id);
        setConnectedDevice(connected);
        addMessage('system', `Conectado a ${device.name}`);
        return connected;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Error al conectar';
        setError(errorMessage);
        console.error('Error connecting to device:', err);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [addMessage],
  );

  /**
   * Desconectar del dispositivo actual
   */
  const disconnect = useCallback(async (): Promise<void> => {
    try {
      if (!connectedDevice) return;

      await connectedDevice.disconnect();
      addMessage('system', `Desconectado de ${connectedDevice.name}`);
      setConnectedDevice(null);
      setMessages([]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al desconectar';
      setError(errorMessage);
      console.error('Error disconnecting:', err);
    }
  }, [connectedDevice, addMessage]);

  /**
   * Enviar datos al dispositivo
   */
  const sendData = useCallback(
    async (data: string): Promise<boolean> => {
      try {
        if (!connectedDevice) {
          throw new Error('No hay dispositivo conectado');
        }

        setError(null);
        await connectedDevice.write(data);
        addMessage('sent', data);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Error al enviar datos';
        setError(errorMessage);
        console.error('Error sending data:', err);
        return false;
      }
    },
    [connectedDevice, addMessage],
  );

  /**
   * Limpiar mensajes
   */
  const clearMessages = useCallback((): void => {
    setMessages([]);
  }, []);

  /**
   * Verificar si Bluetooth está habilitado
   */
  const checkBluetoothEnabled = useCallback(async (): Promise<boolean> => {
    try {
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      return enabled;
    } catch (err) {
      console.error('Error checking Bluetooth status:', err);
      return false;
    }
  }, []);

  /**
   * Solicitar habilitar Bluetooth
   */
  const requestEnableBluetooth = useCallback(async (): Promise<boolean> => {
    try {
      const enabled = await RNBluetoothClassic.requestBluetoothEnabled();
      return enabled;
    } catch (err) {
      console.error('Error requesting Bluetooth enable:', err);
      return false;
    }
  }, []);

  return {
    // Estado
    devices,
    connectedDevice,
    isScanning,
    isConnecting,
    isPairing,
    messages,
    error,
    isConnected: !!connectedDevice,
    mp4Device,

    // Métodos
    loadPairedDevices,
    discoverDevices,
    connectToDevice,
    disconnect,
    sendData,
    clearMessages,
    checkBluetoothEnabled,
    requestEnableBluetooth,
    pairDevice,
    findAndConnectMP4,
  };
};

export default useBluetoothClassic;
export type {
  Message,
  MessageType,
  BluetoothState,
  BluetoothMethods,
  UseBluetoothClassicReturn,
};
