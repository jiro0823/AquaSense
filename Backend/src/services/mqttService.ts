/**
 * MQTT Service
 * Connects to MQTT broker and subscribes to ESP32 sensor data
 * Processes incoming messages and feeds them to waterQualityService
 */

import mqtt, { MqttClient } from 'mqtt';
import { logger } from '../utils/logger';
import { waterQualityService } from '../iot/water/services/waterQualityService';

interface MQTTConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId?: string;
  topics: {
    readings: string;
    commands: string;
    status: string;
  };
}

export class MQTTService {
  private client: MqttClient | null = null;
  private config: MQTTConfig;
  private isConnected = false;
  private reconnectInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MQTTConfig>) {
    this.config = {
      brokerUrl: config?.brokerUrl || process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
      username: config?.username || process.env.MQTT_USERNAME,
      password: config?.password || process.env.MQTT_PASSWORD,
      clientId: config?.clientId || `aquasense-backend-${Date.now()}`,
      topics: {
        readings: config?.topics?.readings || 'water/esp32/readings',
        commands: config?.topics?.commands || 'water/commands/#',
        status: config?.topics?.status || 'water/esp32/status',
        ...config?.topics,
      },
    };
  }

  /**
   * Connect to MQTT broker and start listening
   */
  async connect(): Promise<void> {
    try {
      const options: mqtt.IClientOptions = {
        clientId: this.config.clientId,
        clean: true,
        reconnectPeriod: 5000,
        username: this.config.username,
        password: this.config.password,
      };

      logger.info(`Connecting to MQTT Broker: ${this.config.brokerUrl}`);
      this.client = mqtt.connect(this.config.brokerUrl, options);

      // Connection established
      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('✓ MQTT Connected successfully');
        this.subscribe();
        this.publishStatus('online');

        // Clear any existing reconnect interval
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      });

      // New messages
      this.client.on('message', (topic: string, payload: Buffer) => {
        this.handleMessage(topic, payload);
      });

      // Disconnection
      this.client.on('disconnect', () => {
        this.isConnected = false;
        logger.warn('MQTT disconnected, attempting to reconnect...');
      });

      // Connection error
      this.client.on('error', (error: Error) => {
        logger.error('MQTT Connection error:', error.message);
      });

      // Reconnection attempt
      this.client.on('reconnect', () => {
        logger.info('MQTT attempting to reconnect...');
      });
    } catch (error) {
      logger.error('Failed to initialize MQTT connection:', error);
      throw error;
    }
  }

  /**
   * Subscribe to topics
   */
  private subscribe(): void {
    if (!this.client) return;

    try {
      this.client.subscribe([this.config.topics.readings, this.config.topics.commands], (err) => {
        if (err) {
          logger.error('MQTT subscription error:', err.message);
        } else {
          logger.info(`✓ Subscribed to topics: ${this.config.topics.readings}, ${this.config.topics.commands}`);
        }
      });
    } catch (error) {
      logger.error('Failed to subscribe to MQTT topics:', error);
    }
  }

  /**
   * Handle incoming MQTT messages
   */
  private handleMessage(topic: string, payload: Buffer): void {
    try {
      const message = payload.toString();
      logger.debug(`[MQTT] Received on ${topic}: ${message.substring(0, 100)}`);

      if (topic === this.config.topics.readings) {
        this.handleSensorReading(message);
      } else if (topic.startsWith('water/commands/')) {
        this.handleCommand(topic, message);
      }
    } catch (error) {
      logger.error(`Error processing MQTT message from ${topic}:`, error);
    }
  }

  /**
   * Process sensor reading from ESP32
   * Expected format: {temperature, ph, do, turbidity, location?, timestamp?}
   */
  private handleSensorReading(payload: string): void {
    try {
      const data = JSON.parse(payload);

      // Validate required fields
      if (
        data.temperature === undefined ||
        data.ph === undefined ||
        data.do === undefined ||
        data.turbidity === undefined
      ) {
        logger.warn('Invalid sensor reading - missing required fields:', data);
        return;
      }

      // Add to water quality service
      const reading = waterQualityService.addReading({
        temperature: parseFloat(data.temperature),
        ph: parseFloat(data.ph),
        do: parseFloat(data.do),
        turbidity: parseFloat(data.turbidity),
        location: data.location || 'ESP32-Sensor',
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      });

      logger.info(`[ESP32] Sensor reading received: Temp=${reading.temperature}°C, pH=${reading.ph}, DO=${reading.do}, Turbidity=${reading.turbidity}`);
    } catch (error) {
      logger.error('Failed to process sensor reading:', error);
    }
  }

  /**
   * Handle remote commands
   */
  private handleCommand(topic: string, payload: string): void {
    try {
      const command = topic.split('/').pop();
      const data = JSON.parse(payload);

      logger.info(`[MQTT Command] ${command}:`, data);

      switch (command) {
        case 'threshold-update':
          waterQualityService.setThresholds(data);
          logger.info('Water quality thresholds updated via MQTT');
          break;

        case 'restart':
          logger.warn('Restart command received - would restart device');
          break;

        default:
          logger.debug(`Unknown command: ${command}`);
      }
    } catch (error) {
      logger.error('Error handling MQTT command:', error);
    }
  }

  /**
   * Publish device status
   */
  private publishStatus(status: 'online' | 'offline'): void {
    if (!this.client || !this.isConnected) return;

    const message = JSON.stringify({
      status,
      timestamp: new Date(),
      uptime: process.uptime(),
    });

    this.client.publish(this.config.topics.status, message, { qos: 1, retain: true }, (err) => {
      if (err) {
        logger.error('Failed to publish status:', err.message);
      } else {
        logger.debug(`Published status: ${status}`);
      }
    });
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }

      this.publishStatus('offline');
      this.client.end(false, () => {
        this.isConnected = false;
        logger.info('✓ MQTT disconnected');
        resolve();
      });
    });
  }

  /**
   * Check connection status
   */
  getStatus(): {
    connected: boolean;
    brokerUrl: string;
    subscribedTopics: string[];
  } {
    return {
      connected: this.isConnected,
      brokerUrl: this.config.brokerUrl,
      subscribedTopics: [this.config.topics.readings, this.config.topics.commands],
    };
  }
}

// Export singleton instance
export const mqttService = new MQTTService();
