package main

import (
	"fmt"
	"log"
	"net/http"
	"time"
)

func main() {
	// TODO implement a middleware
	r := http.NewServeMux()
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{ "message": "healthy" }`)
	})
	r.HandleFunc("/api", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `{ "message": "Hello" }`)
	})

	r.Handle("/api/", http.StripPrefix("/api/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// on golang 1.19 so no r.PathValue()
		fmt.Fprintf(w, `{ "message": "Hello", "path": "%s" }`, r.URL.Path)
	})))
	s := &http.Server{
		Addr:        ":8080",
		Handler:     r,
		ReadTimeout: 500 * time.Millisecond,
	}

	fmt.Printf("starting server on port %s", s.Addr)
	log.Fatal(s.ListenAndServe())
}
