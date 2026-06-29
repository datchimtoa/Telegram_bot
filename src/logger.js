const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
const config = require('./config');

// Ensure logs directory exists
fs.ensureDirSync(path.join(config.dataDir, 'logs'));

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'telegram-workflow-bot' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: path.join(config.dataDir, 'logs', 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(config.dataDir, 'logs', 'combined.log'),
    }),
  ],
});

module.exports = logger;
