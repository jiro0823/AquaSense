import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidSmsRecipient, validateSmsMessage } from './sms.service';
import { buildPredictiveSmsTemplate, buildSmsTemplate } from './smsTemplate.service';

test('accepts valid E.164 phone numbers', () => {
  assert.equal(isValidSmsRecipient('+639171234567'), true);
  assert.equal(isValidSmsRecipient('+14155552671'), true);
});

test('rejects invalid phone numbers', () => {
  assert.equal(isValidSmsRecipient('09171234567'), false);
  assert.equal(isValidSmsRecipient('+63-917-123-4567'), false);
  assert.equal(isValidSmsRecipient('+123'), false);
});

test('rejects empty messages', () => {
  const result = validateSmsMessage('   ');
  assert.equal(result.valid, false);
});

test('rejects messages over 160 characters', () => {
  const longMessage = 'A'.repeat(161);
  const result = validateSmsMessage(longMessage);
  assert.equal(result.valid, false);
});

test('accepts message with max 160 characters', () => {
  const message = 'A'.repeat(160);
  const result = validateSmsMessage(message);
  assert.equal(result.valid, true);
});

test('rule alert template fits SMS length limit', () => {
  const message = buildSmsTemplate({
    farmerName: 'Tessie',
    farmName: 'AquaSense Farm With A Long Name',
    tankName: 'FirstTank',
    severity: 'CRITICAL',
    problem: 'Dissolved oxygen critically low',
    value: 2.8,
    unit: 'mg/L',
    action: 'AERATOR_ON_IMMEDIATE',
  });

  assert.equal(message.length <= 160, true);
  assert.equal(validateSmsMessage(message).valid, true);
});

test('predictive alert template fits SMS length limit', () => {
  const message = buildPredictiveSmsTemplate({
    farmName: 'AquaSense Farm With A Long Name',
    tankName: 'FirstTank',
    riskLevel: 'CRITICAL',
    cause: 'low dissolved oxygen + elevated ammonia + DO trending down',
    etaMinutes: 12,
  });

  assert.equal(message.length <= 160, true);
  assert.equal(validateSmsMessage(message).valid, true);
});
