# Use the official Python image as the base image
FROM python:3.9

# Set the working directory within the container
WORKDIR /

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy your FastAPI application code into the container
COPY app/ .

# Expose the port your FastAPI app will run on
EXPOSE 8000

# Read environment variable passed when run the Docker container
ENV OPENAI_API_KEY=open_api_key

# Command to start the FastAPI application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
