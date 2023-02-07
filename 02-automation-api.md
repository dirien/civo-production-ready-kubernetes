# Chapter 2: Building a CLI using the Pulumi Automation API

## Introduction

In this chapter we are going to build a CLI using
the [Pulumi Automation API](https://www.pulumi.com/docs/guides/automation-api/) and Golang. This CLI will be able to
create and destroy a cluster on Civo with the GitOps stack we created in the previous chapter.

![](https://www.pulumi.com/docs/guides/automation-api/automation-api.png)

The Automation API will drive the deployment of our both previous created Pulumi programs using the `Local Program`
function.

For the Golang part, we are going to use `cobra` to create the CLI and define the two commands `create` and `destroy`.
We're going to add some flags to the CLI to make it more flexible.

The cherry on the cake is that we are going to use `ko` to build a container image of our CLI and run it on Civo. So
this gives us the ability to run our CLI on any container based CI/CD system.

## Prerequisites

- [Golang SDK](https://go.dev/dl/)
- [ko CLI](https://ko.build/install/)

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

If the GitOps stack get stuck, due to the `finalizer` on the namespaces you can call your CLI with the
flag `--skip-gitops`

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
- [ko cli](https://ko.build/)
