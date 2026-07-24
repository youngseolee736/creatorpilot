# Limitations and Privacy

## Transcript provider limitations

CreatorPilot uses the unofficial `youtube-transcript` package from the backend
only. It reads YouTube caption endpoints without an official YouTube API
contract, so upstream markup, response formats, blocking behavior, and
transcript availability can change without notice. Some public, private,
age-restricted, or caption-disabled videos do not expose transcripts.
Auto-generated captions may contain transcription and timing errors. The local
adapter currently returns `null` for the video title because caption extraction
does not provide title metadata.

CreatorPilot can also use a hosted transcript fallback when explicitly enabled.
That may improve success rate for some videos, but it adds an extra external
dependency, extra waiting time, and possibly extra cost depending on the
endpoint you use.

Access public transcripts responsibly and do not treat transcript availability
as permission to republish source text.

The backend does not store transcripts, does not log transcript bodies,
rejects malformed provider output, and maps provider timeouts, rate limits, and
unavailable captions to structured user-safe errors.

## LLM agent privacy and limitations

When analysis API mode is enabled, the full transcript and timing segments are
sent from the CreatorPilot backend to the configured LLM provider. CreatorPilot
does not persist the transcript or raw model response, and neither is
logged by application code. The provider may retain inputs according to its own
terms, so configure only an approved provider and retention policy.

The Script Analyst treats transcript text as untrusted content, requests JSON
only, validates and normalizes the result, rejects long source excerpts, and
makes one structured repair attempt for malformed JSON. These controls reduce
risk but do not make model analysis deterministic.

The Scriptwriter receives the tailored brief, compact blueprint, and approved
Fact Pack but never the raw reference transcript. Revision requests additionally
send the current draft and explicit instructions to the configured provider.

The Research Agent searches the public web and exposes provider-returned sources,
but neither citations nor model output guarantee factual accuracy. The backend
does not guarantee factual accuracy.

The Storyboard Agent receives the exact script narration and proposes
visual metadata only. Search queries do not establish asset availability,
accuracy, suitability, or licensing.
