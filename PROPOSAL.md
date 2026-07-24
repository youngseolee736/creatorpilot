# CreatorPilot Proposal

## Project title

CreatorPilot

## One-sentence summary

CreatorPilot is a web app where a user can paste reference videos, get help analyzing what makes those videos work, generate a new script on a different topic, and get guidance on how to structure a 10-15 minute video.

## Problem

A lot of people want to make longer YouTube videos, but it is hard to know where to start. Even if someone finds a good reference video, it is not easy to break down why it works, how the hook is built, how the information is structured, and how to turn that into a new original video idea.

## Proposed solution

My idea for this project was to build an AI-assisted video planning workflow. A user would give the app a few reference videos, and the app would study them, figure out the storytelling pattern, research the user's new topic, write a new script, and then help plan how the final video should be structured.

The main idea was not just “make one answer with AI,” but to build a step-by-step system that helps with the whole creative process.

## Target users

The main users are beginner creators, students, and people who want help planning longer YouTube videos.

## Main features

- paste or link reference videos
- analyze the structure and pacing of those videos
- research a new topic based on the user's idea
- generate a new script in a similar format but with original content
- suggest the flow of the video, like the hook, build, transitions, and conclusion
- create scene-by-scene planning for the video

## User flow

1. The user opens CreatorPilot.
2. The user adds reference videos.
3. The app analyzes how those videos are structured.
4. The user enters a new topic they want to cover.
5. The app researches that topic.
6. The app writes a new script.
7. The app suggests the flow of the video, including the hook, main structure, and conclusion.
8. The app plans scenes and visuals.

## Technology

- HTML, CSS, and JavaScript for the frontend
- Node.js for the backend
- AI model APIs for analysis, research, and writing
- a deployment platform so the project can be used live in the browser

## Scope

At first, I wanted this project to feel like a full AI production assistant. Even though the final version became more focused, the bigger idea was to help guide the full planning process of a video from reference analysis to script and structure.

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

The current version of the project is more focused than the original proposal. Instead of generating a final video, it now focuses more on script creation, structure planning, and storyboard planning. I also changed part of the system so different AI models could compare and judge outputs to help produce a stronger final result. At the same time, I simplified other parts so the project would be more stable and more realistic to finish well.

## Final output

The final goal in this proposal was a live website where a user could start with reference videos and end with a clear plan for how to make a 10-15 minute video, including the flow, hook, structure, and conclusion. Even if the final version became more focused later, that was the original direction I wanted to explore.
