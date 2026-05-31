import type { AlertSeverity } from './ruleEngine.service';

export interface SmsTemplateInput {
  farmerName: string;
  farmName: string;
  tankName: string;
  severity: AlertSeverity;
  problem: string;
  value: number;
  unit: string;
  action: string;
}

const prettyAction = (action: string): string => {
  switch (action) {
    case 'AERATOR_ON':
      return 'Turn aerator ON';
    case 'AERATOR_ON_IMMEDIATE':
      return 'Turn aerator ON now';
    case 'WATER_CHANGE':
      return 'Do water change';
    case 'WATER_REPLACEMENT':
      return 'Replace water soon';
    default:
      return action;
  }
};

const fitSms = (message: string): string => (message.length <= 160 ? message : `${message.slice(0, 157)}...`);

export const buildSmsTemplate = (input: SmsTemplateInput): string => {
  return fitSms(
    [
      `AquaSense ${input.severity}`,
      `${input.farmName}/${input.tankName}`,
      `${input.problem}: ${input.value} ${input.unit}`,
      prettyAction(input.action),
      'Inspect now.',
    ].join(' | ')
  );
};

export const buildCombinedAlertSmsTemplate = (input: {
  farmName: string;
  tankName: string;
  severity: AlertSeverity;
  problems: Array<{ message: string; value: number; unit: string }>;
  action: string;
}): string => {
  const problemText = input.problems
    .slice(0, 3)
    .map((problem) => `${problem.message}: ${problem.value} ${problem.unit}`)
    .join('; ');

  return fitSms(
    [
      `AquaSense ${input.severity}`,
      `${input.farmName}/${input.tankName}`,
      problemText,
      prettyAction(input.action),
      'Inspect now.',
    ].join(' | ')
  );
};

export const buildPredictiveSmsTemplate = (input: {
  farmName: string;
  tankName: string;
  riskLevel: 'HIGH' | 'CRITICAL';
  cause: string;
  etaMinutes: number | null;
}): string => {
  const eta = input.etaMinutes !== null ? `ETA ${input.etaMinutes}m` : 'Unsafe soon';

  return fitSms(
    [
      `AquaSense ${input.riskLevel} predictive warning`,
      `${input.farmName}/${input.tankName}`,
      input.cause,
      eta,
      'Inspect now.',
    ].join(' | ')
  );
};
