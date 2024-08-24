package main

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// wrapHandlerWithLogging adds logging to a handler
// taken from https://gist.github.com/Boerworz/b683e46ae0761056a636#gistcomment-5153619
func wrapHandlerWithLogging(h func(w http.ResponseWriter, r *http.Request)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		log.Printf("HTTP %s %s \n", req.Method, req.URL.Path)

		lrw := NewLoggingResponseWriter(w)

		http.HandlerFunc(h).ServeHTTP(lrw, req)

		log.Printf("HTTP %s %s %d\n", req.Method, req.URL.Path, lrw.statusCode)
	})
}

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func NewLoggingResponseWriter(w http.ResponseWriter) *loggingResponseWriter {
	return &loggingResponseWriter{w, http.StatusOK}
}

func (lrw *loggingResponseWriter) WriteHeader(code int) {
	lrw.statusCode = code
	lrw.ResponseWriter.WriteHeader(code)
}

func main() {
	r := http.NewServeMux()

	r.Handle("/health", wrapHandlerWithLogging(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{ "message": "healthy" }`)
	}))
	r.Handle("/api", wrapHandlerWithLogging(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{ "message": "Hello" }`)
	}))
	r.Handle("/api/", wrapHandlerWithLogging(func(w http.ResponseWriter, r *http.Request) {
		// on golang 1.19 so no r.PathValue()
		fmt.Fprintf(w, `{ "message": "Hello", "path": "%s" }`, strings.TrimPrefix(r.URL.Path, "/api/"))
	}))
	r.Handle("/", wrapHandlerWithLogging(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
		fmt.Fprintf(w, `{ "message", "Not Found" }`)
	}))

	s := &http.Server{
		Addr:        ":8080",
		Handler:     r,
		ReadTimeout: 500 * time.Millisecond,
	}

	fmt.Printf("starting server on port %s\n", s.Addr)
	log.Fatal(s.ListenAndServe())
}
