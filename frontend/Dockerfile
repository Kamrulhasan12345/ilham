# The frontend image: nginx serving the built SPA, and proxying /api to the
# backend so the browser sees one origin.
#
#   docker build -t ilham-web ./frontend
#   docker run -p 8080:80 -e API_UPSTREAM=http://api:3000 ilham-web
#
# The upstream used to be written into nginx.conf, so the image worked in one
# compose topology and nowhere else. It is now ${API_UPSTREAM} in
# nginx.conf.template, which the nginx image renders at start.
#
# You do not need this image to deploy. `npm run build` writes dist/, which is
# plain static output for any static host. That path has no proxy, so build it
# with VITE_API_BASE set to the API's absolute URL — and read the SameSite note
# in frontend/.env.example first, because it affects the login flow.

FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Empty by default, which leaves the app calling same-origin /api — correct for
# this image, because nginx below proxies it. Set it only for a static-host
# build, where nothing proxies anything.
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

# /etc/nginx/templates, not /etc/nginx/conf.d: the image's own entrypoint runs
# envsubst over this directory at start and writes the result to conf.d.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Restrict substitution to API_* names. envsubst would otherwise consider every
# variable in the environment, including any that collides with nginx's own
# $host, $remote_addr, $scheme or $uri.
ENV NGINX_ENVSUBST_FILTER="^API_" \
    API_UPSTREAM="http://api:3000"

EXPOSE 80
