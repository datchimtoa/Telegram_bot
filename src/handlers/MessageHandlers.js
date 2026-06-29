const logger = require('../logger');
const config = require('../config');
const { botStateDB } = require('../db/JsonDB');
const workflowService = require('../services/WorkflowService');
const sessionService = require('../services/SessionService');

class MessageHandlers {
  constructor(bot, commandHandlers) {
    this.bot = bot;
    this.commandHandlers = commandHandlers;
  }

  async handleMessage(msg) {
    // 1. Ignore non-owner
    if (msg.from.id !== config.ownerId) return;

    const chatId = msg.chat.id;
    const text = msg.text || '';

    // 2. Check for active session
    const session = sessionService.getSession(chatId);
    if (session) {
      // Special states: RENAMING, CLONING
      if (session.state === 'RENAMING_WORKFLOW') {
        await this.handleRenaming(msg, session);
        return;
      }
      if (session.state === 'CLONING_WORKFLOW') {
        await this.handleCloning(msg, session);
        return;
      }
      // Delegate to session handler
      await sessionService.handleSessionMessage(msg, this.bot);
      return;
    }

    // 3. Check commands (both text and slash)
    if (text.startsWith('/')) {
      await this.handleCommand(msg);
      return;
    }

    // 4. If bot is ON and message is plain text, try trigger
    if (botStateDB.isOn() && text) {
      const workflow = workflowService.getByName(text);
      if (workflow) {
        logger.info(`Triggered workflow: ${workflow.name} by owner`);
        await this.commandHandlers.runWorkflow(chatId, workflow, false);
      }
    }
  }

  async handleCommand(msg) {
    const text = msg.text.trim();
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (!this.commandHandlers.isOwner(msg)) return;

    switch (cmd) {
      case '/on':
        await this.commandHandlers.handleOn(msg);
        break;
      case '/off':
        await this.commandHandlers.handleOff(msg);
        break;
      case '/status':
        await this.commandHandlers.handleStatus(msg);
        break;
      case '/help':
        await this.commandHandlers.handleHelp(msg);
        break;
      case '/cancel':
        sessionService.deleteSession(msg.chat.id);
        await this.bot.sendMessage(msg.chat.id, '❌ Đã hủy phiên hiện tại.');
        break;
      case '/workflow':
        if (args.length === 0) {
          await this.bot.sendMessage(msg.chat.id, 'Dùng: /workflow create|delete|rename|clone|list|info|edit|test');
        } else {
          await this.commandHandlers.handleWorkflowCommand(msg, args[0], args.slice(1));
        }
        break;
      default:
        // Unknown command
        break;
    }
  }

  async handleRenaming(msg, session) {
    const newName = msg.text.trim();
    const oldName = session.context.oldName;
    try {
      workflowService.rename(oldName, newName);
      sessionService.deleteSession(msg.chat.id);
      await this.bot.sendMessage(msg.chat.id, `✅ Đã đổi tên thành "${newName}".`);
    } catch (err) {
      await this.bot.sendMessage(msg.chat.id, `❌ ${err.message}`);
    }
  }

  async handleCloning(msg, session) {
    const newName = msg.text.trim();
    const sourceName = session.context.sourceName;
    try {
      workflowService.clone(sourceName, newName);
      sessionService.deleteSession(msg.chat.id);
      await this.bot.sendMessage(msg.chat.id, `✅ Đã sao chép thành "${newName}".`);
    } catch (err) {
      await this.bot.sendMessage(msg.chat.id, `❌ ${err.message}`);
    }
  }
}

module.exports = MessageHandlers;
