const { createLLMProvider } = require("../../services/llm");
const { mapLLMError } = require("../../services/llm/llm-errors");
const { normalizeReview, parseReviewJSON, requestFingerprint } = require("./normalize-review");
const {
  ORIGINALITY_REVIEWER_SYSTEM_PROMPT,
  REVIEW_REPAIR_SYSTEM_PROMPT,
  buildReviewRepairPrompt,
  buildReviewUserPrompt,
} = require("./originality-reviewer-prompt");
const { validateReviewRequest } = require("./originality-reviewer-schema");

class OriginalityReviewer {
  constructor(options = {}) {
    this.provider = options.provider || createLLMProvider({
      ...(options.llmOptions || {}),
      agentLabel: "Originality Reviewer",
      unsupportedErrorCode: "REVIEW_INTERNAL_ERROR",
    });
    this.completed = new Map();
    this.inFlight = new Map();
    this.maxCompleted = Number(options.maxCompleted) || 100;
  }

  async providerComplete(messages) {
    try {
      return await this.provider.complete(messages);
    } catch (error) {
      throw mapLLMError(error, "Originality Reviewer");
    }
  }

  remember(key, value) {
    if (this.completed.size >= this.maxCompleted) this.completed.delete(this.completed.keys().next().value);
    this.completed.set(key, value);
  }

  async generateCandidate(input, fingerprint) {
    const raw = await this.providerComplete([
      { role: "system", content: ORIGINALITY_REVIEWER_SYSTEM_PROMPT },
      { role: "user", content: buildReviewUserPrompt(input) },
    ]);
    try {
      return normalizeReview(parseReviewJSON(raw), input, fingerprint);
    } catch (error) {
      if (error?.code !== "INVALID_LLM_RESPONSE") throw error;
      const repaired = await this.providerComplete([
        { role: "system", content: REVIEW_REPAIR_SYSTEM_PROMPT },
        { role: "user", content: buildReviewRepairPrompt(raw, error, input) },
      ]);
      return normalizeReview(parseReviewJSON(repaired), input, fingerprint);
    }
  }

  async review(request) {
    const input = validateReviewRequest(request);
    const fingerprint = requestFingerprint(input);
    if (this.completed.has(fingerprint)) return this.completed.get(fingerprint);
    if (this.inFlight.has(fingerprint)) return this.inFlight.get(fingerprint);
    const operation = this.generateCandidate(input, fingerprint)
      .then((result) => {
        this.remember(fingerprint, result);
        return result;
      })
      .finally(() => this.inFlight.delete(fingerprint));
    this.inFlight.set(fingerprint, operation);
    return operation;
  }
}

module.exports = { OriginalityReviewer };
