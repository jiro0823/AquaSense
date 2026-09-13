import { Op } from 'sequelize';
import { HardwareCommand, HardwareDeviceState } from '../database/models/HardwareControl';
import { FeedingCommand } from '../database/models/FeedingCommand';
import { feedingService } from './feedingService';
import { COMMAND_TTL_MS, DEVICE_ONLINE_MS, type HardwareAction, type HardwareState, type CommandReceipt } from './hardwareProtocol';

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
    if (receipt && !(await this.acknowledge(userId, deviceId, receipt))) throw new Error('Unknown command receipt');
    await HardwareDeviceState.upsert({ deviceId, state, receivedAt: new Date() });
    await HardwareCommand.update({ status: 'EXPIRED', result: 'expired_before_delivery' }, {
      where: { userId, deviceId, status: 'PENDING', expiresAt: { [Op.lte]: new Date() } },
    });
    // Old feeder commands must not dispense food unexpectedly after a long outage.
    await FeedingCommand.update({ status: 'ACKED', metadata: { deviceResult: 'expired_before_delivery' } }, {
      where: { userId, deviceId, status: 'PENDING', createdAt: { [Op.lt]: new Date(Date.now() - COMMAND_TTL_MS) } },
    });
    const [hardware, feeding, schedules] = await Promise.all([
      HardwareCommand.findOne({ where: { userId, deviceId, status: 'PENDING' }, order: [['createdAt', 'ASC']] }),
      feedingService.getLatestDeviceCommand(userId, deviceId),
      feedingService.listSchedules(userId),
    ]);
    const command = hardware ? { id: hardware.id, source: 'hardware', action: hardware.action,
      durationMs: hardware.durationMs ?? 0, ttlMs: Math.max(0, hardware.expiresAt.getTime() - Date.now()) }
      : feeding ? { id: feeding.id, source: 'feeding', action: feeding.action, durationMs: 0,
        ttlMs: Math.max(0, feeding.createdAt.getTime() + COMMAND_TTL_MS - Date.now()) } : null;
    return { command, schedules: schedules.filter(s => s.enabled).slice(0, 20).map(s => ({ id: s.id, date: s.date, time: s.time })),
      timezone: 'Asia/Manila', serverTimeIso: new Date().toISOString() };
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
