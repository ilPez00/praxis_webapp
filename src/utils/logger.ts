import { createLogger, format, transports } from 'winston';
const { combine, timestamp, printf, colorize } = format;

// Custom format for logs
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const logger = createLogger({
  level: 'info', // Minimum level to log (error, warn, info, verbose, debug, silly)
  format: combine(
    colorize(), // Add colors to log levels
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add timestamp
    logFormat // Use the custom format
  ),
  transports: [
    new transports.Console(), // Log to console
    // new transports.File({ filename: 'error.log', level: 'error' }), // Log errors to a file
    // new transports.File({ filename: 'combined.log' }), // Log all levels to a file
  ],
  exceptionHandlers: [
    new transports.Console(),
    // new transports.File({ filename: 'exceptions.log' })
  ],
  rejectionHandlers: [
    new transports.Console(),
    // new transports.File({ filename: 'rejections.log' })
  ]
});

// If not in production, set level to debug to see more verbose logs
if (process.env.NODE_ENV !== 'production') {
  logger.level = 'debug';
}

export default logger;
