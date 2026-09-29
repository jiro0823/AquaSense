import { Op } from 'sequelize';
import { HardwareCommand, HardwareDeviceState } from '../database/models/HardwareControl';
import { FeedingCommand } from '../database/models/FeedingCommand';
import { feedingService } from './feedingService';
import { COMMAND_TTL_MS, DEVICE_ONLINE_MS, type HardwareAction, type HardwareState, type CommandReceipt } from './hardwareProtocol';
import { withHardwareDeviceLock, DeviceStopPendingError } from './hardwareControlLock';
import type { Transaction } from 'sequelize';

const WATER_START_ACTIONS: HardwareAction[] = ['FILL', 'DRAIN', 'WATER_EXCHANGE', 'AUTOMATION_ON'];
const ALL_START_ACTIONS: HardwareAction[] = [...WATER_START_ACTIONS, 'AERATOR_ON', 'AERATOR_AUTO', 'BUZZER_ON'];

const acknowledgeInTransaction = async (userId: string, deviceId: string, receipt: CommandReceipt,
  transaction: Transaction): Promise<boolean> => {
  if (receipt.source === 'feeding') {
    const command = await FeedingCommand.findOne({ where: { id: receipt.id, userId, deviceId }, transaction });
    if (!command) return false;
    if (command.status === 'ACKED') return true;
    command.status = 'ACKED';
    command.executedAt = new Date();
    command.metadata = { ...(command.metadata || {}), deviceResult: receipt.result };
    await command.save({ transaction });
    return true;
  }
  const command = await HardwareCommand.findOne({ where: { id: receipt.id, userId, deviceId }, transaction });
  if (!command) return false;
  if (command.status !== 'PENDING') return true;
  await command.update({ status: 'ACKED', result: receipt.result }, { transaction });
  return true;
};

export const hardwareService = {
  async queue(userId: string, deviceId: string, action: HardwareAction, durationMs?: number) {
    const stopping = action === 'ALL_OFF' || action === 'WATER_STOP';
    return withHardwareDeviceLock(userId, deviceId, async (transaction) => {
      if (!stopping && ALL_START_ACTIONS.includes(action)) {
        const blockingStops: HardwareAction[] = WATER_START_ACTIONS.includes(action) ? ['WATER_STOP', 'ALL_OFF'] : ['ALL_OFF'];
        const pendingStop = await HardwareCommand.findOne({
          where: { userId, deviceId, status: 'PENDING', action: { [Op.in]: blockingStops } }, transaction,
        });
        if (pendingStop) throw new DeviceStopPendingError();
      }
      if (!stopping && await HardwareCommand.count({ where: {
        userId, deviceId, status: 'PENDING', expiresAt: { [Op.gt]: new Date() },
      }, transaction }) >= 20) throw new Error('Device command queue is full');

      // Cancellation, stop persistence, and polling all share this transaction lock.
      if (stopping) {
        const cancelledActions = action === 'WATER_STOP' ? WATER_START_ACTIONS : undefined;
        await HardwareCommand.update({ status: 'EXPIRED', result: 'cancelled_by_stop' }, {
          where: { userId, deviceId, status: 'PENDING', ...(cancelledActions ? { action: { [Op.in]: cancelledActions } } : {}) }, transaction,
        });
        if (action === 'ALL_OFF') {
          await FeedingCommand.update({ status: 'ACKED', metadata: { deviceResult: 'cancelled_by_stop' } }, {
            where: { userId, deviceId, status: 'PENDING' }, transaction,
          });
        }
      }
      return HardwareCommand.create({ userId, deviceId, action, durationMs: durationMs ?? null,
        expiresAt: new Date(Date.now() + COMMAND_TTL_MS) }, { transaction });
    });
  },

  async acknowledge(userId: string, deviceId: string, receipt: CommandReceipt): Promise<boolean> {
    return withHardwareDeviceLock(userId, deviceId, transaction => acknowledgeInTransaction(userId, deviceId, receipt, transaction));
  },

  async sync(userId: string, deviceId: string, state: HardwareState, receipt?: CommandReceipt) {
    return withHardwareDeviceLock(userId, deviceId, async (transaction) => {
      if (receipt && !(await acknowledgeInTransaction(userId, deviceId, receipt, transaction))) throw new Error('Unknown command receipt');
      await HardwareDeviceState.upsert({ deviceId, state, receivedAt: new Date() }, { transaction });
      await HardwareCommand.update({ status: 'EXPIRED', result: 'expired_before_delivery' }, {
        where: { userId, deviceId, status: 'PENDING', expiresAt: { [Op.lte]: new Date() } }, transaction,
      });
      // Old feeder commands must not dispense food unexpectedly after a long outage.
      await FeedingCommand.update({ status: 'ACKED', metadata: { deviceResult: 'expired_before_delivery' } }, {
        where: { userId, deviceId, status: 'PENDING', createdAt: { [Op.lt]: new Date(Date.now() - COMMAND_TTL_MS) } }, transaction,
      });
      const [hardware, feeding, schedules] = await Promise.all([
        HardwareCommand.findOne({ where: { userId, deviceId, status: 'PENDING' }, order: [['createdAt', 'ASC']], transaction }),
        FeedingCommand.findOne({ where: { userId, deviceId, status: 'PENDING' }, order: [['createdAt', 'ASC']], transaction }),
        feedingService.listSchedules(userId),
      ]);
      const command = hardware ? { id: hardware.id, source: 'hardware', action: hardware.action,
        durationMs: hardware.durationMs ?? 0, ttlMs: Math.max(0, hardware.expiresAt.getTime() - Date.now()) }
        : feeding ? { id: feeding.id, source: 'feeding', action: feeding.action, durationMs: 0,
          ttlMs: Math.max(0, feeding.createdAt.getTime() + COMMAND_TTL_MS - Date.now()) } : null;
      return { command, schedules: schedules.filter(s => s.enabled).slice(0, 20).map(s => ({ id: s.id, date: s.date, time: s.time })),
        timezone: 'Asia/Manila', serverTimeIso: new Date().toISOString() };
    });
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
