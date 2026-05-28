FROM node:24-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_API_LANGUAGE
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_LANGUAGE=$VITE_API_LANGUAGE

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
ENV API_PROXY_TARGET=http://data-concord:35981
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
