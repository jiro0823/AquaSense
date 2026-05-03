/**
 * Application configuration
 */
export declare const config: {
    server: {
        nodeEnv: string;
        port: number;
        host: string;
    };
    api: {
        version: string;
    };
    logging: {
        level: string;
    };
    cors: {
        origin: string[];
        credentials: boolean;
        methods: string[];
        allowedHeaders: string[];
    };
    database: {
        host: string;
        port: number;
        name: string;
        user: string;
        password: string;
        dialect: "postgres";
    };
    jwt: {
        secret: string;
        expiry: string;
    };
};
//# sourceMappingURL=config.d.ts.map