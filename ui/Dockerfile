FROM node:lts-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM httpd:2.4-alpine as production-stage
COPY --from=build-stage /app/dist /usr/local/apache2/htdocs
RUN sed -i 's/#LoadModule proxy_module/LoadModule proxy_module/' /usr/local/apache2/conf/httpd.conf
RUN sed -i 's/#LoadModule proxy_http_module/LoadModule proxy_http_module/' /usr/local/apache2/conf/httpd.conf
RUN echo "ProxyPass /api http://api:8000" >> /usr/local/apache2/conf/httpd.conf
RUN echo "ProxyPassReverse /api http://api:8000" >> /usr/local/apache2/conf/httpd.conf

EXPOSE 80
