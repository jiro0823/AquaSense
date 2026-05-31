import axios from 'axios';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export interface SmsSendResult {
  success: boolean;
  response: string;
  retryCount: number;
}

export const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

const maskPhone = (phone: string): string => {
  if (phone.length <= 6) {
    return '***';
  }
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
};

export const isValidSmsRecipient = (recipient: string): boolean => E164_PHONE_REGEX.test(recipient.trim());

export const validateSmsMessage = (message: string): { valid: boolean; reason?: string } => {
  const normalized = message.trim();
  if (!normalized) {
    return { valid: false, reason: 'Message cannot be empty' };
  }
  if (normalized.length > config.sms.maxMessageLength) {
    return { valid: false, reason: `Message exceeds ${config.sms.maxMessageLength} characters` };
  }
  return { valid: true };
};

class SmsService {
  private readonly endpoint = 'https://unismsapi.com/api/sms';
  private readonly maxRetries = 3;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  private isCircuitOpen(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  private tripCircuit(): void {
    this.circuitOpenUntil = Date.now() + config.sms.circuitCooldownMs;
    logger.warn('SMS circuit breaker opened', { cooldownMs: config.sms.circuitCooldownMs });
  }

  private resetCircuit(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
  }

  private async delayWithBackoff(retryCount: number): Promise<void> {
    const baseMs = 300;
    const exponential = baseMs * 2 ** Math.max(0, retryCount - 1);
    const jitter = Math.floor(Math.random() * 120);
    await new Promise((resolve) => setTimeout(resolve, exponential + jitter));
  }

  async sendSms(recipient: string, message: string): Promise<SmsSendResult> {
    const maskedRecipient = maskPhone(recipient);

    if (this.isCircuitOpen()) {
      return {
        success: false,
        response: 'SMS provider temporarily unavailable (circuit breaker open)',
        retryCount: 0,
      };
    }

    if (!isValidSmsRecipient(recipient)) {
      return {
        success: false,
        response: 'Invalid phone number format. Use E.164 format (e.g. +639171234567)',
        retryCount: 0,
      };
    }

    const messageValidation = validateSmsMessage(message);
    if (!messageValidation.valid) {
      return {
        success: false,
        response: messageValidation.reason || 'Invalid SMS message',
        retryCount: 0,
      };
    }

    let retryCount = 0;
    let lastError = '';

    while (retryCount < this.maxRetries) {
      try {
        const body: Record<string, string> = {
          recipient: recipient.trim(),
          content: message.trim(),
        };

        // UniSMS rejects unapproved sender IDs. Leave this unset unless the
        // account has an approved sender_id from the provider dashboard.
        if (config.sms.senderId && config.sms.senderId !== 'AquaSense') {
          body.sender_id = config.sms.senderId;
        }

        const response = await axios.post(this.endpoint, body, {
          auth: {
            username: config.sms.apiSecretKey!,
            password: '',
          },
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        this.resetCircuit();
        logger.info('UniSMS sent', { recipient: maskedRecipient, status: response.status });
        return {
          success: true,
          response: JSON.stringify(response.data),
          retryCount,
        };
      } catch (error) {
        retryCount += 1;

        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const responseData = error.response?.data;
          lastError = JSON.stringify({ status, response: responseData ?? error.message });
        } else {
          lastError = error instanceof Error ? error.message : 'Unknown SMS error';
        }

        logger.warn('UniSMS send failed, retrying', { recipient: maskedRecipient, retryCount, error: lastError });

        if (retryCount < this.maxRetries) {
          await this.delayWithBackoff(retryCount);
        }
      }
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= config.sms.failureThreshold) {
      this.tripCircuit();
      this.consecutiveFailures = 0;
    }

    logger.error('UniSMS send failed after retries', { recipient: maskedRecipient, error: lastError });
    return {
      success: false,
      response: lastError,
      retryCount,
    };
  }
}

export const smsService = new SmsService();
