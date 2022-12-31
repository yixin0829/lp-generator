# Learning Path Generator

## 1 Goal
Help people learn faster and easier.

## 2 Overview
Right now for the prototype thinking about building a dynamic site which can generate a learning path on any topic keyword user input (e.g. React or ... Fishing) in a nice UI. The prototype should also allow users to export the result to markdown, Notion, pdf, csv, etc

## 3 Value Proposition
We want to build more than a learning path generator but a solution to facilitate the consolidation of world's knowledge sharing by creating a place where users can share their learning and knowledge with others (also offer export features to speed up content creation for videos, notetaking, blogs).

## 4 Resources
- [GPT model output comparison tool](https://gpttools.com/comparisontool)
- [OpenAI documentation - model details](https://beta.openai.com/docs/models)
- [OpenAI example prompts and use cases](https://beta.openai.com/examples)
- [OpenAI Production Best Practice](https://beta.openai.com/docs/guides/production-best-practices)
- Similar ideas
    - [Similar idea: Learn from anyone](https://twitter.com/mckaywrigley/status/1284110063498522624)
    - [Roadmap.sh - open source learning groadmap project](https://roadmap.sh/frontend)
    - FE design reference - https://sharegpt.com/
- Miscellaneous
    - [Github Copilot code assistant](https://docs.github.com/en/copilot/quickstart)
    - [Fine tuning the model (GPT-3) - Tutorial by Weights & Biases](https://www.youtube.com/watch?v=5MNqn_7ty8A&ab_channel=Weights%26Biases) (to watch)

## 5 Planning
Future Roadmap: ebsite you can search for JavaScript. then the platform pits out the main concepts from different sources (an aggregator), a learning roadmap (beginner, intermediate, advanced) - scraping and classification, and a summary of each article (NLP text summarization). - under knowledge orchestration framework
- Leverage open AI GPT for initial learning path
- Design the UIUX for user to modify, interatc with the generated learning path ("Enrichment" and human in the loop)
- Eventually should support export the finalized LP like they did  in Wordle by copying to clipboard
- Stretch: publish learning path to public

### 5.1 To-Do
- [x] Model selction - davinci-003
- [x] Backend endpoint using python's [[FastAPI]]
    - Functional requirement: Take a keyword phrase as input and return a JSON formatted initial learning path template by using davinci-003
    - [*] User DB setup and design endpoints
- [x] Manual test endpoint in Postman
- [/] [[React.js]] FE. Functional requirements:
    - [x] FE should retrieve generated learning Path and represent it in an interative list of "concept cards"
    - [x] Users should be able to add/delete/rearrange the concept by simply drag and drop or different CTAs ("human in the loop for AI")
    - [x] Users should be able to export the finalized result in png or text format to clipboard for their own usage in their blogs, personal notes, videos, social medias
        - [ ] Should also be able to share the finalized result through link or on social media which would redirect friends back to the main site
    - [ ] FE overall polishing
- [x] Additional safety practices
    - [x] Leverage OpenAI's [Moderation Endpoint](https://beta.openai.com/docs/guides/moderation/overview) to filter sensitive topics such as learn about mass shooting, racism, discrimination
    - [x] Limit client input length to prevent prompt injection attack
    - [ ] Allow users to report inappropriate learning path (later)
- [ ] Stretch Goal 1: Add enrichment to the initially generated LP to further improve the UI (e.g. add relevant blogs, videos, images using Google APi)
- [ ] Stretch Goal 2: build out user database that allow users to publish their learning path to our DB and generate a link for them to share with friends on our web (kinda like Wordle or [ShareGPT's](https://sharegpt.com/explore) idea)
    - Note: eventually I think this will enable us to do some wonderful stuff with the data we gathered. **what if we can consolidate learning paths around same topic into a "master learning path"? 0.o**
    - A future site for learning everything
- [ ] Deploy to production
    - [ ] [Deploy FastAPI](https://fastapi.tiangolo.com/deployment/)to AWS API Gateway (w/ [Set up SSL certificate for security](https://fastapi.tiangolo.com/deployment/https/))
    - [ ] Deploy using AWS EB and set up CICD with Codepipeline

## 6 Learning Log
### 6.1 Model Selection (2022-12-08)
- Read model details page and decided to select davinci-03 as it's more capable of interpreting complex semantic meanings
- Also ran an output comparison to generate JSON learning path between three GPT models and davinci-003 give the most relevant output
![[Pasted image 20221208122854.png]]

### 6.2 First Working Completion API (2022-12-22 & 24)
- Run `uvicorn main:app --reload`
    - `main` - point to `main.py`
    - `app` - point to the app object instantiated from FastAPI class
    - `--reload` - reload upon code change (good for debugging)
- The main endpoint will call OpenAI's [/completions endpoint](https://beta.openai.com/docs/api-reference/completions)
- Created a prompt with example to keep output format consistent
- The initial API endpoint built using [[FastAPI]] is working well
- use `json.loads(str)` to convert str to dict format and `json.load()` to read file object
- Add API versioning `v1`

```python
with open("./path/to/file.json", "r") as f:
    mock_response = json.load(f)
```

### 6.3 FE Func 1(2022-12-25)
- Added form component and submitForm onclick event to fetch API endpoint for generating LP
- Issue: blocked becuase of CORs
    - Solution: configure CORs in BE https://fastapi.tiangolo.com/tutorial/cors/?h=cor
- Added a form component called `GenerateLp` (Lp = Learning path) that takes one input `topic` and call a prop function passed from `App` called `onSubmit` that fetch LP from BE and set state in `App` component level
- Added another `Lp` component that renders BE data into lists
    - Issue: map returns an array of `undefined`
    - solution: you need to use return inside `map()` 's callback function
    - The component will consitionally render based on whether `Lp` object (a state) is empty or not (check empty object using `Object.keys(Lp).length > 0`)
- Functionality 1 is working
![[Pasted image 20221225222300.png]]

### 6.4 Safety Practices in BE (2022-12-30)
- Implemented user content moderation using OpenAI's moderation endpoint
- added a max 60 character limit to topic to prevent prompt injection
- added additional HTTPExceptions with `fastapi.status` 
    - Issue: one response model will cause `pydantic` validation error when response is a HTTPException
    - Solution: created multiple response models. one for success output (`LeaningPath`), one for error output (`HTTPError`) and config in decorator using `responses={}` parameter

### 6.5 Next Step
- Work on user DB endpoints and DB set up
