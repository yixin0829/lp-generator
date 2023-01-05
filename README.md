# Learning Path Generator

## 1 Goal
Help people learn faster and more efficiently to reach their learning goal. We set LearnAnything's missing to be facilitating the consolidation of world's knowledge sharing by creating a place where users can share their learning experience and knowledge with others.

## 2 Overview
Why did we build LearnAnything? You might ask. Well, we want you to think of LearnAnything as more than just a learning path generator, but as an entry point for YOU to begin your learning journey on any topic that you could possibly imagine. Just as Mahatma Gandhi once said, "Live as if you were to die tomorrow. Learn as if you were to live forever."

## 3 Resources
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

## 4 Planning
Future Roadmap: website you can search for JavaScript. then the platform pits out the main concepts from different sources (an aggregator), a learning roadmap (beginner, intermediate, advanced) - scraping and classification, and a summary of each article (NLP text summarization). - under knowledge orchestration framework (see Learney example above)
- Leverage open AI GPT for initial learning path
- Design the UIUX for user to modify, interatc with the generated learning path ("Enrichment" and human in the loop)
- Eventually should support export the finalized LP like they did  in Wordle by copying to clipboard
- Stretch: publish learning path to public (User DB)

### 4.1 To-Do
- [x] Model selction - davinci-003
- [x] Backend endpoint using python's [[FastAPI]]
    - Functional requirement: Take a keyword phrase as input and return a JSON formatted initial learning path template by using davinci-003
    - [*] User DB setup and design endpoints
- [x] Manual test endpoint in Postman
- [x] [[React.js]] FE. Functional requirements:
    - [x] FE should retrieve generated learning Path and represent it in an interative list of "concept cards"
    - [x] Users should be able to add/delete/rearrange the concept by simply drag and drop or different CTAs ("human in the loop for AI")
    - [x] Users should be able to export the finalized result in png or text format to clipboard for their own usage in their blogs, personal notes, videos, social medias
    - [x] Iterate to improve
- [x] Additional safety practices
    - [x] Leverage OpenAI's [Moderation Endpoint](https://beta.openai.com/docs/guides/moderation/overview) to filter sensitive topics such as learn about mass shooting, racism, discrimination
    - [x] Limit client input length to prevent prompt injection attack
    - [ ] Issue: OpenAI's crendential currently included in Lambda source code
    - [ ] Set up budget limitations for OpenAI and AWS services
- [x] Stretch Goal 1: Set up [LP counter](https://www.youtube.com/watch?v=R8GS-8nlekY&ab_channel=FlorinPop) on homepage
- [ ] Stretch Goal 2: Add enrichment to the initially generated LP to further improve the UI (e.g. add relevant blogs, videos, images using Google APi, [Awesome](https://github.com/sindresorhus/awesome) list  resources)
- [ ] Stretch Goal 3: build out user database that allow users to publish their learning path to our DB and generate a link for them to share with friends on our web (kinda like Wordle or [ShareGPT's](https://sharegpt.com/explore) idea)
    - Note: eventually I think this will enable us to do some wonderful stuff with the data we gathered. **what if we can consolidate learning paths around same topic into a "master learning path"? 0.o** --> A future site for learning everything
- [x] Deploy to production
    - [x] Deploy FE using Vercel (super quick)
    - [x] [Deploy FastAPI](https://fastapi.tiangolo.com/deployment/)with [[AWS Lambda]] (server-less hosting)

## 5 Learning Log
### 5.1 Model Selection (2022-12-08)
- Read model details page and decided to select davinci-03 as it's more capable of interpreting complex semantic meanings
- Also ran an output comparison to generate JSON learning path between three GPT models and davinci-003 give the most relevant output
![[Pasted image 20221208122854.png]]

### 5.2 First Working Completion API (2022-12-22 & 24)
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

### 5.3 FE Func 1(2022-12-25)
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

### 5.4 Safety Practices in BE (2022-12-30)
- Implemented user content moderation using OpenAI's moderation endpoint
- added a max 60 character limit to topic to prevent prompt injection
- added additional HTTPExceptions with `fastapi.status` 
    - Issue: one response model will cause `pydantic` validation error when response is a HTTPException
    - Solution: created multiple response models. one for success output (`LeaningPath`), one for error output (`HTTPError`) and config in decorator using `responses={}` parameter

### 5.5 Merge 2 repos  (2022-12-31)
- Merged FE repo into BE repo based on [this medium blog](https://blog.devgenius.io/how-to-merge-two-repositories-on-git-b0ed5e3b4448)
    - Renamed BE repo from `lp-generator-backend` to `lp-generator`
        - Reset remote origin by running `git remote set-url origin https://github.com/yixin0829/lp-generator.git`

### 5.6 Set up Docker Dev Env(2022-12-31)
- [dockerize Full Stack Applications With Python and ReactJS](https://www.youtube.com/watch?v=Jx39roFmTNg&ab_channel=Docker)
    - BE
        - Add `Dockerfile` and `.dockerignore` file
        - Build backend image running `docker build -t lp-backend .`
        - [?] Issue: access denied to unix socket when building image
            - Solution: [link](https://docs.docker.com/engine/install/linux-postinstall/#manage-docker-as-a-non-root-user)
        - Run container from BE image running `docker run --env-file=.env --name lp-backend --rm -p 8000:8000 lp-backend`
            - read .env securely on run time
            - `-rm` will clean up stuff after exiting container
    - FE - Same steps to add docker file and ignore and then build the FE image
        - `docker run --name lp-frontend --rm -p 3000:3000 lp-frontend`
    - Docker network
        - `docker network create lp-network`
    - Run both FE and BE container on image additional  `--network lp-network` flag
    - [*]  Everytime you build image with the same tag name. It won't overwrite previous image. Instead, the old image will lose its tag and become a "dangling" image which can be deleted manually in desktop application or through `rmi` command
    - SEt up `docker-compose.yml` in root to automate running multiple containers
        - later just need to run `docker compose up` in root to kick off FE and BE containers while set up the network
        - `--build` will tell compose to rebuild the image every time with new source code otherwise will use the same images
    - [*] Best practice: creating a ==dev container== and mount in your source code~ [tutorial](https://youtu.be/QeQ2MH5f_BE?t=607)

### 5.7 Docker live reload + Deployment (2023-01-03/4)
- [[Deployment|Deploy]] React FE to [[Vercel]] (super easy) - [prod link](https://lp-generator.vercel.app/)
- [deploy fastAPI BE to AWS Lambda](https://www.youtube.com/watch?v=RGIM4JfsSk0&ab_channel=pixegami) or [another older blog post](https://www.deadbear.io/simple-serverless-fastapi-with-aws-lambda/)
    - Serverless hosting - scalable, affordable
    - Only one file `main.py`
    - Note: Lambda doesn't understand fastAPI's ASGI interface but understand `handler function`
        - Use a package called [==Mangum==](https://mangum.io/) to create handler function for us to decide which endpoint to use - simply write `handler = Mangum(app)`
    - Create Lambda with python 3.9
    - Test hello world
    - copy paste in the fastAPI code and **deploy**
    - Issue: "unable to find lambda function"
        - Solution: editting runtime handler settings to `main.handler` to be consistent with source code's naming convention ("main" is the file name and "handler" is the handler object instantiated by **Mangum**)
    - Issue: couldn't find module "fastapi" - import python environment
        - [p] solution 1 (easiest): zip up all dependencies and upload to cloud
            - `pip install -t lib -r requirements.txt` - install libs in lib directory
            - zip all up -> add `main.py` and upload
            - Issue: Too big > 50MB
            - Solution: try upload zip through [[AWS S3]]. Note use [[MiniConda]] to create python 3.9 or 3.8 runtime and `pip` instead of `pip3`
        - solution 2: import through docker container built from AWS ECR
            - Issue: trouble include openai's credential in docker container and unsuccessful
        - solution 3: lambda layer [tutorial](https://www.linkedin.com/pulse/deploying-python-dependencies-using-aws-lambda-layer-anurag-mishra/)
            - ==Issue: Still facing import openai module error after adding the layer==
    - Api gateway proxy to customize a payload for testing the Lambda function
    - Adding HTTP endpoint
        - used to be super hard. need AWS APIGateway
        - These days, a new feature in Lambda makes it easy - **"create function URL"**
        - Downside: URL is ugly. probably still need APIGateway to hook to your FE
    - [?] Issue: Request blocked by CORS policy - multiple CORS headers - Use Network tool in developer  console to debugg ([tutorial](https://www.youtube.com/watch?v=PNtFSVU-YTI&ab_channel=WebDevSimplified))
        - Solution: Toggle off configure CORS in AWS Lambda function URL since we've already configure it in FastApi's source code
        - ![[Pasted image 20230104203441.png|500]]

### 5.8 Create LP Counter and FE UX Improve (2023-01-05)
- Created a counter with namespace with `https://api.countapi.xyz/create?namespace=learn-anything.ca&key=lp_counter&value=0`
- LP counter is implemented in Redis and completely free (as for now)
- Use `useEffect` hook in React to render `lpCounter` state hook after upadting DOM

### 5.9 Next Step
- [ ] SG 2 - enrichment
- [ ] Wrap up - update Markdown, user instructions and examples, code clean up
    - [ ] Docker live reload set up with docker Volume [link](https://www.freecodecamp.org/news/how-to-enable-live-reload-on-docker-based-applications/) for better dev experience
