import json
import os
import string

import openai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

PROD = True
VERSION = "v2"
SYSTEM_PROMPT = """Generate a list of key concepts for learning a new topic and rank them from easiest to most difficult. The generated key concepts should then be grouped as "beginner", "intermediate", or "advanced". Finally, the result is output in JSON format.

Example output for learning "JavaScript":
{{
  "Beginner": ["Variables", "Data Types", "Operators", "Conditional Statements", "Arrays", "Loops", "Functions", "Scope", "Objects"],
  "Intermediate": ["Events", "DOM Manipulation", "Error Handling", "Regular Expressions", "JSON", "AJAX", "Promises"],
  "Advanced": ["Prototypal Inheritance", "Closures", "Currying", "Async/Await", "ES6 Features", "Webpack", "Babel", "TypeScript"]
}}"""

app = FastAPI(
    title="Learning Path Generator API",
    description="An intermediary API that leverage OpenAI's GPT API to generate learning path for any topic (e.g. React).",
    version=VERSION,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Development code: Retrieve from local .env to os.environ dictionary for os.getenv() to work
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


@app.get("/")
async def get_root():
    return {"Hello": "this is Learning Path Generator's BE {}.".format(VERSION)}


@app.get(
    "/v2/lp/{topic}",
    responses={
        status.HTTP_200_OK: {"model": LearningPath},
        status.HTTP_400_BAD_REQUEST: {"model": HTTPError},
        status.HTTP_500_INTERNAL_SERVER_ERROR: {"model": HTTPError},
    },
)
async def get_lp(topic: str):
    """Take any topic and call OpenAI's Completion engpoint to generate a learning path in JSON string format"""

    try:
        # Remove punctuations from the user input topic and capitalize the first letter
        topic = topic.translate(str.maketrans("", "", string.punctuation)).title()

        # Enforce client input length to prevent prompt injection
        if len(topic) > 60:
            return HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Input path parameter exceeds maximum length allowed (60 characters).",
            )

        # Enforce client content moderation
        mod_response = openai.Moderation.create(input=topic)
        content_flag = mod_response.get("results")[0].get("flagged")
        if content_flag:
            return HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User input does not complies with OpenAI's content policy. https://beta.openai.com/docs/usage-policies/content-policy",
            )

        # Call OpenAI's Completion endpoint
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT,
                },
                {"role": "user", "content": f'Output for learning "{topic}":'},
            ],
        )

        return {
            "topic": topic,
            "completion": json.loads(response.choices[0].message.content),
            "usage": response.usage,
            "model": response.model,
            "status_code": status.HTTP_200_OK,
        }

    # Code for testing FE (fetching from json)
    # with open("./mock_response.json", "r") as f:
    #     response = json.load(f)
    #     return response

    except Exception as e:
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Server Error. Please try again later. Error: {e}",
        )
