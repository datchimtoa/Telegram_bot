const logger = require('../logger');
const config = require('../config');

class MessageSender {
  constructor(bot) {
    this.bot = bot;
  }

  async sendToTargets(step) {
    const chats = config.targetChats;
    const results = [];
    for (const chatId of chats) {
      try {
        await this.sendStepToChat(chatId, step);
        results.push({ chatId, success: true });
      } catch (error) {
        logger.error(`Failed to send step to ${chatId}: ${error.message}`);
        results.push({ chatId, success: false, error: error.message });
      }
    }
    return results;
  }

  async sendStepToChat(chatId, step) {
    const opts = {
      disable_notification: step.disable_notification || false,
      protect_content: step.protect_content || false,
    };
    if (step.caption) opts.caption = step.caption;
    if (step.parse_mode) opts.parse_mode = step.parse_mode;

    switch (step.type) {
      case 'text':
        await this.bot.sendMessage(chatId, step.text, opts);
        break;
      case 'photo':
        await this.bot.sendPhoto(chatId, step.file_id, opts);
        break;
      case 'video':
        await this.bot.sendVideo(chatId, step.file_id, opts);
        break;
      case 'animation':
        await this.bot.sendAnimation(chatId, step.file_id, opts);
        break;
      case 'sticker':
        await this.bot.sendSticker(chatId, step.file_id, opts);
        break;
      case 'voice':
        await this.bot.sendVoice(chatId, step.file_id, opts);
        break;
      case 'audio':
        await this.bot.sendAudio(chatId, step.file_id, opts);
        break;
      case 'document':
        await this.bot.sendDocument(chatId, step.file_id, opts);
        break;
      case 'delay':
        await new Promise(resolve => setTimeout(resolve, step.delay_ms));
        break;
      case 'copy_message':
        await this.bot.copyMessage(chatId, step.from_chat_id, step.message_id, opts);
        break;
      case 'forward_message':
        await this.bot.forwardMessage(chatId, step.from_chat_id, step.message_id, opts);
        break;
      default:
        logger.warn(`Unknown step type: ${step.type}`);
    }
  }

  async sendToOwner(chatId, step) {
    await this.sendStepToChat(chatId, step);
  }
}

module.exports = MessageSender;
