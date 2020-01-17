FROM node:12 AS build
WORKDIR /opt/build
COPY . .
RUN npm ci

FROM node:12-slim

# http-console should never need to run as root.
RUN useradd --create-home http-console

COPY --from=build /opt/build /opt/http-console
WORKDIR /opt/http-console

USER http-console
ENTRYPOINT ["node", "bin/http-console"]
