# Chapter 1 - Setup FluxCD

## Overview

In this chapter, you will learn to:

- Use `Pulumi` to provision `Flux CD` to your Civo Kubernetes cluster.
- Keep your `Kubernetes` cluster applications state synchronized with a `Bucket` repository, using `GitOps` principles.
- Install several applications to your cluster to create a production-ready environment:
    - cluster-autoscaler
    - metrics-server
    - cert-manager
    - contour
    - external-dns
    - komodor
    - kube-prometheus-stack
    - kyverno
    - sealed-secrets
    - trivy-operator

We will also some advanced Pulumi concepts
like [Stack References](https://www.pulumi.com/docs/intro/concepts/stack/#stackreferences) to share some information
between the different stacks and [Component Resources](https://www.pulumi.com/docs/intro/concepts/resources/components/)
to create a reusable component.

To tell Pulumi to recreate the GitOps files, we will use the `renderYamlToDirectory` on the Pulumi Kubernetes provider.

After finishing all the steps from this tutorial, you should have a Civo Kubernetes cluster with plenty of
production-ready applications installed.

## Prerequisites

For this chapter, you need this fulfill this additional prerequisites

- [s3cmd](https://s3tools.org/s3cmd)
- Komodor API Key (https://app.komodor.com/)
- FluxCD CLI (https://fluxcd.io/docs/installation/)

## Instructions

### Step 0 - Familiarize with the project structure

Take a look in the `civo-navigate-gitops` folder. You will find a `index.ts` file, which is the entrypoint of the Pulumi
program. The different services are categorized in different categories. We have `services`, `infrastructure`
and `config`.

In the folder `gitops` you see the different Pulumi Component Resources we use to create the GitOps files. The `base`
folder contains the `FluxCD` component resource.

All the files will get rendered to the `gitops` folder in the root of the project.

### Step 1 - Run Pulumi Up

The `--replace` flag, we need to tell Pulumi to recreate the GitOps files.

```bash
pulumi up -y -f  --replace  'urn:pulumi:dev::*::collection:**'
```

If the preview looks good, select `yes` to deploy the cluster

```bash
Do you want to perform this update?  [Use arrows to move, type to filter]
  yes
> no
  details
  [experimental] yes, using Update Plans (https://pulumi.com/updateplans)
```

If the deployment is successful, you should see the following output

```bash
Resources:
    + 68 created
    29 unchanged

Duration: 1m5s
```

### Step 2 - Optional: Check the deployed resources

```
➜ k get buckets -n flux-system
NAME          ENDPOINT                    AGE   READY   STATUS
flux-bucket   objectstore.lon1.civo.com   99s   True    stored artifact for revision 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

❯ k get kustomization -n flux-system
NAME                  AGE     READY   STATUS
demo-services         6m26s   False   dependency 'flux-system/demo-infrastructure' is not ready
demo-config           6m27s   False   dependency 'flux-system/demo-services' is not ready
demo-infrastructure   6m27s   False   kustomization path not found: stat /tmp/kustomization-1856736510/infrastructure: no such file or directory
```

### Step 3 - Upload the GitOps Files

Use the `civo` CLI to get the credentials of your bucket and redirect the output to a file called `civo.env`

```bash
civo objectstore show civo-navigate-dev-bucket --region LON1
civo objectstore credential export --access-key=civo-navigate-dev-access-key --region LON1 > civo.env
```

To set the environment variables use the `source` command:

```
source civo.env
```

Now we can use `s3cmd` to upload the whole folder to bucket:

```bash
s3cmd --host=${AWS_HOST}  --host-bucket=s3://civo-navigate-dev-bucket sync --acl-public gitops/ s3://civo-navigate-dev-bucket
```

If you are impatient, you can use the `flux` CLI to kick of the reconcile of the bucket:

```bash
flux reconcile source bucket flux-bucket -n flux-system
```

### Step 3 - Check the deployment

- UI
- Komodor
- external-dns
- Kyverno Policy Reporter

### Important step before Chapter 2

If you want to [build a CLI using the Pulumi Automation API](./02-automation-api.md) in the next chapter, you need to
teardown both Pulumi stacks you just created in both chapters.

Start with the GitOps stack

```bash
pulumi destroy -y -f
```

For 100% you will get stuck in the Finalizer of some namespaces we just created. If this happens, discard the
stack complete using:

```bash
pulumi stack rm --force
```

And then head over to destroy the infrastructure stack in the `civo-navigate` folder:

```bash
pulumi destroy -y -f
```

### Learn More

- [Pulumi](https://www.pulumi.com/)
- [Civo Pulumi Provider](https://www.pulumi.com/registry/packages/civo/)
- [Flux CD Docs](https://fluxcd.io/flux/)
- [Komodor](https://docs.komodor.com/)






