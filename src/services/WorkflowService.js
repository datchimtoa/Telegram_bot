const { workflowDB } = require('../db/JsonDB');
const Workflow = require('../models/Workflow');
const logger = require('../logger');

class WorkflowService {
  constructor() {
    this.workflows = workflowDB;
  }

  listAll() {
    return this.workflows.getAll();
  }

  getByName(name) {
    return this.workflows.findByName(name);
  }

  create(workflow) {
    if (this.getByName(workflow.name)) {
      throw new Error(`Workflow "${workflow.name}" already exists`);
    }
    this.workflows.add(workflow);
    logger.info(`Workflow created: ${workflow.name}`);
  }

  delete(name) {
    const existing = this.getByName(name);
    if (!existing) throw new Error(`Workflow "${name}" not found`);
    this.workflows.delete(name);
    logger.info(`Workflow deleted: ${name}`);
  }

  rename(oldName, newName) {
    if (!this.getByName(oldName)) throw new Error(`Workflow "${oldName}" not found`);
    if (this.getByName(newName)) throw new Error(`Workflow "${newName}" already exists`);
    this.workflows.updateWorkflow(oldName, wf => {
      wf.name = newName;
      wf.updatedAt = new Date().toISOString();
      return wf;
    });
    logger.info(`Workflow renamed from ${oldName} to ${newName}`);
  }

  clone(sourceName, newName) {
    const source = this.getByName(sourceName);
    if (!source) throw new Error(`Source workflow "${sourceName}" not found`);
    if (this.getByName(newName)) throw new Error(`Target workflow "${newName}" already exists`);
    const cloned = { ...source, name: newName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.workflows.add(cloned);
    logger.info(`Workflow cloned: ${sourceName} -> ${newName}`);
  }

  update(name, updaterFn) {
    const wf = this.getByName(name);
    if (!wf) throw new Error(`Workflow "${name}" not found`);
    this.workflows.updateWorkflow(name, updaterFn);
    logger.info(`Workflow updated: ${name}`);
  }
}

module.exports = new WorkflowService();
