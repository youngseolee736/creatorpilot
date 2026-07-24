# CreatorPilot

CreatorPilot is an AI project I made for YouTube script writing and storyboard
planning. Instead of starting from nothing, the idea is to learn from a
successful reference video, research the topic, write a new script, and then
turn that into a storyboard.

## What it does

```text
YouTube URL → Script Analyst → Research Agent → Scriptwriter → Storyboard Agent
```

- **Script Analyst**: looks at a reference video and pulls out the hook, pacing,
  and overall structure
  (YouTube transcript extraction + OpenRouter chat models)
- **Research Agent**: makes a simple fact pack from web sources
  (OpenRouter Responses API + `openrouter:web_search`)
- **Scriptwriter:** writes a new script based on the structure and research
  (OpenRouter models)
- **Storyboard Agent:** turns the script into timed scenes, captions, visuals,
  B-roll ideas, and AI image prompts (OpenRouter models)
- **AI Image Preview:** can optionally generate storyboard still images
  (OpenRouter Images API)

If transcript extraction fails, the user can also paste the reference
transcript manually and continue the workflow without starting over.

## Deep Research mode

Deep Research mode uses multiple models through OpenRouter for analysis and
writing. Right now I am mainly using GPT and Gemini in that comparison flow.
The research step is still kept lightweight because I did not want it to slow
everything down too much. I also used Claude earlier, but I took it out because
the API cost was getting too high.

## Why I built it

I built this because I wanted something that could help beginner creators learn
from videos that already work. The main idea was to break one big creative task
into smaller agent roles and let each one focus on one job.

## What I learned

- Smaller, more focused agents worked better than one huge vague prompt
- Model choice mattered more than I expected
- A polished storyboard ended up being a better final output for this project
  than trying to generate a full video

## Update After Demo Day

After professor feedback, I changed Deep Research mode so multiple models could
compare and judge each other's outputs and then choose a stronger final answer.
Originally, this part only used GPT.

## What honestly I am not sure

I still think I need to figure out whether the multi-model judging system is
really worth the extra cost and waiting time. Sometimes the result looks
better, but I am not fully sure yet if the difference is big enough every time
to make that extra API cost feel worth it.

The hardest part for me was the contract layer. I was never really sure how
strict the agent output format should be. If I made it too strict, errors kept
happening. If I made it too loose, the output got messy and less consistent. I
still feel like this is the part I understand the least, and it is the part I
would want to improve more if I keep working on this project.
