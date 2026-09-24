FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY migrations ./migrations
ENV NODE_ENV=production
# Bijlagen staan buiten de image (volume of bind mount). Eigenaar 'node'
# (uid 1000): een nieuw named volume neemt dit over; een bind mount op de host
# moet zelf eigendom zijn van uid 1000.
ENV BIJLAGEN_DIR=/data/bijlagen
RUN mkdir -p /data/bijlagen && chown -R node:node /data
EXPOSE 3000
USER node
CMD ["node", "src/index.js"]
