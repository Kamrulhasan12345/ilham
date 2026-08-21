# Optional: run the ETL without installing node on the host.
#   podman compose --profile tools run --rm etl npm run doctor
#
# The default path is node on the host — it iterates faster and the ETL is
# ordinary scripts, not a service. This exists so "I don't want node installed"
# is not a blocker.
FROM docker.io/library/node:22-alpine

WORKDIR /app

# Dependencies first, so editing src/ does not reinstall them.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# extract streams the source files, so the default heap is enough. Raised a
# little anyway: the narrator profile file IS read whole (16MB), and detection
# materialises a 500-record sample.
ENV NODE_OPTIONS=--max-old-space-size=2048

# No CMD on purpose. This image is a toolbox you run subcommands in, not a
# service, and a default that silently loaded the corpus would be a trap.
ENTRYPOINT []
CMD ["node", "src/cli.js"]
