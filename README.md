# Family Day Planner

Unified discovery of family days out: search, filter (age, distance, dogs, type, cost), map and list views. Spec: `specs/001-family-day-planner/spec.md`.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run build
```

## Docker Desktop

```bash
docker compose up -d --build   # http://localhost:8080
```

## Data sources

`src/data/sources.ts` defines the `ActivitySource` interface; `aggregate()` merges sources and tolerates failures. Only a bundled **sample** source exists (`sampleSource.ts`) until real APIs are chosen in the research phase. Location search uses a small offline gazetteer (`places.ts`); postcodes need a geocoder.
