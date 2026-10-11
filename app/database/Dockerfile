# Eigen image: het schema en de stamdata zitten erin gebakken, zodat de deploy
# alleen het compose-bestand naar de host hoeft te kopiëren.
#
# Postgres voert de bestanden op naamvolgorde uit, alleen bij een leeg volume:
# eerst het beginschema, daarna de aanvullingen (02-, 03-, ...). Op een
# bestaande database draai je een nieuwe aanvulling handmatig.
FROM postgres:17-alpine
COPY init.sql /docker-entrypoint-initdb.d/01-init.sql
COPY 0*-*.sql /docker-entrypoint-initdb.d/
