package main

import (
	"flag"
	"fmt"
	"os"

	"ctracking/monitor/internal/watch"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: bibomon <watch> -config <file>")
		os.Exit(2)
	}
	mode := os.Args[1]
	fs := flag.NewFlagSet(mode, flag.ExitOnError)
	cfgPath := fs.String("config", "", "path to TOML config")
	fs.Parse(os.Args[2:])

	var err error
	switch mode {
	case "watch":
		err = watch.Run(*cfgPath)
	default:
		err = fmt.Errorf("unknown mode %q", mode)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "bibomon:", err)
		os.Exit(1)
	}
}
