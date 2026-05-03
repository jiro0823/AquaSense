"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const http_1 = require("http");
const config_1 = require("./config/config");
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const api_1 = __importDefault(require("./api"));
const waterQualityWS_1 = require("./websocket/waterQualityWS");
const connection_1 = require("./database/connection");
const models_1 = require("./database/models");
const mqttService_1 = require("./services/mqttService");
/**
 * Initialize Express application
 */
const createApp = () => {
    const app = (0, express_1.default)();
    // Trust proxy - important for production deployments
    app.set('trust proxy', 1);
    // Security middleware
    app.use((0, helmet_1.default)()); // Set various HTTP headers for security
    app.use((0, cors_1.default)(config_1.config.cors)); // Enable CORS with configured origins
    // Body parsing middleware
    app.use(express_1.default.json({ limit: '10kb' })); // Limit payload size to prevent large requests
    app.use(express_1.default.urlencoded({ limit: '10kb', extended: true }));
    // Request logging
    app.use((0, morgan_1.default)(':method :url :status :response-time ms', {
        stream: {
            write: (message) => logger_1.logger.info(message.trim()),
        },
    }));
    // Health check endpoint
    app.get('/health', (_req, res) => {
        const response = {
            success: true,
            statusCode: 200,
            message: 'Server is healthy',
            data: {
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            },
        };
        res.json(response);
    });
    // API routes
    app.use('/api', api_1.default);
    // Root endpoint
    app.get('/', (_req, res) => {
        const response = {
            success: true,
            statusCode: 200,
            message: 'Welcome to Capstone Backend API - Water Quality IoT System',
            data: {
                version: config_1.config.api.version,
                environment: config_1.config.server.nodeEnv,
                mode: 'PREPARATION - Ready for ESP32 Integration',
            },
        };
        res.json(response);
    });
    // ESP32 Integration Guide
    app.get('/integration-guide', (_req, res) => {
        const baseUrl = `http://${config_1.config.server.host}:${config_1.config.server.port}`;
        const guide = {
            success: true,
            statusCode: 200,
            message: 'ESP32 Integration Guide',
            data: {
                description: 'Backend is in PREPARATION mode - ready to receive real sensor data from ESP32',
                howtostartPosting: {
                    endpoint: `POST ${baseUrl}/api/v1/water/readings`,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    requestBody: {
                        temperature: 25.5,
                        ph: 7.4,
                        do: 7.8,
                        turbidity: 25.3,
                        location: 'Sensor Location Name',
                        timestamp: '2026-04-12T05:31:28.462Z',
                    },
                    example_curl: `curl -X POST ${baseUrl}/api/v1/water/readings -H "Content-Type: application/json" -d '{"temperature":25.5,"ph":7.4,"do":7.8,"turbidity":25.3,"location":"Main Tank","timestamp":"2026-04-12T05:31:28.462Z"}'`,
                    esp32_pseudocode: `
            // Every 5 seconds (adjust as needed):
            POST /api/v1/water/readings with:
            {
              "temperature": read_temp_sensor(),
              "ph": read_ph_sensor(),
              "do": read_do_sensor(),
              "turbidity": read_turbidity_sensor(),
              "location": "Water Tank 1",
              "timestamp": current_time()
            }
          `,
                },
                availableEndpoints: [
                    'POST /api/v1/water/readings - Add sensor reading',
                    'GET /api/v1/water/readings/latest - Get latest reading',
                    'GET /api/v1/water/readings?minutes=60 - Get readings by time range',
                    'GET /api/v1/water/statistics?minutes=60 - Get statistics',
                    'GET /api/v1/water/alerts?limit=50 - Get alerts',
                    'GET /api/v1/water/thresholds - Get alert thresholds',
                    'PUT /api/v1/water/thresholds - Update thresholds',
                    'GET /api/v1/water/dashboard - Get combined dashboard data',
                ],
                websocketEvents: [
                    'water:latest - Latest sensor reading',
                    'water:stats - Statistics update',
                    'water:alert - New alert triggered',
                    'water:new-reading - New reading received',
                ],
                notes: 'Backend will remain stable without data. Data will be received and broadcast when ESP32 starts posting.',
            },
        };
        res.json(guide);
    });
    // 404 handler
    app.use(errorHandler_1.notFoundHandler);
    // Global error handler (must be last)
    app.use(errorHandler_1.errorHandler);
    return app;
};
/**
 * Start server
 */
const startServer = async () => {
    let server;
    try {
        // Initialize database and models
        logger_1.logger.info('Initializing database connection...');
        await (0, connection_1.initializeDatabase)();
        logger_1.logger.info('Initializing database models...');
        (0, models_1.initializeAllModels)();
        logger_1.logger.info('Synchronizing database schema...');
        await (0, connection_1.syncDatabase)();
        const app = createApp();
        const PORT = config_1.config.server.port;
        const HOST = config_1.config.server.host;
        // Create HTTP server
        const httpServer = (0, http_1.createServer)(app);
        // Initialize WebSocket server
        const wsServer = new waterQualityWS_1.WaterQualityWebSocketServer(httpServer);
        // Bridge MQTT readings to connected WebSocket dashboard clients
        mqttService_1.mqttService.setRealtimeHandlers({
            onReadingReceived: (reading) => wsServer.broadcastReading(reading),
            onStatsUpdated: (stats) => wsServer.broadcastStats(stats),
        });
        // Initialize MQTT Service (Optional - for ESP32 integration via MQTT)
        try {
            logger_1.logger.info('Initializing MQTT Service...');
            await mqttService_1.mqttService.connect();
            const mqttStatus = mqttService_1.mqttService.getStatus();
            logger_1.logger.info(`✓ MQTT Service initialized - Broker: ${mqttStatus.brokerUrl}`);
        }
        catch (error) {
            logger_1.logger.warn('MQTT Service initialization skipped or failed - Proceeding without MQTT', error instanceof Error ? error.message : 'Unknown error');
            // Continue without MQTT - REST API is still available
        }
        let retryTimer = null;
        const startListening = () => {
            if (retryTimer) {
                retryTimer = null;
            }
            server = httpServer.listen(PORT, HOST, () => {
                const baseUrl = `http://${HOST}:${PORT}`;
                logger_1.logger.info(`✓ Server is running on ${baseUrl}`);
                logger_1.logger.info(`✓ Environment: ${config_1.config.server.nodeEnv}`);
                logger_1.logger.info(`✓ API Version: ${config_1.config.api.version}`);
                logger_1.logger.info(`✓ Database: ${config_1.config.database.name}`);
                logger_1.logger.info(`✓ CORS Origins: ${config_1.config.cors.origin.join(', ')}`);
                logger_1.logger.info(`✓ WebSocket server enabled at ws://${HOST}:${PORT}`);
                logger_1.logger.info('');
                logger_1.logger.info('═══════════════════════════════════════════════════════════════');
                logger_1.logger.info('  PREPARATION MODE - Ready for ESP32 Integration');
                logger_1.logger.info('═══════════════════════════════════════════════════════════════');
                logger_1.logger.info('✓ Backend is connected to PostgreSQL database');
                logger_1.logger.info('✓ Waiting for sensor data from ESP32');
                logger_1.logger.info(`✓ Visit ${baseUrl}/integration-guide for ESP32 setup`);
                logger_1.logger.info('✓ Frontend: http://localhost:3000');
                logger_1.logger.info('═══════════════════════════════════════════════════════════════');
                logger_1.logger.info('');
            });
        };
        httpServer.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                if (!retryTimer) {
                    logger_1.logger.warn(`Port ${PORT} is in use. Retrying in 2 seconds...`);
                    retryTimer = setTimeout(startListening, 2000);
                }
                return;
            }
            logger_1.logger.error('Failed to start HTTP server', {
                message: error.message,
                code: error.code,
            });
            process.exit(1);
        });
        // Start server
        startListening();
        // Add WebSocket server stats endpoint
        app.get('/stats', (_req, res) => {
            const response = {
                success: true,
                statusCode: 200,
                message: 'Server statistics',
                data: {
                    connectedClients: wsServer.getConnectedClientsCount(),
                    timestamp: new Date().toISOString(),
                },
            };
            res.json(response);
        });
        // Graceful shutdown
        const shutdown = async (signal) => {
            logger_1.logger.warn(`${signal} received - Starting graceful shutdown...`);
            if (server) {
                server.close(async () => {
                    logger_1.logger.info('HTTP server closed');
                    // Close MQTT connection
                    try {
                        await mqttService_1.mqttService.disconnect();
                    }
                    catch (error) {
                        logger_1.logger.warn('MQTT disconnect failed or already disconnected');
                    }
                    await (0, connection_1.closeDatabase)();
                    logger_1.logger.info('Database connection closed');
                    process.exit(0);
                });
            }
            // Force shutdown after 15 seconds
            setTimeout(() => {
                logger_1.logger.error('Forced shutdown - timeout exceeded');
                process.exit(1);
            }, 15000);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        // Handle uncaught exceptions - log but don't crash
        process.on('uncaughtException', (err) => {
            logger_1.logger.error('Uncaught Exception detected', {
                message: err.message,
                stack: err.stack,
                timestamp: new Date().toISOString(),
            });
            // Log the error but keep server running
            // Only exit if it's a critical startup error
            if (err.message.includes('EADDRINUSE') || err.message.includes('database')) {
                logger_1.logger.error('Critical error - shutting down');
                process.exit(1);
            }
        });
        // Handle unhandled promise rejections - log but don't crash
        process.on('unhandledRejection', (reason) => {
            logger_1.logger.error('Unhandled Promise Rejection detected', {
                reason: reason instanceof Error ? reason.message : String(reason),
                timestamp: new Date().toISOString(),
            });
            // Log the error but keep server running unless it's critical
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server', error);
        if (server) {
            server.close();
        }
        await (0, connection_1.closeDatabase)();
        process.exit(1);
    }
};
// Start the server
startServer();
//# sourceMappingURL=server.js.map