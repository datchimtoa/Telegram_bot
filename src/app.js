const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const logger = require('./logger');
const { botStateDB } = require('./db/JsonDB');
const CommandHandlers = require('./handlers/CommandHandlers');
const CallbackHandlers = require('./handlers/CallbackHandlers');
const MessageHandlers = require('./handlers/MessageHandlers');

class App {
  constructor() {
    this.bot = new TelegramBot(config.botToken, { polling: true });
    this.commandHandlers = new CommandHandlers(this.bot);
    this.callbackHandlers = new CallbackHandlers(this.bot, this.commandHandlers);
    this.messageHandlers = new MessageHandlers(this.bot, this.commandHandlers);

    this.setupListeners();
    logger.info('Bot started successfully');
  }

  setupListeners() {
    this.bot.on('message', (msg) => {
      this.messageHandlers.handleMessage(msg).catch(err => {
        logger.error(`Unhandled error in message: ${err.message}`);
      });
    });

    this.bot.on('callback_query', (callbackQuery) => {
      this.callbackHandlers.handleCallback(callbackQuery).catch(err => {
        logger.error(`Unhandled error in callback: ${err.message}`);
      });
    });

    this.bot.on('polling_error', (error) => {
      logger.error(`Polling error: ${error.message}`);
    });

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  shutdown() {
    logger.info('Bot shutting down...');
    this.bot.stopPolling();
    process.exit(0);
  }
}

// Start the bot
new App();
