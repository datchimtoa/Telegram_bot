const logger = require('../logger');
const config = require('../config');
const { botStateDB } = require('../db/JsonDB');
const workflowService = require('../services/WorkflowService');
const sessionService = require('../services/SessionService');
const { buildWorkflowListKeyboard } = require('../keyboards/inline');

class CommandHandlers {
  constructor(bot) {
    this.bot = bot;
  }

  isOwner(msg) {
    return msg.from.id === config.ownerId;
  }

  async handleOn(msg) {
    botStateDB.setOn(true);
    await this.bot.sendMessage(msg.chat.id, '🟢 Bot đã được BẬT.');
    logger.info('Bot turned ON by owner');
  }

  async handleOff(msg) {
    botStateDB.setOn(false);
    await this.bot.sendMessage(msg.chat.id, '🔴 Bot đã được TẮT.');
    logger.info('Bot turned OFF by owner');
  }

  async handleStatus(msg) {
    const status = botStateDB.isOn() ? '🟢 Đang hoạt động' : '🔴 Đã tắt';
    await this.bot.sendMessage(msg.chat.id, `Trạng thái: ${status}`);
  }

  async handleHelp(msg) {
    const helpText = `
*Các lệnh:*
/on - Bật bot
/off - Tắt bot
/status - Xem trạng thái
/help - Hiển thị trợ giúp

*Quản lý Workflow:*
/workflow create - Tạo workflow mới
/workflow delete - Xóa workflow
/workflow rename - Đổi tên workflow
/workflow clone - Sao chép workflow
/workflow list - Danh sách workflow
/workflow info - Chi tiết workflow
/workflow edit - Chỉnh sửa workflow
/workflow test - Chạy thử workflow
/cancel - Hủy phiên hiện tại
    `;
    await this.bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
  }

  async handleWorkflowCommand(msg, cmd, args) {
    const chatId = msg.chat.id;
    // Cancel any existing session
    sessionService.deleteSession(chatId);

    switch (cmd) {
      case 'create':
        await sessionService.startWorkflowCreation(chatId, this.bot);
        break;
      case 'delete':
        this.handleDelete(chatId);
        break;
      case 'rename':
        this.handleRename(chatId);
        break;
      case 'clone':
        this.handleClone(chatId);
        break;
      case 'list':
        this.handleList(chatId);
        break;
      case 'info':
        this.handleInfo(chatId, args);
        break;
      case 'edit':
        this.handleEdit(chatId, args);
        break;
      case 'test':
        this.handleTest(chatId, args);
        break;
      default:
        await this.bot.sendMessage(chatId, '❓ Lệnh không hợp lệ.');
    }
  }

  async handleDelete(chatId) {
    const workflows = workflowService.listAll();
    if (workflows.length === 0) {
      await this.bot.sendMessage(chatId, 'Chưa có workflow nào.');
      return;
    }
    const keyboard = buildWorkflowListKeyboard(workflows, 'delwf');
    await this.bot.sendMessage(chatId, 'Chọn workflow để xóa:', keyboard);
  }

  async handleRename(chatId) {
    const workflows = workflowService.listAll();
    if (workflows.length === 0) {
      await this.bot.sendMessage(chatId, 'Chưa có workflow nào.');
      return;
    }
    const keyboard = buildWorkflowListKeyboard(workflows, 'renamewf');
    await this.bot.sendMessage(chatId, 'Chọn workflow cần đổi tên:', keyboard);
  }

  async handleClone(chatId) {
    const workflows = workflowService.listAll();
    if (workflows.length === 0) {
      await this.bot.sendMessage(chatId, 'Chưa có workflow nào.');
      return;
    }
    const keyboard = buildWorkflowListKeyboard(workflows, 'clonewf');
    await this.bot.sendMessage(chatId, 'Chọn workflow để sao chép:', keyboard);
  }

  async handleList(chatId) {
    const workflows = workflowService.listAll();
    if (workflows.length === 0) {
      await this.bot.sendMessage(chatId, 'Danh sách trống.');
      return;
    }
    const list = workflows.map((w, i) => `${i + 1}. ${w.name} (${w.steps.length} steps)`).join('\n');
    await this.bot.sendMessage(chatId, `📋 *Danh sách workflow:*\n${list}`, { parse_mode: 'Markdown' });
  }

  async handleInfo(chatId, args) {
    let name;
    if (args.length > 0) {
      name = args.join(' ');
    } else {
      const workflows = workflowService.listAll();
      if (workflows.length === 0) {
        await this.bot.sendMessage(chatId, 'Chưa có workflow nào.');
        return;
      }
      const keyboard = buildWorkflowListKeyboard(workflows, 'infowf');
      await this.bot.sendMessage(chatId, 'Chọn workflow để xem chi tiết:', keyboard);
      return;
    }
    const wf = workflowService.getByName(name);
    if (!wf) {
      await this.bot.sendMessage(chatId, `❌ Workflow "${name}" không tồn tại.`);
      return;
    }
    const details = wf.steps.map((s, i) => `${i + 1}. ${s.type}${s.caption ? ` - ${s.caption}` : ''}`).join('\n');
    await this.bot.sendMessage(chatId, `📌 *${wf.name}*\n${details || '(không có bước nào)'}`, { parse_mode: 'Markdown' });
  }

  async handleEdit(chatId, args) {
    if (args.length > 0) {
      const wfName = args.join(' ');
      const wf = workflowService.getByName(wfName);
      if (!wf) {
        await this.bot.sendMessage(chatId, `❌ Workflow "${wfName}" không tồn tại.`);
        return;
      }
      this.startEditSession(chatId, wf);
    } else {
      const workflows = workflowService.listAll();
      if (workflows.length === 0) {
        await this.bot.sendMessage(chatId, 'Chưa có workflow nào.');
        return;
      }
      const keyboard = buildWorkflowListKeyboard(workflows, 'editwf');
      await this.bot.sendMessage(chatId, 'Chọn workflow để chỉnh sửa:', keyboard);
    }
  }

  startEditSession(chatId, workflow) {
    // We'll create a session in state EDITING_WORKFLOW with step list and inline buttons
    const session = sessionService.createSession(chatId, 'EDITING_WORKFLOW', { workflowName: workflow.name });
    this.sendEditMenu(chatId, workflow);
  }

  async sendEditMenu(chatId, workflow) {
    const steps = workflow.steps;
    const buttons = steps.map((step, index) => [
      { text: `${index + 1}. ${step.type}`, callback_data: `editstep_${index}` }
    ]);
    buttons.push([{ text: '➕ Thêm bước', callback_data: 'addstep' }]);
    buttons.push([{ text: '💾 Lưu & Thoát', callback_data: 'save_edit' }, { text: '❌ Hủy', callback_data: 'cancel_session' }]);

    await this.bot.sendMessage(chatId, `🔧 Chỉnh sửa workflow *${workflow.name}*`, {
      reply_markup: { inline_keyboard: buttons },
      parse_mode: 'Markdown',
    });
  }

  async handleTest(chatId, args) {
    if (args.length === 0) {
      const workflows = workflowService.listAll();
      if (workflows.length === 0) {
        await this.bot.sendMessage(chatId, 'Chưa có workflow nào.');
        return;
      }
      const keyboard = buildWorkflowListKeyboard(workflows, 'testwf');
      await this.bot.sendMessage(chatId, 'Chọn workflow để chạy thử:', keyboard);
      return;
    }
    const name = args.join(' ');
    const wf = workflowService.getByName(name);
    if (!wf) {
      await this.bot.sendMessage(chatId, `❌ Workflow "${name}" không tồn tại.`);
      return;
    }
    await this.runWorkflow(chatId, wf);
  }

  async runWorkflow(chatId, workflow, isTest = true) {
    const MessageSender = require('../services/MessageSender');
    const sender = new MessageSender(this.bot);
    try {
      for (const step of workflow.steps) {
        if (isTest) {
          await sender.sendToOwner(chatId, step);
        } else {
          await sender.sendToTargets(step);
        }
      }
      await this.bot.sendMessage(chatId, '✅ Workflow hoàn thành.');
      logger.info(`Workflow "${workflow.name}" completed (test=${isTest})`);
    } catch (error) {
      logger.error(`Workflow error: ${error.message}`);
      await this.bot.sendMessage(chatId, `❌ Lỗi khi chạy workflow: ${error.message}`);
    }
  }
}

module.exports = CommandHandlers;
