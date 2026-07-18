class LLMProvider {
  async complete(messages, options = {}) { // eslint-disable-line no-unused-vars
    throw new Error("LLMProvider.complete must be implemented.");
  }
}

module.exports = { LLMProvider };
