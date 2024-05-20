FROM node:alpine

WORKDIR /quehaces
ADD . .
RUN npm i && npm run build
EXPOSE 7654
CMD ["node", "server"]
