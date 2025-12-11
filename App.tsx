import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ListRenderItem,
} from 'react-native';
import useBluetoothClassic, { Message } from './useBluetoothClassic';

/**
 * Aplicación principal con TypeScript
 * Busca automáticamente dispositivos MP4 y permite enviar comandos personalizados
 */
const AppWithHook: React.FC = () => {
  const {
    //connectedDevice,
    isScanning,
    isConnecting,
    isPairing,
    messages,
    error,
    isConnected,
    mp4Device,
    disconnect,
    sendData,
    clearMessages,
    findAndConnectMP4,
  } = useBluetoothClassic();

  const [customCommand, setCustomCommand] = useState<string>('');

  // Buscar y conectar a MP4 automáticamente al iniciar
  useEffect(() => {
    const initializeBluetooth = async (): Promise<void> => {
      try {
        await findAndConnectMP4();
      } catch (err) {
        console.error('Error en inicialización:', err);
      }
    };

    initializeBluetooth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Función para enviar comando personalizado
   */
  const handleSendCommand = async (): Promise<void> => {
    if (!customCommand.trim()) {
      Alert.alert('Error', 'Por favor ingresa un comando');
      return;
    }

    const success = await sendData(customCommand + '\r\n');
    if (success) {
      setCustomCommand(''); // Limpiar input después de enviar
    } else {
      Alert.alert('Error', 'No se pudo enviar el comando');
    }
  };

  /**
   * Función para reconectar a MP4
   */
  const handleReconnect = async (): Promise<void> => {
    try {
      await findAndConnectMP4();
      Alert.alert('Éxito', 'Reconectado a dispositivo MP4');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert('Error', `No se pudo reconectar: ${errorMessage}`);
    }
  };

  /**
   * Renderizar un mensaje individual
   */
  const renderMessage: ListRenderItem<Message> = ({ item }) => {
    const isReceived = item.type === 'received';
    const isSent = item.type === 'sent';

    return (
      <View
        style={[
          styles.message,
          isReceived && styles.messageReceived,
          isSent && styles.messageSent,
        ]}
      >
        <Text style={styles.messageTime}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
        <Text style={styles.messageContent}>{item.content}</Text>
      </View>
    );
  };

  /**
   * Obtener texto del estado actual
   */
  const getStatusText = (): string => {
    if (isConnected) return 'Conectado';
    if (isConnecting) return 'Conectando...';
    if (isPairing) return 'Emparejando...';
    if (isScanning) return 'Buscando MP4...';
    return 'Desconectado';
  };

  /**
   * Obtener texto del botón de carga
   */
  const getLoadingText = (): string => {
    if (isPairing) return 'Emparejando dispositivo...';
    if (isConnecting) return 'Conectando...';
    return 'Buscando dispositivo MP4...';
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Bluetooth MP4</Text>
          {mp4Device && (
            <Text style={styles.subtitle}>
              {isConnected
                ? `Conectado: ${mp4Device.name}`
                : `Encontrado: ${mp4Device.name}`}
            </Text>
          )}
        </View>

        {/* Estado de conexión */}
        <View style={styles.statusSection}>
          <View
            style={[
              styles.statusIndicator,
              isConnected ? styles.statusConnected : styles.statusDisconnected,
            ]}
          >
            <Text style={styles.statusDot}>●</Text>
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>

          {isConnected && (
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger]}
              onPress={disconnect}
            >
              <Text style={styles.buttonText}>Desconectar</Text>
            </TouchableOpacity>
          )}

          {!isConnected && !isScanning && !isConnecting && !isPairing && (
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleReconnect}
            >
              <Text style={styles.buttonText}>Buscar MP4</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Input de comando personalizado */}
        {isConnected && (
          <View style={styles.commandSection}>
            <Text style={styles.sectionTitle}>Enviar Comando</Text>
            <View style={styles.commandInputContainer}>
              <TextInput
                style={styles.commandInput}
                placeholder="Escribe tu comando aquí..."
                value={customCommand}
                onChangeText={setCustomCommand}
                onSubmitEditing={handleSendCommand}
                returnKeyType="send"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.button, styles.buttonSend]}
                onPress={handleSendCommand}
              >
                <Text style={styles.buttonText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Mensajes */}
        {isConnected && (
          <View style={styles.messagesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mensajes</Text>
              <TouchableOpacity
                style={styles.buttonSmall}
                onPress={clearMessages}
              >
                <Text style={styles.buttonText}>Limpiar</Text>
              </TouchableOpacity>
            </View>

            <FlatList<Message>
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item, index) => `${item.timestamp}-${index}`}
              style={styles.messageList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Sin mensajes aún</Text>
              }
            />
          </View>
        )}

        {/* Indicador de carga */}
        {(isScanning || isConnecting || isPairing) && (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>{getLoadingText()}</Text>
          </View>
        )}

        {/* Mensaje de error */}
        {error && !isScanning && !isConnecting && !isPairing && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleReconnect}
            >
              <Text style={styles.buttonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: 'white',
    marginTop: 5,
  },
  statusSection: {
    backgroundColor: 'white',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusConnected: {
    opacity: 1,
  },
  statusDisconnected: {
    opacity: 0.7,
  },
  statusDot: {
    fontSize: 20,
    marginRight: 8,
    color: '#34C759',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  commandSection: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  commandInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  commandInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  messagesSection: {
    flex: 1,
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSmall: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonPrimary: {
    backgroundColor: '#34C759',
  },
  buttonDanger: {
    backgroundColor: '#FF3B30',
  },
  buttonSend: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  messageList: {
    flex: 1,
  },
  message: {
    padding: 10,
    marginVertical: 4,
    borderRadius: 8,
    maxWidth: '80%',
  },
  messageReceived: {
    backgroundColor: '#E8F5E9',
    alignSelf: 'flex-start',
  },
  messageSent: {
    backgroundColor: '#E3F2FD',
    alignSelf: 'flex-end',
  },
  messageTime: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  messageContent: {
    fontSize: 14,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  loading: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  loadingText: {
    color: 'white',
    fontSize: 14,
  },
  errorContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FFEBEE',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
});

export default AppWithHook;
