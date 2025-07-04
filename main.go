package main

import (
	"fmt"
	"os"

	"github.com/urfave/cli/v2"
)

func main() {
	app := &cli.App{
		Name:  "claudemd",
		Usage: "Claude Code Session Manager",
		Commands: []*cli.Command{
			{
				Name:  "sync-sessions",
				Usage: "Sync Claude Code sessions to Supabase",
				Flags: []cli.Flag{
					&cli.BoolFlag{
						Name:  "watch",
						Usage: "Watch for changes and sync continuously",
					},
				},
				Action: syncSessionsCommand,
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
}

