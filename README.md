# CreatorPilot

Live website: https://creatorpilot-95k2.onrender.com

CreatorPilot is an AI project I made to help plan YouTube videos of different
lengths. Instead of trying to make the full video automatically, the main idea is
to study strong reference videos, research the topic, write a new script,
and give guidance on the flow of the video, like the hook, structure, and
conclusion.

## What it does

```text
YouTube URLs → Transcript extraction → Script Analysis → Research → Script Draft → Storyboard
```

- **Transcript extraction:** takes three to five YouTube URLs and automatically
  retrieves timestamped captions through TranscriptAPI. If caption extraction
  fails, the user can still paste a transcript manually and continue.
- **Script Analysis:** analyzes every reference separately, then combines the
  strongest reusable storytelling patterns without copying the source wording
  (OpenRouter models: `openai/gpt-5-mini` and
  `google/gemini-2.5-flash-lite`).
- **Research**: makes a simple fact pack from web sources
  (OpenRouter Responses API + `openrouter:web_search`).
- **Script Draft:** writes a new script based on the structure and research
  (OpenRouter models: `openai/gpt-5-mini` and `google/gemini-2.5-flash-lite`)
- **Storyboard:** turns the script into a clearer scene-by-scene plan with
  captions, visuals, B-roll ideas, and AI image prompts
  (OpenRouter models, with image preview using `google/gemini-3.1-flash-lite-image`)
- **AI Image Preview:** can optionally generate storyboard still images
  (OpenRouter Images API + `google/gemini-3.1-flash-lite-image`)

I originally used manual transcript input because most hosted transcript
services added extra cost. Later, I found TranscriptAPI and received enough
starter credits to restore the simpler URL-based workflow. The API key stays on
the backend, successful responses are cached during the server process, and
failed transcript requests do not consume a transcript credit.

## Standard and Deep modes

Standard mode uses one model for each step. Each reference still needs its own
analysis, followed by one synthesis call, but there is no candidate comparison
or Judge.

Deep mode uses multiple models through OpenRouter for reference synthesis and
script writing. GPT and Gemini create separate candidates, then a Judge creates
the final result. Research and Storyboard stay single-model so the workflow does
not become unnecessarily slow or expensive. I also tested Claude earlier, but
removed it because the extra API cost was too high.

## How to use it

1. Open the live website.
2. Add 3 to 5 public YouTube URLs.
3. Enter the topic for the new video you want to plan.
4. Choose the target language, duration, format, and Standard or Deep mode.
5. Let CreatorPilot fetch and analyze each transcript.
6. Review the research results and generated script draft.
7. Review the storyboard for the suggested flow, visuals, captions, and ending.

## Why I built it

I built this because I wanted something that could help beginner creators learn
from videos that already work. I liked the idea of making a tool that feels
more like a creative planning assistant than a chatbot. The main idea was to
break one big creative task into smaller stages and let each one focus on one
job.

## What I learned

- Smaller, more focused agents worked better than one huge vague prompt
- Model choice mattered more than I expected
- Provider failures, retries, caching, and environment configuration mattered
  just as much as the model prompts
- A polished storyboard ended up being a better final output for this project
  than trying to generate a full video

## Update After Demo Day

After professor feedback, I added Deep mode so multiple models could
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
