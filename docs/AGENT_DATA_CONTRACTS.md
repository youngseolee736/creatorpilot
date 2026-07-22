# CreatorPilot Agent Data Contracts

Status: backend handoff contract, version 1. All tool/agent boundaries use JSON objects. Agents must not return Markdown, commentary, code fences, or prose outside the declared fields. Unknown fields should be rejected in development and ignored only during an explicitly versioned migration.

## Shared envelope

Every invocation is wrapped by the orchestrator. `input` and `output` are the agent-specific objects defined below.

```json
{
  "contractVersion": "1.0",
  "runId": "run_01JZ8Q",
  "projectId": "project_01JZ8P",
  "agent": "script_analyst",
  "input": {},
  "output": {},
  "startedAt": "2026-07-18T05:10:00Z",
  "completedAt": "2026-07-18T05:10:04Z"
}
```

On failure, no partial output is promoted to project state:

```json
{
  "contractVersion": "1.0",
  "runId": "run_01JZ8Q",
  "projectId": "project_01JZ8P",
  "agent": "script_analyst",
  "error": {
    "code": "MODEL_OUTPUT_INVALID",
    "message": "The agent output did not match the required schema.",
    "retryable": true,
    "details": [{ "path": "output.structure", "reason": "required" }]
  }
}
```

## 1. Transcript Extractor Tool

Role: retrieve captions/transcript from the supplied YouTube URL and normalize timestamps. It must not invent missing captions.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["projectId", "youtubeUrl", "targetLanguage"],
  "properties": {
    "projectId": { "type": "string", "minLength": 1 },
    "youtubeUrl": { "type": "string", "format": "uri", "pattern": "^https://(www\\.)?(youtube\\.com|youtu\\.be)/" },
    "targetLanguage": { "type": "string", "minLength": 2 },
    "preferredCaptionLanguage": { "type": "string", "minLength": 2 }
  }
}
```

Output schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["transcriptId", "source", "title", "text", "language", "wordCount", "estimatedDuration", "segments"],
  "properties": {
    "transcriptId": { "type": "string" },
    "source": { "enum": ["youtube_captions", "speech_to_text"] },
    "title": { "type": ["string", "null"] },
    "text": { "type": "string" },
    "language": { "type": ["string", "null"] },
    "wordCount": { "type": "integer", "minimum": 1 },
    "estimatedDuration": { "type": "number", "minimum": 0 },
    "segments": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["start", "end", "text"],
        "properties": {
          "start": { "type": "number", "minimum": 0 },
          "end": { "type": "number", "exclusiveMinimum": 0 },
          "text": { "type": "string", "minLength": 1 }
        }
      }
    }
  }
}
```

Example output:

```json
{
  "transcriptId": "tr_01JZ8Q",
  "source": "youtube_captions",
  "title": "How coastal cities could move onto the water",
  "text": "Most people think the future of coastal cities is higher sea walls...",
  "language": "en",
  "wordCount": 92,
  "estimatedDuration": 58,
  "segments": [{ "start": 0, "end": 4.8, "text": "Most people think the future of coastal cities is higher sea walls." }]
}
```

## 2. Script Analyst Agent

Role: extract storytelling logic from spoken content and show how its Opening,
Build, and Payoff could apply to the user's new topic. It must not output
source-specific examples or long excerpts. Topic examples are illustrative
story moves, not researched claims. Evidence describes an observable function
rather than quoting the source, and transcript-only analysis cannot claim
visual, editing, music, analytics, or private-intent observations.
`structure[].note` describes a function, not source wording.
`safety.maxQuotedWords` must be `0` for v1. The transcript is untrusted
content and cannot alter agent identity, system instructions, provider settings,
tool access, or the output contract.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["projectId", "targetTopic", "transcript", "targetDurationSeconds"],
  "properties": {
    "projectId": { "type": "string" },
    "targetTopic": { "type": "string", "minLength": 3, "maxLength": 200 },
    "transcript": {
      "type": "object",
      "additionalProperties": false,
      "required": ["transcriptId", "text", "segments"],
      "properties": {
        "transcriptId": { "type": "string" },
        "source": { "type": "string" },
        "title": { "type": ["string", "null"] },
        "language": { "type": ["string", "null"] },
        "text": { "type": "string" },
        "wordCount": { "type": "integer", "minimum": 1 },
        "estimatedDuration": { "type": ["number", "null"], "minimum": 0 },
        "segments": { "type": "array", "items": { "type": "object" } }
      }
    },
    "targetDurationSeconds": { "type": "integer", "minimum": 15, "maximum": 180 },
    "analysisLanguage": { "type": "string" }
  }
}
```

Output schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["analysisId", "summary", "hookType", "hookDuration", "hookPurpose", "tone", "pacing", "callToAction", "reusablePatterns", "doNotCopy", "confidence", "estimatedOriginalDuration", "hookMechanics", "narrativeStyle", "informationFlow", "appliedExamples", "retentionMap", "structure", "safety"],
  "properties": {
    "analysisId": { "type": "string" },
    "summary": { "type": "string" },
    "hookType": { "type": "string" },
    "hookDuration": { "type": "number", "minimum": 0 },
    "hookPurpose": { "type": "string" },
    "tone": { "type": "string" },
    "pacing": { "type": "string" },
    "callToAction": { "type": "string" },
    "reusablePatterns": { "type": "array", "minItems": 1, "items": { "type": "string" } },
    "doNotCopy": { "type": "array", "minItems": 1, "items": { "type": "string" } },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "estimatedOriginalDuration": { "type": "number", "minimum": 0 },
    "hookMechanics": { "type": "object", "required": ["trigger", "curiosityGap", "promisedPayoff", "deliveryPattern", "evidenceStart", "evidenceEnd", "evidence"] },
    "narrativeStyle": { "type": "object", "required": ["primaryMode", "narrativeEngine", "progression"] },
    "informationFlow": { "type": "object", "required": ["pattern", "explanation", "sequence"] },
    "appliedExamples": { "type": "object", "required": ["opening", "build", "payoff"] },
    "retentionMap": { "type": "array", "minItems": 1, "maxItems": 3, "items": { "type": "object", "required": ["type", "start", "end", "purpose", "evidence"] } },
    "structure": {
      "type": "array",
      "minItems": 3,
      "maxItems": 6,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["label", "start", "end", "note"],
        "properties": {
          "label": { "type": "string" },
          "start": { "type": "number", "minimum": 0 },
          "end": { "type": "number", "minimum": 0 },
          "note": { "type": "string", "description": "Abstract narrative purpose only" }
        }
      }
    },
    "safety": {
      "type": "object",
      "additionalProperties": false,
      "required": ["longSourceExcerptsIncluded", "maxQuotedWords"],
      "properties": {
        "longSourceExcerptsIncluded": { "const": false },
        "maxQuotedWords": { "const": 0 }
      }
    }
  }
}
```

Example output:

```json
{
  "analysisId": "an_01JZ8R",
  "summary": "A concise explainer built around an expectation reversal and delayed resolution.",
  "hookType": "Counter-intuitive claim",
  "hookDuration": 5,
  "hookPurpose": "Challenge the expected answer and create curiosity.",
  "tone": "Urgent, informed, optimistic",
  "pacing": "Fast opening, measured evidence, decisive close",
  "callToAction": "Invite the viewer to reconsider the obvious solution",
  "reusablePatterns": ["Open with an expectation reversal", "Escalate from example to system stakes"],
  "doNotCopy": ["Reference-specific examples", "Distinctive analogies", "Original sentence sequences"],
  "confidence": 0.88,
  "estimatedOriginalDuration": 58,
  "hookMechanics": { "trigger": "It challenges the expected answer.", "curiosityGap": "The alternative is not explained yet.", "promisedPayoff": "Reveal how the alternative works.", "deliveryPattern": "Challenge, explain, complicate, resolve.", "evidenceStart": 0, "evidenceEnd": 5, "evidence": "The expected answer is rejected before context is supplied." },
  "narrativeStyle": { "primaryMode": "Problem and reveal", "narrativeEngine": "Each new detail makes the alternative more important until the ending resolves its value.", "progression": ["Challenge the assumption", "Explain the alternative", "Show how it works", "Add a problem", "Resolve the question"] },
  "informationFlow": { "pattern": "Question → explanation → complication → answer", "explanation": "The video explains the idea before revealing its larger consequences.", "sequence": ["Ask", "Explain", "Complicate", "Resolve"] },
  "appliedExamples": {
    "opening": "Messi is the MLS benchmark—but what if Son Heung-min is already making the stronger case?",
    "build": "Test Son's case through impact, consistency, and team influence without assuming the answer.",
    "payoff": "Reveal which standard makes Son's case strongest while acknowledging where Messi still leads."
  },
  "retentionMap": [{ "type": "Unanswered question", "start": 0, "end": 5, "purpose": "Make the viewer wait for the explanation.", "evidence": "The opening withholds the answer." }],
  "structure": [
    { "label": "Hook", "start": 0, "end": 5, "note": "Contradict the expected answer" },
    { "label": "Context", "start": 5, "end": 14, "note": "Introduce an overlooked mechanism" }
  ],
  "safety": { "longSourceExcerptsIncluded": false, "maxQuotedWords": 0 }
}
```

## 2a. Research Agent

Role: research the user's new topic after reference analysis and before writing.
It receives a tailored creative brief and a compact reference blueprint, never
the raw reference transcript. It defines subjective claims, builds a fair
comparison set, searches both supporting and opposing evidence, and maps facts
into the reference's story roles. The provider output is promoted only when
every fact, comparison, and counterpoint cites at least one HTTPS URL returned
in the web-search provider's own source or citation metadata.

Input fields: `projectId`, `creativeBrief` (`topic`, `angle`, `targetAudience`,
`viewerGoal`, `desiredTakeaway`, `tone`, `language`, `mustInclude`, `mustAvoid`,
`callToAction`), and `referenceBlueprint` (`analysisId`, hook, tone, pacing,
ending, up to three retention techniques, and three through six structure
sections).

Output fields: `researchId`, `summary`, literal-evidence `verdict`, a
`narrativeCase` that finds the strongest transparent route for proving the claim,
two through five
`criteria`, `comparisonSet`, zero through six `comparisons`, three through eight
role-tagged `facts`, sourced `counterpoint`, three through five `storyFindings`
linked to fact IDs, normalized `sources`, optional `openQuestions`, `searchedAt`,
and a safety object that explicitly states sources were provider-verified and
factual accuracy is not guaranteed.

## 3. Scriptwriter Agent

Role: write an original, claim-led script for the user's topic. Phase 7 input explicitly
includes the tailored `creativeBrief`, compact `referenceBlueprint`, approved
`factPack`, target language, duration, and revision instructions. The agent must
not receive the raw reference transcript and must not invent concrete factual
claims outside facts marked `usableInScript`. The topic is a required claim,
not a loose subject. Supported evidence is argued directly, partial support is
qualified under explicit criteria, and unsupported claims are challenged.

The older topic/audience/referenceAnalysis schema shown below is retained only
as historical v1 context and is no longer accepted by the running Phase 7 API.
See `docs/BACKEND_API_CONTRACT.md` for the current request example.

Implementation note: the model returns the exact `claim`, `title`, and ordered
section `slot`/`label`/`text`/`factIds` values. The backend derives the public `scriptId`, version
lineage, stable section IDs, ranges, and speaking-time estimate. It rejects raw
transcript fields, allowlists abstract analysis fields, and makes at most one
repair attempt for malformed, off-claim, insufficiently grounded, or incorrectly
sized model output. A finished draft must use every narrative-case support fact
and estimate within two seconds of the requested speaking duration.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["projectId", "topic", "targetLanguage", "targetDurationSeconds", "audience", "referenceAnalysis", "revisionInstructions"],
  "properties": {
    "projectId": { "type": "string" },
    "topic": { "type": "string", "minLength": 3, "maxLength": 140 },
    "targetLanguage": { "type": "string", "minLength": 2 },
    "targetDurationSeconds": { "type": "integer", "minimum": 15, "maximum": 180 },
    "audience": { "type": "string", "minLength": 3 },
    "referenceAnalysis": { "$ref": "#/$defs/referenceAnalysis" },
    "currentScript": { "type": ["object", "null"] },
    "revisionInstructions": { "type": "array", "items": { "type": "string", "minLength": 1 } }
  },
  "$defs": {
    "referenceAnalysis": {
      "type": "object",
      "required": ["analysisId", "hookType", "tone", "pacing", "retentionTechniques", "structure"],
      "properties": {
        "analysisId": { "type": "string" },
        "hookType": { "type": "string" },
        "tone": { "type": "string" },
        "pacing": { "type": "string" },
        "retentionTechniques": { "type": "array", "items": { "type": "string" } },
        "structure": { "type": "array", "items": { "type": "object" } }
      }
    }
  }
}
```

Output schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["scriptId", "claim", "claimStrategy", "usedFactIds", "title", "version", "estimatedSeconds", "sections"],
  "properties": {
    "scriptId": { "type": "string" },
    "supersedesScriptId": { "type": "string" },
    "claim": { "type": "string" },
    "claimStrategy": { "type": "object" },
    "usedFactIds": { "type": "array", "items": { "type": "string" } },
    "title": { "type": "string", "minLength": 1 },
    "version": { "type": "integer", "minimum": 1 },
    "estimatedSeconds": { "type": "integer", "minimum": 1 },
    "sections": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "label", "range", "text", "factIds"],
        "properties": {
          "id": { "type": "string" },
          "label": { "type": "string" },
          "range": { "type": "string" },
          "text": { "type": "string", "minLength": 1 },
          "factIds": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

Example input/output:

```json
{
  "input": {
    "projectId": "project_01JZ8P",
    "topic": "Why the United States cannot abandon Taiwan",
    "targetLanguage": "English",
    "targetDurationSeconds": 60,
    "audience": "Curious general audience interested in geopolitics",
    "referenceAnalysis": { "analysisId": "an_01JZ8R", "hookType": "Counter-intuitive claim", "tone": "Urgent, informed", "pacing": "Fast opening, measured evidence", "retentionTechniques": ["Expectation reversal"], "structure": [{ "label": "Hook", "start": 0, "end": 5, "note": "Contradict the expected answer" }] },
    "currentScript": null,
    "revisionInstructions": []
  },
  "output": {
    "scriptId": "sc_01JZ8S",
    "title": "Why the United States cannot abandon Taiwan",
    "version": 1,
    "estimatedSeconds": 59,
    "sections": [{ "id": "hook", "label": "Hook", "range": "0–5s", "text": "The most important line on a map may be the one ships cannot cross." }]
  }
}
```

## 4. Originality Reviewer Agent

Role: return a conservative originality estimate plus quality signals. It must always include pass/fail, originality estimate, potential phrase overlap, structure similarity, quality scores, revision instructions, and the non-legal disclaimer.

Implementation note: the model returns only evidence, estimates, quality scores,
and guidance. The backend derives `reviewId`, preserves the exact `scriptId`,
calculates `overall`, canonicalizes structure risk, applies pass/fail thresholds,
and supplies the fixed disclaimer. Phrase evidence must be a bounded exact excerpt
from the submitted reference transcript and script; invented evidence receives
one repair attempt and is never promoted to project state.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["projectId", "referenceTranscript", "referenceAnalysis", "script"],
  "properties": {
    "projectId": { "type": "string" },
    "referenceTranscript": { "type": "object", "required": ["transcriptId", "text"] },
    "referenceAnalysis": { "type": "object", "required": ["analysisId", "structure"] },
    "script": { "type": "object", "required": ["scriptId", "version", "sections"] },
    "thresholds": { "type": "object" }
  }
}
```

Output schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["reviewId", "scriptId", "status", "overall", "originalityEstimate", "structureSimilarity", "scores", "summary", "overlaps", "instructions", "disclaimer"],
  "properties": {
    "reviewId": { "type": "string" },
    "scriptId": { "type": "string" },
    "status": { "enum": ["passed", "failed"] },
    "overall": { "type": "integer", "minimum": 0, "maximum": 100 },
    "originalityEstimate": { "type": "integer", "minimum": 0, "maximum": 100 },
    "structureSimilarity": {
      "type": "object",
      "additionalProperties": false,
      "required": ["score", "risk", "note"],
      "properties": {
        "score": { "type": "integer", "minimum": 0, "maximum": 100 },
        "risk": { "enum": ["low", "medium", "high"] },
        "note": { "type": "string" }
      }
    },
    "scores": {
      "type": "object",
      "additionalProperties": false,
      "required": ["hook", "structure", "clarity", "duration"],
      "properties": {
        "hook": { "type": "integer", "minimum": 0, "maximum": 100 },
        "structure": { "type": "integer", "minimum": 0, "maximum": 100 },
        "clarity": { "type": "integer", "minimum": 0, "maximum": 100 },
        "duration": { "type": "integer", "minimum": 0, "maximum": 100 }
      }
    },
    "summary": { "type": "string" },
    "overlaps": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["reference", "generated", "risk", "note"],
        "properties": {
          "reference": { "type": "string", "maxLength": 240 },
          "generated": { "type": "string", "maxLength": 240 },
          "risk": { "enum": ["Low", "Medium", "High"] },
          "note": { "type": "string" }
        }
      }
    },
    "instructions": { "type": "array", "items": { "type": "string" } },
    "disclaimer": { "const": "This similarity review is an originality estimate, not a copyright or legal determination." }
  }
}
```

Example output:

```json
{
  "reviewId": "rv_01JZ8T",
  "scriptId": "sc_01JZ8S",
  "status": "passed",
  "overall": 91,
  "originalityEstimate": 91,
  "structureSimilarity": { "score": 34, "risk": "low", "note": "Only abstract pacing mechanics are shared." },
  "scores": { "hook": 88, "structure": 84, "clarity": 94, "duration": 98 },
  "summary": "The draft uses pacing discipline without repeating source language or examples.",
  "overlaps": [{ "reference": "The real breakthrough is not a single floating building.", "generated": "Support is therefore not only a promise to one partner.", "risk": "Low", "note": "Shared contrast construction, but different wording and meaning." }],
  "instructions": ["Avoid distinctive examples from the reference."],
  "disclaimer": "This similarity review is an originality estimate, not a copyright or legal determination."
}
```

## 5. Storyboard Agent

Role: convert only a reviewed script into a timed production plan. It may propose search terms, but it does not license or fetch media.

Implementation note: the backend resolves `approvedReviewId` from the running
Reviewer registry before invoking the model. It deterministically divides the
exact script narration into immutable scene slots and derives storyboard/scene
IDs, order, timing, and duration. The model returns only a matching slot plus
caption, visual direction, search query, and transition. Unknown model timing,
identity, or narration fields are ignored.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["projectId", "approvedReviewId", "script", "format", "targetDurationSeconds"],
  "properties": {
    "projectId": { "type": "string" },
    "approvedReviewId": { "type": "string" },
    "script": { "type": "object", "required": ["scriptId", "sections"] },
    "format": { "enum": ["9:16", "1:1", "16:9"] },
    "targetDurationSeconds": { "type": "integer", "minimum": 15, "maximum": 180 },
    "sceneCount": { "type": "integer", "minimum": 1, "maximum": 30 },
    "visualConstraints": { "type": "array", "items": { "type": "string" } }
  }
}
```

Output schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["storyboardId", "scriptId", "reviewId", "format", "totalDuration", "scenes"],
  "properties": {
    "storyboardId": { "type": "string" },
    "scriptId": { "type": "string" },
    "reviewId": { "type": "string" },
    "format": { "enum": ["9:16", "1:1", "16:9"] },
    "totalDuration": { "type": "number", "minimum": 1 },
    "scenes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "number", "start", "end", "duration", "narration", "caption", "visual", "searchQuery", "transition"],
        "properties": {
          "id": { "type": "string" },
          "number": { "type": "integer", "minimum": 1 },
          "start": { "type": "number", "minimum": 0 },
          "end": { "type": "number", "minimum": 0 },
          "duration": { "type": "number", "minimum": 0 },
          "narration": { "type": "string" },
          "caption": { "type": "string" },
          "visual": { "type": "string" },
          "searchQuery": { "type": "string" },
          "transition": { "type": "string" }
        }
      }
    }
  }
}
```

Example output:

```json
{
  "storyboardId": "sb_01JZ8V",
  "scriptId": "sc_01JZ8S",
  "totalDuration": 60,
  "scenes": [{ "id": "scene-1", "number": 1, "start": 0, "end": 5, "duration": 5, "narration": "The most important line on a map may be the one ships cannot cross.", "caption": "The line ships cannot cross", "visual": "Animated maritime map with a narrow passage highlighted", "searchQuery": "map ocean shipping corridor aerial", "transition": "Fade up" }]
}
```

The agent orchestrator must transform this object into the scene array returned by the HTTP endpoint and consumed by the current UI. The full object can remain the canonical persisted agent record.

## 6. Video Producer Agent

Role: validate an approved production package and coordinate an external render
tool. The HTTP boundary receives `approvedReviewId` and exact Storyboard scenes;
the implemented orchestrator resolves the matching passed review, canonical
script, and Storyboard record from server registries before provider use.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["projectId", "approvedReviewId", "storyboard", "productionSettings", "format", "durationSeconds"],
  "properties": {
    "projectId": { "type": "string" },
    "approvedReviewId": { "type": "string" },
    "storyboard": { "type": "array", "minItems": 1, "items": { "type": "object" } },
    "productionSettings": {
      "type": "object",
      "additionalProperties": false,
      "required": ["voice", "captions", "music"],
      "properties": {
        "voice": { "type": "string" },
        "captions": { "type": "string" },
        "music": { "type": "boolean" }
      }
    },
    "format": { "enum": ["9:16", "1:1", "16:9"] },
    "durationSeconds": { "type": "integer", "minimum": 15, "maximum": 180 }
  }
}
```

Initial output schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["renderId", "status", "stage", "progress", "completed", "source", "statusUrl"],
  "properties": {
    "renderId": { "type": "string" },
    "status": { "enum": ["queued", "running"] },
    "stage": { "type": "string" },
    "progress": { "type": "integer", "minimum": 0, "maximum": 100 },
    "completed": { "const": false },
    "source": { "const": "provider" },
    "statusUrl": { "type": "string" }
  }
}
```

Terminal output schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["renderId", "status", "stage", "progress", "completed", "source", "format", "duration", "voice", "captionStyle", "music", "completedAt", "videoUrl"],
  "properties": {
    "renderId": { "type": "string" },
    "status": { "const": "completed" },
    "stage": { "const": "Final video ready" },
    "progress": { "const": 100 },
    "completed": { "const": true },
    "source": { "const": "provider" },
    "format": { "enum": ["9:16", "1:1", "16:9"] },
    "duration": { "type": "number" },
    "voice": { "type": "string" },
    "captionStyle": { "type": "string" },
    "music": { "type": "boolean" },
    "completedAt": { "type": "string", "format": "date-time" },
    "videoUrl": { "type": "string", "format": "uri" },
    "productionPackageUrl": { "type": "string", "format": "uri" }
  }
}
```

Example input/output:

```json
{
  "input": {
    "projectId": "project_01JZ8P",
    "approvedReviewId": "rv_01JZ8T",
    "storyboard": [{ "id": "scene-1", "start": 0, "end": 5, "narration": "The most important line...", "visual": "Animated maritime map" }],
    "productionSettings": { "voice": "Min — Clear explainer", "captions": "Editorial high contrast", "music": false },
    "format": "9:16",
    "durationSeconds": 60
  },
  "output": {
    "renderId": "render_01JZ8W",
    "status": "queued",
    "stage": "Preparing production",
    "progress": 2,
    "completed": false,
    "source": "provider",
    "statusUrl": "/api/videos/render_01JZ8W/status"
  }
}
```

## Orchestrator validation rules

1. Validate every input before invoking an agent and every output before persistence.
2. Reject any Script Analyst output containing transcript-length quotations or source-specific examples.
3. Never send the raw transcript to the Research Agent or Scriptwriter; send the
   tailored brief, compact blueprint, and provider-grounded Fact Pack.
4. Invalidate an existing review whenever script title or section text changes.
5. Require `review.scriptId === script.scriptId` and `review.status === "passed"` before storyboard or video production.
6. Store each script/review version immutably so stale approvals cannot authorize a revised script.
7. Treat model scores as product estimates, not factual or legal determinations.
