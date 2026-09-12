# Load testing workshop with k6 OSS - TestCon 2026

[Workshop slide deck](https://docs.google.com/presentation/d/18XU_aborhDz27WRwy-mqONcmOrd69zVO5nmMAGuAjts/edit?usp=sharing)

## Hands-on lab agenda

- Introduction: 5m
- [Lab setup](./1.lab-setup/): 10m
- [First load test](./2.basic-load-test/): 20m
- [Workload in request rate](./3.workload-in-rps/): 20m
- [Assertions](./4.assertions/): 20m
- [Parameterize test data](./5.parameterized-data/): 20m
- [Test suite structure & CI/CD integration](./6.test-suite-and-ci-integration/): 25m
- [Test recorders](./7.test-recorders/): 25m
- [Store and visualize test results](./8.test-result-visualization/): 25m
- [Observe the system under test with Grafana](./9.observing-the-sut/): 40m
- [Testing beyond HTTP](./10.testing-beyond-http/): 35m
- [Hybrid performance testing](./11.hybrid-performance-testing/): 25m
- k6 Ecosystem Overview: 20m
- QA & Lab wrap-up 

## Facilitators and in-room support staff
- [Pepe Cano](https://www.linkedin.com/in/ppcano/)
- [Edgar Fisher](https://www.linkedin.com/in/edgarfisher/)

_**Need help?** Raise your hand and we'll come help._

## What you will learn

By the end of this workshop, you will learn the fundamentals of load testing and have built:
- API performance tests with meaningful thresholds and assertions
- Grafana dashboards to visualize test results and understand how the system behaves under a heavy load.
- k6 tests automatically generated using k6 Studio
- Load tests for SQL databases and WebSocket connections, plus custom k6 metrics
- Hybrid tests that correlate real browser performance (Web Vitals) with backend load

## Pre-requisites

In order to participate in the lab, you must have a laptop with Wi-Fi/Internet connectivity, running Linux/MacOS/Windows.

The following also needs to be installed:
- An IDE installed to write k6 scripts
- Git and [Docker Desktop](https://docs.docker.com/get-started/get-docker/) to run the demo app
- [k6 OSS](https://grafana.com/docs/k6/latest/set-up/install-k6/) binary installed
- [k6 Studio](https://grafana.com/docs/k6-studio/set-up/install/) installed
