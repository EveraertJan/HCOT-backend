FROM node:8.16.2

RUN mkdir -p /hcot/lib

COPY package.json /hcot
COPY package-lock.json /hcot

WORKDIR /hcot

RUN npm install || cat npm-debug.log

VOLUME /hcot/src
VOLUME /hcot/uploads

EXPOSE 3000

CMD ["npm", "start"]
