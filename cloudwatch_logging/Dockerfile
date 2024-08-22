FROM golang:alpine AS main-env
RUN mkdir /app
ADD . /app/
WORKDIR /app
RUN cd /app && go build -o myapp

FROM alpine
WORKDIR /app
COPY --from=main-env /app/myapp /app
EXPOSE 8080

# see https://codehakase.com/blog/2018-01-12-building-small-containers-for-kubernetes/

ENTRYPOINT ./myapp
