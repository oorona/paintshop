FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM node:20-alpine

RUN npm install -g serve

COPY --from=build /app/dist /app/dist

EXPOSE 80

CMD ["serve", "-s", "/app/dist", "-l", "80"]
