# CreatorPilot

Live website: https://creatorpilot-95k2.onrender.com

CreatorPilot is an AI project I made to help plan a 10-15 minute YouTube
video. Instead of trying to make the full video automatically, the main idea is
to study strong reference transcripts, research the topic, write a new script,
and give guidance on the flow of the video, like the hook, structure, and
conclusion.

## What it does

```text
Reference transcript → Script Analysis → Research → Script Draft → Storyboard
```

- **Script Analysis**: looks at a reference transcript and pulls out the hook,
  pacing, and overall structure
  (manual transcript input + OpenRouter models: `openai/gpt-5-mini` and
  `google/gemini-2.5-flash-lite`)
- **Research**: makes a simple fact pack from web sources
  (OpenRouter Responses API + `openrouter:web_search` + `google/gemini-2.5-flash-lite`)
- **Script Draft:** writes a new script based on the structure and research
  (OpenRouter models: `openai/gpt-5-mini` and `google/gemini-2.5-flash-lite`)
- **Storyboard:** turns the script into a clearer scene-by-scene plan with
  captions, visuals, B-roll ideas, and AI image prompts
  (OpenRouter models, with image preview using `google/gemini-3.1-flash-lite-image`)
- **AI Image Preview:** can optionally generate storyboard still images
  (OpenRouter Images API + `google/gemini-3.1-flash-lite-image`)

To keep this free, I changed the workflow so the user can paste reference
transcripts directly instead of depending on paid transcript APIs.

I also tested the unofficial youtube-transcript Node.js package:
https://www.npmjs.com/package/youtube-transcript

But most hosted transcript APIs I looked at would add extra cost, so I decided
to keep the main workflow based on manual transcript input.

## Deep Research mode

Deep Research mode uses multiple models through OpenRouter for analysis and
writing. Right now I am mainly using GPT and Gemini in that comparison flow.
The research step is still kept lightweight because I did not want it to slow
everything down too much. I also used Claude earlier, but I took it out because
the API cost was getting too high.

## How to use it

1. Open the live website.
2. Paste 3 to 5 reference transcripts.
3. Enter the topic for the new video you want to plan.
4. Run the analysis and review the research results.
5. Read the generated script draft.
6. Review the storyboard to see the suggested hook, flow, visuals, and ending.

## Why I built it

I built this because I wanted something that could help beginner creators learn
from videos that already work. I liked the idea of making a tool that feels
more like a creative planning assistant than a chatbot. The main idea was to
break one big creative task into smaller stages and let each one focus on one
job.

## What I learned

- Smaller, more focused agents worked better than one huge vague prompt
- Model choice mattered more than I expected
- A polished storyboard ended up being a better final output for this project
  than trying to generate a full video

## Update After Demo Day

After professor feedback, I added Deep Research mode so multiple models could
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
