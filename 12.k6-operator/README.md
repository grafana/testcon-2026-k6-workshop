# Distributed load testing with the k6 Operator

_**Need help?** Raise your hand and we'll come help._

In this exercise, you'll learn how to:

- Run a k6 test as a Kubernetes custom resource
- See how the k6 Operator turns one `TestRun` into multiple Kubernetes Jobs
- Inspect the output from distributed k6 runner processes

If the workshop Docker Compose stack is still running and your laptop has limited memory, stop it before starting kind:

```bash
docker compose down
```

## Requirements

Install [kind](https://kind.sigs.k8s.io/) and [kubectl](https://kubernetes.io/docs/tasks/tools/).

Run all commands from the repository root.

## Create the cluster

Create a one-node kind cluster and confirm that `kubectl` is using it:

```bash
kind create cluster --name k6-workshop
kubectl config current-context
```

The context should be `kind-k6-workshop`.

Install the pinned k6 Operator v1.7.0 bundle, and wait for its controller to become available:

```bash
kubectl apply --server-side -f https://raw.githubusercontent.com/grafana/k6-operator/v1.7.0/bundle.yaml
kubectl wait --for=condition=available deployment/k6-operator-controller-manager \
  --namespace k6-operator-system --timeout=120s
```

The bundle installs the k6 Custom Resource Definitions, the operator controller, and the permissions it needs to create Jobs and Pods.

## Create and run the distributed test

A ConfigMap makes the local test script available inside the runner Pods. Create it from the supplied script:

```bash
kubectl create configmap quickpizza-test \
  --from-file=k6-test.js=12.k6-operator/k6-test.js
```

Review [`testrun.yaml`](./testrun.yaml). Its main fields are:

- `script.configMap`: mounts the `k6-test.js` ConfigMap entry as the test script.
- `parallelism: 4`: splits one logical k6 test run into four equal runners.
- `separate: false`: allows the runner Pods to share the same node.
- `runner.env`: sets `BASE_URL` to the public QuickPizza instance.

Apply the `TestRun`:

```bash
kubectl apply -f 12.k6-operator/testrun.yaml
```

In a second terminal, watch the resources created by the operator:

```bash
kubectl get testruns,jobs,pods
```

You should see six Jobs over the lifetime of the test: one initializer, four k6 runners, and one starter:

- The initializer validates and prepares the script. 
- Each runner owns one execution segment.
- The starter coordinates their common start.

Since you're running on _kind_, your cluster will have only one node. The four runner Pods show how k6 test execution can be split and orchestrated by the operator.

Wait for the TestRun to finish, then see what happened:

```bash
kubectl wait --for=jsonpath='{.status.stage}'=finished \
  testrun/quickpizza-test --timeout=180s
kubectl get testrun quickpizza-test
kubectl get jobs
```

## Compare the runner output

Read the summary from each runner. With `parallelism: 4`, each runner executes a quarter of the 10 VUs:

```bash
kubectl logs job/quickpizza-test-1
kubectl logs job/quickpizza-test-2
kubectl logs job/quickpizza-test-3
kubectl logs job/quickpizza-test-4
```

## Optional: change the parallelism

Delete the completed `TestRun` before reusing its name. Otherwise its completed Jobs can collide with the next run:

```bash
kubectl delete -f 12.k6-operator/testrun.yaml --ignore-not-found
```

Change `parallelism` in [`testrun.yaml`](./testrun.yaml) from `4` to `2`, apply it again, and watch the resources:

```bash
kubectl apply -f 12.k6-operator/testrun.yaml
kubectl get testruns,jobs,pods --watch
```

Delete the `TestRun` when you finish.

## Troubleshooting

**If you re-apply the TestRun onto the cluster, it does not start a new test**

A completed `TestRun` is not restarted by `kubectl apply`. Delete the TestRun before applying it again:

```bash
kubectl delete testrun quickpizza-test --ignore-not-found
kubectl apply -f 12.k6-operator/testrun.yaml
```

## Clean up

Remove only the lab workloads and operator, while keeping the kind cluster:

```bash
kubectl delete testrun quickpizza-test --ignore-not-found 2>/dev/null || true
kubectl delete configmap quickpizza-test --ignore-not-found
kubectl delete -f https://raw.githubusercontent.com/grafana/k6-operator/v1.7.0/bundle.yaml \
  --ignore-not-found
```

Or remove the entire cluster, including all lab resources:

```bash
kind delete cluster --name k6-workshop
```

## Related Resources

- [k6 Operator documentation](https://grafana.com/docs/k6/latest/set-up/set-up-distributed-k6/)
- [Run k6 scripts with the TestRun CRD](https://grafana.com/docs/k6/latest/set-up/set-up-distributed-k6/usage/executing-k6-scripts-with-testrun-crd/)
- [Configure the TestRun CRD](https://grafana.com/docs/k6/latest/set-up/set-up-distributed-k6/usage/configure-testrun-crd/)
- [kind documentation](https://kind.sigs.k8s.io/)

---

[← Previous exercise](../11.hybrid-performance-testing/) · [Workshop homepage](https://github.com/grafana/testcon-2026-k6-workshop)
