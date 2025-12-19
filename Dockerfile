# case-bros (Render/Docker)
# Builds Next.js, then runs the custom Express server (Steam OpenID + API)

FROM node:20-alpine

WORKDIR /app

# If better-sqlite3 needs compiling on Alpine, these tools are required
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
