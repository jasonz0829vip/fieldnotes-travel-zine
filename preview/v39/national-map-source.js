/* FIELDNOTES V3.9 national cartographic source configuration.
 * A deployer must fill in a permissioned, HTTPS, CORS-enabled, byte-range capable
 * PMTiles archive URL that is reachable by ordinary mobile networks in China.
 *
 * Disabled by default: do NOT pretend the nationwide high-detail maps are online
 * before a real provider, coverage, and lawful re-distribution are verified.
 * Never put API secrets here; this is a public web app asset.
 */
window.FIELDNOTES_NATIONAL_SOURCE = window.FIELDNOTES_NATIONAL_SOURCE || Object.freeze({
 enabled:false,
 kind:'pmtiles',
 url:'',
 version:'china-202610',
 attribution:'Map data © OpenStreetMap contributors / ODbL',
 sourceDescription:'等待国内可访问且经许可的数据源'
});
