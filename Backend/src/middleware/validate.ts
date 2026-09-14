import { NextFunction, Request, Response } from 'express';
import { z, ZodSchema } from 'zod';
import { sendError } from '../utils/response';

export const validateBody = <T>(schema: ZodSchema<T>) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    sendError(res, 400, `Validation failed: ${result.error.issues.map((i) => i.message).join(', ')}`);
    return;
  }
  req.body = result.data;
  next();
};

export const feedingScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  enabled: z.boolean().optional(),
  label: z.string().trim().max(120).nullable().optional(),
});

export const feedingScheduleUpdateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  enabled: z.boolean().optional(),
  label: z.string().trim().max(120).nullable().optional(),
});

export const feedingManualSchema = z.object({
  action: z.enum(['ON', 'OFF', 'TRIGGER']),
  deviceId: z.string().trim().min(1).max(120).optional(),
});

<<<<<<< Updated upstream
export const sensorIngestSchema = z.object({
  deviceId: z.string().trim().min(1).max(120),
  temperature: z.coerce.number().finite(),
  ph: z.coerce.number().finite(),
  dissolvedOxygen: z.coerce.number().finite(),
  turbidity: z.coerce.number().finite(),
  ammonia: z.coerce.number().finite().optional(),
});

export const waterReadingSchema = z.object({
  orp: z.number().finite().nullable().optional(),
=======
// Keep malformed sensor fields intact for structured diagnostics; never coerce null to zero.
const diagnosticPayload = z.object({
>>>>>>> Stashed changes
  deviceId: z.string().trim().min(1).max(120).optional(),
  location: z.string().trim().max(255).optional(),
}).passthrough();
export const sensorIngestSchema = diagnosticPayload.extend({deviceId:z.string().trim().min(1).max(120)});
export const waterReadingSchema = diagnosticPayload;

export const registerDeviceSchema = z.object({
  deviceId: z.string().trim().min(3).max(120),
  name: z.string().trim().min(2).max(120).optional(),
});

export const smsTestSchema = z.object({
  recipient: z.string().trim().regex(/^\+[1-9]\d{7,14}$/).optional(),
  message: z.string().trim().min(1).max(160).optional(),
});
