FROM node:18-alpine

WORKDIR /client

COPY package*.json /client
RUN npm i --force --slient
# RUN npm install react-scripts@5.0.1 -g

COPY . ./

CMD [ "npm", "start" ]