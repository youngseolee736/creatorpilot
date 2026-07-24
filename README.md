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
  (YouTube transcript extraction + OpenRouter chat models)
- Research Agent: builds a lightweight fact pack from web sources
  (OpenRouter Responses API + `openrouter:web_search`)
- Scriptwriter: writes a new script based on the structure and evidence
  (OpenRouter models)
- Storyboard Agent: converts the script into timed scenes, captions, visuals,
  B-roll ideas, and AI image prompts (OpenRouter models)
- AI Image Preview: optionally generates storyboard stills
  (OpenRouter Images API)

## Deep Research mode

Deep mode uses multiple models through OpenRouter for analysis and writing.
Right now, the comparison flow is centered on GPT and Gemini. The lightweight
research step stays simple to avoid becoming a bottleneck, and the judge picks
the strongest result. Claude was part of the ensemble earlier, but I removed it
to keep API costs lower.

## Why I built it

I wanted a system that helps beginner creators learn from videos that already
work. The main idea is simple: break one big creative task into smaller agent
roles with clear responsibilities, then let each role do one job well.

## What I learned

- Smaller, tightly scoped agents produce better results than one vague prompt
- Model choice matters, especially when comparing multiple writing strategies
- A polished storyboard can be a stronger final artifact than full video render

## Update After Demo Day

After professor feedback, I changed Deep Research mode so multiple models
compare and judge each other's outputs to produce a stronger final response.
Originally, this part used only GPT.

## What honestly I am not sure

I still think there is room to improve how much value the multi-model judging
system adds compared with its cost and latency. It produces better-looking
results in many cases, but I am not fully sure yet how often that improvement
is large enough to justify the extra API usage in a real production setting.

The hardest part for me was the contract layer. I was not always sure how
strict the agent output format should be. When I made it too strict,
validation errors happened too often. When I relaxed it too much, the output
quality and consistency dropped. I still think this is the part I understand
the least, and I would want to improve it more.
