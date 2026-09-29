/**
 * The data side: DuckDB-Wasm reads `routes.parquet` from the CDN as ONE
 * fetch, registered as a file buffer (so a static host serving the file
 * gzip-encoded still reads correctly — the same reason the GIS demo uses
 * `registerFileBuffer` over a range-read URL), then a view adds a row
 * number so every route has a stable, unique key for selection and write-
 * free grouping. `aggregates: { default: 'engine' }` is what lets the KPI
 * tiles' `sum`/`countDistinct` follow the grid's filter without any manual
 * refresh code in app.js.
 */
const CDN_ROUTES = 'https://data.latticegrid.dev/uk-flights/routes.parquet';

/**
 * Start DuckDB-Wasm and build the routes pushdown source.
 * @param {(name: string, text: string) => void} step announces each slow step
 * @returns {Promise<object>} a pushdown source over `routes.parquet`
 */
async function startDuckDB(step) {
    step('starting DuckDB-WASM', 'Starting DuckDB-WASM…');
    const duckdb = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm');
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
    const worker = await duckdb.createWorker(bundle.mainWorker);
    const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.ERROR), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const connection = await db.connect();

    step('fetching routes.parquet', 'Fetching routes.parquet (58 KB, the only network request)…');
    const res = await fetch(CDN_ROUTES);
    if (!res.ok) throw new Error('routes.parquet: HTTP ' + res.status);
    await db.registerFileBuffer('routes.parquet', new Uint8Array(await res.arrayBuffer()));
    await connection.query("CREATE VIEW routes AS SELECT row_number() OVER () AS id, * FROM read_parquet('routes.parquet')");

    return LatticeGrid.createPushdownSource({
        adapter: LatticeGrid.duckdbAdapter({ connection, from: 'routes' }),
        compute: LatticeGrid, pageSize: 200, aggregates: { default: 'engine' },
    });
}
