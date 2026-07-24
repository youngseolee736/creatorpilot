# CreatorPilot

CreatorPilot is an AI multi-agent YouTube script and storyboard studio.
Instead of starting from a blank page, it studies a successful reference video,
researches the topic, writes a new script, and turns it into a production-ready
storyboard.

## What it does

```text
YouTube URL → Script Analyst → Research Agent → Scriptwriter → Storyboard Agent
```

- Script Analyst: extracts hook, pacing, and structure from a reference video
  using YouTube transcript extraction plus OpenRouter chat models for analysis
- Research Agent: builds a lightweight fact pack from web sources using the
  OpenRouter Responses API with `openrouter:web_search`
- Scriptwriter: writes a new script based on the structure and evidence using
  OpenRouter models for drafting and revision
- Storyboard Agent: converts the script into timed scenes, captions, visuals,
  B-roll ideas, and AI image prompts using OpenRouter models
- AI Image Preview: optionally generates storyboard stills using the
  OpenRouter Images API

## Deep Research mode

Deep mode uses multiple models through OpenRouter for analysis and writing.
Right now, the comparison flow is centered on GPT and Gemini. The lightweight
research step stays simple to avoid becoming a bottleneck, and the judge picks
the strongest result.

## Why I built it

I wanted a system that helps beginner creators learn from videos that already
work. The main idea is simple: break one big creative task into smaller agent
roles with clear responsibilities, then let each role do one job well.

## What I learned

- Smaller, tightly scoped agents produce better results than one vague prompt
- Model choice matters, especially when comparing multiple writing strategies
- A polished storyboard can be a stronger final artifact than full video render
