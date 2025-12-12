import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItem,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { styles } from './styles';
import useBluetoothClassic, { Message } from './useBluetoothClassic';

/**
 * Aplicación principal con TypeScript
 * Busca automáticamente dispositivos MP4 y permite enviar comandos personalizados
 */
const AppWithHook: React.FC = () => {
  const {
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

export default AppWithHook;
