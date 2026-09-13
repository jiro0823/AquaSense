/**
 * MQTT Service
 * Connects to MQTT broker and subscribes to ESP32 sensor data
 * Processes incoming messages and feeds them to waterQualityService
 */

import mqtt, { MqttClient } from 'mqtt';
import { parseOrp } from './sensorValues';
import { logger } from '../utils/logger';
import { sensorReadingService } from './sensorReadingService';
import { waterAlertNotificationService } from './waterAlertNotification.service';
import type { WaterQualityReading, WaterQualityStats } from '../iot/water/types';

interface MQTTConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  clientId?: string;
  topics: {
    readings: string;
    sensorWildcard: string;
    commands: string;
    status: string;
  };
}

export class MQTTService {
  private client: MqttClient | null = null;
  private config: MQTTConfig;
  private isConnected = false;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private latestSensorPayload: {
    temperature?: number;
    ph?: number;
    turbidity?: number;
    do?: number;
    ammonia?: number;
    orp?: number | null;
  } = {};
  private pendingBatchFlags = {
    temperature: false,
    ph: false,
    turbidity: false,
  };
  private onReadingReceived?: (reading: WaterQualityReading) => void;
  private onStatsUpdated?: (stats: WaterQualityStats) => void;
  private lastConnectionWarningAt = 0;
  private latestDoReceivedAt = 0;
  private latestOrpReceivedAt = 0;

  constructor(config?: Partial<MQTTConfig>) {
    this.config = {
      brokerUrl: config?.brokerUrl || process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
      username: config?.username || process.env.MQTT_USERNAME,
      password: config?.password || process.env.MQTT_PASSWORD,
      clientId: config?.clientId || `aquasense-backend-${Date.now()}`,
      topics: {
        readings: config?.topics?.readings || process.env.MQTT_TOPIC_READINGS || 'water/esp32/readings',
        sensorWildcard: config?.topics?.sensorWildcard || process.env.MQTT_TOPIC_SENSOR_WILDCARD || 'aquasense/+',
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
        logger.info('âœ“ MQTT Connected successfully');
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

      // MQTT is optional for local development; REST sensor ingestion remains online
      // even when the public broker is unreachable.
      this.client.on('error', (error: Error) => {
        const now = Date.now();
        if (now - this.lastConnectionWarningAt > 30000) {
          this.lastConnectionWarningAt = now;
          logger.warn('MQTT broker unavailable; backend is still running without MQTT data', {
            brokerUrl: this.config.brokerUrl,
            message: error.message || 'Connection failed',
          });
        }
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
      this.client.subscribe([this.config.topics.readings, this.config.topics.sensorWildcard, this.config.topics.commands], (err) => {
        if (err) {
          logger.error('MQTT subscription error:', err.message);
        } else {
          logger.info(
            `âœ“ Subscribed to topics: ${this.config.topics.readings}, ${this.config.topics.sensorWildcard}, ${this.config.topics.commands}`
          );
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
      } else if (this.isAquasenseSensorTopic(topic)) {
        this.handleAquasenseTopicValue(topic, message);
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
  private async handleSensorReading(payload: string): Promise<void> {
    try {
      const data = JSON.parse(payload);

      // Accept both `do` and `dissolvedOxygen` key names.
      const suppliedDo = data.do ?? data.dissolvedOxygen;
      const doMeasured = suppliedDo !== undefined && suppliedDo !== null && String(suppliedDo).trim() !== '' && Number.isFinite(Number(suppliedDo));
      // Keep the legacy numeric storage format, explicitly tagging placeholders.
      const doValue = doMeasured ? suppliedDo : 0;

      // Validate required fields
      if (
        data.temperature === undefined ||
        data.ph === undefined ||
        data.turbidity === undefined
      ) {
        logger.warn('Invalid sensor reading - missing required fields:', data);
        return;
      }

      const temperature = parseFloat(data.temperature);
      const ph = parseFloat(data.ph);
      const dissolvedOxygen = parseFloat(doValue);
      const turbidity = parseFloat(data.turbidity);
      const ammonia = parseFloat(data.ammonia ?? 0);
      const orp = parseOrp(data.orp);

      const sanitized = this.sanitizeSensorValues({
        temperature,
        ph,
        dissolvedOxygen,
        turbidity,
        ammonia,
      });

      if (
        sanitized.temperature === null ||
        sanitized.ph === null ||
        sanitized.dissolvedOxygen === null ||
        sanitized.turbidity === null
      ) {
        logger.warn('[MQTT] Dropping sensor reading: required sensor value is not numeric', {
          temperature,
          ph,
          do: dissolvedOxygen,
          turbidity,
          ammonia,
        });
        return;
      }

      if (sanitized.warnings.length) {
        logger.warn(`[MQTT] Sanitized sensor reading: ${sanitized.warnings.join(', ')}`);
      }

      const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
      const deviceId = typeof data.deviceId === 'string' && data.deviceId.trim() ? data.deviceId.trim() : 'mqtt-device';
      const persisted = await sensorReadingService.addSensorReading(
        deviceId,
        sanitized.temperature,
        sanitized.ph,
        sanitized.dissolvedOxygen,
        sanitized.turbidity,
        sanitized.ammonia,
        data.location || 'ESP32-Sensor',
        timestamp,
        doMeasured,
        orp
      );
      const reading = {
        id: persisted?.id || `mqtt-${Date.now()}`,
        temperature: sanitized.temperature,
        ph: sanitized.ph,
        do: sanitized.dissolvedOxygen,
        doMeasured,
        orp,
        turbidity: sanitized.turbidity,
        ammonia: sanitized.ammonia,
        location: data.location || 'ESP32-Sensor',
        timestamp,
        status: 'normal' as const,
      };

      await waterAlertNotificationService.processReading({
        deviceId,
        temperature: reading.temperature,
        ph: reading.ph,
        dissolvedOxygen: reading.do,
        dissolvedOxygenMeasured: doMeasured,
        turbidity: reading.turbidity,
        ammonia: reading.ammonia,
      });

      this.onReadingReceived?.(reading);
      const dbStats = await sensorReadingService.getStatistics(60);
      this.onStatsUpdated?.({
        timestamp: new Date(),
        orp: dbStats.orp,
        temperature: dbStats.temperature,
        ph: dbStats.ph,
        do: dbStats.do,
        turbidity: dbStats.turbidity,
        ammonia: dbStats.ammonia,
        healthScore: 0,
      });

      // Do not overwrite in-progress numeric-topic aggregation after async DB work.

      logger.info(
        `[ESP32] Sensor reading received: Temp=${reading.temperature}Â°C, pH=${reading.ph}, DO=${reading.do}, Turbidity=${reading.turbidity}`
      );
    } catch (error) {
      logger.error('Failed to process sensor reading:', error);
    }
  }

  setRealtimeHandlers(handlers: {
    onReadingReceived?: (reading: WaterQualityReading) => void;
    onStatsUpdated?: (stats: WaterQualityStats) => void;
  }): void {
    this.onReadingReceived = handlers.onReadingReceived;
    this.onStatsUpdated = handlers.onStatsUpdated;
  }

  /**
   * Handle topic-per-parameter payloads, e.g.:
   * aquasense/temperature => 26.4
   * aquasense/ph => 7.19
   * aquasense/turbidity => 324
   */
  private handleAquasenseTopicValue(topic: string, payload: string): void {
    const topicSuffix = topic.split('/').pop();
    const parsed = Number(payload);

    if (!Number.isFinite(parsed)) {
      logger.warn(`[MQTT] Ignoring non-numeric payload on ${topic}: ${payload}`);
      return;
    }

    switch (topicSuffix) {
      case 'temperature':
        this.latestSensorPayload.temperature = parsed;
        this.pendingBatchFlags.temperature = true;
        break;
      case 'ph':
        this.latestSensorPayload.ph = parsed;
        this.pendingBatchFlags.ph = true;
        break;
      case 'turbidity':
        this.latestSensorPayload.turbidity = parsed;
        this.pendingBatchFlags.turbidity = true;
        break;
      case 'orp':
        this.latestSensorPayload.orp = parsed;
        this.latestOrpReceivedAt = Date.now();
        break;
      case 'do':
      case 'dissolved-oxygen':
        this.latestSensorPayload.do = parsed;
        this.latestDoReceivedAt = Date.now();
        break;
      case 'ammonia':
      case 'nh3':
        this.latestSensorPayload.ammonia = parsed;
        break;
      default:
        logger.debug(`[MQTT] Unsupported aquasense topic suffix: ${topicSuffix}`);
        return;
    }

    if (
      this.pendingBatchFlags.temperature &&
      this.pendingBatchFlags.ph &&
      this.pendingBatchFlags.turbidity &&
      this.latestSensorPayload.temperature !== undefined &&
      this.latestSensorPayload.ph !== undefined &&
      this.latestSensorPayload.turbidity !== undefined
    ) {
      const normalizedPayload = {
        temperature: this.latestSensorPayload.temperature,
        ph: this.latestSensorPayload.ph,
        do: Date.now() - this.latestDoReceivedAt <= 15000 ? this.latestSensorPayload.do : undefined,
        turbidity: this.latestSensorPayload.turbidity,
        ammonia: this.latestSensorPayload.ammonia ?? 0,
        orp: Date.now() - this.latestOrpReceivedAt <= 15000 ? this.latestSensorPayload.orp ?? null : null,
        location: 'ESP32-MQTT',
        timestamp: new Date().toISOString(),
      };

      this.pendingBatchFlags = {
        temperature: false,
        ph: false,
        turbidity: false,
      };

      this.handleSensorReading(JSON.stringify(normalizedPayload));
    }
  }

  private isAquasenseSensorTopic(topic: string): boolean {
    return topic.startsWith('aquasense/');
  }

  private sanitizeSensorValues(values: {
    temperature: number;
    ph: number;
    dissolvedOxygen: number;
    turbidity: number;
    ammonia: number;
  }): {
    temperature: number | null;
    ph: number | null;
    dissolvedOxygen: number | null;
    turbidity: number | null;
    ammonia: number;
    warnings: string[];
  } {
    const warnings: string[] = [];

    let temperature: number | null = values.temperature;
    if (!Number.isFinite(temperature)) {
      temperature = null;
      warnings.push('temperature invalid -> dropped reading');
    }

    let ph: number | null = values.ph;
    if (!Number.isFinite(ph)) {
      ph = null;
      warnings.push('pH invalid -> dropped reading');
    }

    let dissolvedOxygen: number | null = values.dissolvedOxygen;
    if (!Number.isFinite(dissolvedOxygen)) {
      dissolvedOxygen = null;
      warnings.push('dissolved oxygen invalid -> dropped reading');
    }

    let turbidity: number | null = values.turbidity;
    if (!Number.isFinite(values.turbidity)) {
      turbidity = null;
      warnings.push('turbidity invalid -> dropped reading');
    }

    let ammonia = values.ammonia;
    if (!Number.isFinite(ammonia)) {
      ammonia = 0;
      warnings.push('ammonia unavailable -> set to 0');
    }

    return {
      temperature,
      ph,
      dissolvedOxygen,
      turbidity,
      ammonia,
      warnings,
    };
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
          logger.info('Threshold update command received (handled by API configuration layer)');
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
        logger.info('âœ“ MQTT disconnected');
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
      subscribedTopics: [this.config.topics.readings, this.config.topics.sensorWildcard, this.config.topics.commands],
    };
  }
}

// Export singleton instance
export const mqttService = new MQTTService();
