# Use the official Nginx image
FROM nginx:latest

# Install inotify-tools for file watching
RUN apt-get update && apt-get install -y inotify-tools

# Set the working directory
WORKDIR /usr/share/nginx/html

# Copy your web app files into the container
COPY ./html /usr/share/nginx/html

# Expose port 80 for serving the web app
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]