const { createLLMProvider } = require("../../services/llm");
const { mapLLMError } = require("../../services/llm/llm-errors");
const {
  createScenePlan,
  normalizeStoryboard,
  parseStoryboardJSON,
  requestFingerprint,
} = require("./normalize-storyboard");
const {
  STORYBOARD_REPAIR_SYSTEM_PROMPT,
  STORYBOARD_SYSTEM_PROMPT,
  buildStoryboardRepairPrompt,
  buildStoryboardUserPrompt,
} = require("./storyboard-prompt");
const { validateStoryboardRequest } = require("./storyboard-schema");

class StoryboardAgent {
  constructor(options = {}) {
    this.provider = options.provider || createLLMProvider({
      ...(options.llmOptions || {}),
      envPrefix: "STORYBOARD",
      agentLabel: "Storyboard Agent",
      unsupportedErrorCode: "STORYBOARD_INTERNAL_ERROR",
    });
    this.completed = new Map();
    this.storyboards = [];
    this.inFlight = new Map();
    this.maxCompleted = Number(options.maxCompleted) || 100;
  }

  async providerComplete(messages) {
    try {
      return await this.provider.complete(messages);
    } catch (error) {
      throw mapLLMError(error, "Storyboard Agent");
    }
  }

  remember(key, value, script) {
    if (this.completed.size >= this.maxCompleted) {
      const oldestKey = this.completed.keys().next().value;
      const oldest = this.completed.get(oldestKey);
      this.completed.delete(oldestKey);
      this.storyboards = this.storyboards.filter((record) => record.storyboard.storyboardId !== oldest?.storyboardId);
    }
    this.completed.set(key, value);
    this.storyboards.push({ storyboard: value, script });
  }

  findStoryboard(scenes) {
    return this.storyboards.find((record) => JSON.stringify(record.storyboard.scenes) === JSON.stringify(scenes)) || null;
  }

  async generateCandidate(input, scenePlan, fingerprint) {
    const raw = await this.providerComplete([
      { role: "system", content: STORYBOARD_SYSTEM_PROMPT },
      { role: "user", content: buildStoryboardUserPrompt(input, scenePlan) },
    ]);
    try {
      return normalizeStoryboard(parseStoryboardJSON(raw), input, scenePlan, fingerprint);
    } catch (error) {
      if (error?.code !== "INVALID_LLM_RESPONSE") throw error;
      const repaired = await this.providerComplete([
        { role: "system", content: STORYBOARD_REPAIR_SYSTEM_PROMPT },
        { role: "user", content: buildStoryboardRepairPrompt(raw, error, input, scenePlan) },
      ]);
      return normalizeStoryboard(parseStoryboardJSON(repaired), input, scenePlan, fingerprint);
    }
  }

  async generate(request) {
    const input = validateStoryboardRequest(request);
    const scenePlan = createScenePlan(input);
    const fingerprint = requestFingerprint(input);
    if (this.completed.has(fingerprint)) return this.completed.get(fingerprint);
    if (this.inFlight.has(fingerprint)) return this.inFlight.get(fingerprint);
    const operation = this.generateCandidate(input, scenePlan, fingerprint)
      .then((result) => {
        this.remember(fingerprint, result, input.script);
        return result;
      })
      .finally(() => this.inFlight.delete(fingerprint));
    this.inFlight.set(fingerprint, operation);
    return operation;
  }
}

module.exports = { StoryboardAgent };
