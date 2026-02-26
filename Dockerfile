# -----------------------------------------------------------------------------
# Frontend (Vite + React) - build y servir con nginx
# -----------------------------------------------------------------------------
# Build:  docker build -t consultorio-web --build-arg VITE_API_URL=http://localhost:5000/api ./web
# Run:    docker run -p 3000:80 consultorio-web
# -----------------------------------------------------------------------------

# Etapa 1: build
FROM node:20-alpine AS builder

WORKDIR /app

# URL del API (se "hornea" en el build del frontend)
ARG VITE_API_URL=http://localhost:5000/api
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: servir estáticos con nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
