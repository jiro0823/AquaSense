import { initializeUserModel } from './User';
import { initializeSensorReadingModel } from './SensorReading';
import { User } from './User';
import { SensorReading } from './SensorReading';

/**
 * Initialize all database models
 */
export const initializeAllModels = async (): Promise<void> => {
  try {
    initializeUserModel();
    initializeSensorReadingModel();
  } catch (error) {
    throw error;
  }
};

// Export models
export { User, initializeUserModel };
export { SensorReading, initializeSensorReadingModel };
