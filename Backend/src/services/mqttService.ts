/**
 * MQTT Service
 * Connects to MQTT broker and subscribes to ESP32 sensor data
 * Processes incoming messages and feeds them to waterQualityService
 */

import mqtt, { MqttClient } from 'mqtt';
import { numeric } from './sensorHealth';
import { logger } from '../utils/logger';
import { sensorReadingService } from './sensorReadingService';
import { waterAlertNotificationService } from './waterAlertNotification.service';
import type { WaterQualityReading, WaterQualityStats } from '../iot/water/types';
<<<<<<< HEAD
import { config } from '../config/config';
import { HardwareCommand } from '../database/models/HardwareControl';
import { FeedingCommand } from '../database/models/FeedingCommand';
import { deviceService } from './device.service';
import { ackCanonical, commandCanonical, parseSignedAck, signCanonical, verifyCanonical } from './hardwareProtocol';
import { hardwareService } from './hardwareService';
=======
import { config as appConfig } from '../config/config';
>>>>>>> origin/feature/major-improvements

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
    temperature?: unknown;
    ph?: unknown;
    turbidity?: unknown;
    do?: unknown;
    ammonia?: unknown;
    orp?: unknown;
  } = {};
  private latestTurbidityUnit: 'raw_adc' | 'NTU' = 'raw_adc';
  private latestDeviceId = 'mqtt-device';
  private pendingBatchFlags = {
    temperature: false,
    ph: false,
    turbidity: false,
  };
  private onReadingReceived?: (reading: WaterQualityReading) => void;
  private onStatsUpdated?: (stats: WaterQualityStats) => void;
  private lastConnectionWarningAt = 0;
  private sensorTimestamps: Record<string,string> = {};
  private latestDoReceivedAt = 0;
  private latestOrpReceivedAt = 0;
  private actuatorRedeliveryInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MQTTConfig>) {
    this.config = {
      brokerUrl: config?.brokerUrl || appConfig.mqtt.brokerUrl,
      username: config?.username || appConfig.mqtt.username,
      password: config?.password || appConfig.mqtt.password,
      clientId: config?.clientId || `aquasense-backend-${Date.now()}`,
      topics: {
        readings: config?.topics?.readings || appConfig.mqtt.topics.readings,
        sensorWildcard: config?.topics?.sensorWildcard || appConfig.mqtt.topics.sensorWildcard,
        commands: config?.topics?.commands || appConfig.mqtt.topics.commands,
        status: config?.topics?.status || appConfig.mqtt.topics.status,
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
        void this.redeliverPendingActuatorCommands();
        if (!this.actuatorRedeliveryInterval) this.actuatorRedeliveryInterval = setInterval(() => {
          void this.redeliverPendingActuatorCommands();
        }, 5000);
        this.publishStatus('online');

        // Clear any existing reconnect interval
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      });

      // New messages
      this.client.on('message', (topic: string, payload: Buffer, packet: mqtt.IPublishPacket) => {
        if (!packet.retain) this.handleMessage(topic, payload);
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
      this.client.subscribe([this.config.topics.readings, this.config.topics.sensorWildcard, this.config.topics.commands, 'aquasense/+/state'], (err) => {
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
      } else if (/^aquasense\/[^/]+\/state$/.test(topic)) {
        void this.handleActuatorAck(topic, message);
      } else if (this.isAquasenseSensorTopic(topic)) {
        this.handleAquasenseTopicValue(topic, message);
      } else if (topic.startsWith('water/commands/')) {
        this.handleCommand(topic, message);
      }
    } catch (error) {
      logger.error(`Error processing MQTT message from ${topic}:`, error);
    }
  }

  /** Publish one non-retained, signed actuator command. Publishing means queued, never confirmed. */
  async dispatchHardwareCommand(input: { id: string; deviceId: string; source: 'hardware' | 'feeding'; action: string; durationMs?: number; expiresAt: Date }): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    const key = config.device.keys[input.deviceId];
    if (!key) return false;
    const unsigned = { v: 1 as const, deviceId: input.deviceId, id: input.id, source: input.source,
      action: input.action, durationMs: input.durationMs ?? 0, expiresAt: input.expiresAt.getTime() };
    const payload = JSON.stringify({ ...unsigned, signature: signCanonical(commandCanonical(unsigned), key) });
    return new Promise((resolve) => this.client!.publish(`aquasense/${input.deviceId}/command`, payload,
      { qos: 1, retain: false }, error => {
        if (error) { logger.warn('Actuator MQTT publish failed', { deviceId: input.deviceId, commandId: input.id, error: error.message }); resolve(false); }
        else resolve(true);
      }));
  }

  private async redeliverPendingActuatorCommands(): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      const [hardware, feeding] = await Promise.all([
        HardwareCommand.findAll({ where: { status: 'PENDING' }, order: [['createdAt', 'ASC']], limit: 100 }),
        FeedingCommand.findAll({ where: { status: 'PENDING', source: 'MANUAL' }, order: [['createdAt', 'ASC']], limit: 100 }),
      ]);
      const now = Date.now();
      for (const command of hardware) {
        if (command.expiresAt.getTime() <= now) continue;
        if (!(await deviceService.verifyOwnership(command.userId, command.deviceId))) continue;
        await this.dispatchHardwareCommand({ id: command.id, deviceId: command.deviceId, source: 'hardware', action: command.action,
          durationMs: command.durationMs ?? undefined, expiresAt: command.expiresAt });
      }
      for (const command of feeding) {
        const expiresAt = command.createdAt.getTime() + 120_000;
        if (expiresAt <= now || !(await deviceService.verifyOwnership(command.userId, command.deviceId))) continue;
        await this.dispatchHardwareCommand({ id: command.id, deviceId: command.deviceId, source: 'feeding', action: command.action,
          expiresAt: new Date(expiresAt) });
      }
      // Expired commands are not redelivered after a reconnect/outage.
      await hardwareService.expirePendingCommands();
    } catch (error) { logger.error('Actuator command redelivery failed', error); }
  }

  private async handleActuatorAck(topic: string, payload: string): Promise<void> {
    const ack = parseSignedAck(payload);
    const topicDeviceId = topic.split('/')[1];
    if (!ack || ack.deviceId !== topicDeviceId) { logger.warn('Rejected malformed actuator state/ack', { topic }); return; }
    const key = config.device.keys[ack.deviceId];
    if (!key || !verifyCanonical(ackCanonical(ack), ack.signature, key)) {
      logger.warn('Rejected actuator state/ack with invalid signature', { deviceId: ack.deviceId, commandId: ack.id }); return;
    }
    try {
      const device = await deviceService.getActiveDevice(ack.deviceId);
      if (!device) return;
      const accepted = await hardwareService.acceptMqttAck(device.userId, ack);
      if (!accepted) logger.warn('Rejected out-of-scope actuator state/ack', { deviceId: ack.deviceId, commandId: ack.id });
    } catch (error) { logger.error('Failed to persist actuator state/ack', error); }
  }

  /**
   * Process sensor reading from ESP32
   * Expected format: {temperature, ph, do, turbidity, location?, timestamp?}
   */
  private async handleSensorReading(payload: string): Promise<void> {
    try {
      const data = JSON.parse(payload);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      const deviceId = typeof data.deviceId === 'string' ? data.deviceId : 'mqtt-device';
      const reading = await sensorReadingService.ingest(deviceId, data);
      this.onReadingReceived?.(reading);
      await waterAlertNotificationService.processReading({...reading, dissolvedOxygen:reading.do, dissolvedOxygenMeasured:reading.doMeasured}).catch(error=>logger.error('Post-ingestion notification failed', {deviceId, readingId:reading.id, error:String(error)}));
      const stats = await sensorReadingService.getStatistics(60);
      this.onStatsUpdated?.({...stats,timestamp:new Date()});
    } catch { logger.warn('Malformed sensor payload or ingestion failed'); }
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
    const parsed = numeric(payload);

    const value = parsed === null ? payload : parsed;

    if(topicSuffix) this.sensorTimestamps[topicSuffix]=new Date().toISOString();
    switch (topicSuffix) {
      case 'device-id':
        if (payload.trim()) this.latestDeviceId = payload.trim();
        return;
      case 'temperature':
        this.latestSensorPayload.temperature = value;
        this.pendingBatchFlags.temperature = true;
        break;
      case 'ph':
        this.latestSensorPayload.ph = value;
        this.pendingBatchFlags.ph = true;
        break;
      case 'turbidity':
        this.latestSensorPayload.turbidity = value;
        this.latestTurbidityUnit = 'raw_adc';
        this.pendingBatchFlags.turbidity = true;
        break;
      case 'turbidity-ntu':
        this.latestSensorPayload.turbidity = value;
        this.latestTurbidityUnit = 'NTU';
        this.pendingBatchFlags.turbidity = true;
        break;
      case 'orp':
        this.latestSensorPayload.orp = value;
        this.latestOrpReceivedAt = Date.now();
        break;
      case 'do':
      case 'dissolved-oxygen':
        this.latestSensorPayload.do = value;
        this.latestDoReceivedAt = Date.now();
        break;
      case 'ammonia':
      case 'nh3':
        this.latestSensorPayload.ammonia = value;
        break;
      default:
        logger.debug(`[MQTT] Unsupported aquasense topic suffix: ${topicSuffix}`);
        return;
    }

    if (
      (parsed === null || (this.pendingBatchFlags.temperature &&
      this.pendingBatchFlags.ph &&
      this.pendingBatchFlags.turbidity &&
      this.latestSensorPayload.temperature !== undefined &&
      this.latestSensorPayload.ph !== undefined &&
      this.latestSensorPayload.turbidity !== undefined))
    ) {
      const normalizedPayload = {
        deviceId: this.latestDeviceId,
        temperature: this.latestSensorPayload.temperature,
        ph: this.latestSensorPayload.ph,
        do: Date.now() - this.latestDoReceivedAt <= 15000 ? this.latestSensorPayload.do : undefined,
        turbidity: this.latestSensorPayload.turbidity,
        turbidityUnit: this.latestTurbidityUnit,
        orp: Date.now() - this.latestOrpReceivedAt <= 15000 ? this.latestSensorPayload.orp ?? null : null,
        sensorTimestamps: {...this.sensorTimestamps},
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
    if (this.actuatorRedeliveryInterval) { clearInterval(this.actuatorRedeliveryInterval); this.actuatorRedeliveryInterval = null; }
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
