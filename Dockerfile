# --- Stage 1: Build the React application ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Create the optimized production build
RUN npm run build

# --- Stage 2: Serve the application with Nginx ---
FROM nginx:stable-alpine AS production

# Copy the built files from the build stage to Nginx's public directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration (optional, for history/routing)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for the web server
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]