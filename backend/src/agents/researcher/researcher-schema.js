const { AppError } = require("../../middleware/error-handler");
const { normalizeCreativeBrief, normalizeReferenceBlueprint, plainObject, text } = require("../../contracts/creative-input");

const TOP_LEVEL_FIELDS = new Set(["projectId", "creativeBrief", "referenceBlueprint"]);

function validateResearchRequest(request) {
  if (!plainObject(request)) throw new AppError(400, "INVALID_RESEARCH_BRIEF", "The research request must be a JSON object.", false);
  if (Object.prototype.hasOwnProperty.call(request, "transcript")) {
    throw new AppError(400, "INVALID_RESEARCH_BRIEF", "The Research Agent does not accept the reference transcript.", false, [{ field: "transcript", reason: "prohibited" }]);
  }
  const unexpected = Object.keys(request).find((field) => !TOP_LEVEL_FIELDS.has(field));
  if (unexpected) throw new AppError(400, "INVALID_RESEARCH_BRIEF", "The research request contains an unexpected field.", false, [{ field: unexpected, reason: "unexpected_field" }]);
  return {
    projectId: text(request.projectId, "projectId", { max: 128, code: "INVALID_RESEARCH_BRIEF" }),
    creativeBrief: normalizeCreativeBrief(request.creativeBrief, { code: "INVALID_RESEARCH_BRIEF" }),
    referenceBlueprint: normalizeReferenceBlueprint(request.referenceBlueprint, { code: "INVALID_RESEARCH_BRIEF" }),
  };
}

module.exports = { validateResearchRequest };

