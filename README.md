# UK airport routes: a deck.gl arc map with a Lattice Grid table

1,621 UK-origin airport routes (7 airports, 354 destinations, 96 countries,
137 airlines), a historical schedule snapshot circa 2018, queried in the
browser by DuckDB-WASM and drawn as deck.gl arcs over a MapLibre basemap,
with Lattice Grid as the attribute table. Filter the table (or click an
airport preset) and the arcs redraw; select a row and its arc highlights;
pan or zoom the map and the table narrows to routes whose destination is in
view.

## What it shows

- **Map** — a deck.gl `ArcLayer`, one arc per matching route, source at the
  UK origin airport, target at the destination, coloured by origin airport
  (7 colours, legend) and widened by scheduled services. Bound to the grid
  with `bindDeck` (`modules/deckgl`); `viewportFilter` turns the map's view
  into a `between` condition on the destination's coordinates, so panning or
  zooming narrows the table to routes whose destination is on screen. The
  selected row's arc redraws in a second, wider layer.
- **Routes** — the whole matching set, paged from DuckDB, filter row on.
  Group by airline or region from the Controls panel.
- **Controls** — the airport preset bar (All, LHR, LGW, STN, MAN, EDI, BHX,
  BRS), the group-by select, and the origin-airport colour legend.
- **Matching set** — routes, scheduled services, destinations, countries and
  estimated flights/week, all computed by the engine over the current
  filter. The weekly figure is labelled **estimate**: `AIRROUTE` carries no
  days-of-week, so it assumes every scheduled flight number runs daily
  (services × 7) — an upper bound, not a measured frequency.
- **Chart** — scheduled services by destination region.
- **Credits** — the snapshot and estimate caveats, basemap and grid credits.

## Data

`routes.parquet` (58 KB, 1,621 rows), fetched once from
`https://data.latticegrid.dev/uk-flights/routes.parquet` and registered with
DuckDB-WASM as a file buffer — the page's only network request. Full dataset,
schema and provenance: see the Lattice project's dataset notes (Tocloco Inc,
historical UK schedule snapshot, circa 2018; kept including defunct carriers
Thomas Cook and Monarch, labelled as historical).

**Basemap tiles come from a third-party service**: the keyless
[OpenFreeMap](https://openfreemap.org) Positron style. Map data ©
OpenStreetMap contributors, tiles © OpenMapTiles. The page also loads
MapLibre GL JS 4.7.1, deck.gl 9.1.0 and DuckDB-WASM 1.32.0 from jsDelivr.

## Run it locally

The page loads Lattice Grid 1.77.0 from the jsDelivr CDN. To try a local
build instead, copy the grid's `dist/` to `vendor/` (not part of this
repository) and set `LOCAL = true` at the top of `index.html`. Serve the
folder with any static server, for example:

```
python3 -m http.server 8608
```

and open http://localhost:8608/. No licence key is needed on localhost.

## Grid features used

`duckdbAdapter` + `createPushdownSource` (filter, sort and paging pushed
down as SQL; engine-computed KPI aggregations), `createGrid` with
`filterRow`, single row `selection`, `columns.group`, `scroll.toRow`,
`bindDeck` with `viewportFilter`, and the layout, KPI and charts modules.
Modules loaded: `layout`, `kpi`, `charts`, `deckgl`.

## Licence

The code in this repository is available under the MIT licence. See
[LICENSE](LICENSE). The route data is Tocloco Inc's own (scraped for an
earlier internal demo; published here). Lattice Grid itself is a separate
commercial product, free to use on localhost; keys for your own sites come
from [latticegrid.dev](https://www.latticegrid.dev).
