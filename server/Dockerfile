FROM python:3.10
WORKDIR /server
COPY ./requirements.txt /server/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /server/requirements.txt
COPY . /server
# Only use --reload for developemnt
CMD [ "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]