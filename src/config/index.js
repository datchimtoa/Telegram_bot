require('dotenv').config();

const config = {
  botToken: process.env.BOT_TOKEN,
  ownerId: parseInt(process.env.OWNER_ID, 10),
  targetChats: (process.env.TARGET_CHATS || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id),
  logLevel: process.env.LOG_LEVEL || 'info',
  dataDir: process.env.DATA_DIR || './data',
};

// Validate essential config
if (!config.botToken) {
  console.error('FATAL: BOT_TOKEN is not set in .env');
  process.exit(1);
}
if (!config.ownerId) {
  console.error('FATAL: OWNER_ID is not set in .env');
  process.exit(1);
}

module.exports = config;
