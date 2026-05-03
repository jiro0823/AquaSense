import { Model } from 'sequelize';
/**
 * User model for AquaSense database
 */
export declare class User extends Model {
    id: string;
    fullName: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Initialize User model
 */
export declare const initializeUserModel: () => void;
//# sourceMappingURL=User.d.ts.map