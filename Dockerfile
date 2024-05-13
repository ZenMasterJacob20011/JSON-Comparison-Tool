FROM nginx
WORKDIR /app
COPY ./src/ /app
COPY nginx.conf /etc/nginx/nginx.conf
