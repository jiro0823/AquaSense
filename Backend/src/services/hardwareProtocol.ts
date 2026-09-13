import { z } from 'zod';

export const hardwareActions = ['FILL', 'DRAIN', 'WATER_EXCHANGE', 'WATER_STOP', 'AERATOR_ON',
  'AERATOR_OFF', 'AERATOR_AUTO', 'AUTOMATION_ON', 'AUTOMATION_OFF', 'BUZZER_ON',
  'BUZZER_OFF', 'ALL_OFF', 'CLEAR_FAULT'] as const;
export type HardwareAction = typeof hardwareActions[number];
export const COMMAND_TTL_MS = 120_000;
export const DEVICE_ONLINE_MS = 20_000;
const deviceId = z.string().trim().min(1).max(120);
export const hardwareCommandSchema = z.object({
  deviceId,
  action: z.enum(hardwareActions),
  durationMs: z.number().int().min(1).max(300_000).optional(),
}).strict().superRefine((value, context) => {
  const pump = ['FILL', 'DRAIN', 'WATER_EXCHANGE'].includes(value.action);
  if (pump !== (value.durationMs !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'durationMs is required only for pump commands (per phase for an exchange)' });
  }
});
export const hardwareStateSchema = z.object({
  fillPump: z.boolean(), drainPump: z.boolean(), aerator: z.boolean(),
  feederBusy: z.boolean(), buzzer: z.boolean(), automation: z.boolean(),
  waterPhase: z.enum(['IDLE', 'DRAINING', 'REFILLING', 'COMPLETE', 'FAULT']),
  fault: z.string().max(64), relaysReady: z.boolean(), timeValid: z.boolean(),
  wifiConnected: z.boolean(), mqttConnected: z.boolean(),
  uptimeMs: z.number().int().min(0).max(0xffffffff),
}).strict();
export const receiptSchema = z.object({
  id: z.string().uuid(), source: z.enum(['hardware', 'feeding']),
  result: z.string().min(1).max(64),
}).strict();
export const hardwareSyncSchema = z.object({ deviceId, state: hardwareStateSchema, receipt: receiptSchema.optional() }).strict();
export type HardwareState = z.infer<typeof hardwareStateSchema>;
export type CommandReceipt = z.infer<typeof receiptSchema>;

