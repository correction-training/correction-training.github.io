# Correction Training for Diffusion Models

- [Project website](https://correction-training.github.io/)
- [Personal homepage mirror](https://correction-training.github.io/donghoon/)
- [Code and project repository](https://github.com/sunovivid/correction-training)

This repository deploys the published project page and a personal homepage mirror under a separate GitHub Pages hostname.

The workflow fetches the public source revisions listed in `sources.json`. `overrides/` updates site URLs, local paths, and production analytics hostname checks. The build verifies every output file against `expected-files.json`, including the original paper PDF.

Deploy through **Actions → Deploy project website → Run workflow**. Deployment is manual.
