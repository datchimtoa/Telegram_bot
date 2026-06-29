const { sessionDB } = require('../db/JsonDB');
const logger = require('../logger');
const { buildStepTypeKeyboard } = require('../keyboards/inline');

class SessionService {
  constructor() {
    this.sessions = sessionDB;
  }

  getSession(chatId) {
    return this.sessions.get(chatId);
  }

  createSession(chatId, state, context = {}) {
    const session = { chatId, state, context, updatedAt: new Date().toISOString() };
    this.sessions.set(chatId, session);
    return session;
  }

  updateSession(chatId, updates) {
    const session = this.getSession(chatId);
    if (!session) return null;
    Object.assign(session, updates, { updatedAt: new Date().toISOString() });
    this.sessions.set(chatId, session);
    return session;
  }

  deleteSession(chatId) {
    this.sessions.delete(chatId);
  }

  async startWorkflowCreation(chatId, bot) {
    this.createSession(chatId, 'CREATING_WORKFLOW_NAME', { steps: [] });
    await bot.sendMessage(chatId, '📝 Hãy nhập tên cho workflow mới:');
  }

  async handleSessionMessage(msg, bot) {
    const chatId = msg.chat.id;
    const session = this.getSession(chatId);
    if (!session) return false;

    const state = session.state;
    const text = msg.text || msg.caption || '';

    try {
      switch (state) {
        case 'CREATING_WORKFLOW_NAME':
          await this.handleWorkflowName(msg, bot, session);
          break;
        case 'WAITING_TEXT':
          await this.handleTextInput(msg, bot, session);
          break;
        case 'WAITING_DELAY':
          await this.handleDelayInput(msg, bot, session);
          break;
        case 'WAITING_PHOTO':
        case 'WAITING_VIDEO':
        case 'WAITING_ANIMATION':
        case 'WAITING_STICKER':
        case 'WAITING_VOICE':
        case 'WAITING_AUDIO':
        case 'WAITING_DOCUMENT':
          await this.handleMediaInput(msg, bot, session, state);
          break;
        case 'WAITING_CAPTION':
          await this.handleCaptionInput(msg, bot, session);
          break;
        case 'WAITING_COPY_CHAT_ID':
          await this.handleCopyChatId(msg, bot, session);
          break;
        case 'WAITING_COPY_MSG_ID':
          await this.handleCopyMsgId(msg, bot, session);
          break;
        case 'WAITING_FORWARD_CHAT_ID':
          await this.handleForwardChatId(msg, bot, session);
          break;
        case 'WAITING_FORWARD_MSG_ID':
          await this.handleForwardMsgId(msg, bot, session);
          break;
        case 'EDITING_WORKFLOW_STEP_TEXT':
          await this.handleEditStepText(msg, bot, session);
          break;
        case 'EDITING_WORKFLOW_STEP_DELAY':
          await this.handleEditStepDelay(msg, bot, session);
          break;
        default:
          // Unknown state: ignore or reset
          break;
      }
    } catch (error) {
      logger.error(`Session error for chat ${chatId}: ${error.message}`);
      await bot.sendMessage(chatId, `❌ Lỗi: ${error.message}`);
      this.deleteSession(chatId);
    }
    return true;
  }

  async handleWorkflowName(msg, bot, session) {
    const name = msg.text.trim();
    const workflowService = require('./WorkflowService');
    if (workflowService.getByName(name)) {
      await bot.sendMessage(msg.chat.id, '⚠️ Tên workflow đã tồn tại. Hãy nhập tên khác:');
      return;
    }
    session.context.workflowName = name;
    this.updateSession(msg.chat.id, { state: 'CREATING_STEP_TYPE', context: session.context });
    await bot.sendMessage(msg.chat.id, '✅ Đã đặt tên. Bây giờ chọn loại step đầu tiên:', buildStepTypeKeyboard());
  }

  async handleTextInput(msg, bot, session) {
    const text = msg.text;
    session.context.steps.push({ type: 'text', text });
    this.updateSession(msg.chat.id, { state: 'CREATING_STEP_TYPE', context: session.context });
    await bot.sendMessage(msg.chat.id, '✅ Đã thêm Text step. Chọn bước tiếp theo:', buildStepTypeKeyboard());
  }

  async handleDelayInput(msg, bot, session) {
    const ms = parseInt(msg.text, 10);
    if (isNaN(ms) || ms < 0) {
      await bot.sendMessage(msg.chat.id, '⏱ Vui lòng nhập số ms hợp lệ (>=0):');
      return;
    }
    session.context.steps.push({ type: 'delay', delay_ms: ms });
    this.updateSession(msg.chat.id, { state: 'CREATING_STEP_TYPE', context: session.context });
    await bot.sendMessage(msg.chat.id, '✅ Đã thêm Delay step. Chọn bước tiếp theo:', buildStepTypeKeyboard());
  }

  async handleMediaInput(msg, bot, session, state) {
    const typeMap = {
      WAITING_PHOTO: 'photo',
      WAITING_VIDEO: 'video',
      WAITING_ANIMATION: 'animation',
      WAITING_STICKER: 'sticker',
      WAITING_VOICE: 'voice',
      WAITING_AUDIO: 'audio',
      WAITING_DOCUMENT: 'document',
    };
    const expectedType = typeMap[state];
    const media = msg[expectedType];
    if (!media) {
      await bot.sendMessage(msg.chat.id, `⚠️ Hiện tại mình đang chờ ${expectedType}. Hãy gửi đúng loại dữ liệu hoặc dùng /cancel để hủy.`);
      return;
    }
    // Extract file_id (for photo, take largest)
    let file_id;
    if (expectedType === 'photo') {
      file_id = media[media.length - 1].file_id;
    } else {
      file_id = media.file_id;
    }
    session.context.pendingStep = { type: expectedType, file_id };
    this.updateSession(msg.chat.id, { state: 'WAITING_CAPTION', context: session.context });
    await bot.sendMessage(msg.chat.id, '📝 Nhập caption (hoặc gửi "-" để bỏ qua):', { reply_markup: { force_reply: true } });
  }

  async handleCaptionInput(msg, bot, session) {
    const caption = msg.text === '-' ? '' : msg.text;
    const step = session.context.pendingStep;
    step.caption = caption;
    delete session.context.pendingStep;
    session.context.steps.push(step);
    this.updateSession(msg.chat.id, { state: 'CREATING_STEP_TYPE', context: session.context });
    await bot.sendMessage(msg.chat.id, '✅ Đã thêm step. Chọn bước tiếp theo:', buildStepTypeKeyboard());
  }

  async handleCopyChatId(msg, bot, session) {
    session.context.pendingStep = { from_chat_id: msg.text.trim() };
    this.updateSession(msg.chat.id, { state: 'WAITING_COPY_MSG_ID', context: session.context });
    await bot.sendMessage(msg.chat.id, '🔢 Nhập message_id:');
  }

  async handleCopyMsgId(msg, bot, session) {
    const msgId = parseInt(msg.text, 10);
    if (isNaN(msgId)) {
      await bot.sendMessage(msg.chat.id, 'Message ID phải là số. Thử lại:');
      return;
    }
    const step = session.context.pendingStep;
    step.message_id = msgId;
    step.type = 'copy_message';
    session.context.steps.push(step);
    delete session.context.pendingStep;
    this.updateSession(msg.chat.id, { state: 'CREATING_STEP_TYPE', context: session.context });
    await bot.sendMessage(msg.chat.id, '✅ Đã thêm Copy Message step. Chọn bước tiếp theo:', buildStepTypeKeyboard());
  }

  async handleForwardChatId(msg, bot, session) {
    session.context.pendingStep = { from_chat_id: msg.text.trim() };
    this.updateSession(msg.chat.id, { state: 'WAITING_FORWARD_MSG_ID', context: session.context });
    await bot.sendMessage(msg.chat.id, '🔢 Nhập message_id:');
  }

  async handleForwardMsgId(msg, bot, session) {
    const msgId = parseInt(msg.text, 10);
    if (isNaN(msgId)) {
      await bot.sendMessage(msg.chat.id, 'Message ID phải là số. Thử lại:');
      return;
    }
    const step = session.context.pendingStep;
    step.message_id = msgId;
    step.type = 'forward_message';
    session.context.steps.push(step);
    delete session.context.pendingStep;
    this.updateSession(msg.chat.id, { state: 'CREATING_STEP_TYPE', context: session.context });
    await bot.sendMessage(msg.chat.id, '✅ Đã thêm Forward Message step. Chọn bước tiếp theo:', buildStepTypeKeyboard());
  }

  async handleEditStepText(msg, bot, session) {
    const newText = msg.text;
    const editCtx = session.context.editContext;
    const workflowName = editCtx.workflowName;
    const stepIndex = editCtx.stepIndex;
    const workflowService = require('./WorkflowService');
    workflowService.update(workflowName, wf => {
      wf.steps[stepIndex].text = newText;
      return wf;
    });
    this.deleteSession(msg.chat.id);
    await bot.sendMessage(msg.chat.id, '✅ Step đã được cập nhật.');
  }

  async handleEditStepDelay(msg, bot, session) {
    const ms = parseInt(msg.text, 10);
    if (isNaN(ms) || ms < 0) {
      await bot.sendMessage(msg.chat.id, 'Vui lòng nhập số ms hợp lệ:');
      return;
    }
    const editCtx = session.context.editContext;
    const workflowService = require('./WorkflowService');
    workflowService.update(editCtx.workflowName, wf => {
      wf.steps[editCtx.stepIndex].delay_ms = ms;
      return wf;
    });
    this.deleteSession(msg.chat.id);
    await bot.sendMessage(msg.chat.id, '✅ Delay step đã được cập nhật.');
  }
}

module.exports = new SessionService();
