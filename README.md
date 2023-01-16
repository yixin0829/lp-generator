# Learning Path Generator

## 1 Goal
Help people learn faster and more efficiently to reach their learning goal. LearnAnything's mission is to facilitate the consolidation of the world's knowledge sharing by creating a place where users can share their learning experiences and knowledge with others.

## 2 Overview
Why did we build LearnAnything? You might ask. Well, we want you to think of LearnAnything as more than just a learning path generator, but as an entry point for YOU to begin your learning journey on any topic that you could possibly imagine. Just as Mahatma Gandhi once said, "Live as if you were to die tomorrow. Learn as if you were to live forever."

## 3 How to Run
### 3.1 Without Docker
- BE
    - Create venv (python 3.8) and install `requirements.txt`
    - Development mode: `cd/server/app && uvicorn main:app --reload` to start the local server
        - Comment out main:27-28 and comment main:31 to get env from local `.env`
        - Comment out main:123-125 if want to get mock response from json for testing FE (optional)
    - In production
        - Comment out main:31 and comment main:27-28 to get env from Lambda env configuration
        - Only include `main.py` and `lib/` in zip file (exclude `.env` for best practice) when upload code to Lambda
- FE
    - Install React and Node
    - `cd/client/ && npm install --force` otherwise dependency error
    - Comment out LearningPath.jsx:15 to fetch data from local server
    - `npm start`

### 3.2 With Docker
- Note: Currently no live-reload so need to rebuild image to reflect code changes
- Developement config
    - Comment out main:27-28 and comment main:31 to get env from local `.env`
    - Comment out main:123-125 if to get mock response from json (optional)
    - Comment out LearningPath.jsx:15 to fetch data from local server
- Run `docker compose up --build` in root directory

## 4 Resources
- [GPT model output comparison tool](https://gpttools.com/comparisontool)
- [OpenAI Best Practices for Prompt Engineering](https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-openai-api)
- [OpenAI documentation - model details](https://beta.openai.com/docs/models)
- [OpenAI example prompts and use cases](https://beta.openai.com/examples)
- [OpenAI Production Best Practice](https://beta.openai.com/docs/guides/production-best-practices)
- FE Utilities
    - [WebGradient Templates](https://webgradients.com/)
    - [ShareGPT](https://sharegpt.com/) - Design reference
- Similar ideas
    - [Similar idea: Learn from anyone](https://twitter.com/mckaywrigley/status/1284110063498522624)
    - [Roadmap.sh - open source learning groadmap project](https://roadmap.sh/frontend)
    - [*] [Learn Anything xyz](https://learn-anything.xyz/)
    - [*] [Learney - closest example](https://maps.joindeltaacademy.com/)
    - [Map of Reddit](https://anvaka.github.io/map-of-reddit/) by [Anvaka (graph lover)](https://github.com/anvaka)
- Miscellaneous
    - [Github Copilot code assistant](https://docs.github.com/en/copilot/quickstart)
    - [Fine tuning the model (GPT-3) - Tutorial by Weights & Biases](https://www.youtube.com/watch?v=5MNqn_7ty8A&ab_channel=Weights%26Biases) (to watch)
