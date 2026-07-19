const { AppError } = require("../../middleware/error-handler");
const { createRenderProvider } = require("../../services/render");
const { mapRenderError } = require("../../services/render/render-errors");
const { normalizeStart, normalizeStatus, requestFingerprint } = require("./normalize-render");
const { validateRenderRequest } = require("./video-producer-schema");

class VideoProducer {
  constructor(options = {}) {
    this.provider = options.provider || createRenderProvider(options.renderOptions || {});
    this.reviewResolver = options.reviewResolver || (() => null);
    this.storyboardResolver = options.storyboardResolver || (() => null);
    this.jobs = new Map();
    this.jobsByFingerprint = new Map();
    this.inFlight = new Map();
    this.maxJobs = Number(options.maxJobs) || 100;
  }

  async authorize(input) {
    const review = await this.reviewResolver(input.approvedReviewId);
    if (!review) throw new AppError(404, "REVIEW_NOT_FOUND", "The approved review is not available on this server.", false);
    const record = await this.storyboardResolver(input.approvedReviewId, input.storyboard);
    if (!record || review.status !== "passed" || review.scriptId !== record.storyboard.scriptId) {
      throw new AppError(403, "STORYBOARD_NOT_APPROVED", "The submitted storyboard does not match the passed review.", false);
    }
    if (record.storyboard.format !== input.format || record.storyboard.totalDuration !== input.durationSeconds) {
      throw new AppError(422, "ASSET_OR_TIMELINE_INVALID", "The submitted production settings do not match the approved storyboard.", false);
    }
    return { review, record };
  }

  publicStart(job) {
    if (job.publicStatus.completed) return job.publicStatus;
    return {
      ...job.publicStatus,
      completed: false,
      source: "provider",
      statusUrl: `/api/videos/${job.renderId}/status`,
    };
  }

  remember(job, fingerprint) {
    if (this.jobs.size >= this.maxJobs) {
      const oldestId = this.jobs.keys().next().value;
      const oldest = this.jobs.get(oldestId);
      this.jobs.delete(oldestId);
      if (oldest?.fingerprint) this.jobsByFingerprint.delete(oldest.fingerprint);
    }
    this.jobs.set(job.renderId, job);
    this.jobsByFingerprint.set(fingerprint, job.renderId);
  }

  async startCandidate(input, fingerprint) {
    const { review, record } = await this.authorize(input);
    const productionPackage = {
      projectId: input.projectId,
      approvedReview: { reviewId: review.reviewId, scriptId: review.scriptId, status: review.status },
      script: record.script,
      storyboard: record.storyboard,
      productionSettings: input.productionSettings,
      format: input.format,
      durationSeconds: input.durationSeconds,
    };
    let raw;
    try {
      raw = await this.provider.startRender(productionPackage, fingerprint);
    } catch (error) {
      throw mapRenderError(error);
    }
    const started = normalizeStart(raw);
    const renderId = `render_${fingerprint.slice(0, 20)}`;
    const job = {
      renderId,
      providerJobId: started.providerJobId,
      fingerprint,
      input,
      publicStatus: {
        renderId,
        status: started.status,
        stage: started.stage,
        progress: started.progress,
      },
    };
    this.remember(job, fingerprint);
    return this.publicStart(job);
  }

  async start(request) {
    const input = validateRenderRequest(request);
    const fingerprint = requestFingerprint(input);
    const existingId = this.jobsByFingerprint.get(fingerprint);
    if (existingId && this.jobs.has(existingId)) return this.publicStart(this.jobs.get(existingId));
    if (this.inFlight.has(fingerprint)) return this.inFlight.get(fingerprint);
    const operation = this.startCandidate(input, fingerprint).finally(() => this.inFlight.delete(fingerprint));
    this.inFlight.set(fingerprint, operation);
    return operation;
  }

  async status(renderId) {
    const job = this.jobs.get(String(renderId || ""));
    if (!job) throw new AppError(404, "RENDER_NOT_FOUND", "The render job was not found.", false);
    if (["completed", "failed"].includes(job.publicStatus.status)) return job.publicStatus;
    let raw;
    try {
      raw = await this.provider.getStatus(job.providerJobId);
    } catch (error) {
      throw mapRenderError(error);
    }
    job.publicStatus = normalizeStatus(raw, job);
    return job.publicStatus;
  }
}

module.exports = { VideoProducer };
