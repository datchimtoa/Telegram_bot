const { validateStep } = require('./Step');

class Workflow {
  constructor(name, steps = []) {
    this.name = name;
    this.steps = steps;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  addStep(step) {
    this.steps.push(step);
    this.updatedAt = new Date().toISOString();
  }

  removeStep(index) {
    this.steps.splice(index, 1);
    this.updatedAt = new Date().toISOString();
  }

  moveStep(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.steps.length ||
        toIndex < 0 || toIndex >= this.steps.length) return;
    const step = this.steps.splice(fromIndex, 1)[0];
    this.steps.splice(toIndex, 0, step);
    this.updatedAt = new Date().toISOString();
  }

  validate() {
    const errors = [];
    if (!this.name || typeof this.name !== 'string') errors.push('Workflow name required');
    this.steps.forEach((step, idx) => {
      const stepErrors = validateStep(step);
      if (stepErrors.length) {
        errors.push(`Step ${idx + 1}: ${stepErrors.join(', ')}`);
      }
    });
    return errors;
  }
}

module.exports = Workflow;
