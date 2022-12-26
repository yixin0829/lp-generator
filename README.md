# lp-generator-backend
Learning Path Generator backend API.

## How to Run
- Create a `.env` file in root and paste in your [OpenAI API key](https://openai.com/api/) as `OPENAI_API_KEY=...`
- Create a `venv` and `pip` install all dependencies in `requirements.txt`
- Run the BE using `uvicorn main:app --reload`