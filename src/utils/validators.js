const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

const isValidDelay = (ms) => {
  const num = parseInt(ms, 10);
  return !isNaN(num) && num >= 0;
};

module.exports = {
  isValidUrl,
  isValidDelay,
};
