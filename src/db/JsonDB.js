const path = require('path');
const fs = require('fs-extra');
const logger = require('../logger');
const config = require('../config');

class JsonDB {
  constructor(filename) {
    this.filePath = path.join(config.dataDir, filename);
    this.ensureFile();
  }

  ensureFile() {
    try {
      fs.ensureFileSync(this.filePath);
      if (fs.readFileSync(this.filePath, 'utf8').trim() === '') {
        fs.writeJsonSync(this.filePath, this.defaultValue(), { spaces: 2 });
      }
    } catch (error) {
      logger.error(`Failed to ensure file ${this.filePath}`, error);
      throw error;
    }
  }

  defaultValue() {
    // To be overridden if needed
    return {};
  }

  read() {
    try {
      return fs.readJsonSync(this.filePath);
    } catch (error) {
      logger.error(`Failed to read ${this.filePath}`, error);
      return this.defaultValue();
    }
  }

  write(data) {
    try {
      fs.writeJsonSync(this.filePath, data, { spaces: 2 });
    } catch (error) {
      logger.error(`Failed to write ${this.filePath}`, error);
      throw error;
    }
  }

  update(updaterFn) {
    const data = this.read();
    const newData = updaterFn(data);
    this.write(newData);
    return newData;
  }
}

class WorkflowDB extends JsonDB {
  constructor() {
    super('workflows.json');
  }

  defaultValue() {
    return [];
  }

  getAll() {
    return this.read();
  }

  findByName(name) {
    const workflows = this.getAll();
    return workflows.find(w => w.name === name);
  }

  add(workflow) {
    this.update(workflows => {
      workflows.push(workflow);
      return workflows;
    });
  }

  updateWorkflow(name, updaterFn) {
    this.update(workflows => {
      const index = workflows.findIndex(w => w.name === name);
      if (index !== -1) {
        workflows[index] = updaterFn(workflows[index]);
      }
      return workflows;
    });
  }

  delete(name) {
    this.update(workflows => workflows.filter(w => w.name !== name));
  }
}

class SessionDB extends JsonDB {
  constructor() {
    super('sessions.json');
  }

  defaultValue() {
    return {};
  }

  get(chatId) {
    const sessions = this.read();
    return sessions[chatId] || null;
  }

  set(chatId, session) {
    this.update(sessions => {
      sessions[chatId] = session;
      return sessions;
    });
  }

  delete(chatId) {
    this.update(sessions => {
      delete sessions[chatId];
      return sessions;
    });
  }
}

class BotStateDB extends JsonDB {
  constructor() {
    super('bot_state.json');
  }

  defaultValue() {
    return { on: true }; // Bot starts ON by default
  }

  isOn() {
    return this.read().on;
  }

  setOn(value) {
    this.update(state => {
      state.on = value;
      return state;
    });
  }
}

module.exports = {
  workflowDB: new WorkflowDB(),
  sessionDB: new SessionDB(),
  botStateDB: new BotStateDB(),
};
