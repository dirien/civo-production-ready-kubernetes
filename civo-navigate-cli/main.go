package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/pulumi/pulumi/sdk/v3/go/auto"
	"github.com/pulumi/pulumi/sdk/v3/go/auto/optdestroy"
	"github.com/pulumi/pulumi/sdk/v3/go/auto/optup"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

func parseLogLevel(cmd *cobra.Command, args []string) {
	logLevel, err := cmd.Flags().GetString("log-level")
	if err != nil {
		log.Fatal(err)
	}
	level, err := log.ParseLevel(logLevel)
	if err != nil {
		log.Fatal(err)
	}
	log.SetLevel(level)
}

var (
	logLevel string
	rootCmd  *cobra.Command
)

func init() {
	rootCmd = &cobra.Command{
		Use: "civo-navigate-cli",
		Run: func(cmd *cobra.Command, args []string) {
			figlet := `
 ######  #### ##     ##  #######          ##    ##    ###    ##     ## ####  ######      ###    ######## ########          ######  ##       #### 
##    ##  ##  ##     ## ##     ##         ###   ##   ## ##   ##     ##  ##  ##    ##    ## ##      ##    ##               ##    ## ##        ##  
##        ##  ##     ## ##     ##         ####  ##  ##   ##  ##     ##  ##  ##         ##   ##     ##    ##               ##       ##        ##  
##        ##  ##     ## ##     ## ####### ## ## ## ##     ## ##     ##  ##  ##   #### ##     ##    ##    ######   ####### ##       ##        ##  
##        ##   ##   ##  ##     ##         ##  #### #########  ##   ##   ##  ##    ##  #########    ##    ##               ##       ##        ##  
##    ##  ##    ## ##   ##     ##         ##   ### ##     ##   ## ##    ##  ##    ##  ##     ##    ##    ##               ##    ## ##        ##  
 ######  ####    ###     #######          ##    ## ##     ##    ###    ####  ######   ##     ##    ##    ########          ######  ######## ####`
			fmt.Println(figlet)
			err := cmd.Help()
			if err != nil {
				os.Exit(0)
			}
		},
	}
	rootCmd.PersistentFlags().StringVarP(&logLevel, "log-level", "l", "info", "Log level (trace, debug, info, warn, error, fatal, and panic)")
}

func main() {
	log.SetFormatter(&log.TextFormatter{})
	var stackName string
	var region string
	var nodeSize string
	var nodeCount int
	var skipDNS bool
	var skipGitOps bool

	var createCmd = &cobra.Command{
		Use:    "create",
		Short:  "Create new Civo Cluster",
		PreRun: parseLogLevel,
		Run: func(cmd *cobra.Command, args []string) {
			ctx := context.Background()
			workDir := filepath.Join("..", "civo-navigate")

			s, err := auto.UpsertStackLocalSource(ctx, stackName, workDir)
			if err != nil {
				log.Errorf("Failed to create or select stack: %v\n", err)
				os.Exit(1)
			}

			log.Infof("Created/Selected stack %q\n", stackName)

			s.SetConfig(ctx, "civo:region", auto.ConfigValue{Value: region})
			if skipDNS {
				s.SetConfig(ctx, "dns:skip", auto.ConfigValue{Value: "true"})
			}
			s.SetConfig(ctx, "cluster:node_size", auto.ConfigValue{Value: nodeSize})
			s.SetConfig(ctx, "cluster:node_count", auto.ConfigValue{Value: fmt.Sprintf("%d", nodeCount)})

			log.Debug("Successfully set config")
			log.Info("Starting refresh")

			_, err = s.Refresh(ctx)
			if err != nil {
				log.Fatalf("Failed to refresh stack: %v\n", err)
			}

			log.Debug("Refresh succeeded!")
			log.Info("Starting update")

			var stdoutStreamer optup.Option = optup.Message("Updating stack...")
			if log.GetLevel() >= log.DebugLevel {
				stdoutStreamer = optup.ProgressStreams(os.Stdout)
			}

			_, err = s.Up(ctx, stdoutStreamer)
			if err != nil {
				log.Fatalf("Failed to update stack: %v\n\n", err)
			}
			infraStackName := auto.FullyQualifiedStackName("dirien", "civo-navigate", stackName)

			log.Info("Deploy GitOps stack")
			workDir = filepath.Join("..", "civo-navigate-gitops")

			s, err = auto.UpsertStackLocalSource(ctx, stackName, workDir)
			if err != nil {
				log.Errorf("Failed to create or select stack: %v\n", err)
				os.Exit(1)
			}

			log.Infof("Created/Selected stack %q\n", stackName)

			s.SetConfig(ctx, "infra:stackReference", auto.ConfigValue{Value: infraStackName})

			log.Debug("Successfully set config")
			log.Info("Starting update")

			if log.GetLevel() >= log.DebugLevel {
				stdoutStreamer = optup.ProgressStreams(os.Stdout)
			}
			_, err = s.Up(ctx, stdoutStreamer, optup.Replace([]string{"urn:pulumi:dev::*::collection:**"}))
			if err != nil {
				log.Fatalf("Failed to update stack: %v\n\n", err)
			}

			log.Debug("Update succeeded!")
		},
	}
	createCmd.Flags().StringVarP(&stackName, "stack", "s", "dev", "The name of the stack")
	createCmd.Flags().StringVarP(&region, "region", "r", "LON1", "The name of the civo region")
	createCmd.Flags().StringVarP(&nodeSize, "node-size", "n", "g3.k3s.medium", "The size of the node")
	createCmd.Flags().IntVarP(&nodeCount, "node-count", "c", 1, "The number of nodes")
	createCmd.Flags().BoolVarP(&skipDNS, "skip-dns", "d", false, "Skip DNS creation")

	var destroyCommand = &cobra.Command{
		Use:    "destroy",
		Short:  "Destroy a Civo Cluster",
		PreRun: parseLogLevel,
		Run: func(cmd *cobra.Command, args []string) {
			ctx := context.Background()

			var workDir string
			var s auto.Stack
			var err error
			if skipGitOps {
				infraStackName := auto.FullyQualifiedStackName("dirien", "civo-navigate", stackName)

				log.Info("Destroy GitOps stack")
				workDir = filepath.Join("..", "civo-navigate-gitops")

				s, err = auto.UpsertStackLocalSource(ctx, stackName, workDir)
				if err != nil {
					log.Errorf("Failed to create or select stack: %v\n", err)
					os.Exit(1)
				}

				log.Infof("Created/Selected stack %q\n", stackName)

				s.SetConfig(ctx, "infra:stackReference", auto.ConfigValue{Value: infraStackName})

				log.Debug("Successfully set config")
				log.Info("Starting destroy")

				var stdoutStreamer = optdestroy.Message("Destroying stack...")
				if log.GetLevel() >= log.DebugLevel {
					stdoutStreamer = optdestroy.ProgressStreams(os.Stdout)
				}
				_, err = s.Destroy(ctx, stdoutStreamer)
				if err != nil {
					log.Fatalf("Failed to update stack: %v\n\n", err)
				}

				log.Debug("Destroy succeeded!")
			}
			log.Info("Destroy Infrastructure stack")
			workDir = filepath.Join("..", "civo-navigate")

			s, err = auto.UpsertStackLocalSource(ctx, stackName, workDir)
			if err != nil {
				log.Errorf("Failed to create or select stack: %v\n", err)
				os.Exit(1)
			}

			log.Infof("Created/Selected stack %q\n", stackName)

			s.SetConfig(ctx, "civo:region", auto.ConfigValue{Value: region})
			if skipDNS {
				s.SetConfig(ctx, "dns:skip", auto.ConfigValue{Value: "true"})
			}
			s.SetConfig(ctx, "cluster:node_size", auto.ConfigValue{Value: nodeSize})
			s.SetConfig(ctx, "cluster:node_count", auto.ConfigValue{Value: fmt.Sprintf("%d", nodeCount)})

			log.Debug("Successfully set config")
			log.Info("Starting refresh")

			_, err = s.Refresh(ctx)
			if err != nil {
				log.Fatalf("Failed to refresh stack: %v\n", err)
			}

			log.Debug("Refresh succeeded!")
			log.Info("Starting update")

			var stdoutStreamerDestroy optdestroy.Option = optdestroy.Message("Destroying stack...")
			if log.GetLevel() >= log.DebugLevel {
				stdoutStreamerDestroy = optdestroy.ProgressStreams(os.Stdout)
			}

			_, err = s.Destroy(ctx, stdoutStreamerDestroy)
			if err != nil {
				log.Fatalf("Failed to update stack: %v\n\n", err)
			}
			log.Debug("Destroy succeeded!")
		},
	}
	destroyCommand.Flags().StringVarP(&stackName, "stack", "s", "dev", "The name of the stack)")
	destroyCommand.Flags().StringVarP(&region, "region", "r", "LON1", "The name of the civo region")
	destroyCommand.Flags().BoolVarP(&skipGitOps, "skip-gitops", "g", false, "Skip GitOps stack creation")

	rootCmd.AddCommand(createCmd)
	rootCmd.AddCommand(destroyCommand)
	rootCmd.Execute()
}
