# CreatorPilot

CreatorPilot is an AI multi-agent YouTube production studio that turns a proven,
successful video into a brand-new script for you. It is built for beginners:
instead of starting from a blank page, you start from what already works.

## Motive

I started making YouTube videos, and honestly, my storytelling scripts were
terrible. A friend gave me simple advice: watch lots of videos in your niche
and copy them at first — that's how you learn what works.

So I thought: what if a service did that for you? CreatorPilot analyzes scripts
that are already complete and successful, then builds your script around them.

## How it works

```
YouTube URL → Script Analyst → Research Agent → Scriptwriter → Storyboard Agent
```

- **Script Analyst** — takes the transcript of a successful reference video and
  extracts its storytelling mechanics: the hook, the pacing, the structure.
  This becomes the blueprint for your script.
- **Research Agent** — searches the web and builds a Fact Pack with verified
  sources, so your script is grounded in real evidence, not made-up claims.
- **Scriptwriter** — writes an original script that follows the blueprint's
  storytelling structure but is filled with your topic and the researched
  facts. It also handles revision requests.
- **Storyboard Agent** — turns the approved script into timed scenes with
  captions, visual direction, transitions, and suggested B-roll queries. This is
  the final project artifact instead of an actual MP4 render.

### Deep Research mode

Deep mode upgrades the Script Analyst and Scriptwriter into an ensemble of
three models — Claude, Gemini, and GPT. Each model researches or writes
independently, and then a Judge step compares their outputs and picks the
strongest one as the final result. It costs more and takes longer, but produces
higher-quality analysis and scripts.

## What I learned

This project taught me how to use AI effectively, not just use it more. I had
always wanted to build an AI agent system where each agent has its own role and
its own restrictions — and now I understand why that matters. When you hand a
model a vague, broad instruction like "just do this," you get vague, low-quality
output back. Giving each agent a narrow role, a specific prompt, and clear
limits on what it can and cannot do made a visible difference in output
quality. That shift — from one big prompt to many small, constrained ones — was
the most meaningful lesson.

Working with OpenRouter was also a new experience. Being able to route
different agents to different models (Claude, Gemini, GPT) through a single
API opened my eyes to how much model choice affects the result — and made the
Deep Research mode's judge-based ensemble possible in the first place.
