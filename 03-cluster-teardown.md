# Chapter 3 - Destroy the Civo Kubernetes Custer with Pulumi

In this chapter we will use Pulumi to destroy our Civo Kubernetes Cluster we created during the workshop

### Prerequisites

- The Pulumi [CLI](https://www.pulumi.com/docs/get-started/install/)

## Instructions

### Step 1 - Destroy your cluster with Pulumi

If you did not the `Chapter 2`, you can use following Pulumi commands to destroy both stacks:

Start with the GitOps stack

```bash
cd civo-navigate-gitops
pulumi destroy -y -f
```

For 100% you will get stuck in the Finalizer of some of the namespaces we just created. If this happens, discard the stack
complety using:

```bash
pulumi stack rm --force
```

Then head over to destroy the infrastructure stack in the `civo-navigate` folder:

```bash
pulumi destroy -y -f
```

Look in the Civo dashboard and double check that the cluster is being terminated.

### Step 2 - Destroy your cluster with your Civo Navigate CLI

```bash
./civo-navigate-cli destroy
```

### Step 3 - Now Celebrate, You're Done!

![](https://cdn.dribbble.com/users/234969/screenshots/5414177/burst_trophy_dribbble.gif)
