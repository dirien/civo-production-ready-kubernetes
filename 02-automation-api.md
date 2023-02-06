# Chapter 2: Building a CLI using the Pulumi Automation API

## Introduction

## Prerequisites

- Golang SDK
- ko CLI

## Instructions

### Step 0 - Compile the binary

```
go build .
```

### Step 1 - Create a cluster

```bash
./civo-navigate-cli create
```

Check the logs, this should create both steps in one call. With the flag `--stack` you can create several new stack.
Completely on demand.

If you are going to the test this while using the Civo DNS service, please add `--skip-dns` to your call to avoid the
recreation of the DNS service with the same domain name. Also, if you are using a different DNS provider.

### Step 2 - Destroy a cluster

```bash
./civo-navigate-cli destroy
```

If the GitOps stack get stuck, due to the `finalizer` on the namespaces you can call your CLI with the flag `--skip-gitops`

```bash
./civo-navigate-cli destroy --skip-gitops 
```

### Step 3 - Create a container image with `ko`

```bash
export KO_DOCKER_REPO=dirien
ko build . --platform=linux/amd64,linux/arm64 -B
```

And run the commands above using the container, don't forget to pass your `PULUMI_ACCESS_TOKEN` and `CIVO_TOKEN` to the 
container using the `-e KEY=VALUE` flag

```bash
docker run  -e PULUMI_ACCESS_TOKEN=yyy -e CIVO_TOKEN=zzz dirien/civo-navigate-cli create
```

### Learn More

- [Pulumi Automation API](https://www.pulumi.com/)
- ko cli
