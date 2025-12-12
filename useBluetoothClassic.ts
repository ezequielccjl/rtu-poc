import { useCallback, useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
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
  connectedDevice: BluetoothDevice | null;
  isScanning: boolean;
  isConnecting: boolean;
  isPairing: boolean;
  messages: Message[];
  error: string | null;
  isConnected: boolean;
  mp4Device: BluetoothDevice | null;
  permissionsGranted: boolean;
}

/**
 * Interface para los métodos del hook
 */
interface BluetoothMethods {
  connectToDevice: (device: BluetoothDevice) => Promise<BluetoothDevice>;
  disconnect: () => Promise<void>;
  sendData: (data: string) => Promise<boolean>;
  clearMessages: () => void;
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
  const [connectedDevice, setConnectedDevice] =
    useState<BluetoothDevice | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isPairing, setIsPairing] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mp4Device, setMp4Device] = useState<BluetoothDevice | null>(null);
  const [permissionsGranted, setPermissionsGranted] = useState<boolean>(false);

  /**
   * Solicitar permisos de Bluetooth para Android 12+
   */
  const requestBluetoothPermissions =
    useCallback(async (): Promise<boolean> => {
      if (Platform.OS !== 'android') {
        return true;
      }

      try {
        const apiLevel = Platform.Version;

        if (apiLevel < 31) {
          // Android 11 o menor - solo necesita ACCESS_FINE_LOCATION
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Permiso de Ubicación',
              message:
                'La app necesita acceso a la ubicación para escanear dispositivos Bluetooth.',
              buttonNeutral: 'Preguntar después',
              buttonNegative: 'Cancelar',
              buttonPositive: 'Aceptar',
            },
          );
          const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
          setPermissionsGranted(isGranted);
          return isGranted;
        }

        // Android 12+ (API 31+) - necesita permisos específicos de Bluetooth
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        const allGranted =
          granted['android.permission.BLUETOOTH_SCAN'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_CONNECT'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.ACCESS_FINE_LOCATION'] ===
            PermissionsAndroid.RESULTS.GRANTED;

        setPermissionsGranted(allGranted);

        if (!allGranted) {
          setError('Se requieren permisos de Bluetooth para continuar');
        }

        return allGranted;
      } catch (err) {
        console.error('Error requesting permissions:', err);
        setPermissionsGranted(false);
        setError('Error al solicitar permisos');
        return false;
      }
    }, []);

  // Solicitar permisos automáticamente al montar el componente
  useEffect(() => {
    requestBluetoothPermissions();
  }, [requestBluetoothPermissions]);

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
        // Verificar permisos antes de emparejar
        if (!permissionsGranted) {
          const granted = await requestBluetoothPermissions();
          if (!granted) {
            throw new Error(
              'Se requieren permisos de Bluetooth para emparejar',
            );
          }
        }

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
    [addMessage, permissionsGranted, requestBluetoothPermissions],
  );

  /**
   * Buscar dispositivo MP4 y conectar automáticamente
   */
  const findAndConnectMP4 = useCallback(async (): Promise<
    BluetoothDevice | undefined
  > => {
    try {
      // Verificar permisos primero
      if (!permissionsGranted) {
        const granted = await requestBluetoothPermissions();
        if (!granted) {
          throw new Error(
            'Se requieren permisos de Bluetooth para buscar dispositivos',
          );
        }
      }

      setIsScanning(true);
      setError(null);

      // Primero buscar en dispositivos emparejados
      const paired = await RNBluetoothClassic.getBondedDevices();
      console.log({ paired });
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
      console.log({ enabled });
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
  }, [addMessage, pairDevice, permissionsGranted, requestBluetoothPermissions]);

  /**
   * Conectar a un dispositivo específico
   */
  const connectToDevice = useCallback(
    async (device: BluetoothDevice): Promise<BluetoothDevice> => {
      try {
        // Verificar permisos
        if (!permissionsGranted) {
          const granted = await requestBluetoothPermissions();
          if (!granted) {
            throw new Error('Se requieren permisos de Bluetooth para conectar');
          }
        }

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
    [addMessage, permissionsGranted, requestBluetoothPermissions],
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

  return {
    // Estado
    connectedDevice,
    isScanning,
    isConnecting,
    isPairing,
    messages,
    error,
    isConnected: !!connectedDevice,
    mp4Device,
    permissionsGranted,

    // Métodos
    connectToDevice,
    disconnect,
    sendData,
    clearMessages,
    pairDevice,
    findAndConnectMP4,
  };
};

export default useBluetoothClassic;
export type {
  BluetoothMethods,
  BluetoothState,
  Message,
  MessageType,
  UseBluetoothClassicReturn,
};
