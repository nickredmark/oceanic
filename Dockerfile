FROM node
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm i
COPY . ./
RUN npm run build
ENTRYPOINT [ "npm" ]
CMD ["start"]