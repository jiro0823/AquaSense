/**
 * SMS test controller
 */
import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../../utils/response';
import { isValidSmsRecipient, smsService, validateSmsMessage } from '../../../services/sms.service';
import { config } from '../../../config/config';
import { logger } from '../../../utils/logger';

export const sendTestSms = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body as { recipient?: string; message?: string };
    const recipient = payload.recipient || config.farm.recipientPhone;
    const message = payload.message || 'AquaSense test message';

    if (!recipient) {
      sendError(res, 400, 'Recipient phone number is required');
      return;
    }
    if (!isValidSmsRecipient(recipient)) {
      sendError(res, 400, 'Invalid phone number format. Use E.164 format (e.g. +639171234567)');
      return;
    }

    const messageValidation = validateSmsMessage(message);
    if (!messageValidation.valid) {
      sendError(res, 400, messageValidation.reason || 'Invalid SMS message');
      return;
    }

    const result = await smsService.sendSms(recipient, message);

    sendSuccess(res, 200, 'SMS test sent', {
      success: result.success,
      retryCount: result.retryCount,
      providerResponse: result.response,
    });
  } catch (error) {
    logger.error('Failed to send SMS test', error);
    sendError(res, 500, 'Failed to send SMS test');
  }
};
