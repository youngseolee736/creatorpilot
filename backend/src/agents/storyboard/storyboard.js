const { AppError } = require("../../middleware/error-handler");
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
      agentLabel: "Storyboard Agent",
      unsupportedErrorCode: "STORYBOARD_INTERNAL_ERROR",
    });
    this.reviewResolver = options.reviewResolver || (() => null);
    this.completed = new Map();
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

  remember(key, value) {
    if (this.completed.size >= this.maxCompleted) this.completed.delete(this.completed.keys().next().value);
    this.completed.set(key, value);
  }

  async authorize(input) {
    const review = await this.reviewResolver(input.approvedReviewId);
    if (!review) {
      throw new AppError(404, "REVIEW_NOT_FOUND", "The approved review is not available on this server.", false);
    }
    if (review.status !== "passed" || review.scriptId !== input.script.scriptId) {
      throw new AppError(403, "SCRIPT_NOT_APPROVED", "The current script does not have a matching passed review.", false);
    }
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
    await this.authorize(input);
    const scenePlan = createScenePlan(input);
    const fingerprint = requestFingerprint(input);
    if (this.completed.has(fingerprint)) return this.completed.get(fingerprint);
    if (this.inFlight.has(fingerprint)) return this.inFlight.get(fingerprint);
    const operation = this.generateCandidate(input, scenePlan, fingerprint)
      .then((result) => {
        this.remember(fingerprint, result);
        return result;
      })
      .finally(() => this.inFlight.delete(fingerprint));
    this.inFlight.set(fingerprint, operation);
    return operation;
  }
}

module.exports = { StoryboardAgent };
