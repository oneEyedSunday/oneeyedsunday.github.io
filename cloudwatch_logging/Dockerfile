# see https://codehakase.com/blog/2018-01-12-building-small-containers-for-kubernetes/

# build app
FROM golang:alpine AS main-env
RUN mkdir /app
ADD . /app/
WORKDIR /app
RUN cd /app && GO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o run

# run artifacts
FROM scratch
WORKDIR /app
COPY --from=main-env /app/run /app
EXPOSE 8080


# did a CMD v ENTRYPOINT refresher via https://www.baeldung.com/ops/dockerfile-run-cmd-entrypoint
# ENTRYPOINT ./run
CMD ["/app/run"]
