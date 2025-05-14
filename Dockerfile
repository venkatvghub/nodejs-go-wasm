FROM node:18-slim AS build

RUN apt-get update && apt-get install -y curl wget
# Install TinyGo 0.33.0
RUN wget https://github.com/tinygo-org/tinygo/releases/download/v0.33.0/tinygo_0.33.0_amd64.deb && \
    dpkg -i tinygo_0.33.0_amd64.deb || true && \
    apt-get install -f -y && rm tinygo_0.33.0_amd64.deb

WORKDIR /app
COPY . .

RUN cd wasm && tinygo build -o ../src/crypto.wasm -target=wasi ./crypto.go
RUN npm ci --omit=dev
RUN npm run build --if-present || true

CMD ["node", "dist/index.js"]