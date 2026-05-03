"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeUserModel = exports.User = void 0;
const sequelize_1 = require("sequelize");
const connection_1 = require("../connection");
/**
 * User model for AquaSense database
 */
class User extends sequelize_1.Model {
}
exports.User = User;
/**
 * Initialize User model
 */
const initializeUserModel = () => {
    const sequelize = (0, connection_1.getDatabase)();
    User.init({
        id: {
            type: sequelize_1.DataTypes.UUID,
            defaultValue: sequelize_1.DataTypes.UUIDV4,
            primaryKey: true,
        },
        fullName: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
        },
        email: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
            },
        },
        passwordHash: {
            type: sequelize_1.DataTypes.STRING(255),
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
    });
};
exports.initializeUserModel = initializeUserModel;
//# sourceMappingURL=User.js.map