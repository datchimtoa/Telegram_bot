const { v4: uuidv4 } = require('uuid');

const generateId = () => uuidv4();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  generateId,
  sleep,
};
