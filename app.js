// UK airport routes, historical schedule snapshot (circa 2018), as deck.gl
// arcs over a Lattice Grid attribute table: one DuckDB relation, six
// windows. Data loading lives in data.js, the arc layer + legend + preset
// bar in arcs.js, the loading overlay in loading.js.
const $ = (sel) => document.querySelector(sel);
const panel = (id, heading, html) => {
    const el = $('#' + id + '-body');
    el.className = 'panel';
    el.innerHTML = '<div class="panel__head">' + heading + '</div><div class="panel__body">' + (html || '') + '</div>';
    return el.lastChild;
};

LatticeGridLayout.createLayout($('#container'), {
    columns: 24, rows: 20, gap: 6, padding: 6, overflowX: 'static', overflowY: 'static',
    windows: [
        { id: 'map', title: 'Map', xPos: 1, yPos: 1, xSize: 15, ySize: 13, chrome: false },
        { id: 'table', title: 'Routes', xPos: 1, yPos: 14, xSize: 15, ySize: 6, chrome: false },
        { id: 'controls', title: 'Controls', xPos: 16, yPos: 1, xSize: 9, ySize: 2, chrome: false },
        { id: 'kpis', title: 'Matching set', xPos: 16, yPos: 3, xSize: 9, ySize: 8, chrome: false },
        { id: 'chart', title: 'Chart', xPos: 16, yPos: 11, xSize: 9, ySize: 9, chrome: false },
        { id: 'footer', title: 'Credits', xPos: 1, yPos: 20, xSize: 24, ySize: 1, chrome: false },
    ],
});
panel('map', 'Map · one arc per route, filter the table or click a preset to change it',
    '<div id="basemap"></div><div id="deck"></div>');
const controls = panel('controls', 'Controls', $('#controls-panel').innerHTML);
$('#footer-body').innerHTML = $('#footer-panel').innerHTML;
drawOriginLegend($('#origin-legend'));

const loader = createLoader({ timeoutMs: 90_000 });
(async () => {
    loader.armTimeout();
    const routes = await startDuckDB(loader.step);
    loader.step('drawing the map', 'Drawing the arcs…');

    const grid = LatticeGrid.createGrid(panel('table', 'Routes · filter row on, group by airline or region'), {
        rowKey: 'id', source: routes, filterRow: true, selection: 'single',
        columns: [
            { field: 'id', title: 'ID', layout: { hidden: true } },
            { field: 'origin_iata', title: 'Origin', layout: { flex: 1, min: 70 } },
            { field: 'dest_iata', title: 'Destination', layout: { flex: 1, min: 90 } },
            { field: 'airline_name', title: 'Airline', layout: { flex: 2, min: 140 } },
            { field: 'scheduled_services', title: 'Services', type: 'number', layout: { flex: 1, min: 80 } },
            { field: 'flights_per_week_estimate', title: 'Est./week', type: 'number', layout: { flex: 1, min: 80 } },
            { field: 'distance_km', title: 'Distance km', type: 'number', format: { decimals: 0 }, layout: { flex: 1, min: 90 } },
            { field: 'haul', title: 'Haul', layout: { flex: 1, min: 90 } },
            { field: 'region', title: 'Region', layout: { flex: 1, min: 90 } },
            { field: 'origin_lat', layout: { hidden: true } }, { field: 'origin_lon', layout: { hidden: true } },
            { field: 'dest_lat', layout: { hidden: true } }, { field: 'dest_lon', layout: { hidden: true } },
            { field: 'dest_country', layout: { hidden: true } },
        ],
    });
    loader.waitForRows(() => grid.rows.count() > 0 && grid.rows.get(0).data && grid.rows.get(0).data.origin_iata !== undefined);
    window.__demo = { grid, routes };

    buildPresets(controls.querySelector('#presets'), grid);
    controls.querySelector('#group-by').addEventListener('change', (e) => grid.columns.group(e.target.value ? [e.target.value] : []));

    // Destinations/countries are `custom` tiles calling the engine directly with
    // fn:'distinct' (F-UKFL-1: the KPI module's own `countDistinct` aggregation
    // does not route to a duckdbAdapter pushdown source as `distinct`, the fn
    // name the adapter pushes identically — it silently falls back to reducing
    // only the loaded page, undercounting a paged grid. Filed, not worked around:
    // this calls the documented `source.aggregate()` fn vocabulary directly.)
    const distinct = { destinations: null, countries: null };
    const refreshDistinct = async () => {
        const req = { filters: grid.filters.get(), sort: [], range: null, groupBy: [] };
        const r = await routes.aggregate(req, [{ id: 'd', col: 'dest_iata', fn: 'distinct' }, { id: 'c', col: 'dest_country', fn: 'distinct' }]);
        distinct.destinations = Number(r.values.d);
        distinct.countries = Number(r.values.c);
        tiles.refresh();
    };
    const tiles = LatticeGridKPI.createKPI(panel('kpis', 'Matching set · computed by the engine'), {
        grid, rowKey: 'id', columns: 1,
        tiles: [
            { id: 'routes', label: 'Routes', aggregation: 'count' },
            { id: 'services', label: 'Scheduled services', aggregation: 'sum', field: 'scheduled_services' },
            { id: 'destinations', label: 'Destinations', aggregation: 'custom', compute: () => distinct.destinations },
            { id: 'countries', label: 'Countries', aggregation: 'custom', compute: () => distinct.countries },
            { id: 'weekly', label: 'Est. flights/week (estimate)', aggregation: 'sum', field: 'flights_per_week_estimate' },
        ],
    });
    grid.on('filter:changed', refreshDistinct);
    refreshDistinct();
    LatticeGrid.createChart({
        grid, container: panel('chart', 'Chart · scheduled services by region'),
        type: 'bar', x: 'region', y: 'scheduled_services',
    });

    // zoom 0: the whole world in view at load, so every matching arc (not just
    // the destinations on screen) draws before the reader ever pans or zooms.
    const view = { longitude: 15, latitude: 20, zoom: 0 };
    const basemap = new maplibregl.Map({ container: 'basemap', style: 'https://tiles.openfreemap.org/styles/positron',
        interactive: false, center: [view.longitude, view.latitude], zoom: view.zoom, attributionControl: false });
    const deckgl = new deck.Deck({
        parent: $('#deck'), initialViewState: view, controller: true,
        getCursor: ({ isHovering }) => (isHovering ? 'pointer' : 'grab'),
        onAfterRender: () => { const vp = deckgl.getViewports()[0]; if (vp) basemap.jumpTo({ center: [vp.longitude, vp.latitude], zoom: vp.zoom }); },
        onClick: ({ object, layer }) => { if (object && layer && layer.id === 'routes') { grid.selection.set([object.id]); grid.scroll.toRow(object.id, 'center'); } },
    });

    const binding = LatticeGridDeck.bindDeck(grid, {
        deck: deckgl, viewportFilter: true, position: { lon: 'dest_lon', lat: 'dest_lat' },
        layers: (rows) => buildArcLayers(rows, new Set(grid.selection.keys())),
    });
    grid.on('selection:changed', () => binding.update());
    window.__demo.binding = binding;
})().catch(loader.fail);
