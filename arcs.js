/**
 * The arc layer, its legend and the airport preset bar. Colour is by UK
 * origin airport (7 colours); width by scheduled services (area-true,
 * `sqrt`, matching the GIS demo's dot-sizing choice); a second, wider
 * layer redraws the selected row's arc on top so a table click stands out
 * on the map.
 */
const ORIGIN_COLOUR = {
    LHR: [230, 25, 75], LGW: [60, 180, 75], STN: [255, 170, 30],
    MAN: [0, 130, 200], EDI: [245, 100, 175], BHX: [145, 30, 180], BRS: [30, 200, 200],
};
const width = (services) => 1 + Math.sqrt(Math.max(0, services));

/**
 * Build deck's ArcLayer(s) for one render of the binding.
 * @param {object[]} rows the binding's rows (routes inside the map's view)
 * @param {Set<number>} selected the grid's selected row ids
 * @returns {object[]} the deck.gl layers
 */
function buildArcLayers(rows, selected) {
    const colourOf = (r) => ORIGIN_COLOUR[r.origin_iata] || [140, 140, 140];
    const base = new deck.ArcLayer({
        id: 'routes', data: rows, pickable: true, greatCircle: true,
        getSourcePosition: (r) => [r.origin_lon, r.origin_lat],
        getTargetPosition: (r) => [r.dest_lon, r.dest_lat],
        getSourceColor: colourOf, getTargetColor: (r) => [...colourOf(r), 140],
        getWidth: (r) => width(r.scheduled_services),
    });
    const highlight = new deck.ArcLayer({
        id: 'routes-selected', data: rows.filter((r) => selected.has(r.id)), greatCircle: true,
        getSourcePosition: (r) => [r.origin_lon, r.origin_lat],
        getTargetPosition: (r) => [r.dest_lon, r.dest_lat],
        getSourceColor: [255, 0, 90], getTargetColor: [255, 0, 90],
        getWidth: (r) => width(r.scheduled_services) + 3,
    });
    return [base, highlight];
}

/**
 * Draw the origin-airport colour legend.
 * @param {Element} el where it goes
 */
function drawOriginLegend(el) {
    el.innerHTML = Object.entries(ORIGIN_COLOUR).map(([code, c]) =>
        '<span><i class="sw" style="background:rgb(' + c + ')"></i>' + code + '</span>').join('');
}

/**
 * Build the airport preset buttons; each sets (or, for "All", clears) the
 * grid's `origin_iata` filter.
 * @param {Element} el the preset bar's container
 * @param {object} grid the bound grid
 */
function buildPresets(el, grid) {
    const codes = ['All', ...Object.keys(ORIGIN_COLOUR)];
    el.innerHTML = codes.map((c) => '<button type="button" data-airport="' + c + '">' + c + '</button>').join('');
    el.addEventListener('click', (e) => {
        const code = e.target.dataset.airport;
        if (!code) return;
        for (const b of el.querySelectorAll('button')) b.classList.toggle('on', b === e.target);
        if (code === 'All') grid.filters.clear();
        else grid.filters.set({ col: 'origin_iata', op: 'eq', value: code });
    });
    el.querySelector('[data-airport="All"]').classList.add('on');
}
