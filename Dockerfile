# Build stage
FROM node:20-slim as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build-stage /app/dist /usr/share/nginx/html
# We use the custom nginx config from the root
# Actually, it's better to copy it here if doing a standalone image,
# but compose will mount it.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
