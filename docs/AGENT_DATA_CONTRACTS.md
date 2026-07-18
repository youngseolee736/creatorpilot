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
    "title": { "type": "string" },
    "text": { "type": "string" },
    "language": { "type": "string" },
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

Role: extract abstract storytelling mechanics. It must not output source-specific examples or long excerpts. `structure[].note` describes a function, not source wording. `safety.maxQuotedWords` must be `0` for v1.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["projectId", "transcript", "targetDurationSeconds"],
  "properties": {
    "projectId": { "type": "string" },
    "transcript": {
      "type": "object",
      "required": ["transcriptId", "language", "text", "segments"],
      "properties": {
        "transcriptId": { "type": "string" },
        "language": { "type": "string" },
        "text": { "type": "string" },
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
  "required": ["analysisId", "hookType", "hookDuration", "targetAudience", "tone", "pacing", "retentionTechniques", "callToAction", "estimatedOriginalDuration", "structure", "safety"],
  "properties": {
    "analysisId": { "type": "string" },
    "hookType": { "type": "string" },
    "hookDuration": { "type": "number", "minimum": 0 },
    "targetAudience": { "type": "string" },
    "tone": { "type": "string" },
    "pacing": { "type": "string" },
    "retentionTechniques": { "type": "array", "minItems": 1, "items": { "type": "string" } },
    "callToAction": { "type": "string" },
    "estimatedOriginalDuration": { "type": "number", "minimum": 0 },
    "structure": {
      "type": "array",
      "minItems": 2,
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
  "hookType": "Counter-intuitive claim",
  "hookDuration": 5,
  "targetAudience": "Curious general audience interested in cities and technology",
  "tone": "Urgent, informed, optimistic",
  "pacing": "Fast opening, measured evidence, decisive close",
  "retentionTechniques": ["Expectation reversal", "Concrete visual examples", "Open-loop question"],
  "callToAction": "Invite the viewer to reconsider the obvious solution",
  "estimatedOriginalDuration": 58,
  "structure": [
    { "label": "Hook", "start": 0, "end": 5, "note": "Contradict the expected answer" },
    { "label": "Context", "start": 5, "end": 14, "note": "Introduce an overlooked mechanism" }
  ],
  "safety": { "longSourceExcerptsIncluded": false, "maxQuotedWords": 0 }
}
```

## 3. Scriptwriter Agent

Role: write an original script for the user's topic. The required input explicitly includes topic, target language, duration, audience, reference analysis, and revision instructions. The agent must not receive the raw reference transcript.

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
  "required": ["scriptId", "title", "version", "estimatedSeconds", "sections"],
  "properties": {
    "scriptId": { "type": "string" },
    "supersedesScriptId": { "type": "string" },
    "title": { "type": "string", "minLength": 1 },
    "version": { "type": "integer", "minimum": 1 },
    "estimatedSeconds": { "type": "integer", "minimum": 1 },
    "sections": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "label", "range", "text"],
        "properties": {
          "id": { "type": "string" },
          "label": { "type": "string" },
          "range": { "type": "string" },
          "text": { "type": "string", "minLength": 1 }
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

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["projectId", "approvedReview", "script", "format", "targetDurationSeconds"],
  "properties": {
    "projectId": { "type": "string" },
    "approvedReview": {
      "type": "object",
      "required": ["reviewId", "scriptId", "status"],
      "properties": { "reviewId": { "type": "string" }, "scriptId": { "type": "string" }, "status": { "const": "passed" } }
    },
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
  "required": ["storyboardId", "scriptId", "totalDuration", "scenes"],
  "properties": {
    "storyboardId": { "type": "string" },
    "scriptId": { "type": "string" },
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

Role: validate an approved production package and coordinate asset, narration, caption, composition, and render tools. It must receive only a script with a matching `passed` review. This is enforced both by schema (`status: const passed`) and by backend authorization; frontend gating alone is insufficient.

Input schema:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["projectId", "approvedReview", "script", "storyboard", "productionSettings", "format", "durationSeconds"],
  "properties": {
    "projectId": { "type": "string" },
    "approvedReview": {
      "type": "object",
      "additionalProperties": false,
      "required": ["reviewId", "scriptId", "status"],
      "properties": {
        "reviewId": { "type": "string" },
        "scriptId": { "type": "string" },
        "status": { "const": "passed" }
      }
    },
    "script": { "type": "object", "required": ["scriptId", "version", "sections"] },
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
  "required": ["renderId", "status", "stage", "progress", "completed", "statusUrl"],
  "properties": {
    "renderId": { "type": "string" },
    "status": { "enum": ["queued", "running"] },
    "stage": { "type": "string" },
    "progress": { "type": "integer", "minimum": 0, "maximum": 100 },
    "completed": { "const": false },
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
  "required": ["renderId", "status", "stage", "progress", "completed", "format", "duration", "voice", "captionStyle", "music", "completedAt", "videoUrl", "productionPackageUrl"],
  "properties": {
    "renderId": { "type": "string" },
    "status": { "const": "completed" },
    "stage": { "const": "Final video ready" },
    "progress": { "const": 100 },
    "completed": { "const": true },
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
    "approvedReview": { "reviewId": "rv_01JZ8T", "scriptId": "sc_01JZ8S", "status": "passed" },
    "script": { "scriptId": "sc_01JZ8S", "version": 1, "sections": [{ "id": "hook", "text": "The most important line..." }] },
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
    "statusUrl": "/api/videos/render_01JZ8W/status"
  }
}
```

## Orchestrator validation rules

1. Validate every input before invoking an agent and every output before persistence.
2. Reject any Script Analyst output containing transcript-length quotations or source-specific examples.
3. Never send the raw transcript to the Scriptwriter; send only the validated abstract analysis.
4. Invalidate an existing review whenever script title or section text changes.
5. Require `review.scriptId === script.scriptId` and `review.status === "passed"` before storyboard or video production.
6. Store each script/review version immutably so stale approvals cannot authorize a revised script.
7. Treat model scores as product estimates, not factual or legal determinations.
