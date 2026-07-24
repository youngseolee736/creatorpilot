# CreatorPilot Proposal

## Project title

CreatorPilot

## One-sentence summary

CreatorPilot is a web app where a user can add YouTube reference URLs, automatically analyze what makes those videos work, generate an original script on a different topic, and turn it into a scene-by-scene storyboard.

## Problem

A lot of people want to make YouTube videos, but it is hard to know where to start. Even if someone finds a good reference video, it is not easy to break down why it works, how the hook is built, how the information is structured, and how to turn that into a new original video idea. Manually finding and copying several transcripts also makes the process slower before the creative work even begins.

## Proposed solution

My idea for this project was to build an AI-assisted video planning workflow. A user gives the app three to five public YouTube URLs. The app retrieves the available captions, studies each reference separately, combines reusable storytelling patterns, researches the user's new topic, writes an original script, and then plans a storyboard.

The main idea was not just “make one answer with AI,” but to build a step-by-step system that helps with the whole creative process.

## Target users

The main users are beginner creators, students, and people who want help planning YouTube videos without starting from a blank page.

## Main features

- add three to five YouTube reference URLs
- automatically retrieve timestamped transcripts
- analyze the structure and pacing of each video separately
- combine abstract storytelling patterns without copying source wording
- research a new topic based on the user's idea
- generate a new script in a similar format but with original content
- suggest the flow of the video, like the hook, build, transitions, and conclusion
- create scene-by-scene planning for the video
- support flexible target duration, language, format, and analysis depth
- retry temporary provider failures while preserving completed work

## User flow

1. The user opens CreatorPilot.
2. The user adds three to five YouTube URLs and a new topic.
3. The user chooses the target language, duration, format, and Standard or Deep mode.
4. The backend retrieves each available transcript through TranscriptAPI.
5. The app analyzes every reference separately and synthesizes the reusable story mechanics.
6. The app researches the new topic and builds a source-grounded Fact Pack.
7. The app writes an original script.
8. The user reviews or revises the script.
9. The app creates timed scenes, captions, visual direction, and B-roll suggestions.

## Technology

- HTML, CSS, and JavaScript for the frontend
- Node.js and Express for the backend
- TranscriptAPI for timestamped YouTube caption extraction
- OpenRouter for GPT and Gemini model access
- OpenRouter web search for source-grounded research
- Render for live deployment and server-side environment variables

## Scope

At first, I wanted this project to feel like a full AI production assistant for 10-15 minute videos. The current version supports flexible target lengths and focuses on the planning work that can be reviewed clearly: reference analysis, research, script writing, and storyboard direction. It does not render a final MP4 or claim to replace an editor.

## Why this project matters to me

I wanted to build something creative but also technical. I like the idea of AI being used as a tool for helping people make things, not just answer questions. I also thought video creation was a fun area to explore because it combines research, writing, and design all in one project.

## Challenges I expected

The biggest challenge I expected was that I had never really made an agent-style system like this before, so I was not fully sure how to design it or how to make each part work together. I also expected it to be hard to connect multiple AI steps without things breaking or getting too messy.

I also thought it would be challenging to:

- figure out how to organize the different agent roles
- make the output consistent from one step to the next
- deal with API cost, especially if I wanted to use multiple models
- keep the project realistic enough to actually finish
- make the final result look polished enough for presentation

## Current status

The current version is live and more complete than the first prototype. Users now enter YouTube URLs instead of copying transcripts manually. TranscriptAPI retrieves the captions, while a manual transcript remains available as a fallback when captions are unavailable.

Standard mode uses one model per stage. Deep mode uses GPT and Gemini candidates plus a Judge for reference synthesis and script writing. Research and Storyboard stay single-model to control waiting time and API cost. The workflow also preserves completed steps, retries temporary provider errors, and keeps all provider keys in backend environment variables.

Instead of generating a final video, the project focuses on outputs a creator can review: story analysis, a source-grounded Fact Pack, an editable script, and a timed storyboard with captions, visual direction, B-roll ideas, and optional AI image previews.

## Final output

The final output is a live website where a user can start with public YouTube references and end with an original, editable production plan for a video of their chosen length. The plan includes the hook, structure, research findings, narration, scene timing, captions, visual direction, and conclusion. The app helps organize creative decisions; it does not copy a reference video or automatically render the finished video.
