import * as pulumi from "@pulumi/pulumi";
import * as civo from "@pulumi/civo";

const projectName = pulumi.getProject()
const stackName = pulumi.getStack()

const clusterConfig = new pulumi.Config("cluster");
const nodeSize = clusterConfig.require("node_size");
const nodeCount = clusterConfig.requireNumber("node_count");
const cni = clusterConfig.require("cni");
const kubernetesVersion = clusterConfig.require("kubernetes_version");
const dnsConfig = new pulumi.Config("dns");
const dnsDomain = dnsConfig.require("domain");
const dnsSkip = dnsConfig.requireBoolean("skip");

const firewall = new civo.Firewall("civo-navigate-workshop-firewall", {
    name: pulumi.interpolate`${projectName}-${stackName}-fw`,
    createDefaultRules: true,
});

const cluster = new civo.KubernetesCluster("civo-navigate-workshop-cluster", {
    name: pulumi.interpolate`${projectName}-${stackName}-k3s`,
    pools: {
        label: "civo-navigate-workshop-node-pool",
        nodeCount: nodeCount,
        size: nodeSize
    },
    cni: cni,
    kubernetesVersion: kubernetesVersion,
    firewallId: firewall.id,
})

const credentials = new civo.ObjectStoreCredential("civo-navigate-workshop-credentials", {
    name: pulumi.interpolate`${projectName}-${stackName}-cred`,
    accessKeyId: pulumi.interpolate`${projectName}-${stackName}-access-key`,
    secretAccessKey: "civo-navigate-workshop-secret-key",
})

const bucket = new civo.ObjectStore("civo-navigate-workshop-bucket", {
    name: pulumi.interpolate`${projectName}-${stackName}-bucket`,
    maxSizeGb: 500,
    accessKeyId: credentials.accessKeyId,
})

let dnsDomainName: civo.DnsDomainName | undefined;

if (!dnsSkip) {
    dnsDomainName = new civo.DnsDomainName("civo-navigate-workshop-dns", {
        name: dnsDomain,
    })
}

export const clusterName = cluster.name
export const clusterId = cluster.id
export const clusterRegion = cluster.region
export const clusterKubeConfig = pulumi.secret(cluster.kubeconfig)
export const nodePoolName = cluster.pools.apply(pools => pools.label)
export const bucketUrl = bucket.bucketUrl
export const bucketAccessKeyId = pulumi.secret(credentials.accessKeyId)
export const bucketSecretAccessKey = pulumi.secret(credentials.secretAccessKey)
export const bucketName = bucket.name
export const bucketRegion = bucket.region
export const dns = dnsDomainName?.name

