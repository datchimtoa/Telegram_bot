const logger = require('../logger');
const sessionService = require('../services/SessionService');
const workflowService = require('../services/WorkflowService');
const { buildStepTypeKeyboard, buildEditStepKeyboard, buildConfirmKeyboard } = require('../keyboards/inline');

class CallbackHandlers {
  constructor(bot, commandHandlers) {
    this.bot = bot;
    this.commandHandlers = commandHandlers;
  }

  async handleCallback(callbackQuery) {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;
    const ownerId = require('../config').ownerId;

    if (callbackQuery.from.id !== ownerId) {
      this.bot.answerCallbackQuery(callbackQuery.id, 'Bạn không có quyền.');
      return;
    }

    // Check for active session first
    const session = sessionService.getSession(chatId);
    if (session && session.state === 'EDITING_WORKFLOW') {
      await this.handleEditCallback(callbackQuery, session);
      return;
    }

    // Global callbacks (from session-free menus)
    if (data.startsWith('delwf_')) {
      await this.handleDeleteWorkflow(callbackQuery);
      return;
    }
    if (data.startsWith('renamewf_')) {
      await this.handleRenameWorkflowStart(callbackQuery);
      return;
    }
    if (data.startsWith('clonewf_')) {
      await this.handleCloneWorkflowStart(callbackQuery);
      return;
    }
    if (data.startsWith('infowf_')) {
      await this.handleInfoWorkflow(callbackQuery);
      return;
    }
    if (data.startsWith('editwf_')) {
      await this.handleEditWorkflow(callbackQuery);
      return;
    }
    if (data.startsWith('testwf_')) {
      await this.handleTestWorkflow(callbackQuery);
      return;
    }

    // Session-related callbacks
    if (session) {
      await this.handleSessionCallback(callbackQuery, session);
    } else {
      this.bot.answerCallbackQuery(callbackQuery.id, 'Không có phiên làm việc nào.');
    }
  }

  async handleDeleteWorkflow(callbackQuery) {
    const name = callbackQuery.data.replace('delwf_', '');
    try {
      workflowService.delete(name);
      this.bot.editMessageText(`✅ Đã xóa workflow "${name}".`, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
      });
    } catch (err) {
      this.bot.answerCallbackQuery(callbackQuery.id, { text: err.message, show_alert: true });
    }
  }

  async handleRenameWorkflowStart(callbackQuery) {
    const oldName = callbackQuery.data.replace('renamewf_', '');
    const chatId = callbackQuery.message.chat.id;
    sessionService.createSession(chatId, 'RENAMING_WORKFLOW', { oldName });
    await this.bot.sendMessage(chatId, `✏️ Nhập tên mới cho "${oldName}":`);
    this.bot.answerCallbackQuery(callbackQuery.id);
    // Delete the selection message
    this.bot.deleteMessage(chatId, callbackQuery.message.message_id);
  }

  async handleCloneWorkflowStart(callbackQuery) {
    const sourceName = callbackQuery.data.replace('clonewf_', '');
    const chatId = callbackQuery.message.chat.id;
    sessionService.createSession(chatId, 'CLONING_WORKFLOW', { sourceName });
    await this.bot.sendMessage(chatId, `📋 Nhập tên mới cho bản sao của "${sourceName}":`);
    this.bot.answerCallbackQuery(callbackQuery.id);
    this.bot.deleteMessage(chatId, callbackQuery.message.message_id);
  }

  async handleInfoWorkflow(callbackQuery) {
    const name = callbackQuery.data.replace('infowf_', '');
    const wf = workflowService.getByName(name);
    if (!wf) {
      this.bot.answerCallbackQuery(callbackQuery.id, { text: 'Không tìm thấy', show_alert: true });
      return;
    }
    const details = wf.steps.map((s, i) => `${i + 1}. ${s.type}${s.caption ? ` - ${s.caption}` : ''}`).join('\n');
    await this.bot.editMessageText(`📌 *${wf.name}*\n${details || '(không có bước nào)'}`, {
      chat_id: callbackQuery.message.chat.id,
      message_id: callbackQuery.message.message_id,
      parse_mode: 'Markdown',
    });
    this.bot.answerCallbackQuery(callbackQuery.id);
  }

  async handleEditWorkflow(callbackQuery) {
    const name = callbackQuery.data.replace('editwf_', '');
    const wf = workflowService.getByName(name);
    if (!wf) {
      this.bot.answerCallbackQuery(callbackQuery.id, 'Không tìm thấy', true);
      return;
    }
    this.commandHandlers.startEditSession(callbackQuery.message.chat.id, wf);
    this.bot.answerCallbackQuery(callbackQuery.id);
    this.bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);
  }

  async handleTestWorkflow(callbackQuery) {
    const name = callbackQuery.data.replace('testwf_', '');
    const wf = workflowService.getByName(name);
    if (!wf) {
      this.bot.answerCallbackQuery(callbackQuery.id, 'Không tìm thấy', true);
      return;
    }
    await this.commandHandlers.runWorkflow(callbackQuery.message.chat.id, wf, true);
    this.bot.answerCallbackQuery(callbackQuery.id);
    this.bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);
  }

  // Session callbacks (creating/editing)
  async handleSessionCallback(callbackQuery, session) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (session.state === 'CREATING_STEP_TYPE' || session.state === 'CREATING_WORKFLOW_NAME') {
      await this.handleCreatingStepCallback(callbackQuery, session);
      return;
    }

    this.bot.answerCallbackQuery(callbackQuery.id, 'Không xử lý được.');
  }

  async handleCreatingStepCallback(callbackQuery, session) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'save_workflow') {
      await this.saveWorkflow(session, chatId);
      return;
    }
    if (data === 'cancel_session') {
      sessionService.deleteSession(chatId);
      await this.bot.sendMessage(chatId, '❌ Đã hủy.');
      this.bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    if (data.startsWith('step_type_')) {
      const type = data.replace('step_type_', '');
      await this.startStepInput(chatId, type, session);
      this.bot.answerCallbackQuery(callbackQuery.id);
    } else {
      this.bot.answerCallbackQuery(callbackQuery.id, 'Lựa chọn không hợp lệ.');
    }
  }

  async startStepInput(chatId, type, session) {
    switch (type) {
      case 'text':
        sessionService.updateSession(chatId, { state: 'WAITING_TEXT' });
        await this.bot.sendMessage(chatId, '📝 Nhập nội dung text:');
        break;
      case 'delay':
        sessionService.updateSession(chatId, { state: 'WAITING_DELAY' });
        await this.bot.sendMessage(chatId, '⏱ Nhập delay (ms):');
        break;
      case 'photo':
        sessionService.updateSession(chatId, { state: 'WAITING_PHOTO' });
        await this.bot.sendMessage(chatId, '🖼 Gửi ảnh.');
        break;
      case 'video':
        sessionService.updateSession(chatId, { state: 'WAITING_VIDEO' });
        await this.bot.sendMessage(chatId, '🎥 Gửi video.');
        break;
      case 'animation':
        sessionService.updateSession(chatId, { state: 'WAITING_ANIMATION' });
        await this.bot.sendMessage(chatId, '🎬 Gửi GIF.');
        break;
      case 'sticker':
        sessionService.updateSession(chatId, { state: 'WAITING_STICKER' });
        await this.bot.sendMessage(chatId, '😀 Gửi sticker.');
        break;
      case 'voice':
        sessionService.updateSession(chatId, { state: 'WAITING_VOICE' });
        await this.bot.sendMessage(chatId, '🎤 Gửi voice.');
        break;
      case 'audio':
        sessionService.updateSession(chatId, { state: 'WAITING_AUDIO' });
        await this.bot.sendMessage(chatId, '🎵 Gửi audio.');
        break;
      case 'document':
        sessionService.updateSession(chatId, { state: 'WAITING_DOCUMENT' });
        await this.bot.sendMessage(chatId, '📄 Gửi document.');
        break;
      case 'copy_message':
        sessionService.updateSession(chatId, { state: 'WAITING_COPY_CHAT_ID' });
        await this.bot.sendMessage(chatId, '📋 Nhập from_chat_id (ID hoặc @username):');
        break;
      case 'forward_message':
        sessionService.updateSession(chatId, { state: 'WAITING_FORWARD_CHAT_ID' });
        await this.bot.sendMessage(chatId, '↩ Nhập from_chat_id (ID hoặc @username):');
        break;
      default:
        await this.bot.sendMessage(chatId, 'Loại không hỗ trợ.');
    }
  }

  async saveWorkflow(session, chatId) {
    const workflowName = session.context.workflowName;
    const steps = session.context.steps;
    if (!workflowName || steps.length === 0) {
      await this.bot.sendMessage(chatId, '⚠️ Cần ít nhất một step để lưu.');
      return;
    }
    const Workflow = require('../models/Workflow');
    const wf = new Workflow(workflowName, steps);
    try {
      workflowService.create(wf);
      sessionService.deleteSession(chatId);
      await this.bot.sendMessage(chatId, `✅ Đã lưu workflow "${workflowName}".`);
    } catch (err) {
      await this.bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
    }
  }

  // Edit workflow callbacks
  async handleEditCallback(callbackQuery, session) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const wf = workflowService.getByName(session.context.workflowName);
    if (!wf) {
      sessionService.deleteSession(chatId);
      await this.bot.sendMessage(chatId, '❌ Workflow không còn tồn tại.');
      return;
    }

    if (data === 'save_edit') {
      sessionService.deleteSession(chatId);
      await this.bot.sendMessage(chatId, '💾 Đã lưu thay đổi.');
      return;
    }
    if (data === 'cancel_session') {
      sessionService.deleteSession(chatId);
      await this.bot.sendMessage(chatId, '❌ Đã hủy chỉnh sửa.');
      return;
    }
    if (data === 'addstep') {
      sessionService.updateSession(chatId, { state: 'CREATING_STEP_TYPE', context: { ...session.context, editing: true } });
      await this.bot.sendMessage(chatId, 'Chọn loại step để thêm:', buildStepTypeKeyboard());
      return;
    }
    if (data.startsWith('editstep_')) {
      const index = parseInt(data.replace('editstep_', ''), 10);
      const step = wf.steps[index];
      if (!step) {
        this.bot.answerCallbackQuery(callbackQuery.id, 'Step không tồn tại.');
        return;
      }
      // Show edit step submenu
      const buttons = [];
      buttons.push([{ text: '✏️ Sửa nội dung', callback_data: `editcontent_${index}` }]);
      if (step.type === 'text' || step.type === 'delay') {
        // text or delay can be edited directly via message
      } else {
        buttons.push([{ text: '🔄 Gửi lại media', callback_data: `resendmedia_${index}` }]);
      }
      buttons.push([{ text: '📝 Sửa caption', callback_data: `editcaption_${index}` }]);
      buttons.push([{ text: '🔇 Toggle notify', callback_data: `togglenotify_${index}` }]);
      buttons.push([{ text: '🔒 Toggle protect', callback_data: `toggleprotect_${index}` }]);
      buttons.push([{ text: '🗑 Xóa step', callback_data: `deletestep_${index}` }]);
      buttons.push([{ text: '🔙 Quay lại', callback_data: 'back_to_edit' }]);

      await this.bot.editMessageText(`⚙️ Chỉnh sửa step ${index + 1} (${step.type}):`, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: { inline_keyboard: buttons },
      });
      this.bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    if (data.startsWith('moveup_')) {
      const index = parseInt(data.replace('moveup_', ''), 10);
      if (index > 0) {
        workflowService.update(session.context.workflowName, wf => {
          const step = wf.steps.splice(index, 1)[0];
          wf.steps.splice(index - 1, 0, step);
          return wf;
        });
      }
      await this.commandHandlers.sendEditMenu(chatId, workflowService.getByName(session.context.workflowName));
      this.bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    if (data.startsWith('movedown_')) {
      const index = parseInt(data.replace('movedown_', ''), 10);
      const wf = workflowService.getByName(session.context.workflowName);
      if (index < wf.steps.length - 1) {
        workflowService.update(session.context.workflowName, wf => {
          const step = wf.steps.splice(index, 1)[0];
          wf.steps.splice(index + 1, 0, step);
          return wf;
        });
      }
      await this.commandHandlers.sendEditMenu(chatId, workflowService.getByName(session.context.workflowName));
      this.bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    if (data.startsWith('deletestep_')) {
      const index = parseInt(data.replace('deletestep_', ''), 10);
      workflowService.update(session.context.workflowName, wf => {
        wf.steps.splice(index, 1);
        return wf;
      });
      await this.commandHandlers.sendEditMenu(chatId, workflowService.getByName(session.context.workflowName));
      this.bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    if (data.startsWith('editcontent_')) {
      const index = parseInt(data.replace('editcontent_', ''), 10);
      const wf = workflowService.getByName(session.context.workflowName);
      const step = wf.steps[index];
      if (step.type === 'text') {
        sessionService.updateSession(chatId, { state: 'EDITING_WORKFLOW_STEP_TEXT', context: { ...session.context, editContext: { workflowName: wf.name, stepIndex: index } } });
        await this.bot.sendMessage(chatId, `📝 Nhập nội dung mới cho text step (hiện tại: ${step.text}):`);
      } else if (step.type === 'delay') {
        sessionService.updateSession(chatId, { state: 'EDITING_WORKFLOW_STEP_DELAY', context: { ...session.context, editContext: { workflowName: wf.name, stepIndex: index } } });
        await this.bot.sendMessage(chatId, `⏱ Nhập delay ms mới (hiện tại: ${step.delay_ms}):`);
      } else {
        this.bot.answerCallbackQuery(callbackQuery.id, 'Không hỗ trợ sửa nội dung trực tiếp cho loại này.');
      }
      this.bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    // Add more edit sub-callbacks as needed (simplified for brevity)
    this.bot.answerCallbackQuery(callbackQuery.id);
  }
}

module.exports = CallbackHandlers;
