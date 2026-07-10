# ---- build stage: compile the Vite/React app to static assets ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# `npm install` (not `npm ci`) so the Linux container can resolve platform-
# specific optional native deps (e.g. @emnapi/*) that a Windows-generated
# lockfile omits — a known npm cross-platform limitation.
RUN npm install --no-audit --no-fund

COPY . .
# VITE_API_BASE_URL is left unset so the app calls the same-origin "/api",
# which nginx (below) proxies to the backend container.
RUN npm run build

# ---- serve stage: nginx serves the build and proxies /api to the backend ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
