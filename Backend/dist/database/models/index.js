"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSensorReadingModel = exports.SensorReading = exports.initializeUserModel = exports.User = exports.initializeAllModels = void 0;
const User_1 = require("./User");
Object.defineProperty(exports, "initializeUserModel", { enumerable: true, get: function () { return User_1.initializeUserModel; } });
const SensorReading_1 = require("./SensorReading");
Object.defineProperty(exports, "initializeSensorReadingModel", { enumerable: true, get: function () { return SensorReading_1.initializeSensorReadingModel; } });
const User_2 = require("./User");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return User_2.User; } });
const SensorReading_2 = require("./SensorReading");
Object.defineProperty(exports, "SensorReading", { enumerable: true, get: function () { return SensorReading_2.SensorReading; } });
/**
 * Initialize all database models
 */
const initializeAllModels = async () => {
    try {
        (0, User_1.initializeUserModel)();
        (0, SensorReading_1.initializeSensorReadingModel)();
    }
    catch (error) {
        throw error;
    }
};
exports.initializeAllModels = initializeAllModels;
//# sourceMappingURL=index.js.map