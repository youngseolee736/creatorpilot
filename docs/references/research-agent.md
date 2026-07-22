# Research Agent interface references

Reviewed: 2026-07-19

These references were reviewed for interaction patterns only. CreatorPilot keeps
its own visual language, copy, information architecture, and implementation.

## OpenAI Deep Research

Source: https://help.openai.com/en/articles/10500283-deep-research

Observed patterns:

- The user defines the desired outcome and source constraints before research.
- Research progress is distinct from the final report.
- Results expose citations and a sources-used section for verification.
- Users can review the research result before reusing it downstream.

CreatorPilot application:

- Capture a specific creative brief before research instead of inferring the
  target audience from the reference video.
- Show a dedicated Research Agent state and a reviewable Fact Pack before the
  Scriptwriter starts.

## Google NotebookLM

Source: https://support.google.com/notebooklm/answer/16179559?hl=en

Observed patterns:

- Answers are grounded in selected sources.
- Citations navigate back to their source context.
- Source selection is explicit and visible to the user.

CreatorPilot application:

- Every usable claim links to at least one source returned by the research
  provider.
- Keep claims, explanations, and source links together rather than presenting a
  detached bibliography.

## Perplexity

Source: https://www.perplexity.ai/help-center/en/articles/10352155-what-is-perplexity

Observed patterns:

- A concise synthesized answer appears before source detail.
- Citations and original-source links are prominent enough to verify quickly.
- Current web information is framed as research input, not unquestionable truth.

CreatorPilot application:

- Lead with a short research summary, then show claim cards and their sources.
- Label confidence and contested/uncertain areas without implying a legal or
  factual guarantee.

