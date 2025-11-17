module.exports = {
  isValidName(name) {
    return typeof name === "string" && name.trim().length >= 2;
  },

  isValidInt(value) {
    return Number.isInteger(value) && value > 0;
  },
};
