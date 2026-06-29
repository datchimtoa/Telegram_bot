const stepTypes = [
  'text',
  'photo',
  'video',
  'animation',
  'sticker',
  'voice',
  'audio',
  'document',
  'delay',
  'copy_message',
  'forward_message',
];

const stepSchema = {
  type: { type: 'string', required: true, enum: stepTypes },
  // For media types
  file_id: { type: 'string', required: false },
  // For text
  text: { type: 'string', required: false },
  // For delay
  delay_ms: { type: 'number', required: false },
  // For copy/forward
  from_chat_id: { type: 'string', required: false },
  message_id: { type: 'number', required: false },
  // Common
  caption: { type: 'string', required: false },
  parse_mode: { type: 'string', required: false },
  disable_notification: { type: 'boolean', default: false },
  protect_content: { type: 'boolean', default: false },
};

function validateStep(step) {
  const errors = [];
  if (!step.type || !stepTypes.includes(step.type)) {
    errors.push(`Invalid step type: ${step.type}`);
  }

  switch (step.type) {
    case 'text':
      if (!step.text && step.text !== '') errors.push('Text step requires text property');
      break;
    case 'photo':
    case 'video':
    case 'animation':
    case 'sticker':
    case 'voice':
    case 'audio':
    case 'document':
      if (!step.file_id) errors.push('Media step requires file_id');
      break;
    case 'delay':
      if (typeof step.delay_ms !== 'number' || step.delay_ms < 0) errors.push('Delay step requires a positive delay_ms');
      break;
    case 'copy_message':
    case 'forward_message':
      if (!step.from_chat_id) errors.push('Copy/forward step requires from_chat_id');
      if (!step.message_id) errors.push('Copy/forward step requires message_id');
      break;
  }
  return errors;
}

module.exports = {
  stepTypes,
  validateStep,
};
