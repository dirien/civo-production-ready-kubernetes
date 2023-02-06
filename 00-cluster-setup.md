# Chapter 0 - Create a Civo Kubernetes Cluster with Pulumi

## Overview

In order to set up a GitOps workflow, we are going to need a Kubernetes Cluster. The goal of this chapter is firstly to
create a Civo Kubernetes Cluster using Pulumi.

Not only we are going to create a Civo Kubernetes Cluster, but we will create a Civo Object Storage Bucket and a Civo
DNS Domain too. The DNS Domain will be used in the next chapter to setup the GitOps workflow.

## Prerequisites

To successful complete this chapter, you must meet all of these requirements:

- Civo [account](https://dashboard.civo.com/signup)
- Civo [CLI](https://www.civo.com/docs/overview/civo-cli)
- The Pulumi [CLI](https://www.pulumi.com/docs/get-started/install/) should be present on your machine
- Kubernetes [CLI](https://kubernetes.io/docs/tasks/tools/#kubectl)
- A Domain

## Instructions

### Step 0 - Custom Domain

civoThese workshops assumes, that you want to manage your domain using Civo DNS. For this you need to point the
nameserver of your domain to the Civo nameserver (`ns01.civo.com` and `ns1.civo.com`). If you have a domain, and you
cant move them please change the config value `dns:skip` to `true`

### Step 1 - Clone the repo

Go to GitHub and fork clone
the [Civo Navigate: Production Ready Kubernetes Workshop](https://github.com/dirien/civo-production-ready-kubernetes)
repo and then change into the directory.

If you use SSH to clone:

```bash
git clone git@github.com:dirien/civo-production-ready-kubernetes.git
cd civo-production-ready-kubernetes
```

To clone with HTTP:

```bash
git clone https://github.com/dirien/civo-production-ready-kubernetes.git
cd civo-production-ready-kubernetes
```

### Step 2 - Configure Civo Cli

1. Creat a new API token in your [Civo account settings](https://www.civo.com/docs/account/api-keys)
1. Export the API token as an environment variable
3. Verify the token is set working by listing the API keys.

```bash
export CIVO_TOKEN=<YOUR_API_TOKEN>

civo apikey list
+---------+---------+
| Name    | Default |
+---------+---------+
| tempKey | <=====  |
+---------+---------+
```

### Step 3 - Pulumi

Change into the `civo-navigate` directory.

```bash
cd civo-navigate
```

Most important part of a Pulumi program is the `Pulumi.yaml`. Here you can define and modify different settings. From
the runtime of the programming language you are using to changing the default config values.

- Change the region in the `Pulumi.yaml` file to your preferred region
- Change the node size in the `Pulumi.yaml` file to your preferred node size
- Change the dns domain name in the `Pulumi.yaml` to your own domain name.

### Step 4 - Run Pulumi Up

```bash
pulumi up
```

If the preview looks good, select `yes` to deploy the cluster

```bash
Previewing update (dev)

View Live: https://app.pulumi.com/dirien/civo-navigate/dev/previews/380be5a1-e5c7-4c4c-98fb-3fe81037dd68

     Type                                 Name                                Plan       
 +   pulumi:pulumi:Stack                  civo-navigate-dev                   create     
 +   ├─ civo:index:Firewall               civo-navigate-workshop-firewall     create     
 +   ├─ civo:index:ObjectStoreCredential  civo-navigate-workshop-credentials  create     
 +   ├─ civo:index:DnsDomainName          civo-navigate-workshop-dns          create     
 +   ├─ civo:index:ObjectStore            civo-navigate-workshop-bucket       create     
 +   └─ civo:index:KubernetesCluster      civo-navigate-workshop-cluster      create     


Outputs:
    bucketAccessKeyId    : [secret]
    bucketName           : "civo-navigate-dev-bucket"
    bucketRegion         : output<string>
    bucketSecretAccessKey: [secret]
    bucketUrl            : output<string>
    clusterId            : output<string>
    clusterKubeConfig    : output<string>
    clusterName          : "civo-navigate-dev-k3s"
    clusterRegion        : output<string>
    dns                  : "ediri.cloud"
    nodePoolName         : output<string>

Resources:
    + 6 to create

Do you want to perform this update?  [Use arrows to move, type to filter]
  yes
> no
  details
  [experimental] yes, using Update Plans (https://pulumi.com/updateplans)
```

If the deployment is successful, you should see the following output. The duration of the deployment can take a few
minutes.

```bash
...
Resources:
    + 6 created

Duration: 2m17s
```

### Step 5 - Configure Kubectl

```bash
pulumi stack output clusterKubeConfig --show-secrets > kubeconfig 
```

### Step 6 - Verify the cluster

```bash
kubectl --kubeconfig kubeconfig get nodes
```

You should see output similar to the following

```bash
NAME                                                              STATUS     ROLES    AGE   VERSION
k3s-civo-navigate-workshop-cluster-8c6a-0b-node-pool-98be-keh3e   NotReady   <none>   16s   v1.25.0+k3s1
```

Congratulations! You have successfully deployed a Kubernetes cluster on Civo using Pulumi. Please leave the cluster up
and running for [Chapter 1 - Setup FluxCD](./01-gitops-setup.md)

### Learn More

- [Pulumi](https://www.pulumi.com/)
- [Civo Pulumi Provider](https://www.pulumi.com/registry/packages/civo/)
