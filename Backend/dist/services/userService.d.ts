export interface User {
    id: string;
    fullName: string;
    email: string;
    passwordHash?: string;
    createdAt: Date;
    updatedAt: Date;
}
declare class UserService {
    /**
     * Register a new user
     */
    registerUser(fullName: string, email: string, password: string): Promise<User | null>;
    /**
     * Authenticate user (login)
     */
    authenticateUser(email: string, password: string): Promise<User | null>;
    /**
     * Get user by ID
     */
    getUserById(id: string): Promise<User | null>;
    /**
     * Get user by email
     */
    getUserByEmail(email: string): Promise<User | null>;
    /**
     * Get user without password hash
     */
    getPublicUser(user: User): Omit<User, 'passwordHash'>;
    /**
     * Map Sequelize User model to User interface
     */
    private mapUserModel;
}
export declare const userService: UserService;
export {};
//# sourceMappingURL=userService.d.ts.map