import { Op } from 'sequelize';
import { HardwareCommand, HardwareDeviceState } from '../database/models/HardwareControl';
import { FeedingCommand } from '../database/models/FeedingCommand';
import { feedingService } from './feedingService';
import { COMMAND_TTL_MS, DEVICE_ONLINE_MS, type HardwareAction, type HardwareState, type CommandReceipt, type SignedHardwareAck } from './hardwareProtocol';

export const hardwareService = {
  async queue(userId: string, deviceId: string, action: HardwareAction, durationMs?: number) {
    const stopping = action === 'ALL_OFF' || action === 'WATER_STOP';
    if (!stopping && await HardwareCommand.count({ where: { userId, deviceId, status: 'PENDING', expiresAt: { [Op.gt]: new Date() } } }) >= 20) {
      throw new Error('Device command queue is full');
    }
    // A stop cancels waiting starts so they cannot unexpectedly execute afterwards.
    if (stopping) {
      await HardwareCommand.update({ status: 'EXPIRED', result: 'cancelled_by_stop' }, {
        where: { userId, deviceId, status: 'PENDING' },
      });
    }
    if (action === 'ALL_OFF') {
      await FeedingCommand.update({ status: 'ACKED', metadata: { deviceResult: 'cancelled_by_stop' } }, {
        where: { userId, deviceId, status: 'PENDING' },
      });
    }
    return HardwareCommand.create({ userId, deviceId, action, durationMs: durationMs ?? null,
      expiresAt: new Date(Date.now() + COMMAND_TTL_MS) });
  },

  async acknowledge(userId: string, deviceId: string, receipt: CommandReceipt): Promise<boolean> {
    if (receipt.source === 'feeding') {
      const command = await FeedingCommand.findOne({ where: { id: receipt.id, userId, deviceId } });
      if (!command) return false;
      if (command.status === 'ACKED') return true;
      return feedingService.ackCommand(userId, deviceId, receipt.id, { deviceResult: receipt.result });
    }
    const command = await HardwareCommand.findOne({ where: { id: receipt.id, userId, deviceId } });
    if (!command) return false;
    // Duplicate receipts are harmless, including receipts racing a cancellation.
    if (command.status !== 'PENDING') return true;
    await command.update({ status: 'ACKED', result: receipt.result });
    return true;
  },

  async sync(userId: string, deviceId: string, state: HardwareState, receipt?: CommandReceipt) {
    // Device-key authenticated sync is a heartbeat/state report only. It cannot
    // acknowledge user commands or retrieve one-shot commands.
    void receipt;
    await HardwareDeviceState.upsert({ deviceId, state, receivedAt: new Date() });
    const schedules = await feedingService.listSchedules(userId);
    return { command: null, schedules: schedules.filter(s => s.enabled).slice(0, 20).map(s => ({ id: s.id, date: s.date, time: s.time })),
      timezone: 'Asia/Manila', serverTimeIso: new Date().toISOString() };
  },

  async expirePendingCommands(): Promise<void> {
    const now = new Date();
    await HardwareCommand.update({ status: 'EXPIRED', result: 'expired_before_delivery' },
      { where: { status: 'PENDING', expiresAt: { [Op.lte]: now } } });
    await FeedingCommand.update({ status: 'ACKED', metadata: { deviceResult: 'expired_before_delivery' } },
      { where: { status: 'PENDING', source: 'MANUAL', createdAt: { [Op.lt]: new Date(now.getTime() - COMMAND_TTL_MS) } } });
  },

  async acceptMqttAck(userId: string, ack: SignedHardwareAck): Promise<boolean> {
    const { signature: _signature, v: _version, reportedAt, id, source, action, result, deviceId, state } = ack;
    if (source === 'hardware') {
      const command = await HardwareCommand.findOne({ where: { id, userId, deviceId } });
      if (!command || command.action !== action) return false;
      if (command.status === 'PENDING') await command.update({ status: 'ACKED', result });
    } else {
      const command = await FeedingCommand.findOne({ where: { id, userId, deviceId } });
      if (!command || command.action !== action || command.source !== 'MANUAL') return false;
      if (command.status === 'PENDING') await feedingService.ackCommand(userId, deviceId, id,
        { deviceResult: result, reportedAt: new Date(reportedAt).toISOString() });
    }
    await HardwareDeviceState.upsert({ deviceId, state, receivedAt: new Date(reportedAt) });
    return true;
  },

  async getState(userId: string, deviceId: string) {
    const [reported, commands] = await Promise.all([
      HardwareDeviceState.findByPk(deviceId),
      HardwareCommand.findAll({ where: { userId, deviceId }, order: [['createdAt', 'DESC']], limit: 20 }),
    ]);
    return { deviceId, online: !!reported && Date.now() - reported.receivedAt.getTime() <= DEVICE_ONLINE_MS,
      receivedAt: reported?.receivedAt ?? null, state: reported?.state ?? null, commands };
  },
};
