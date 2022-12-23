import os
import openai
from fastapi import FastAPI
from dotenv import load_dotenv

app = FastAPI()
load_dotenv() # add .env variables to os.environ dictionary for os.getenv() to work
openai.api_key = os.getenv("OPENAI_API_KEY", default=None)
def generate_prompt(topic:str):
    return """Task: Generate a list of key concepts for learning a topic grouped by beginner, intermediate, advanced levels and output the result in JSON format.

Output for learning Angular:
{{
\"Beginner\": [\"Modules\", \"Components\", \"Data Binding\", \"Directives\", \"Routing\", \"Forms\", \"Pipes\", \"Services\"],
\"Intermediate\": [\"Dependency Injection\", \"HTTP Requests\", \"Change Detection\", \"Angular CLI\", \"State Management\", \"Unit Testing\"],
\"Advanced\": [\"Web Workers\", \"Dynamic Components\", \"Optimizing Performance\", \"Angular Universal\", \"Advanced Routing\", \"Progressive Web Apps\"]
}}

Output for learning {}:""".format(topic.capitalize())

@app.get("/")
def read_root():
    return "Hello, this is Learning Path Generator's BE."


@app.get("/lp/{topic}")
def generate_lp(topic:str):
    """Take any topic and call OpenAI's Completion engpoint to generate a learning path in JSON string format"""
    response = openai.Completion.create(
        model="text-davinci-003",
        prompt=generate_prompt(topic),
        max_tokens = 300,
        temperature = 1
    )
    return {"topic": topic, "completion": response.choices[0].text, "usage": response.usage, "status_code": 200}
