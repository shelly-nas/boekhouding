# boekhouding (webapp)

Deze app volgt de shelly-nas standaarden uit de plugin **`shelly-fundamentals@shelly-nas`**
(repo `shelly-nas/shelly-fundamentals`, gekoppeld via `.claude/settings.json`). Gebruik de skills
daaruit: `stack-voorkeuren`, `docker-traefik`, `release-deploy`, `database-migraties`,
`conventional-commits` en `design-richtlijnen`. De inhoudelijke regels (vastlegging, AVG) staan in
`../CLAUDE.md`.

Is de plugin niet geladen, dan gelden in elk geval deze regels:

- **Stack:** React + Vite (`client/`), Node + Express (`server/`, poort 3000, alles onder `/api`,
  met `GET /api/health`), PostgreSQL (`database/`). De app staat in `app/`, de workflows in de
  root (`.github/workflows/`).
- **Bewuste afwijkingen van de standaard:** JavaScript in plaats van TypeScript, gewone CSS met
  `tokens.css` in plaats van MUI, Node 24 en Postgres 17. Daarom een eigen `ci.yml` in plaats van
  `shared-workflows/ci-node-postgres.yml`. Zet Postgres nooit een major terug: dat breekt het datavolume.
- **Lokaal:** `docker-compose.yml` bouwt vanuit de broncode. **Productie:** `docker-compose.prod.yml`
  gebruikt alleen images met een gepinde `IMAGE_TAG` (de commit), achter Traefik op `shelly-network`,
  op `boekhouding.shelly-nas.nl`. Elke merge naar `main` deployt direct naar productie (`deploy.yml`).
- **Productiedata** staat in de externe Docker-volumes `boekhouding-db-data` en `boekhouding-bijlagen`.
  Een deploy maakt ze aan als ze ontbreken en verwijdert ze nooit; de namen staan in
  `docker-compose.prod.yml` en in `persistent_volumes` van `deploy.yml`.
- **Acc:** elke PR naar `main` wordt gedeployd naar `boekhouding-acc.shelly-nas.nl` via
  `docker-compose.acc.yml` en `acc.yml`, met een verse database, en afgebroken zodra de PR sluit.
  Houd `docker-compose.acc.yml` gelijk aan prod, op namen, host en opslag na.
- **Geheimen** staan alleen in `.env` (niet in git) en in GitHub-secrets. Een nieuwe env-variabele
  komt in `docker-compose.prod.yml` én `docker-compose.acc.yml`, in `env_file_content` van
  `deploy.yml` én `acc.yml`, en in `.env.example`.
- **Schemawijzigingen:** als idempotente, additieve migratie `server/migrations/NNN_*.sql`.
- **Vormgeving:** `client/src/tokens.css` is een kopie van `design-richtlijnen/tokens.css` en de bron
  van waarheid; `styles.css` leest alleen rollen. Dark mode via `.theme-dark` op `<html>`.

## Commitberichten

Elke merge naar `main` gaat direct naar productie; de geschiedenis van `main` is het logboek van
wat er live ging. **Elke commit is daarom een Conventional Commit** (`fix:`, `feat:`, `feat!:` voor
iets dat een API, het schema of het deploycontract breekt, en `perf:` `refactor:` `docs:` `test:`
`ci:` `build:` `chore:` voor de rest). Bij een squash-merge geldt dat ook voor de PR-titel.
