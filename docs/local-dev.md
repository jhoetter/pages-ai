# Local Development

PagesAI should use hof-os shared services for integrated work. Start hof-os in native-subapp mode first:

```sh
cd ~/repos/hof-os
make dev DEV_SUBAPP=pagesai
```

Then run this repo with the printed env:

```sh
cd ~/repos/pages-ai
export HOF_ENV=dev
export HOF_SUBAPP_JWT_SECRET=<value from ~/repos/hof-os/.env>
export DATABASE_URL=postgresql://hofos:hofos@localhost:5432/pagesai
export REDIS_URL=redis://localhost:6379/0
export HOF_DATA_APP_PUBLIC_URL=http://app.localhost:3000
make dev
```

For Docker-sidecar testing from hof-os instead, run `make dev SUBAPPS=pagesai`.
