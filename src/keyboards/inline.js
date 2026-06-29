const buildStepTypeKeyboard = () => ({
  reply_markup: {
    inline_keyboard: [
      [
        { text: '➕ Text', callback_data: 'step_type_text' },
        { text: '🖼 Photo', callback_data: 'step_type_photo' },
      ],
      [
        { text: '🎬 GIF', callback_data: 'step_type_animation' },
        { text: '🎥 Video', callback_data: 'step_type_video' },
      ],
      [
        { text: '😀 Sticker', callback_data: 'step_type_sticker' },
        { text: '🎤 Voice', callback_data: 'step_type_voice' },
      ],
      [
        { text: '🎵 Audio', callback_data: 'step_type_audio' },
        { text: '📄 Document', callback_data: 'step_type_document' },
      ],
      [
        { text: '⏱ Delay', callback_data: 'step_type_delay' },
        { text: '📋 Copy Msg', callback_data: 'step_type_copy_message' },
      ],
      [
        { text: '↩ Forward Msg', callback_data: 'step_type_forward_message' },
      ],
      [
        { text: '💾 Lưu', callback_data: 'save_workflow' },
        { text: '❌ Hủy', callback_data: 'cancel_session' },
      ],
    ],
  },
});

const buildWorkflowListKeyboard = (workflows, actionPrefix) => {
  const buttons = workflows.map(wf => ([
    { text: wf.name, callback_data: `${actionPrefix}_${wf.name}` }
  ]));
  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
};

const buildEditStepKeyboard = (stepIndex, totalSteps) => {
  const buttons = [];
  if (stepIndex > 0) {
    buttons.push({ text: '⬆️', callback_data: `moveup_${stepIndex}` });
  }
  if (stepIndex < totalSteps - 1) {
    buttons.push({ text: '⬇️', callback_data: `movedown_${stepIndex}` });
  }
  buttons.push({ text: '✏️ Sửa', callback_data: `editstep_${stepIndex}` });
  buttons.push({ text: '🗑 Xóa', callback_data: `deletestep_${stepIndex}` });
  return {
    reply_markup: {
      inline_keyboard: [buttons],
    },
  };
};

const buildConfirmKeyboard = () => ({
  reply_markup: {
    inline_keyboard: [
      [
        { text: '✅ Có', callback_data: 'confirm_yes' },
        { text: '❌ Không', callback_data: 'confirm_no' },
      ],
    ],
  },
});

module.exports = {
  buildStepTypeKeyboard,
  buildWorkflowListKeyboard,
  buildEditStepKeyboard,
  buildConfirmKeyboard,
};
