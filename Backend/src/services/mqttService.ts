/**
 * MQTT Service
 * Connects to MQTT broker and subscribes to ESP32 sensor data
 * Processes incoming messages and feeds them to waterQualityService
 */

import mqtt, { MqttClient } from 'mqtt';
import { isPublicDevelopmentTelemetryProfile, numeric, parseProvisionalSensorValue } from './sensorHealth';
import { logger } from '../utils/logger';
import { sensorReadingService } from './sensorReadingService';
import { waterAlertNotificationService } from './waterAlertNotification.service';
import type { WaterQualityReading, WaterQualityStats } from '../iot/water/types';
import { config as appConfig } from '../config/config';
import { HardwareCommand } from '../database/models/HardwareControl';
import { FeedingCommand } from '../database/models/FeedingCommand';
import { deviceService } from './device.service';
import { ackCanonical, commandCanonical, parseSignedAck, signCanonical, verifyCanonical } from './hardwareProtocol';
import { hardwareService } from './hardwareService';

interface MQTTConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  caCertificate?: string;
  deviceScopedTopics: boolean;
  topicNamespace: string;
  actuatorCommandsEnabled: boolean;
  clientId?: string;
  topics: {
    readings: string;
    sensorWildcard: string;
    commands: string;
    status: string;
  };
}

interface TelemetryAssembly {
  latestSensorPayload: { temperature?: unknown; ph?: unknown; turbidity?: unknown; do?: unknown; ammonia?: unknown; orp?: unknown };
  latestTurbidityUnit: 'raw_adc' | 'NTU';
  latestRawTurbidity: number | null;
  pendingBatchFlags: { temperature: boolean; ph: boolean; turbidity: boolean };
  sensorTimestamps: Record<string, string>;
  latestDoReceivedAt: number;
  latestOrpReceivedAt: number;
  frameMode: boolean;
}

const newTelemetryAssembly = (): TelemetryAssembly => ({
  latestSensorPayload: {}, latestTurbidityUnit: 'raw_adc', latestRawTurbidity: null,
  pendingBatchFlags: { temperature: false, ph: false, turbidity: false },
  sensorTimestamps: {}, latestDoReceivedAt: 0, latestOrpReceivedAt: 0, frameMode: false,
});

const safeBrokerUrl = (value: string): string => {
  try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.toString(); }
  catch { return '[invalid MQTT URL]'; }
};

export class MQTTService {
  private client: MqttClient | null = null;
  private config: MQTTConfig;
  private isConnected = false;
  private activeSubscribedTopics: string[] = [];
  private subscriptionGeneration = 0;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private readonly telemetryByDevice = new Map<string, TelemetryAssembly>();
  private latestLegacyDeviceId = 'mqtt-device';
  private onReadingReceived?: (reading: WaterQualityReading) => void;
  private onStatsUpdated?: (stats: WaterQualityStats) => void;
  private lastConnectionWarningAt = 0;
  private actuatorRedeliveryInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MQTTConfig>) {
    this.config = {
      brokerUrl: config?.brokerUrl || appConfig.mqtt.brokerUrl,
      username: config?.username || appConfig.mqtt.username,
      password: config?.password || appConfig.mqtt.password,
      caCertificate: config?.caCertificate || appConfig.mqtt.caCertificate,
      deviceScopedTopics: config?.deviceScopedTopics ?? appConfig.mqtt.deviceScopedTopics,
      topicNamespace: config?.topicNamespace ?? appConfig.mqtt.topicNamespace,
      actuatorCommandsEnabled: config?.actuatorCommandsEnabled ?? appConfig.mqtt.actuatorCommandsEnabled,
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
    // MQTT.js owns automatic reconnects; repeated calls reuse its client.
    if (this.client) return;

    try {
      const options: mqtt.IClientOptions = {
        clientId: this.config.clientId,
        clean: true,
        reconnectPeriod: 5000,
        username: this.config.username,
        password: this.config.password,
        rejectUnauthorized: true,
        ...(this.config.caCertificate ? { ca: this.config.caCertificate } : {}),
      };

      const broker = new URL(this.config.brokerUrl);
      if (broker.username || broker.password) {
        throw new Error('MQTT credentials must be supplied separately from the broker URL');
      }
      if (Boolean(this.config.username) !== Boolean(this.config.password)) {
        throw new Error('MQTT username and password must be configured together');
      }
      logger.info(`Connecting to MQTT Broker: ${safeBrokerUrl(this.config.brokerUrl)}`);
      this.client = mqtt.connect(this.config.brokerUrl, options);

      // Connection established
      this.client.on('connect', () => {
        const generation = ++this.subscriptionGeneration;
        this.isConnected = true;
        this.activeSubscribedTopics = [];
        logger.info('âœ“ MQTT Connected successfully');
        this.subscribe(generation);
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
        this.activeSubscribedTopics = [];
        this.subscriptionGeneration++;
        this.telemetryByDevice.clear();
        this.latestLegacyDeviceId = 'mqtt-device';
        this.logConnectionWarning('MQTT broker sent a disconnect packet');
      });

      this.client.on('offline', () => {
        this.isConnected = false;
        this.activeSubscribedTopics = [];
        this.subscriptionGeneration++;
        this.telemetryByDevice.clear();
        this.latestLegacyDeviceId = 'mqtt-device';
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.activeSubscribedTopics = [];
        this.subscriptionGeneration++;
        this.telemetryByDevice.clear();
        this.latestLegacyDeviceId = 'mqtt-device';
        this.logConnectionWarning('MQTT transport closed before or after connection');
      });

      // MQTT is optional for local development; REST sensor ingestion remains online
      // even when the public broker is unreachable.
      this.client.on('error', (error: Error) => {
        this.logConnectionWarning('MQTT broker connection error', {
          errorName: error.name,
          errorCode: (error as NodeJS.ErrnoException).code,
          message: error.message || 'Connection failed',
        });
      });

      // Reconnection attempt
      this.client.on('reconnect', () => {
        this.logConnectionWarning('MQTT attempting to reconnect');
      });
    } catch (error) {
      logger.error('Failed to initialize MQTT connection:', error);
      throw error;
    }
  }

  private logConnectionWarning(message: string, details: Record<string, unknown> = {}): void {
    const now = Date.now();
    if (now - this.lastConnectionWarningAt <= 30000) return;
    this.lastConnectionWarningAt = now;
    logger.warn(message, { brokerUrl: safeBrokerUrl(this.config.brokerUrl), ...details });
  }

  /**
   * Subscribe to topics
   */
  private subscribe(generation: number): void {
    const client = this.client;
    if (!client) return;

    try {
      const subscriptions = this.config.deviceScopedTopics
        ? [`${this.config.topicNamespace}/+/telemetry/+`, `${this.config.topicNamespace}/+/state`]
        : [this.config.topics.readings, this.config.topics.sensorWildcard, this.config.topics.commands, `${this.config.topicNamespace}/+/state`];
      client.subscribe(subscriptions, (err, granted) => {
        if (this.client !== client || !this.isConnected || generation !== this.subscriptionGeneration) return;
        if (err) {
          this.activeSubscribedTopics = [];
          this.logConnectionWarning('MQTT subscription error', {
            errorName: err.name,
            errorCode: (err as NodeJS.ErrnoException).code,
          });
        } else {
          // SUBACK QoS 128 means the broker denied the topic filter.
          this.activeSubscribedTopics = (granted ?? [])
            .filter((grant) => subscriptions.includes(grant.topic) && grant.qos !== 128)
            .map((grant) => grant.topic);
          if (this.activeSubscribedTopics.length === subscriptions.length) {
            logger.info('MQTT subscriptions restored');
          } else {
            this.logConnectionWarning('MQTT broker denied one or more subscriptions', {
              acceptedCount: this.activeSubscribedTopics.length,
              requestedCount: subscriptions.length,
            });
          }
        }
      });
    } catch (error) {
      this.activeSubscribedTopics = [];
      this.logConnectionWarning('Failed to subscribe to MQTT topics', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  /**
   * Handle incoming MQTT messages
   */
  private handleMessage(topic: string, payload: Buffer): void {
    try {
      const message = payload.toString();
      logger.debug(`[MQTT] Received on ${topic}: ${message.substring(0, 100)}`);

      if (!this.config.deviceScopedTopics && topic === this.config.topics.readings) {
        this.handleSensorReading(message);
      } else if (new RegExp(`^${this.config.topicNamespace}/[^/]+/state$`).test(topic)) {
        void this.handleActuatorAck(topic, message);
      } else if (this.config.deviceScopedTopics) {
        this.handleScopedTelemetryTopic(topic, message);
      } else if (this.isAquasenseSensorTopic(topic)) {
        this.handleAquasenseTopicValue(topic, message);
      } else if (topic.startsWith(`${this.config.topics.commands.replace(/#$/, '')}`)) {
        this.handleCommand(topic, message);
      }
    } catch (error) {
      logger.error(`Error processing MQTT message from ${topic}:`, error);
    }
  }

  /** Publish one non-retained, signed actuator command. Publishing means queued, never confirmed. */
  async dispatchHardwareCommand(input: { id: string; deviceId: string; source: 'hardware' | 'feeding'; action: string; durationMs?: number; expiresAt: Date }): Promise<boolean> {
    if (!this.config.actuatorCommandsEnabled) return false;
    if (!this.client || !this.isConnected) return false;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(input.deviceId)) return false;
    const key = Object.prototype.hasOwnProperty.call(appConfig.device.keys, input.deviceId) ? appConfig.device.keys[input.deviceId] : undefined;
    if (!key) return false;
    const unsigned = { v: 1 as const, deviceId: input.deviceId, id: input.id, source: input.source,
      action: input.action, durationMs: input.durationMs ?? 0, expiresAt: input.expiresAt.getTime() };
    const payload = JSON.stringify({ ...unsigned, signature: signCanonical(commandCanonical(unsigned), key) });
    return new Promise((resolve) => this.client!.publish(`${this.config.topicNamespace}/${input.deviceId}/command`, payload,
      { qos: 1, retain: false }, error => {
        if (error) { logger.warn('Actuator MQTT publish failed', { deviceId: input.deviceId, commandId: input.id, error: error.message }); resolve(false); }
        else resolve(true);
      }));
  }

  private async redeliverPendingActuatorCommands(): Promise<void> {
    if (!this.client || !this.isConnected || !this.config.actuatorCommandsEnabled) return;
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
    if (!ack || ack.deviceId !== topicDeviceId || !/^[A-Za-z0-9_-]{1,64}$/.test(topicDeviceId)) { logger.warn('Rejected malformed actuator state/ack', { topic }); return; }
    const key = Object.prototype.hasOwnProperty.call(appConfig.device.keys, ack.deviceId) ? appConfig.device.keys[ack.deviceId] : undefined;
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
  private async handleSensorReading(payload: string, topicDeviceId?: string): Promise<void> {
    try {
      const data = JSON.parse(payload);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      // JSON telemetry has no signed publisher identity. It is accepted only by
      // the legacy development contract; production uses ACL-scoped topic IDs.
      if (this.config.deviceScopedTopics && (!topicDeviceId || !Object.prototype.hasOwnProperty.call(appConfig.device.keys, topicDeviceId))) return;
      const deviceId = this.config.deviceScopedTopics
        ? topicDeviceId!
        : (typeof data.deviceId === 'string' ? data.deviceId : 'mqtt-device');
      if (this.config.deviceScopedTopics && !(await deviceService.getActiveDevice(deviceId))) {
        logger.warn('Rejected MQTT telemetry for an inactive or unregistered device', { deviceId, topicDeviceId });
        return;
      }
      const reading = await sensorReadingService.ingest(deviceId, { ...data, deviceId });
      logger.info('Persisted MQTT telemetry reading', {
        deviceId, readingId: reading.id,
        messageId: typeof data.messageId === 'string' ? data.messageId : undefined,
        bootId: typeof data.bootId === 'string' ? data.bootId : undefined,
        sequence: Number.isSafeInteger(data.sequence) ? data.sequence : undefined,
        acquiredAt: data.timestamp ?? data.ts ?? null,
        receivedAt: new Date().toISOString(),
      });
      this.onReadingReceived?.(reading);
      await waterAlertNotificationService.processReading({...reading, dissolvedOxygen:reading.do, dissolvedOxygenMeasured:reading.doMeasured}).catch(error=>logger.error('Post-ingestion notification failed', {deviceId, readingId:reading.id, error:String(error)}));
      const stats = await sensorReadingService.getStatistics(60);
      this.onStatsUpdated?.({...stats,timestamp:new Date()});
    } catch (error) {
      logger.warn('MQTT sensor payload parsing or ingestion failed', {
        deviceId: topicDeviceId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message.slice(0, 240) : undefined,
      });
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
   * In migration mode the topic is the device identity. The legacy flat
   * contract remains development-only and isolates its claimed IDs in memory.
   */
  private handleScopedTelemetryTopic(topic: string, payload: string): void {
    const namespace = this.config.topicNamespace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`^${namespace}/([A-Za-z0-9_-]{1,64})/telemetry/(frame|temperature|ph|turbidity|turbidity-ntu|orp|do|dissolved-oxygen|ammonia|nh3)(?:/status)?$`).exec(topic);
    if (!match || topic.endsWith('/status')) return;
    const [, deviceId, suffix] = match;
    if (!Object.prototype.hasOwnProperty.call(appConfig.device.keys, deviceId)) return;
    if (suffix === 'frame') {
      let frame: any;
      try { frame = JSON.parse(payload); } catch { return; }
      const validFrame = frame && typeof frame === 'object' && !Array.isArray(frame) && frame.v === 1 &&
        frame.deviceId === deviceId && typeof frame.bootId === 'string' && /^[a-fA-F0-9]{16}$/.test(frame.bootId) &&
        Number.isSafeInteger(frame.sequence) && frame.sequence >= 0 &&
        ['temperature', 'ph', 'turbidity', 'orp'].every(name => frame[name] === null || (typeof frame[name] === 'number' && Number.isFinite(frame[name]))) &&
        typeof frame.messageId === 'string' && frame.messageId === `${frame.bootId}-${frame.sequence}`;
      if (!validFrame) { logger.warn('Rejected malformed device telemetry frame', { topic, deviceId }); return; }
      const sensors = frame.sensors;
      const provisionalFields = ['temperature', 'ph', 'turbidity', 'orp'].some(name =>
        sensors && typeof sensors === 'object' && !Array.isArray(sensors) &&
        sensors[name] && typeof sensors[name] === 'object' && Object.prototype.hasOwnProperty.call(sensors[name], 'provisional'));
      if (provisionalFields) {
        if (!this.isPublicDevelopmentTelemetryProfile()) {
          logger.warn('Rejected provisional diagnostics outside the public development MQTT profile', { deviceId });
          return;
        }
        try {
          if (sensors?.temperature && typeof sensors.temperature === 'object' && !Array.isArray(sensors.temperature) &&
              Object.prototype.hasOwnProperty.call(sensors.temperature, 'provisional')) throw new Error('Temperature cannot have a provisional diagnostic');
          for (const [name, unit] of [['ph', 'pH'], ['turbidity', 'NTU'], ['orp', 'mV']] as const) {
            const diagnostic = sensors?.[name];
            if (diagnostic && typeof diagnostic === 'object' && !Array.isArray(diagnostic) &&
                Object.prototype.hasOwnProperty.call(diagnostic, 'provisional')) {
              parseProvisionalSensorValue(diagnostic.provisional, unit);
            }
          }
        } catch {
          logger.warn('Rejected malformed provisional sensor diagnostic', { deviceId });
          return;
        }
      }
      const assembly = this.telemetryAssembly(deviceId);
      if (assembly) assembly.frameMode = true;
      const sensorDiagnostics = Object.fromEntries(['temperature', 'ph', 'turbidity', 'orp'].map((name) => {
        const diagnostic = sensors?.[name];
        return [name, diagnostic && typeof diagnostic === 'object' && !Array.isArray(diagnostic) ? {
          connected: typeof diagnostic.connected === 'boolean' ? diagnostic.connected : undefined,
          valid: typeof diagnostic.valid === 'boolean' ? diagnostic.valid : undefined,
          rawAdc: Number.isFinite(diagnostic.rawAdc) ? diagnostic.rawAdc : undefined,
          provisional: diagnostic.provisional && typeof diagnostic.provisional === 'object' ? {
            value: Number.isFinite(diagnostic.provisional.value) ? diagnostic.provisional.value : undefined,
            unit: typeof diagnostic.provisional.unit === 'string' ? diagnostic.provisional.unit : undefined,
            status: typeof diagnostic.provisional.status === 'string' ? diagnostic.provisional.status : undefined,
          } : undefined,
        } : undefined];
      }));
      logger.info('Received MQTT telemetry frame', {
        topic, deviceId, bootId: frame.bootId, sequence: frame.sequence, messageId: frame.messageId,
        deviceTimestamp: frame.timestamp ?? frame.ts ?? null, receivedAt: new Date().toISOString(), sensorDiagnostics,
      });
      void this.handleSensorReading(payload, deviceId);
      return;
    }
    const assembly = this.telemetryByDevice.get(deviceId);
    if (assembly?.frameMode) return;
    this.handleTelemetryValue(deviceId, suffix, payload);
  }

  private isPublicDevelopmentTelemetryProfile(): boolean {
    return isPublicDevelopmentTelemetryProfile(this.config, appConfig.server.nodeEnv);
  }

  private handleAquasenseTopicValue(topic: string, payload: string): void {
    const namespace = this.config.topicNamespace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`^${namespace}/(device-id|temperature|ph|turbidity|turbidity-ntu|orp|do|dissolved-oxygen|ammonia|nh3)$`).exec(topic);
    if (!match) return;
    const topicSuffix = match[1];
    if (topicSuffix === 'device-id') {
      const claimedId = payload.trim();
      if (/^[A-Za-z0-9_-]{1,64}$/.test(claimedId)) this.latestLegacyDeviceId = claimedId;
      return;
    }
    this.handleTelemetryValue(this.latestLegacyDeviceId, topicSuffix, payload);
  }

  private telemetryAssembly(deviceId: string): TelemetryAssembly | undefined {
    let assembly = this.telemetryByDevice.get(deviceId);
    if (assembly) return assembly;
    // Hard cap protects development legacy mode from arbitrary claimed IDs.
    if (this.telemetryByDevice.size >= 256) this.telemetryByDevice.delete(this.telemetryByDevice.keys().next().value!);
    assembly = newTelemetryAssembly();
    this.telemetryByDevice.set(deviceId, assembly);
    return assembly;
  }

  private handleTelemetryValue(deviceId: string, topicSuffix: string, payload: string): void {
    const assembly = this.telemetryAssembly(deviceId);
    if (!assembly) return;
    const parsed = numeric(payload);
    const value = parsed;

    assembly.sensorTimestamps[topicSuffix] = new Date().toISOString();
    switch (topicSuffix) {
      case 'temperature':
        assembly.latestSensorPayload.temperature = value ?? undefined;
        assembly.pendingBatchFlags.temperature = true;
        break;
      case 'ph':
        assembly.latestSensorPayload.ph = value ?? undefined;
        assembly.pendingBatchFlags.ph = true;
        break;
      case 'turbidity': {
        if (value === null) {
          assembly.latestRawTurbidity = null;
          assembly.latestSensorPayload.turbidity = undefined;
          assembly.pendingBatchFlags.turbidity = false;
          break;
        }
        assembly.latestRawTurbidity = value;
        // The firmware publishes raw ADC and reported NTU separately. Keep ADC
        // as diagnostic metadata when an NTU sample is also arriving; it must
        // not replace that sample or create a second mixed-unit frame.
        const ntuAt = Date.parse(assembly.sensorTimestamps['turbidity-ntu'] ?? '');
        if (!Number.isFinite(ntuAt) || Date.now() - ntuAt > 15000) {
          assembly.latestSensorPayload.turbidity = value;
          assembly.latestTurbidityUnit = 'raw_adc';
          assembly.pendingBatchFlags.turbidity = true;
        }
        break;
      }
      case 'turbidity-ntu':
        assembly.latestSensorPayload.turbidity = value ?? undefined;
        assembly.latestTurbidityUnit = 'NTU';
        assembly.pendingBatchFlags.turbidity = true;
        break;
      case 'orp':
        assembly.latestSensorPayload.orp = value;
        assembly.latestOrpReceivedAt = Date.now();
        break;
      case 'do':
      case 'dissolved-oxygen':
        assembly.latestSensorPayload.do = value;
        assembly.latestDoReceivedAt = Date.now();
        break;
      case 'ammonia':
      case 'nh3':
        assembly.latestSensorPayload.ammonia = value;
        break;
      default:
        logger.debug(`[MQTT] Unsupported aquasense topic suffix: ${topicSuffix}`);
        return;
    }

    const requiredTimestamps = ['temperature', 'ph', assembly.latestTurbidityUnit === 'NTU' ? 'turbidity-ntu' : 'turbidity'];
    const frameFresh = requiredTimestamps.every(name => {
      const at = Date.parse(assembly.sensorTimestamps[name] ?? '');
      return Number.isFinite(at) && Date.now() - at <= 15000;
    });
    if (
      (assembly.pendingBatchFlags.temperature &&
      assembly.pendingBatchFlags.ph &&
      assembly.pendingBatchFlags.turbidity &&
      frameFresh &&
      assembly.latestSensorPayload.temperature !== undefined &&
      assembly.latestSensorPayload.ph !== undefined &&
      assembly.latestSensorPayload.turbidity !== undefined)
    ) {
      const normalizedPayload = {
        deviceId,
        temperature: assembly.latestSensorPayload.temperature,
        ph: assembly.latestSensorPayload.ph,
        do: Date.now() - assembly.latestDoReceivedAt <= 15000 ? assembly.latestSensorPayload.do : undefined,
        turbidity: assembly.latestSensorPayload.turbidity,
        turbidityUnit: assembly.latestTurbidityUnit,
        sensors: assembly.latestTurbidityUnit === 'NTU' && assembly.latestRawTurbidity !== null && Date.now() - Date.parse(assembly.sensorTimestamps.turbidity ?? '') <= 15000
          ? { turbidity: { rawAdc: assembly.latestRawTurbidity } }
          : undefined,
        orp: Date.now() - assembly.latestOrpReceivedAt <= 15000 ? assembly.latestSensorPayload.orp ?? null : null,
        sensorTimestamps: {
          ...assembly.sensorTimestamps,
          turbidity: assembly.sensorTimestamps[assembly.latestTurbidityUnit === 'NTU' ? 'turbidity-ntu' : 'turbidity'],
        },
        location: 'ESP32-MQTT',
        timestamp: new Date().toISOString(),
      };

      assembly.pendingBatchFlags = {
        temperature: false,
        ph: false,
        turbidity: false,
      };
      assembly.latestSensorPayload.temperature = undefined;
      assembly.latestSensorPayload.ph = undefined;
      assembly.latestSensorPayload.turbidity = undefined;

      void this.handleSensorReading(JSON.stringify(normalizedPayload), this.config.deviceScopedTopics ? deviceId : undefined);
    }
  }

  private isAquasenseSensorTopic(topic: string): boolean {
    const namespace = this.config.topicNamespace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${namespace}/(device-id|temperature|ph|turbidity|turbidity-ntu|orp|do|dissolved-oxygen|ammonia|nh3)$`).test(topic);
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

    // The configured Mosquitto listener has retain_available=false.
    this.client.publish(this.config.topics.status, message, { qos: 1, retain: false }, (err) => {
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
      const client = this.client;
      if (!client) {
        resolve();
        return;
      }

      this.activeSubscribedTopics = [];
      this.subscriptionGeneration++;
      this.publishStatus('offline');
      client.end(false, () => {
        this.isConnected = false;
        if (this.client === client) this.client = null;
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
      brokerUrl: safeBrokerUrl(this.config.brokerUrl),
      subscribedTopics: [...this.activeSubscribedTopics],
    };
  }
}

// Export singleton instance
export const mqttService = new MQTTService();
