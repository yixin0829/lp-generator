import os
import openai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mangum import Mangum
import string
import json

app = FastAPI(
    title="Learning Path Generator API",
    description="An API that leverage OpenAI's GPT-3 API to generate learning path for any topic (e.g. React).",
    version="1",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add .env variables to os.environ dictionary for os.getenv() to work
load_dotenv() 
openai.api_key = os.getenv("OPENAI_API_KEY", default=None)

class LearningPath(BaseModel):
    topic: str
    completion: dict
    usage: dict
    status_code: int

class HTTPError(BaseModel):
    detail: str

    class Config:
        schema_extra = {
            "example": {"detail": "HTTPException raised."},
        }

# Helper
def generate_prompt(topic:str):
    """
    Helper to generate the prompt as input to OpenAI's completions endpoint.
    Input topic is any string key phrase to generate learning path for (e.g. React, Fishing)
    """
    # Remove punctuations from the user input topic
    topic = topic.translate(str.maketrans('', '', string.punctuation))

    return """Task: Generate a list of key concepts for learning a topic grouped by beginner, intermediate, advanced levels and output the result in JSON format.

Output for learning Angular:
{{
"Beginner": ["Modules", "Components", "Data Binding", "Directives", "Routing", "Forms", "Pipes", "Services"],
"Intermediate": ["Dependency Injection", "HTTP Requests", "Change Detection", "Angular CLI", "State Management", "Unit Testing"],
"Advanced": ["Web Workers", "Dynamic Components", "Optimizing Performance", "Angular Universal", "Advanced Routing", "Progressive Web Apps"]
}}

Output for learning {}:""".format(topic)

@app.get("/")
async def get_root():
    return {
        "Hello": "this is Learning Path Generator's BE."
    }


@app.get(
    "/v1/lp/{topic}",
    responses={
        status.HTTP_200_OK: {"model": LearningPath},
        status.HTTP_400_BAD_REQUEST: {"model": HTTPError},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": HTTPError},
        })
async def get_lp(topic:str):
    """Take any topic and call OpenAI's Completion engpoint to generate a learning path in JSON string format"""

    try:
        ######### Code for production (fetching from API)  ###########
        # Enforce client input length to prevent prompt injection
        if len(topic) > 60:
            return HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Input path parameter exceeds maximum length allowed (60 characters)."
            )
        
        # Enforce client content moderation
        mod_response = openai.Moderation.create(input=topic)
        content_flag = mod_response.get("results")[0].get("flagged")
        if content_flag:
            return HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User input does not complies with OpenAI's content policy. https://beta.openai.com/docs/usage-policies/content-policy"
            )

        response = openai.Completion.create(
            model="text-davinci-003",
            prompt=generate_prompt(topic),
            max_tokens = 200,
            temperature = 1
        )
        return {
            "topic": topic,
            "completion": json.loads(response.choices[0].text),
            "usage": response.usage,
            "status_code": status.HTTP_200_OK
        }
        ##############################################################

        ########## Code for testing FE (fetching from json) ##########
        # with open("./mock_response.json", "r") as f:
        #     response = json.load(f)
        #     return response
        ##############################################################

    except Exception as error:
        return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error)

# Create an adapter for running ASGI applications in AWS Lambda
handler = Mangum(app)