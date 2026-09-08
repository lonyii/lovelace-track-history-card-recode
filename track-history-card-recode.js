/**
 * lovelace-track-history-card
 * Lovelace card for Home Assistant — shows device_tracker movement on a map for a selected day.
 * Install via HACS → Frontend → Custom repositories.
 *
 * Config example:
 *   type: custom:lovelace-track-history-card
 *   title: "Movimientos"
 *   entities:
 *     - device_tracker.john_phone
 *     - device_tracker.jane_iphone
 *   default_entity: device_tracker.john_phone
 *   units: metric        # metric (default) or imperial
 *   show_arrows: true    # direction arrows on the path (default true)
 *   arrow_count: 30      # number of arrows when enabled (default 30)
 */

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_JS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
const LEAFLET_CSS_URL = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;

// Reverse geocoding (opt-in). Default endpoint is Nominatim; `geocode_url` may
// point at any Nominatim-compatible reverse endpoint (LocationIQ, self-hosted).
// Nominatim's usage policy caps requests at ~1/sec, so calls are serialised
// (GEO_MIN_GAP_MS) and results cached in localStorage for GEO_TTL_MS.
// NOTE: the AMap (高德) endpoints below no longer ship a built-in key — the key
// is read from the card config (`amap_key`) at runtime. Without an `amap_key`,
// the AMap provider will not work; configure one in the card editor or YAML.
const GEO_PROVIDERS = {
  amap: {
    name: 'AMap',
    url: 'https://restapi.amap.com/v3/geocode/regeo',
    convertUrl: 'https://restapi.amap.com/v3/assistant/coordinate/convert'
  },
  bigdatacloud: {
    name: 'BigDataCloud',
    url: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
    convertUrl: null
  }
};
const GEO_MIN_GAP_MS = 1100;
const GEO_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const GEO_CACHE_PREFIX = 'thc:geo:';

// Numeric config limits — the single source of truth for each field's default
// and the range enforced in setConfig, the editor inputs and the editor labels.
// Change a value here and it propagates everywhere.
const LIMITS = {
  cluster_radius: { min:  50, max:  500, def: 200 },
  min_points:     { min:   2, max:    5, def:   3 },
  arrow_count:    { min:  10, max:   30, def:  30 },
};

// ── Translations ──────────────────────────────────────────────────────────────

const TRANSLATIONS = {
  en: {
    track_of:       'Track of',
    date:           'Date',
    load:           'Load',
    loading:        'Loading…',
    no_data:        'No location data found for this day.',
    points:         'points',
    error:          'Error',
    start:          'Start',
    end:            'End',
    title_lbl:      'Title',
    tracked_devs:   'Tracked devices',
    device_n:       'Device',
    add_device:     '+ Add device',
    default_dev:    'Default device',
    first_in_list:  '— first in list —',
    remove:            'Remove',
    cluster_radius_lbl:'Cluster radius',
    min_points_lbl:    'Minimum points per cluster',
    reverse_geocode_lbl: 'Reverse geocoding (address for stops outside zones)',
    geocode_provider_lbl: 'Geocode provider',
    amap_key_lbl:  'AMap (Gaode) API key',
    carto_key_lbl: 'CARTO basemap API key',
    amap_key_hint: 'Required when the geocode provider is AMap.',
    carto_key_hint: 'Optional. Without it the public CARTO tiles are used.',
    units_lbl:         'Units',
    units_metric:      'Metric',
    units_imperial:    'Imperial',
    theme_lbl:         'Theme',
    theme_system:      'System',
    theme_light:       'Light',
    theme_dark:        'Dark',
    advanced_lbl:      'Advanced',
    timeline_lbl:      'Timeline',
    arrows_lbl:        'Direction arrows',
    arrow_count_lbl:   'Number of arrows',
    stop_n:            'Stop',
    moving:            'Moving',
    recenter:          'Recenter',
    default_title:     'Track History',
    time:             'Time',
    speed:            'Speed',
    heading:          'Heading',
    coordinates:      'Coordinates',
    distance:         'Distance',
    avg_speed:        'Avg Speed',
    max_speed:        'Max Speed',
    play_animation:   'Play',
    pause_animation:  'Pause',
    resume_animation: 'Resume',
    stop_animation:   'Stop',
  },
  zh: {
    track_of:       '轨迹',
    date:           '日期',
    load:           '加载',
    loading:        '加载中…',
    no_data:        '当天没有找到位置数据。',
    points:         '个点',
    error:          '错误',
    start:          '起点',
    end:            '终点',
    title_lbl:      '标题',
    tracked_devs:   '追踪设备',
    device_n:       '设备',
    add_device:     '+ 添加设备',
    default_dev:    '默认设备',
    first_in_list:  '— 列表第一个 —',
    remove:            '移除',
    cluster_radius_lbl:'聚合半径',
    min_points_lbl:    '每个聚合的最小点数',
    reverse_geocode_lbl: '反向地理编码 (区域外停留点的地址)',
    geocode_provider_lbl: '地理编码提供商',
    amap_key_lbl:  '高德地图 API Key',
    carto_key_lbl: 'CARTO 底图 API Key',
    amap_key_hint: '选择高德地图 (AMap) 作为地理编码提供商时必填。',
    carto_key_hint: '可选；不填则使用 CARTO 公共瓦片（受其公共配额限制）。',
    units_lbl:         '单位',
    units_metric:      '公制',
    units_imperial:    '英制',
    theme_lbl:         '主题',
    theme_system:      '系统',
    theme_light:       '浅色',
    theme_dark:        '深色',
    advanced_lbl:      '高级',
    timeline_lbl:      '时间线',
    arrows_lbl:        '方向箭头',
    arrow_count_lbl:   '箭头数量',
    stop_n:            '停留',
    moving:            '移动中',
    recenter:          '重新居中',
    default_title:     '轨迹历史',
    time:             '时间',
    speed:            '速度',
    heading:          '朝向',
    coordinates:      '坐标',
    distance:         '里程',
    avg_speed:        '均速',
    max_speed:        '极速',
    play_animation:   '播放',
    pause_animation:  '暂停',
    resume_animation: '继续',
    stop_animation:   '停止',
  },
};

// HA language codes can be 'en', 'es', 'pt-BR', etc. — take the base code.
function getLang(hass) {
  const base = (hass?.language ?? 'en').split('-')[0].toLowerCase();
  return TRANSLATIONS[base] ? base : 'en';
}

// Shared promise — only loads Leaflet once across all card instances
let _leafletPromise = null;

function ensureLeaflet() {
  if (_leafletPromise) return _leafletPromise;
  _leafletPromise = new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return; }
    const script = document.createElement('script');
    script.src = LEAFLET_JS_URL;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.head.appendChild(script);
  });
  return _leafletPromise;
}

// ────────────────────────────────────────────────────────────────────────────

class LovelaceTrackHistoryCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._map = null;
    this._config = null;
    this._hass = null;
    this._leafletCssInjected = false;
    this._autoLoaded = false;
    this._hasConnected = false;
    // Reverse-geocoding state. `_loadGen` is bumped on every load so responses
    // that arrive after the user changed day/device are discarded. `_geoMarkers`
    // maps a stop's rounded-coordinate key → the marker popup rebuilders, and
    // `_geoResolved` holds the address components resolved so far this load.
    this._loadGen = 0;
    this._geoQueue = [];
    this._geoBusy = false;
    this._geoResolved = new Map();
    this._geoMarkers = new Map();
  }

  // ── HA lifecycle ──────────────────────────────────────────────────────────

  static getConfigElement() {
    return document.createElement('lovelace-track-history-card-editor');
  }

  static getStubConfig() {
    return {
      entities: [],
      cluster_radius: LIMITS.cluster_radius.def,
      min_points: LIMITS.min_points.def,
      theme: 'system',
      reverse_geocode: true,
      geocode_provider: 'amap',
    };
  }

  setConfig(config) {
    if (!config.entities || !Array.isArray(config.entities) || config.entities.length === 0) {
      throw new Error('[lovelace-track-history-card] "entities" must be a non-empty list of device_tracker entity IDs.');
    }
    this._config = {
      default_entity: null,
      theme: 'system',
      ...config,
    };
    // Enforce the same ranges as the editor here too, so a hand-edited YAML
    // can't bypass them. Missing / out-of-range / non-numeric values are
    // clamped or fall back to the default — matching what the editor stores.
    this._config.cluster_radius = this._clampNum(this._config.cluster_radius,  LIMITS.cluster_radius);
    this._config.min_points     = this._clampNum(this._config.min_points,      LIMITS.min_points);
    if (this._config.arrow_count != null) {
      this._config.arrow_count  = this._clampNum(this._config.arrow_count,     LIMITS.arrow_count);
    }
    this._build();
    // Redraw the map on config changes (e.g. from the visual editor) once
    // hass is available and the first load has already happened.
    if (this._hass && this._autoLoaded) this._onLoad();
  }

  // Clamp a config value to a field's [min, max], rounding to an integer and
  // falling back to its default when missing or not a number.
  _clampNum(v, { min, max, def }) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
  }

  set hass(hass) {
    const langChanged = getLang(this._hass) !== getLang(hass);
    const oldTheme = this._hass ? this._resolveTheme() : null;
    this._hass = hass;
    const newTheme = this._resolveTheme();
    
    if (langChanged && this._config) {
      this._destroyMap();
      this._build();
    } else if (oldTheme !== null && oldTheme !== newTheme && this._map) {
      const L = window.L;
      this._ensureTileLayer(L);
    }
    
    if (!this._autoLoaded && this._config) {
      this._autoLoaded = true;
      this._onLoad();
    }
  }

  _t(key) {
    return TRANSLATIONS[getLang(this._hass)][key];
  }

  // The `person` linked to a Home Assistant user that owns this tracker, or
  // null. A tracker can belong to at most one such person.
  _personForTracker(entityId) {
    const states = this._hass?.states || {};
    for (const id in states) {
      if (!id.startsWith('person.')) continue;
      const attrs = states[id].attributes || {};
      if (attrs.user_id && Array.isArray(attrs.device_trackers)
          && attrs.device_trackers.includes(entityId)) {
        return { id, name: attrs.friendly_name || id.replace('person.', '') };
      }
    }
    return null;
  }

  // The tracker's own name: friendly_name, else a title-cased entity id.
  _trackerName(entityId) {
    return this._hass?.states[entityId]?.attributes?.friendly_name
      || entityId.replace('device_tracker.', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Label for a device_tracker in the selector. Shows the owning user's name
  // when the tracker is assigned to one — unless two configured trackers share
  // the same user, in which case the user name would be ambiguous, so we keep
  // the tracker names. Unassigned trackers always show their tracker name.
  _deviceLabel(entityId) {
    const person = this._personForTracker(entityId);
    if (person) {
      const shared = (this._config?.entities || []).some(
        e => e !== entityId && this._personForTracker(e)?.id === person.id);
      if (!shared) return person.name;
    }
    return this._trackerName(entityId);
  }

  // Format a time honouring the user's HA profile settings (12/24h + language).
  _fmtTime(t) {
    const locale = this._hass?.locale;
    const opts = { hour: '2-digit', minute: '2-digit' };
    if (locale?.time_format === '24') opts.hour12 = false;
    else if (locale?.time_format === '12') opts.hour12 = true;
    // 'language' / 'system' (or unset) → let Intl decide from the locale.
    return t.toLocaleTimeString(locale?.language || [], opts);
  }

  // Format an ISO date (yyyy-mm-dd) honouring the user's HA profile date_format
  // (DMY / MDY / YMD / language / system). The native <input type="date"> can't
  // be told which order to render, so we display this string over it instead.
  _fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    const locale = this._hass?.locale;
    const fmt = locale?.date_format;
    const dateOpts = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const weekdayOpts = { weekday: 'short' };
    let dateStr, weekdayStr;
    // Force the day/month/year order via a locale known to produce it.
    if (fmt === 'DMY') { dateStr = d.toLocaleDateString('en-GB', dateOpts); weekdayStr = d.toLocaleDateString('en-GB', weekdayOpts); }
    else if (fmt === 'MDY') { dateStr = d.toLocaleDateString('en-US', dateOpts); weekdayStr = d.toLocaleDateString('en-US', weekdayOpts); }
    else if (fmt === 'YMD') { dateStr = d.toLocaleDateString('en-CA', dateOpts); weekdayStr = d.toLocaleDateString('en-CA', weekdayOpts); }
    else if (fmt === 'system') { dateStr = d.toLocaleDateString([], dateOpts); weekdayStr = d.toLocaleDateString([], weekdayOpts); }
    else { dateStr = d.toLocaleDateString(locale?.language || [], dateOpts); weekdayStr = d.toLocaleDateString(locale?.language || [], weekdayOpts); }
    return dateStr + ' ' + weekdayStr;
  }

  disconnectedCallback() {
    this._destroyMap();
  }

  connectedCallback() {
    // The first attach is handled by the normal setConfig / `set hass` load
    // path. A *re-attach* (switching away and back to the view, or opening the
    // visual editor) lands here after disconnectedCallback destroyed the map —
    // Home Assistant reuses the element, so the DOM and the selected date/device
    // survive on the instance. Redraw from them so the map comes back without a
    // full page reload or a manual date/device change.
    if (this._hasConnected) {
      if (this._config && this._hass) this._onLoad();
    } else {
      this._hasConnected = true;
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _isPreviewMode() {
    return window.location.pathname.includes('config') || 
           window.location.pathname.includes('lovelace') && window.location.search.includes('edit');
  }

  _isLandscapeMode() {
    const screenRatio = window.innerWidth / window.innerHeight;
    const containerWidth = this.shadowRoot?.querySelector('#main-content')?.clientWidth || window.innerWidth;
    const timelineMinWidth = 280;
    const mapMinWidth = containerWidth * 0.7;
    if (mapMinWidth <= timelineMinWidth) {
      return false;
    }
    return screenRatio > 1.2;
  }

  _build() {
    const today = new Date().toISOString().split('T')[0];
    const selDate   = this._selectedDate || today;
    const selEntity = this._selectedEntity || this._config.default_entity;
    const isPreview = this._isPreviewMode();
    const isLandscape = this._isLandscapeMode();

    this.shadowRoot.innerHTML = `
      <style>${this._css(isPreview)}</style>
      <ha-card class="${isLandscape ? 'landscape' : 'portrait'}">
        ${this._config.title ? `<div class="card-header">${this._config.title}</div>` : ''}
        <div class="card-content">
          <div class="controls">
            ${this._config.entities.length > 1 ? `
            <div class="ctrl-group">
              <label>${this._t('track_of')}</label>
              <select id="entity-select">
                ${this._config.entities.map(e => {
                  const label = this._deviceLabel(e);
                  const selected = e === selEntity ? ' selected' : '';
                  return `<option value="${e}"${selected}>${label}</option>`;
                }).join('')}
              </select>
            </div>` : `<input type="hidden" id="entity-select" value="${this._config.entities[0]}">`}
            <div class="ctrl-group">
              <div class="date-nav">
                <button type="button" class="date-nav-btn" id="date-prev">&#8249;</button>
                <div class="date-field">
                  <button type="button" class="date-display" id="date-display">${this._fmtDate(selDate)}</button>
                  <input type="date" id="date-picker" value="${selDate}" max="${today}" tabindex="-1" aria-hidden="true" />
                </div>
                <button type="button" class="date-nav-btn" id="date-next" ${selDate >= today ? 'disabled' : ''}>&#8250;</button>
              </div>
            </div>
          </div>
          <div id="alert" class="alert hidden"></div>
          <div id="main-content">
            <div id="map-wrap">
              <div id="map"></div>
              <div id="no-data" class="no-data hidden">${this._t('no_data')}</div>
              <div id="loading-overlay" class="loading-overlay hidden">
                <div class="loading-spinner">
                  <div class="loading-ping"></div>
                  <div class="loading-ping"></div>
                  <div class="loading-ping"></div>
                  <div class="loading-orbit">
                    <div class="loading-orbit-dot"></div>
                  </div>
                  <div class="loading-dot"></div>
                </div>
                <div class="loading-text">
                  ${this._t('loading')}<span class="loading-dots"><span></span><span></span><span></span></span>
                </div>
              </div>
            </div>
            <div id="timeline-container">
              <div id="summary" class="summary hidden"></div>
              <div id="timeline" class="timeline hidden"></div>
            </div>
          </div>
        </div>
      </ha-card>
    `;

    this.shadowRoot.getElementById('entity-select')
      .addEventListener('change', e => {
        this._selectedEntity = e.target.value;
        this._onLoad();
      });

    const datePicker  = this.shadowRoot.getElementById('date-picker');
    const dateNext    = this.shadowRoot.getElementById('date-next');
    const dateDisplay = this.shadowRoot.getElementById('date-display');
    const applyDate   = () => {
      this._selectedDate = datePicker.value;
      dateNext.disabled = datePicker.value >= today;
      if (dateDisplay) dateDisplay.textContent = this._fmtDate(datePicker.value);
      this._onLoad();
    };
    datePicker.addEventListener('change', applyDate);
    // The visible button just opens the native calendar; the input itself is
    // hidden so its browser-locale text never shows.
    dateDisplay.addEventListener('click', () => {
      if (typeof datePicker.showPicker === 'function') {
        datePicker.showPicker();
      } else if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        datePicker.style.opacity = '1';
        datePicker.style.pointerEvents = 'auto';
        datePicker.focus();
        datePicker.click();
        setTimeout(() => {
          datePicker.style.opacity = '0';
          datePicker.style.pointerEvents = 'none';
        }, 100);
      } else {
        datePicker.focus();
        datePicker.click();
      }
    });
    this.shadowRoot.getElementById('date-prev')
      .addEventListener('click', () => {
        const d = new Date(datePicker.value + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        datePicker.value = d.toISOString().slice(0, 10);
        applyDate();
      });
    dateNext.addEventListener('click', () => {
      const d = new Date(datePicker.value + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      datePicker.value = d.toISOString().slice(0, 10);
      applyDate();
    });
  }

  _css(isPreview = false) {
    return `
      :host { 
        display: block; 
        height: 100%;
      }
      ha-card { 
        overflow: hidden;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 400px;
      }

      .card-header {
        padding: 16px 16px 0;
        font-size: 18px;
        font-weight: 500;
        color: var(--ha-card-header-color, var(--primary-text-color));
        letter-spacing: 0.01em;
        flex-shrink: 0;
      }
      .card-content { 
        padding: 16px; 
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      /* Controls row */
      .controls {
        display: flex;
        gap: 10px;
        align-items: flex-end;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .ctrl-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        min-width: 130px;
      }
      label {
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--secondary-text-color, #888);
      }
      .date-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .date-field { position: relative; flex: 1; }
      /* The visible field is a button showing the date in the user's HA format;
         the native <input type="date"> below is invisible and only used to open
         the calendar picker (showPicker), so the browser-locale text is never
         shown. */
      .date-field .date-display { cursor: pointer; font-family: inherit; }
      .date-field input[type="date"] {
        position: absolute;
        inset: 0;
        opacity: 0;
        pointer-events: none;
        z-index: 100;
      }
      .date-nav-btn {
        flex-shrink: 0;
        width: 30px;
        height: 38px;
        padding: 0;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #333);
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        transition: opacity .15s;
      }
      .date-nav-btn:hover:not(:disabled) { opacity: 0.7; }
      .date-nav-btn:disabled { opacity: 0.3; cursor: default; }
      select, input[type="date"], .date-display {
        padding: 8px 10px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 6px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #333);
        font-size: 14px;
        width: 100%;
        box-sizing: border-box;
        height: 38px;
        text-align: center;
      }
/* Alert banner */
      .alert {
        padding: 9px 12px;
        border-radius: 6px;
        font-size: 13px;
        margin-bottom: 10px;
      }
      .alert.error { background: #ffebee; color: #b71c1c; }
      .alert.info  { background: #e3f2fd; color: #0d47a1; }
      .hidden { display: none !important; }

      #main-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1;
        min-height: 0;
        max-height: calc(100vh - 180px);
      }
      #map-wrap {
        flex: 3;
        min-height: 200px;
      }
      #timeline-container {
        flex: 1;
        min-height: 100px;
        max-height: calc((100vh - 180px) * 0.25);
        overflow-y: auto;
        border-radius: 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        padding: 12px;
        box-sizing: border-box;
        background: var(--card-background-color, #fff);
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      #timeline-container::-webkit-scrollbar {
        display: none;
      }
      .landscape #main-content {
        flex-direction: row;
        align-items: stretch;
        gap: 16px;
        max-height: calc(100vh - 180px);
      }
      .landscape #map-wrap {
        flex: 3;
        height: 100%;
      }
      .landscape #map-wrap #map {
        height: 100% !important;
      }
      .landscape #timeline-container {
        flex: 1;
        min-width: 280px;
        max-width: 360px;
        height: 100%;
        max-height: calc(100vh - 180px);
        overflow-y: auto;
        border-radius: 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        padding: 12px;
        box-sizing: border-box;
        background: var(--card-background-color, #fff);
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .landscape #timeline-container::-webkit-scrollbar {
        display: none;
      }
      .portrait .controls {
        margin-bottom: 8px;
        gap: 6px;
      }
      .portrait .ctrl-group {
        gap: 2px;
      }
      .portrait .date-nav-btn {
        height: 30px;
        width: 24px;
        font-size: 14px;
      }
      .portrait select, .portrait input[type="date"], .portrait .date-display {
        height: 30px;
        padding: 4px 8px;
        font-size: 13px;
      }

      /* Map */
      #map-wrap {
        position: relative;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--divider-color, #e0e0e0);
        isolation: isolate;
        z-index: 0;
      }
      #map { width: 100%; height: 100%; }
      .no-data {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--card-background-color, #fafafa);
        color: var(--secondary-text-color, #888);
        font-size: 14px;
      }

      /* Loading overlay */
      .loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--card-background-color, rgba(250, 250, 250, 0.9));
        backdrop-filter: blur(2px);
        z-index: 500;
        gap: 16px;
      }
      .loading-spinner {
        position: relative;
        width: 56px;
        height: 56px;
      }
      .loading-ping {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: var(--primary-color, #03a9f4);
        opacity: 0.3;
        animation: thc-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
      .loading-ping:nth-child(2) {
        animation-delay: -0.6s;
      }
      .loading-ping:nth-child(3) {
        animation-delay: -1.2s;
      }
      .loading-dot {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--primary-color, #03a9f4);
        border: 3px solid var(--card-background-color, #fff);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 2;
      }
      .loading-orbit {
        position: absolute;
        inset: 0;
        animation: thc-spin 2s linear infinite;
      }
      .loading-orbit-dot {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--primary-color, #03a9f4);
      }
      .loading-text {
        font-size: 13px;
        color: var(--secondary-text-color, #666);
        font-weight: 500;
        letter-spacing: 0.02em;
      }
      .loading-dots {
        display: inline-flex;
        gap: 4px;
        margin-left: 2px;
      }
      .loading-dots span {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--secondary-text-color, #666);
        animation: thc-bounce 1.4s ease-in-out infinite both;
      }
      .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
      .loading-dots span:nth-child(2) { animation-delay: -0.16s; }
      @keyframes thc-ping {
        0% { transform: scale(0.4); opacity: 0.6; }
        75%, 100% { transform: scale(1.2); opacity: 0; }
      }
      @keyframes thc-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes thc-bounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
        40% { transform: scale(1); opacity: 1; }
      }

      /* Summary row */
      .summary {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
        margin-top: 10px;
        font-size: 13px;
        color: var(--secondary-text-color, #666);
      }
      .summary-item { display: flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0; }
      .play-btn {
        display: inline-flex;
        margin-left: auto;
        flex-shrink: 0;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border: 1px solid var(--primary-color, #03a9f4);
        border-radius: 4px;
        background: transparent;
        color: var(--primary-color, #03a9f4);
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        overflow: hidden;
      }
      .play-btn:hover {
        background: var(--primary-color, #03a9f4);
        color: #fff;
      }
      .play-btn.playing {
        background: #C62828;
        border-color: #C62828;
        color: #fff;
      }
      .play-btn.paused {
        background: #FF9800;
        border-color: #FF9800;
        color: #fff;
      }
      .play-btn svg {
        width: 14px;
        height: 14px;
      }
      .play-btn .longpress-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: rgba(255, 255, 255, 0.8);
        width: 0;
        transition: width 0.1s linear;
        border-radius: 0 0 4px 4px;
      }
      .play-btn.paused .longpress-progress {
        background: rgba(0, 0, 0, 0.3);
      }
      .animation-info {
        position: absolute;
        top: 10px;
        right: 10px;
        background: var(--card-background-color, rgba(255, 255, 255, 0.95));
        border-radius: 6px;
        padding: 4px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        color: var(--primary-text-color, #333);
        border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.1));
        box-sizing: border-box;
        width: 250px;
      }
      .animation-info .info-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 2px 6px;
        background: var(--secondary-background-color, rgba(0, 0, 0, 0.02));
        border-radius: 4px;
        flex-shrink: 0;
      }
      .animation-info .info-container:nth-child(1) { width: 45px; }
      .animation-info .info-container:nth-child(2) { width: 55px; }
      .animation-info .info-container:nth-child(3) { width: 45px; }
      .animation-info .info-container:nth-child(4) { width: 30px; }
      .animation-info .info-item {
        display: flex;
        align-items: baseline;
        gap: 1px;
      }
      .animation-info .info-label {
        font-size: 10px;
        color: var(--secondary-text-color, #666);
      }
      .animation-info .info-value {
        font-size: 13px;
        font-weight: 600;
        color: var(--primary-color, #1565C0);
      }
      .animation-info .info-unit {
        font-size: 10px;
        color: var(--secondary-text-color, #666);
      }
      .animation-info .heading-arrow {
        font-size: 16px;
        color: var(--primary-color, #1565C0);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        background: var(--secondary-background-color, rgba(21, 101, 192, 0.1));
        border-radius: 50%;
        transition: transform 0.1s ease;
        flex-shrink: 0;
      }

      /* Timeline panel */
      .timeline {
        margin-top: 0;
        padding-top: 0;
      }
      @media screen and (min-width: 900px) {
        #timeline-container .summary {
          margin-top: 0;
        }
        #timeline-container .timeline {
          margin-top: 0;
          padding-top: 0;
        }
      }
      .tl-header {
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--secondary-text-color, #888);
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: space-between;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }
      .tl-summary {
        display: flex;
        gap: 8px;
        font-size: 11px;
        color: var(--secondary-text-color, #888);
      }
      .tl-stat {
        white-space: nowrap;
      }
      .tl-item {
        display: flex;
        gap: 10px;
        font-size: 13px;
        color: var(--primary-text-color, #333);
        padding: 6px 10px;
        border-radius: 8px;
      }
      /* Stops get a zebra background so the right-hand value reads as part of
         the same row; movement segments stay transparent in between. */
      .tl-item.tl-stop {
        background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
      }
      .tl-rail {
        position: relative;
        flex-shrink: 0;
        width: 22px;
      }
      .tl-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 20px;
        font-size: 14px;
      }
      .tl-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #F57C00;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
      }
      /* Vertical connector between consecutive events; extends past the row
         padding so the line stays continuous across the gap. */
      .tl-item:not(:last-child) .tl-rail::after {
        content: '';
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        top: 20px;
        bottom: -12px;
        width: 2px;
        background: var(--divider-color, #e0e0e0);
      }
      .tl-main {
        flex: 1;
        min-width: 0;
      }
      .tl-line {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }
      /* min-width:0 + ellipsis lets a long location truncate instead of
         pushing the right-hand time/duration onto a second line (mobile). */
      .tl-title {
        font-weight: 500;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tl-value {
        flex-shrink: 0;
        color: var(--secondary-text-color, #888);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .tl-sub {
        flex-shrink: 0;
        margin-top: 1px;
        text-align: right;
        font-size: 12px;
        white-space: nowrap;
        color: var(--secondary-text-color, #888);
      }
      .tl-subline {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        margin-top: 1px;
      }
      .tl-zone {
        font-weight: 500;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tl-move .tl-title {
        color: var(--secondary-text-color, #888);
        font-style: italic;
        font-weight: 400;
      }

      /* Leaflet popup override */
      .leaflet-popup-content { font-size: 13px; line-height: 1.5; }
    `;
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async _onLoad() {
    const entityId = this.shadowRoot.getElementById('entity-select').value;
    const date     = this.shadowRoot.getElementById('date-picker').value;
    if (!entityId || !date) return;

    // 停止正在进行的动画
    this._stopAnimation();

    // New load generation: abort any pending geocoding from the previous
    // day/device so a late address can't be written onto the new track.
    const gen = ++this._loadGen;
    this._geoQueue = [];
    this._geoResolved = new Map();

    // Keep the date overlay in sync with the locale (the first build can run
    // before `hass` — and thus the user's date_format — is available).
    const dateDisplay = this.shadowRoot.getElementById('date-display');
    if (dateDisplay) dateDisplay.textContent = this._fmtDate(date);

    this._setAlert('');
    this._setLoading(true);

    try {
      await this._injectLeafletCss();
      const L = await ensureLeaflet();
      const points = await this._fetchPoints(entityId, date);

      // The previous summary/timeline stay on screen during the fetch and are
      // replaced in place once the new data is ready — clearing them up front
      // collapses the card and then re-expands it, which reads as a flicker.
      if (points.length === 0) {
        // Keep the map alive (the opaque "no data" overlay covers it); just
        // drop the previous track so returning to a day with data is flicker-free.
        if (this._trackLayer) this._trackLayer.clearLayers();
        this._setSummary(null);
        this._setTimeline(null);
        this._setNoData(true);
      } else {
        this._setNoData(false);
        const displayed = this._drawTrack(L, points);
        this._setSummary(displayed);
        this._setTimeline(displayed);
        this._enrichLocations(displayed, gen);
      }
    } catch (err) {
      console.error('[lovelace-track-history-card]', err);
      this._setAlert(`${this._t('error')}: ${err.message}`, 'error');
    } finally {
      this._setLoading(false);
    }
  }

  async _fetchPoints(entityId, date) {
    // Local day boundaries → explicit UTC instants for the API.
    const startISO = new Date(`${date}T00:00:00`).toISOString();
    const endISO   = new Date(`${date}T23:59:59.999`).toISOString();

    // Use the `history/stream` WS subscription — the same one the HA History
    // panel uses. The REST `history/period` endpoint and the one-shot
    // `history/history_during_period` command both return empty for fully past
    // days in recent HA versions; `history/stream` returns them correctly.
    const list = await this._streamHistory(entityId, startISO, endISO);

    let lastA = {};
    return list
      .map(s => {
        // Compact keys: s=state, a=attributes, lu=last_updated,
        // lc=last_changed (epoch seconds). Attributes carry forward when
        // unchanged. Verbose keys are a fallback for older HA versions.
        const a = s.a ?? s.attributes;
        if (a) lastA = { ...lastA, ...a };
        const t = s.lu ?? s.lc ?? s.last_updated ?? s.last_changed;
        return {
          lat:      lastA.latitude != null ? parseFloat(lastA.latitude) : null,
          lng:      lastA.longitude != null ? parseFloat(lastA.longitude) : null,
          accuracy: lastA.gps_accuracy ?? 0,
          speed:    lastA.speed != null ? parseFloat(lastA.speed) : null,
          heading:  lastA.heading != null ? parseFloat(lastA.heading) : null,
          time:     typeof t === 'number' ? new Date(t * 1000) : new Date(t),
          state:    s.s ?? s.state,
        };
      })
      .filter(p => p.lat != null && p.lng != null);
  }

  _streamHistory(entityId, startISO, endISO) {
    // `history/stream` is a subscription: the first event carries the initial
    // history, followed by live updates. We take that first event and
    // unsubscribe immediately.
    return new Promise((resolve, reject) => {
      let unsub = null;
      let done = false;
      const finish = (val) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (unsub) { try { unsub(); } catch (_) { /* ignore */ } }
        resolve(val);
      };
      const timer = setTimeout(() => finish([]), 15000);

      this._hass.connection.subscribeMessage(
        (msg) => { if (msg && msg.states) finish(msg.states[entityId] ?? []); },
        {
          type: 'history/stream',
          entity_ids: [entityId],
          start_time: startISO,
          end_time: endISO,
          minimal_response: false,
          no_attributes: false,
          significant_changes_only: false,
        }
      ).then((u) => {
        unsub = u;
        if (done) { try { u(); } catch (_) { /* ignore */ } }
      }).catch(reject);
    });
  }

  // ── Map rendering ─────────────────────────────────────────────────────────

  _resolveTheme() {
    const t = this._config.theme || 'system';
    if (t === 'light' || t === 'dark') return t;
    return this._hass?.themes?.darkMode ? 'dark' : 'light';
  }

  // Add the tile layer to the (reused) map, rebuilding it only when the theme
  // or carto_key actually changes so the tiles aren't needlessly reloaded on
  // every redraw.
  _ensureTileLayer(L) {
    const theme = this._resolveTheme();
    const cartoKey = this._config.carto_key || '';
    // Signature combines theme + key so a key change in the editor also forces
    // a tile-layer rebuild (the theme alone wouldn't differ).
    const signature = `${theme}|${cartoKey}`;
    if (this._tileLayer && this._tileTheme === signature) return;
    if (this._tileLayer) this._map.removeLayer(this._tileLayer);
    // keepBuffer holds more off-screen tiles so panning/zooming to a new day or
    // device reuses cached tiles instead of flashing the empty background while
    // fresh ones load (fade animations are off, so there's no cross-fade).
    // CARTO basemap key comes from the card config (`carto_key`). Without one,
    // the public CARTO endpoint is used without a key (subject to its limits).
    const cartoKeyParam = cartoKey ? `?key=${encodeURIComponent(cartoKey)}` : '';
    const attribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>';
    this._tileLayer = theme === 'dark'
      ? L.tileLayer(`https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${cartoKeyParam}`, {
          attribution,
          maxZoom: 19,
          keepBuffer: 6,
        })
      : L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${cartoKeyParam}`, {
          attribution,
          maxZoom: 19,
          keepBuffer: 6,
        });
    this._tileLayer.addTo(this._map);
    this._tileTheme = signature;
  }

  _drawTrack(L, points) {
    // Reuse the map across loads. Tearing it down and rebuilding it on every
    // date/device change blanks the container and reloads every tile, which
    // shows as a flicker. Instead the map is created once; on later loads we
    // only swap the track layers (polyline, markers, arrows), keeping the map
    // and its (already cached) tiles in place.
    if (!this._map) {
      const mapEl = this.shadowRoot.getElementById('map');
      // Animations disabled: Leaflet's animation internals read `_leaflet_pos`
      // from map pane elements, which are not accessible across Shadow DOM
      // boundaries, causing a TypeError during fitBounds/pan animations.
      this._map = L.map(mapEl, {
        zoomControl: true,
        fadeAnimation: false,
        zoomAnimation: false,
        markerZoomAnimation: false,
        wheelPxPerZoomLevel: 250,
      });
      this._trackLayer = L.layerGroup().addTo(this._map);
      this._addRecenterControl(L);
      this._map.on('zoomend', () => this._onZoomEnd());
    }
    this._ensureTileLayer(L);
    this._trackLayer.clearLayers();
    // Stop markers are re-created each draw, so drop the previous load's popup
    // rebuilders before registering the new ones.
    this._geoMarkers = new Map();

    const displayed = this._clusterPoints(points, this._radiusMeters(), this._config.min_points);
    this._numberStops(displayed);
    const latlngs   = displayed.map(p => [p.lat, p.lng]);
    // Stops (clusters) are anchors the smoothed line must pass through, so it
    // never cuts the corner of an isolated stop and leaves its marker uncrossed.
    const anchors   = displayed.reduce((a, p, i) => (p.count > 1 && a.push(i), a), []);

    this._trackData = { displayed, latlngs, anchors };

    // 绘制路径（根据当前缩放级别动态抽稀）
    this._redrawTrackPath(L);

    // Start/end markers. If both fall within the cluster radius (e.g. a day
    // that starts and ends at home) they'd overlap, so a single combined
    // half-green/half-red marker is drawn at their midpoint instead.
    const startP = displayed[0];
    const endP   = displayed[displayed.length - 1];
    const sameZone = displayed.length > 1
      && this._haversine(startP, endP) * 1000 <= this._radiusMeters();

    // Intermediate stop markers, numbered. The first/last stops get the
    // green/end pins below; in-transit points are represented by the line only.
    displayed.forEach(p => {
      if (p.stopRole === 'mid') {
        const m = this._clusterMarker(L, p);
        m.addTo(this._trackLayer);
        this._registerGeoMarker(p, m, loc => this._popupHtml(p, `${this._t('stop_n')} ${p.stopNo}`, '', loc));
      }
    });

    if (sameZone) {
      const m = this._startEndMarker(L, startP, endP);
      m.addTo(this._trackLayer);
      this._registerGeoMarker(startP, m, loc => this._startEndPopup(startP, endP, loc));
    } else {
      const ms = this._pinMarker(L, startP, '#2E7D32', this._t('start'), 'start');
      ms.addTo(this._trackLayer);
      this._registerGeoMarker(startP, ms, loc => this._popupHtml(startP, this._t('start'), 'start', loc));
      if (displayed.length > 1) {
        const me = this._pinMarker(L, endP, '#C62828', this._t('end'), 'end');
        me.addTo(this._trackLayer);
        this._registerGeoMarker(endP, me, loc => this._popupHtml(endP, this._t('end'), 'end', loc));
      }
    }

    this._bounds = L.latLngBounds(latlngs);
    this._map.fitBounds(this._bounds, { padding: [32, 32], animate: false });
    return displayed;
  }

  _getSimplifyToleranceForZoom() {
    const zoom = this._map?.getZoom() ?? 10;
    const baseTolerance = 156543.03392 * Math.cos(0) / Math.pow(2, zoom);
    const pixelTolerance = 0.5;
    return Math.max(2, baseTolerance * pixelTolerance);
  }

  _redrawTrackPath(L) {
    if (!this._trackData) return;
    const { displayed, latlngs, anchors } = this._trackData;

    const simplifyTolerance = this._getSimplifyToleranceForZoom();
    const pointCount = latlngs.length;
    const MIN_POINTS = 200;
    const actualTolerance = pointCount <= MIN_POINTS ? 0 : simplifyTolerance;

    let smoothIterations = 3;
    if (pointCount > 2000) smoothIterations = 1;
    else if (pointCount > 1000) smoothIterations = 2;

    const simplifiedLatlngs = actualTolerance > 0
      ? this._simplifyLatlngs(latlngs, actualTolerance, anchors)
      : latlngs;
    const simplifiedAnchors = actualTolerance > 0
      ? this._remapAnchors(latlngs, simplifiedLatlngs, anchors)
      : anchors;

    const startP = displayed[0];
    const endP   = displayed[displayed.length - 1];
    const sameZone = displayed.length > 1
      && this._haversine(startP, endP) * 1000 <= this._radiusMeters();

    const smoothed = this._smoothPath(simplifiedLatlngs, simplifiedAnchors, smoothIterations);
    if (sameZone) {
      const mid = [(startP.lat + endP.lat) / 2, (startP.lng + endP.lng) / 2];
      smoothed[0] = mid;
      smoothed[smoothed.length - 1] = mid;
    }

    this._lastSmoothedPath = smoothed;

    if (this._pathLayer) {
      this._trackLayer.removeLayer(this._pathLayer);
    }
    this._pathLayer = L.layerGroup();
    this._drawColoredTrackOnLayer(L, smoothed, displayed, this._pathLayer);
    this._pathLayer.addTo(this._trackLayer);

    if (this._config.show_arrows !== false) {
      if (this._arrowLayer) {
        this._trackLayer.removeLayer(this._arrowLayer);
      }
      this._arrowLayer = L.layerGroup();
      this._drawArrowsOnLayer(L, smoothed, this._arrowLayer);
      this._arrowLayer.addTo(this._trackLayer);
    }
  }

  _onZoomEnd() {
    // 动画播放时不允许重绘轨迹，否则会破坏动画图层和原有轨迹的叠加逻辑
    if (this._animationRunning || !this._trackData || !window.L) return;
    if (this._zoomRedrawTimer) {
      clearTimeout(this._zoomRedrawTimer);
    }
    this._zoomRedrawTimer = setTimeout(() => {
      this._zoomRedrawTimer = null;
      this._redrawTrackPath(window.L);
    }, 150);
  }

  _drawColoredTrackOnLayer(L, smoothed, displayed, layer) {
    if (smoothed.length < 2) return;

    const segments = [];
    let currentSeg = { color: null, points: [smoothed[0]] };

    for (let i = 0; i < smoothed.length - 1; i++) {
      const segmentSpeed = this._estimateSpeedForSegment(i, smoothed.length, displayed);
      const color = this._speedToColor(segmentSpeed);
      if (currentSeg.color === null) {
        currentSeg.color = color;
        currentSeg.points.push(smoothed[i + 1]);
      } else if (currentSeg.color === color) {
        currentSeg.points.push(smoothed[i + 1]);
      } else {
        segments.push(currentSeg);
        currentSeg = { color, points: [smoothed[i], smoothed[i + 1]] };
      }
    }
    if (currentSeg.points.length > 1) segments.push(currentSeg);

    const polylines = [];
    for (const seg of segments) {
      const polyline = L.polyline(seg.points, {
        color: seg.color, weight: 4, opacity: 0.9,
        lineJoin: 'round', lineCap: 'round',
        className: 'track-segment',
      }).addTo(layer);
      polylines.push(polyline);
    }

    const self = this;
    layer.eachLayer(lyr => {
      lyr.on('click', function(e) {
        const nearestPoint = self._findNearestPoint(e.latlng, displayed);
        if (nearestPoint) {
          const popupContent = self._trackPointPopupHtml(nearestPoint);
          L.popup({ maxWidth: 300 })
            .setLatLng(e.latlng)
            .setContent(popupContent)
            .openOn(self._map);
        }
      });
      lyr.on('mouseover', function() {
        polylines.forEach(p => p.setStyle({ weight: 6, opacity: 1.0 }));
        if (self._map?._container) self._map._container.style.cursor = 'pointer';
      });
      lyr.on('mouseout', function() {
        polylines.forEach(p => p.setStyle({ weight: 4, opacity: 0.9 }));
        if (self._map?._container) self._map._container.style.cursor = '';
      });
    });
  }

  _drawArrowsOnLayer(L, latlngs, layer) {
    if (latlngs.length < 2) return;

    const segLen = [];
    let total = 0;
    for (let i = 1; i < latlngs.length; i++) {
      const d = this._haversine(
        { lat: latlngs[i - 1][0], lng: latlngs[i - 1][1] },
        { lat: latlngs[i][0],     lng: latlngs[i][1] });
      segLen.push(d);
      total += d;
    }
    if (total === 0) return;

    const count    = Math.max(1, this._config.arrow_count ?? LIMITS.arrow_count.def);
    const stepDist = total / count;
    let nextAt = stepDist;
    let acc    = 0;

    for (let i = 1; i < latlngs.length; i++) {
      const segStart = acc;
      acc += segLen[i - 1];
      const [lat1, lng1] = latlngs[i - 1];
      const [lat2, lng2] = latlngs[i];
      const angle = this._bearing(lat1, lng1, lat2, lng2);
      while (nextAt <= acc && nextAt < total) {
        const t   = segLen[i - 1] > 0 ? (nextAt - segStart) / segLen[i - 1] : 0;
        const pos = [lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t];
        nextAt += stepDist;
        L.marker(pos, {
          icon: L.divIcon({
            html: `<div style="transform:rotate(${angle}deg);font-size:22px;line-height:1;
                     color:#1565C0;text-shadow:0 0 4px #fff,0 0 4px #fff;">▲</div>`,
            className: '',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          interactive: false,
          zIndexOffset: -1000,
        }).addTo(layer);
      }
    }
  }

  _speedToColor(speedMph) {
    if (speedMph == null || speedMph <= 0) return '#9E9E9E';
    const minSpeed = 0;
    const maxSpeed = 80;
    const normalizedSpeed = Math.min(speedMph / maxSpeed, 1);
    const r = Math.round(255 * (1 - normalizedSpeed));
    const g = Math.round(255 * normalizedSpeed);
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  }

  _findNearestPoint(latlng, points) {
    let nearest = null;
    let minDist = Infinity;
    for (const p of points) {
      const dist = this._haversine(latlng, { lat: p.lat, lng: p.lng });
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }
    return nearest;
  }

  _trackPointPopupHtml(point) {
    const timeStr = point.time ? this._fmtTime(point.time) : 'N/A';
    const speedKmh = point.speed != null ? (point.speed * 1.609344).toFixed(1) : 'N/A';
    const headingVal = point.heading != null ? point.heading : null;
    const headingStr = headingVal != null ? `${headingVal.toFixed(0)}°` : 'N/A';
    const arrowHtml = headingVal != null 
      ? `<span style="display:inline-block;margin-left:8px;font-size:16px;transform:rotate(${headingVal}deg);">↑</span>` 
      : '';
    const latStr = point.lat.toFixed(6);
    const lngStr = point.lng.toFixed(6);
    
    return `
      <div style="padding: 8px;">
        <div style="margin-bottom: 4px;"><strong>${this._t('time')}:</strong> ${timeStr}</div>
        <div style="margin-bottom: 4px;"><strong>${this._t('speed')}:</strong> ${speedKmh} km/h</div>
        <div style="margin-bottom: 4px;"><strong>${this._t('heading')}:</strong> ${headingStr}${arrowHtml}</div>
        <div><strong>${this._t('coordinates')}:</strong> ${latStr}, ${lngStr}</div>
      </div>
    `;
  }

  _estimateSpeedForSegment(segmentIndex, totalSegments, displayed) {
    const displayedIndex = Math.floor((segmentIndex / (totalSegments - 1)) * (displayed.length - 1));
    const nextIndex = Math.min(displayedIndex + 1, displayed.length - 1);
    const p1 = displayed[displayedIndex];
    const p2 = displayed[nextIndex];
    if (p1.speed != null && p1.speed > 0) {
      if (p2.speed != null && p2.speed > 0) {
        return (p1.speed + p2.speed) / 2;
      }
      return p1.speed;
    }
    if (p2.speed != null && p2.speed > 0) {
      return p2.speed;
    }
    const avgSpeed = displayed.filter(p => p.speed != null && p.speed > 0)
      .reduce((sum, p) => sum + p.speed, 0) / displayed.filter(p => p.speed != null && p.speed > 0).length || null;
    return avgSpeed;
  }

  _addRecenterControl(L) {
    const self = this;
    const Control = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const btn = L.DomUtil.create('a', '', container);
        btn.href = '#';
        btn.title = self._t('recenter');
        btn.setAttribute('role', 'button');
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" style="display:block">
            <path fill="currentColor" d="M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 3A9 9 0 0013 3.06V1h-2v2.06A9 9 0 003.06 11H1v2h2.06A9 9 0 0011 20.94V23h2v-2.06A9 9 0 0020.94 13H23v-2zM12 19a7 7 0 110-14 7 7 0 010 14z"/>
          </svg>`;
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          L.DomEvent.stopPropagation(e);
          if (self._bounds) self._map.fitBounds(self._bounds, { padding: [32, 32], animate: false });
        });
        return container;
      },
    });
    this._map.addControl(new Control());
  }

  _pinMarker(L, point, color, label, role = '') {
    const icon = L.divIcon({
      html: `<div style="
        width:26px;height:26px;border-radius:50%;
        background:${color};
        border:2px solid rgba(255,255,255,.9);
        box-shadow:0 2px 6px rgba(0,0,0,.35);
      "></div>`,
      className: '',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -16],
    });
    return L.marker([point.lat, point.lng], { icon })
      .bindPopup(this._popupHtml(point, label, role));
  }

  _startEndMarker(L, startP, endP) {
    const icon = L.divIcon({
      html: `<div style="
        width:26px;height:26px;border-radius:50%;
        background:linear-gradient(90deg,#2E7D32 0 50%,#C62828 50% 100%);
        border:2px solid rgba(255,255,255,.9);
        box-shadow:0 2px 6px rgba(0,0,0,.35);
      "></div>`,
      className: '',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -16],
    });
    // Place it at the midpoint so it sits between the two coincident points.
    const mid = [(startP.lat + endP.lat) / 2, (startP.lng + endP.lng) / 2];
    return L.marker(mid, { icon }).bindPopup(this._startEndPopup(startP, endP));
  }

  // Popup for the combined start/end marker. `loc` overrides the location line
  // (used when a reverse-geocoded address arrives); undefined falls back to the
  // HA zone. Start and end coincide here, so the location is shown once, first.
  _startEndPopup(startP, endP, loc) {
    const fmt = t => this._fmtTime(t);
    const where = loc !== undefined ? loc : this._zoneName(startP);
    return `
      <div style="min-width:120px">
        ${where ? `<strong>(${where})</strong><br>` : ''}
        <strong>${this._t('start')}</strong> 🕐 ${fmt(startP.timeTo ?? startP.time)}<br>
        <strong>${this._t('end')}</strong> 🕐 ${fmt(endP.time)}
      </div>`;
  }

  _popupHtml(point, label = '', role = '', loc) {
    const fmt = t => this._fmtTime(t);
    // Location (if any) is appended in parentheses right after the label. `loc`
    // overrides it with a reverse-geocoded address; undefined falls back to the
    // HA zone.
    const where = loc !== undefined ? loc : this._zoneName(point);
    const labelText = label && where ? `${label} (${where})` : label;
    // Start stop → departure time (last point); end stop → arrival time
    // (first point); other stops → the full arrival–departure range.
    const timeHtml = role === 'start'
      ? `🕐 ${fmt(point.timeTo ?? point.time)}`
      : role === 'end'
      ? `🕐 ${fmt(point.time)}`
      : point.count > 1
      ? `🕐 ${fmt(point.time)} – ${fmt(point.timeTo)} (${this._fmtDuration(point.timeTo - point.time)})`
      : `🕐 ${fmt(point.time)}`;
    return `
      <div style="min-width:120px">
        ${labelText ? `<strong>${labelText}</strong><br>` : ''}
        ${timeHtml}
      </div>`;
  }

  _numberStops(displayed) {
    const clusters = displayed.filter(p => p.count > 1);
    let midCount = 0;
    clusters.forEach((p, k) => {
      const idx = displayed.indexOf(p);
      const isLastAtEnd = k === clusters.length - 1 && idx === displayed.length - 1;
      
      if (k === 0) {
        p.stopRole = 'start';
        p.stopNo = null;
      } else if (isLastAtEnd) {
        p.stopRole = 'end';
        p.stopNo = null;
      } else {
        midCount++;
        p.stopRole = 'mid';
        p.stopNo = midCount;
      }
    });
  }

  _clusterMarker(L, point) {
    const icon = L.divIcon({
      html: `<div style="
        background:#F57C00;color:#fff;
        width:28px;height:28px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;
        border:2px solid rgba(255,255,255,.9);
        box-shadow:0 2px 6px rgba(0,0,0,.3);
      ">${point.stopNo}</div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16],
    });
    return L.marker([point.lat, point.lng], { icon })
      .bindPopup(this._popupHtml(point, `${this._t('stop_n')} ${point.stopNo}`));
  }

  _clusterPoints(points, radiusMeters, minPoints = 3) {
    if (!radiusMeters || points.length === 0) return points.map(p => ({ ...p, count: 1 }));
    
    const STAY_THRESHOLD_MS = 5 * 60 * 1000;

    const groups = [];
    let group = [points[0]];
    let groupCentroid = { lat: points[0].lat, lng: points[0].lng };

    for (let i = 1; i < points.length; i++) {
      const dist = this._haversine(groupCentroid, points[i]) * 1000;

      if (dist <= radiusMeters) {
        group.push(points[i]);
        groupCentroid = {
          lat: group.reduce((s, p) => s + p.lat, 0) / group.length,
          lng: group.reduce((s, p) => s + p.lng, 0) / group.length,
        };
      } else {
        groups.push(group);
        group = [points[i]];
        groupCentroid = { lat: points[i].lat, lng: points[i].lng };
      }
    }
    groups.push(group);

    const result = [];
    for (const g of groups) {
      const duration = g[g.length - 1].time.getTime() - g[0].time.getTime();
      
      if (duration >= STAY_THRESHOLD_MS) {
        const speeds = g.filter(p => p.speed != null && p.speed > 0);
        const avgSpeed = speeds.length > 0 ? speeds.reduce((s, p) => s + p.speed, 0) / speeds.length : null;
        result.push({
          lat: g.reduce((s, p) => s + p.lat, 0) / g.length,
          lng: g.reduce((s, p) => s + p.lng, 0) / g.length,
          time:   g[0].time,
          timeTo: g[g.length - 1].time,
          count:  g.length,
          accuracy: 0,
          state:  g[0].state,
          speed:  avgSpeed,
        });
      } else {
        for (const p of g) result.push({ ...p, count: 1 });
      }
    }
    return result;
  }

  _destroyMap() {
    // 停止动画
    this._stopAnimation();

    if (this._zoomRedrawTimer) {
      clearTimeout(this._zoomRedrawTimer);
      this._zoomRedrawTimer = null;
    }

    if (this._map) {
      try { this._map.stop(); this._map.remove(); } catch (_) { /* ignore Shadow DOM cleanup errors */ }
      this._map = null;
    }
    this._trackLayer = null;
    this._pathLayer = null;
    this._arrowLayer = null;
    this._tileLayer = null;
    this._tileTheme = null;
    this._geoQueue = [];
    this._geoResolved = new Map();
    this._geoMarkers = new Map();
    this._trackData = null;
    this._lastSmoothedPath = null;
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  _setNoData(show) {
    const el = this.shadowRoot.getElementById('no-data');
    el.classList.toggle('hidden', !show);
  }

  _setLoading(show) {
    const el = this.shadowRoot.getElementById('loading-overlay');
    if (!el) return;
    el.classList.toggle('hidden', !show);
  }

  _setAlert(msg, type = 'info') {
    const el = this.shadowRoot.getElementById('alert');
    if (!msg) { el.className = 'alert hidden'; return; }
    el.textContent = msg;
    el.className = `alert ${type}`;
  }

  _setSummary(points) {
    const el = this.shadowRoot.getElementById('summary');
    if (!points) { el.className = 'summary hidden'; return; }

    el.innerHTML = '';
    el.className = 'summary';
  }

  _startAnimation(points) {
    if (!this._map || !points || points.length < 2) return;

    const L = window.L;
    const btn = this.shadowRoot.getElementById('play-animation-btn');
    if (btn) {
      btn.classList.add('playing');
      btn.classList.remove('paused');
      btn.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
      btn.querySelector('span').textContent = this._t('pause_animation');
    }

    this._animationRunning = true;
    this._animationPaused = false;
    this._animationPoints = points;

    // 清理可能存在的旧动画图层，防止残留
    if (this._animationLayer) {
      this._animationLayer.remove();
      this._animationLayer = null;
    }
    this._animationSegments = [];
    this._animationStopMarkers = [];
    this._tempSegment = null;

    // 清理可能残留的原有轨迹层（上次动画未正确停止的情况）
    if (this._savedTrackLayers && this._trackLayer) {
      this._savedTrackLayers.forEach(layer => {
        if (this._trackLayer.hasLayer(layer)) {
          this._trackLayer.removeLayer(layer);
        }
      });
      this._savedTrackLayers = null;
    }

    // 保存原有轨迹层并隐藏
    if (this._trackLayer) {
      this._savedTrackLayers = [];
      this._trackLayer.eachLayer(layer => {
        this._savedTrackLayers.push(layer);
        this._trackLayer.removeLayer(layer);
      });
    }

    // 创建动画图层（添加到地图上，不是trackLayer）
    this._animationLayer = L.layerGroup().addTo(this._map);

    // 创建信息面板
    this._createAnimationInfoPanel();

    // 创建移动标记
    const markerIcon = L.divIcon({
      html: `<div style="
        width: 18px; height: 18px; border-radius: 50%;
        background: #1565C0;
        border: 3px solid #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,.5);
      "></div>`,
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    // 如果是暂停后继续，使用当前位置
    let startLat = points[0].lat;
    let startLng = points[0].lng;
    if (this._animationMarker) {
      const pos = this._animationMarker.getLatLng();
      startLat = pos.lat;
      startLng = pos.lng;
    }

    if (!this._animationMarker) {
      this._animationMarker = L.marker([startLat, startLng], {
        icon: markerIcon,
        zIndexOffset: 1000,
      }).addTo(this._animationLayer);
    }

    // 存储已绘制的轨迹段和停留点标记
    if (!this._animationSegments) {
      this._animationSegments = [];
    }
    if (!this._animationStopMarkers) {
      this._animationStopMarkers = [];
    }

    // 添加起点标记（只在第一次启动时添加）
    if (!this._animationStarted) {
      const startMarker = this._createAnimationPinMarker(L, points[0], '#2E7D32', this._t('start'));
      if (startMarker) {
        startMarker.addTo(this._animationLayer);
        this._animationStopMarkers.push(startMarker);
      }
      this._animationStarted = true;
    }

    // 地图放大到当前位置
    this._map.flyTo([startLat, startLng], 16, {
      animate: true,
      duration: 0.3,
    });

    // 动画参数
    const totalDuration = 30000; // 总时长30秒
    const frameInterval = 50; // 每50ms更新一帧
    const totalFrames = totalDuration / frameInterval;
    
    // 如果是继续，使用之前保存的帧位置
    let currentFrame = this._animationCurrentFrame || 0;

    const self = this;

    this._animationTimer = setInterval(() => {
      if (!self._animationRunning || self._animationPaused) {
        return;
      }

      currentFrame++;
      self._animationCurrentFrame = currentFrame;
      const progress = currentFrame / totalFrames;

      if (progress >= 1) {
        const lastPoint = points[points.length - 1];
        const endMarker = self._createAnimationPinMarker(L, lastPoint, '#C62828', self._t('end'));
        if (endMarker) {
          endMarker.addTo(self._animationLayer);
        }
        clearInterval(self._animationTimer);
        setTimeout(() => self._stopAnimation(), 1000);
        return;
      }

      // 计算当前应该在的位置
      const totalPoints = points.length;
      const floatIndex = progress * (totalPoints - 1);
      const currentIndex = Math.floor(floatIndex);
      const segmentProgress = floatIndex - currentIndex;

      const p1 = points[currentIndex];
      const p2 = points[Math.min(currentIndex + 1, totalPoints - 1)];

      // 插值计算当前位置
      const currentLat = p1.lat + (p2.lat - p1.lat) * segmentProgress;
      const currentLng = p1.lng + (p2.lng - p1.lng) * segmentProgress;

      // 计算当前朝向
      const heading = self._bearing(p1.lat, p1.lng, p2.lat, p2.lng);

      // 计算当前速度（km/h）
      const speedMph = p1.speed;
      const speedKmh = speedMph != null ? (speedMph * 1.609344).toFixed(1) : '0.0';

      // 计算已行驶里程
      let traveledDist = 0;
      for (let i = 1; i <= currentIndex; i++) {
        traveledDist += self._haversine(points[i - 1], points[i]);
      }
      if (segmentProgress > 0 && currentIndex < totalPoints - 1) {
        traveledDist += self._haversine(p1, { lat: currentLat, lng: currentLng });
      }

      // 获取当前点的时间
      let timeStr = '--:--';
      if (p1.time) {
        const date = new Date(p1.time);
        if (!isNaN(date.getTime())) {
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          timeStr = `${hours}:${minutes}`;
        }
      }

      self._updateAnimationInfoPanel(timeStr, speedKmh, traveledDist, heading);

      self._animationMarker.setLatLng([currentLat, currentLng]);

      // 绘制轨迹段
      while (self._animationSegments.length < currentIndex) {
        const i = self._animationSegments.length;
        const segP1 = points[i];
        const segP2 = points[i + 1];
        const color = self._speedToColor(segP1.speed);

        const segment = L.polyline([[segP1.lat, segP1.lng], [segP2.lat, segP2.lng]], {
          color: color,
          weight: 4,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(self._animationLayer);

        self._animationSegments.push(segment);

        if (segP1.count > 1 && !segP1._markerAdded) {
          segP1._markerAdded = true;
          const stopMarker = self._createAnimationStopMarker(L, segP1);
          if (stopMarker) {
            stopMarker.addTo(self._animationLayer);
            self._animationStopMarkers.push(stopMarker);
          }
        }
      }

      const color = self._speedToColor(p1.speed);
      if (self._tempSegment) {
        self._animationLayer.removeLayer(self._tempSegment);
      }
      self._tempSegment = L.polyline([
        [p1.lat, p1.lng],
        [currentLat, currentLng]
      ], {
        color: color,
        weight: 4,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(self._animationLayer);

      self._map.panTo([currentLat, currentLng], {
        animate: false,
      });

    }, frameInterval);
  }

  _pauseAnimation() {
    this._animationPaused = !this._animationPaused;
    const btn = this.shadowRoot.getElementById('play-animation-btn');
    if (!btn) return;

    if (this._animationPaused) {
      // 暂停状态
      btn.classList.remove('playing');
      btn.classList.add('paused');
      btn.querySelector('svg').innerHTML = '<path d="M8 5v14l11-7z"/>';
      btn.querySelector('span').textContent = this._t('resume_animation');
    } else {
      // 继续状态
      btn.classList.remove('paused');
      btn.classList.add('playing');
      btn.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
      btn.querySelector('span').textContent = this._t('pause_animation');
    }
  }

  _createAnimationInfoPanel() {
    const mapWrap = this.shadowRoot.getElementById('map-wrap');
    if (!mapWrap) return;

    const infoPanel = document.createElement('div');
    infoPanel.className = 'animation-info';
    infoPanel.id = 'animation-info';
    infoPanel.innerHTML = `
      <div class="info-container">
        <div class="info-item">
          <span class="info-value" id="anim-time">--:--</span>
        </div>
      </div>
      <div class="info-container">
        <div class="info-item">
          <span class="info-value" id="anim-speed">0.0</span>
          <span class="info-unit">km/h</span>
        </div>
      </div>
      <div class="info-container">
        <div class="info-item">
          <span class="info-value" id="anim-distance">0.0</span>
          <span class="info-unit">km</span>
        </div>
      </div>
      <div class="info-container">
        <span class="heading-arrow" id="anim-heading">↑</span>
      </div>
    `;
    mapWrap.appendChild(infoPanel);
    this._animationInfoPanel = infoPanel;
  }

  _updateAnimationInfoPanel(timeStr, speedKmh, distanceKm, heading) {
    const timeEl = this.shadowRoot.getElementById('anim-time');
    const speedEl = this.shadowRoot.getElementById('anim-speed');
    const distanceEl = this.shadowRoot.getElementById('anim-distance');
    const headingEl = this.shadowRoot.getElementById('anim-heading');

    if (timeEl) {
      timeEl.textContent = timeStr;
    }
    if (speedEl) {
      speedEl.textContent = speedKmh;
    }
    if (distanceEl) {
      distanceEl.textContent = distanceKm.toFixed(1);
    }
    if (headingEl) {
      headingEl.style.transform = `rotate(${heading}deg)`;
    }
  }

  _removeAnimationInfoPanel() {
    if (this._animationInfoPanel) {
      this._animationInfoPanel.remove();
      this._animationInfoPanel = null;
    }
  }

  _createAnimationStopMarker(L, point) {
    if (point.stopRole === 'start' || point.stopRole === 'end') return null;

    const icon = L.divIcon({
      html: `<div style="
        background:#F57C00;color:#fff;
        width:24px;height:24px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:700;
        border:2px solid rgba(255,255,255,.9);
        box-shadow:0 2px 6px rgba(0,0,0,.3);
      ">${point.stopNo || ''}</div>`,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    return L.marker([point.lat, point.lng], { icon });
  }

  _createAnimationPinMarker(L, point, color, label) {
    const icon = L.divIcon({
      html: `<div style="
        width:22px;height:22px;border-radius:50%;
        background:${color};
        border:2px solid rgba(255,255,255,.9);
        box-shadow:0 2px 6px rgba(0,0,0,.35);
      "></div>`,
      className: '',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    return L.marker([point.lat, point.lng], { icon });
  }

  _stopAnimation() {
    this._animationRunning = false;
    this._animationPaused = false;
    this._animationCurrentFrame = 0;
    this._animationStarted = false;

    // 清理定时器
    if (this._animationTimer) {
      clearInterval(this._animationTimer);
      this._animationTimer = null;
    }

    // 移除信息面板
    this._removeAnimationInfoPanel();

    // 清理临时段
    if (this._tempSegment) {
      if (this._animationLayer) {
        this._animationLayer.removeLayer(this._tempSegment);
      }
      this._tempSegment = null;
    }

    // 清理动画图层
    if (this._animationLayer) {
      this._animationLayer.remove();
      this._animationLayer = null;
    }

    this._animationMarker = null;
    this._animationSegments = [];
    this._animationStopMarkers = [];

    // 恢复原有轨迹层
    if (this._savedTrackLayers && this._trackLayer) {
      this._savedTrackLayers.forEach(layer => {
        layer.addTo(this._trackLayer);
      });
      this._savedTrackLayers = null;
    }

    // 重置标记状态
    if (this._animationPoints) {
      this._animationPoints.forEach(p => { p._markerAdded = false; });
    }

    const btn = this.shadowRoot.getElementById('play-animation-btn');
    if (btn) {
      btn.classList.remove('playing');
      btn.querySelector('svg').innerHTML = '<path d="M8 5v14l11-7z"/>';
      btn.querySelector('span').textContent = this._t('play_animation');
    }

    // 恢复地图视图
    if (this._map && this._bounds) {
      this._map.fitBounds(this._bounds, { padding: [32, 32], animate: true });
    }
  }

  _setTimeline(displayed) {
    const el = this.shadowRoot.getElementById('timeline');
    if (!el) return;
    if (!displayed || !this._config.show_timeline) { el.className = 'timeline hidden'; return; }

    const items = this._buildTimeline(displayed);
    if (items.length === 0) { el.className = 'timeline hidden'; return; }

    // 计算统计数据
    const speeds = displayed.filter(p => p.speed != null && p.speed > 0);
    const avgSpeed = speeds.length > 0
      ? ((speeds.reduce((sum, p) => sum + p.speed, 0) / speeds.length) * 1.609344).toFixed(1)
      : 'N/A';
    const maxSpeed = speeds.length > 0
      ? (Math.max(...speeds.map(p => p.speed)) * 1.609344).toFixed(1)
      : 'N/A';
    const totalDist = displayed.reduce((sum, p, i) => {
      if (i === 0) return 0;
      return sum + this._haversine(displayed[i - 1], p);
    }, 0);

    const fmt = t => this._fmtTime(t);
    const rows = items.map(it => {
      if (it.type === 'stop') {
        const isStartEnd = it.role === 'start' || it.role === 'end';
        const title = it.role === 'start' ? this._t('start')
          : it.role === 'end' ? this._t('end')
          : `${this._t('stop_n')} ${it.n}`;
        const icon = it.role === 'start' ? '🟢'
          : it.role === 'end' ? '🔴'
          : it.n != null ? `<span class="tl-badge">${it.n}</span>` : '🔵';
        // Start → departure (last point); end → arrival (first point);
        // other stops → the full arrival–departure range + dwell duration.
        const value = it.role === 'start' ? fmt(it.timeTo)
          : it.role === 'end' ? fmt(it.time)
          : `${fmt(it.time)} – ${fmt(it.timeTo)}`;
        // The location label (zone, or a reverse-geocoded address filled in
        // later) lives in a span addressable by the stop's coordinate key, so
        // it can be updated in place without re-rendering the timeline. Start/end
        // show it inline after the word; mid stops on the subline next to the
        // dwell duration. Both share the `(…)` format so the async fill is uniform.
        const geoKey = this._geoKey(it);
        const locText = it.zone ? `(${it.zone})` : '';
        const titleHtml = isStartEnd
          ? `${title} <span class="tl-loc" data-geo="${geoKey}">${locText}</span>`
          : title;
        const sub = isStartEnd
          ? ''
          : `<div class="tl-subline"><span class="tl-zone" data-geo="${geoKey}">${locText}</span><span class="tl-sub">(${this._fmtDuration(it.timeTo - it.time)})</span></div>`;
        return `
          <div class="tl-item tl-stop" data-lat="${it.lat}" data-lng="${it.lng}" style="cursor: pointer;">
            <div class="tl-rail"><div class="tl-icon">${icon}</div></div>
            <div class="tl-main">
              <div class="tl-line">
                <span class="tl-title">${titleHtml}</span>
                <span class="tl-value">${value}</span>
              </div>
              ${sub}
            </div>
          </div>`;
      }
      return `
        <div class="tl-item">
          <div class="tl-rail"><div class="tl-icon">↓</div></div>
          <div class="tl-main">
            <div class="tl-line tl-move">
              <span class="tl-title">${this._t('moving')}</span>
              <span class="tl-value">~${this._fmtDist(it.dist)}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    el.innerHTML = `<div class="tl-header">
      <div class="tl-summary">
        <span class="tl-stat">${this._fmtDist(totalDist)}</span>
        <span class="tl-stat">${avgSpeed} km/h</span>
        <span class="tl-stat">${maxSpeed} km/h</span>
      </div>
      <button type="button" class="play-btn" id="play-animation-btn">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
        <span>${this._t('play_animation')}</span>
        <div class="longpress-progress"></div>
      </button>
    </div>${rows}`;
    el.className = 'timeline';
    
    // 播放按钮事件绑定
    const btn = el.querySelector('#play-animation-btn');
    
    el.querySelectorAll('.tl-stop').forEach(stopEl => {
      stopEl.addEventListener('click', () => {
        const lat = parseFloat(stopEl.dataset.lat);
        const lng = parseFloat(stopEl.dataset.lng);
        if (!isNaN(lat) && !isNaN(lng) && this._map) {
          this._map.flyTo([lat, lng], 16, {
            animate: true,
            duration: 0.5
          });
        }
      });
    });

    // 播放按钮事件绑定
    let longpressTimer = null;
    let longpressProgressTimer = null;
    let longpressStartTime = 0;
    const longpressDuration = 1500; // 长按1.5秒触发停止

    const handlePointerDown = () => {
      if (!this._animationRunning) {
        this._startAnimation(displayed);
        return;
      }

      longpressStartTime = Date.now();
      const progressBar = btn.querySelector('.longpress-progress');
      
      longpressTimer = setTimeout(() => {
        // 长按停止
        this._stopAnimation();
        resetLongpress();
      }, longpressDuration);

      longpressProgressTimer = setInterval(() => {
        const elapsed = Date.now() - longpressStartTime;
        const progress = Math.min(elapsed / longpressDuration, 1);
        if (progressBar) {
          progressBar.style.width = `${progress * 100}%`;
        }
        if (progress >= 1) {
          clearInterval(longpressProgressTimer);
        }
      }, 50);
    };

    const handlePointerUp = () => {
      if (longpressTimer) {
        const elapsed = Date.now() - longpressStartTime;
        if (elapsed < longpressDuration && this._animationRunning) {
          // 单击暂停
          this._pauseAnimation();
        }
        resetLongpress();
      }
    };

    const resetLongpress = () => {
      if (longpressTimer) {
        clearTimeout(longpressTimer);
        longpressTimer = null;
      }
      if (longpressProgressTimer) {
        clearInterval(longpressProgressTimer);
        longpressProgressTimer = null;
      }
      const progressBar = btn.querySelector('.longpress-progress');
      if (progressBar) {
        progressBar.style.width = '0%';
      }
    };

    btn.addEventListener('mousedown', handlePointerDown);
    btn.addEventListener('mouseup', handlePointerUp);
    btn.addEventListener('mouseleave', resetLongpress);
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handlePointerDown();
    });
    btn.addEventListener('touchend', handlePointerUp);
  }

  _buildTimeline(displayed) {
    const segDist = (from, to) => {
      let d = 0;
      for (let k = from; k < to; k++) d += this._haversine(displayed[k], displayed[k + 1]);
      return d; // km
    };
    const stops = [];
    displayed.forEach((p, i) => { if (p.count > 1) stops.push(i); });

    const items = [];
    if (stops.length === 0) {
      if (displayed.length > 1) {
        const first = displayed[0];
        const last = displayed[displayed.length - 1];
        items.push({ type: 'stop', n: 1, role: 'start', time: first.time, timeTo: first.time, zone: this._zoneName(first), lat: first.lat, lng: first.lng });
        items.push({ type: 'move', dist: segDist(0, displayed.length - 1) });
        items.push({ type: 'stop', n: 2, role: 'end', time: last.time, timeTo: last.time, zone: this._zoneName(last), lat: last.lat, lng: last.lng });
      }
      return items;
    }

    const lastPoint = displayed[displayed.length - 1];
    const firstPoint = displayed[0];
    const firstStop = displayed[stops[0]];

    const startPoint = firstPoint.count > 1 ? firstPoint : firstStop;
    items.push({ type: 'stop', n: startPoint.stopNo, role: 'start', time: startPoint.time, timeTo: startPoint.timeTo, zone: this._zoneName(startPoint), lat: startPoint.lat, lng: startPoint.lng });

    for (let s = 1; s < stops.length; s++) {
      const prevIdx = stops[s - 1];
      const currIdx = stops[s];
      items.push({ type: 'move', dist: segDist(prevIdx, currIdx) });
      const p = displayed[currIdx];
      if (p.stopRole === 'end') {
        items.push({ type: 'stop', n: p.stopNo, role: 'end', time: p.time, timeTo: p.timeTo, zone: this._zoneName(p), lat: p.lat, lng: p.lng });
      } else {
        items.push({ type: 'stop', n: p.stopNo, role: 'mid', time: p.time, timeTo: p.timeTo, zone: this._zoneName(p), lat: p.lat, lng: p.lng });
      }
    }

    const lastStop = stops[stops.length - 1];
    const lastStopPoint = displayed[lastStop];
    
    if (lastStop < displayed.length - 1) {
      items.push({ type: 'move', dist: segDist(lastStop, displayed.length - 1) });
      items.push({ type: 'stop', n: null, role: 'end', time: lastPoint.time, timeTo: lastPoint.time, zone: this._zoneName(lastPoint), lat: lastPoint.lat, lng: lastPoint.lng });
    }

    return items;
  }

  _fmtDist(km) {
    if (this._config.units === 'imperial') {
      const miles = km / 1.609344;
      // Below ~0.1 mi (≈528 ft) show feet, otherwise miles — mirrors the m/km split.
      return miles < 0.1 ? `${Math.round(km * 3280.84)} ft` : `${miles.toFixed(1)} mi`;
    }
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  }

  // Name of the Home Assistant zone (a zone.* entity) that contains a point, or
  // null if it falls outside every zone. When zones overlap, the smallest (most
  // specific) one wins — mirroring how HA assigns a device to a zone.
  _zoneName(point) {
    const states = this._hass?.states;
    if (!states) return null;
    let best = null;
    for (const id in states) {
      if (!id.startsWith('zone.')) continue;
      const a = states[id].attributes || {};
      if (a.latitude == null || a.longitude == null || !a.radius) continue;
      const dist = this._haversine(point, { lat: a.latitude, lng: a.longitude }) * 1000;
      if (dist <= a.radius && (!best || a.radius < best.radius)) {
        best = { name: a.friendly_name || id.slice(5), radius: a.radius };
      }
    }
    return best ? best.name : null;
  }

  // ── Reverse geocoding (opt-in) ──────────────────────────────────────────────

  // A stop's stable key: its coordinates rounded to ~11 m. Used both as the
  // localStorage cache key and to address the timeline span / marker for a stop,
  // so recurring places (home, gym) reuse the same cached address.
  _geoKey(p) {
    return `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  }

  // Cache key is scoped by the HA UI language, since the cached components are
  // localised by the `accept-language` sent to the geocoder — entries for one
  // language must not be reused when the user switches HA to another.
  _geoCacheKey(key) {
    return `${GEO_CACHE_PREFIX}${getLang(this._hass)}:${key}`;
  }

  _geoCacheGet(key) {
    try {
      const raw = localStorage.getItem(this._geoCacheKey(key));
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || !o.addr || (Date.now() - o.ts) > GEO_TTL_MS) return null;
      return o.addr;
    } catch (_) { return null; }
  }

  _geoCacheSet(key, addr) {
    try {
      localStorage.setItem(this._geoCacheKey(key), JSON.stringify({ addr, ts: Date.now() }));
    } catch (_) { /* storage disabled / full — degrade to no cache */ }
  }

  // Query the reverse-geocoding endpoint for a point and return the address
  // components we care about (not a finished string — the label depends on how
  // many of the day's stops share the same city, computed at relabel time).
async _reverseGeocode(lat, lng) {
  const providerKey = this._config.geocode_provider || 'amap';
  const provider = GEO_PROVIDERS[providerKey];
  if (!provider) return null;

  let useLat = lat;
  let useLng = lng;

  // ========== 修复1：修正高德GPS(WGS84)转GCJ02坐标分割顺序BUG ==========
  // 高德接口的 key 由卡片配置项 `amap_key` 提供（默认不内置任何 key）。
  const amapKey = this._config.amap_key || '';
  if (provider.convertUrl) {
    try {
      const convertUrl = `${provider.convertUrl}?coordsys=gps&output=json&locations=${lng},${lat}${amapKey ? `&key=${amapKey}` : ''}`;
      const convertRes = await fetch(convertUrl, { headers: { Accept: 'application/json' } });
      if (convertRes.ok) {
        const convertJson = await convertRes.json();
        if (convertJson.status === '1' && convertJson.locations) {
          // 高德返回 locations=经度,纬度 ，正确赋值
          const [convLng, convLat] = convertJson.locations.split(',').map(parseFloat);
          if (!isNaN(convLng) && !isNaN(convLat)) {
            useLng = convLng;
            useLat = convLat;
          }
        }
      }
    } catch (convertErr) {
      console.warn('[坐标转换失败]', convertErr);
      // 转换接口异常，继续使用原始坐标尝试逆编码，不直接中断
    }
  }

  const base = this._config.geocode_url || provider.url;
  const sep = base.includes('?') ? '&' : '?';

  if (providerKey === 'amap') {
    const url = `${base}${sep}location=${useLng},${useLat}&extensions=all&roadlevel=1&radius=300&output=json${amapKey ? `&key=${amapKey}` : ''}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const json = await res.json();
      if (json.status !== '1' || !json.regeocode) return null;
      const regeo = json.regeocode;
      const addr = regeo.addressComponent || {};

      // 字段默认空字符串，防止undefined报错
      const province = typeof addr.province === 'string' ? addr.province.trim() : '';
      let city = Array.isArray(addr.city) ? '' : (typeof addr.city === 'string' ? addr.city.trim() : '') || province;
      const district = typeof addr.district === 'string' ? addr.district.trim() : '';
      const township = typeof addr.township === 'string' ? addr.township.trim() : '';
      const streetNum = addr.streetNumber || {};
      const roadName = typeof streetNum.street === 'string' ? streetNum.street.trim() : '';
      const houseNo = typeof streetNum.number === 'string' ? streetNum.number.trim() : '';

      // AOI/POI/道路容错
      let aoiName = '';
      if (Array.isArray(regeo.aois) && regeo.aois.length > 0) {
        const aoi = regeo.aois[0];
        aoiName = aoi?.name && typeof aoi.name === 'string' ? aoi.name.trim() : '';
      }
      let buildingName = '';
      if (addr.building?.name) buildingName = Array.isArray(addr.building.name) ? '' : (typeof addr.building.name === 'string' ? addr.building.name.trim() : '');
      let poiName = '';
      if (Array.isArray(regeo.pois) && regeo.pois.length > 0) {
        const residentialPoi = regeo.pois.find(p => p.type && p.type.includes('住宅区'));
        const priorityTypes = ['住宿服务', '餐饮服务', '购物服务', '科教文化服务', '体育休闲服务', '医疗保健服务', '商务住宅'];
        let bestPoi = residentialPoi;
        if (!bestPoi) for (const t of priorityTypes) { bestPoi = regeo.pois.find(p => p.type?.includes(t)); if (bestPoi) break; }
        if (!bestPoi) bestPoi = regeo.pois[0];
        poiName = bestPoi?.name && typeof bestPoi.name === 'string' ? bestPoi.name.trim() : '';
      }
      let nearestRoadName = '';
      if (Array.isArray(regeo.roads) && regeo.roads.length > 0) {
        const road = regeo.roads[0];
        nearestRoadName = road?.name && typeof road.name === 'string' ? road.name.trim() : '';
      }

      const landmark = buildingName || aoiName;
      const roadParts = [];
      if (landmark) roadParts.push(landmark);
      else if (roadName) roadParts.push(roadName + (houseNo ? houseNo : ''));
      else if (poiName) roadParts.push(poiName);
      else if (nearestRoadName) roadParts.push(nearestRoadName);
      const fullRoad = roadParts.join(' ') || null;

      return {
        road: fullRoad,
        house_number: houseNo,
        neighbourhood: township,
        suburb: district,
        city: city,
        country: province,
        country_code: 'CN',
        smallest: township || roadName || district,
        state: province,
        county: district,
      };
    } catch (fetchErr) {
      console.error('[高德逆编码请求失败]', fetchErr);
      return null;
    }
  } else {
    // BigDataCloud 逻辑不变，仅增加捕获异常
    try {
      const lang = getLang(this._hass);
      const url = `${base}${sep}latitude=${useLat}&longitude=${useLng}&localityLanguage=${lang}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const json = await res.json();
      if (!json) return null;
      let smallestAdmin = '';
      if (json.localityInfo?.administrative?.length) smallestAdmin = json.localityInfo.administrative.at(-1).name || '';
      return {
        road: json.streetName || null,
        house_number: json.streetNumber || null,
        neighbourhood: json.locality || null,
        suburb: json.principalSubdivision || null,
        city: json.city || json.town || json.village || json.municipality || null,
        country: json.countryName || null,
        country_code: json.countryCode || null,
        smallest: smallestAdmin,
        state: json.principalSubdivision,
        county: json.locality,
      };
    } catch (e) {
      console.error('[BigDataCloud逆编码失败]', e);
      return null;
    }
  }
}

  // Compose a label from address components: street level (street + city) for
  // every stop, falling back to just the city when there's no street info, with
  // the ISO country code appended after a middle dot — e.g. "Main St, Madrid · ES"
  // (no parentheses, since the whole label is already shown wrapped in them).
  _composeAddress(addr) {
    if (!addr) return null;
    const city = typeof addr.city === 'string' ? addr.city.trim() : '';
    const neighbourhood = typeof addr.neighbourhood === 'string' ? addr.neighbourhood.trim() : '';
    const suburb = typeof addr.suburb === 'string' ? addr.suburb.trim() : '';
    const smallest = typeof addr.smallest === 'string' ? addr.smallest.trim() : '';
    const country = typeof addr.country === 'string' ? addr.country.trim() : '';
    const road = typeof addr.road === 'string' ? addr.road.trim() : '';
    const house_number = typeof addr.house_number === 'string' ? addr.house_number.trim() : '';

    const street = road
      ? (house_number ? `${road} ${house_number}` : road)
      : (neighbourhood || suburb);

    if (road) return road;
    if (street && city) return `${street}, ${city}`;
    if (street) return street;
    if (smallest && city) return `${smallest}, ${city}`;
    if (smallest) return smallest;
    if (city) return city;
    if (country) return country;
    return null;
  }

  // Record a stop's marker so its popup location line can be refreshed in place
  // when an address arrives. `rebuild(label)` returns the new popup HTML.
  _registerGeoMarker(point, marker, rebuild) {
    const key = this._geoKey(point);
    if (!this._geoMarkers.has(key)) this._geoMarkers.set(key, []);
    this._geoMarkers.get(key).push({ marker, rebuild });
  }

  // Kick off reverse geocoding for the stops that have no HA zone (zones win and
  // are instant). Cache hits apply immediately; misses go through the throttled
  // queue. `gen` ties every result to this load so stale ones are dropped.
  _enrichLocations(displayed, gen) {
    if (!this._config.reverse_geocode) return;
    const seen = new Set();
    for (const p of displayed) {
      if (p.count <= 1) continue; // 只解析停留点，跳过移动中的单点
      if (this._zoneName(p)) continue; // 跳过在HA zone内的点
      const key = this._geoKey(p);
      if (seen.has(key)) continue;
      seen.add(key);
      const cached = this._geoCacheGet(key);
      if (cached) this._geoResolved.set(key, cached);
      else this._geoQueue.push({ lat: p.lat, lng: p.lng, key, gen });
    }
    this._relabelLocations(gen); // paint cache hits right away
    this._drainGeoQueue();
  }

  // Process one queued geocode at a time, leaving GEO_MIN_GAP_MS between network
  // calls to respect Nominatim's ~1/sec policy. Stale jobs are dropped without
  // a network call.
  _drainGeoQueue() {
    if (this._geoBusy) return;
    let job = null;
    while (this._geoQueue.length) {
      const next = this._geoQueue.shift();
      if (next.gen === this._loadGen) { job = next; break; }
    }
    if (!job) return;
    this._geoBusy = true;
    this._reverseGeocode(job.lat, job.lng)
      .then(addr => {
        if (addr && job.gen === this._loadGen) {
          this._geoCacheSet(job.key, addr);
          this._geoResolved.set(job.key, addr);
          this._relabelLocations(job.gen);
        }
      })
      .catch((e) => { console.warn('[track-history-card] Reverse geocode exception:', e.message); })
      .finally(() => {
        setTimeout(() => { this._geoBusy = false; this._drainGeoQueue(); }, GEO_MIN_GAP_MS);
      });
  }

  // Write the labels for every stop resolved so far this load. Each label is
  // independent of the others, so this is idempotent — re-running it as more
  // stops resolve simply fills in the new ones.
  _relabelLocations(gen) {
    if (gen !== this._loadGen || !this.shadowRoot) return;
    for (const [key, addr] of this._geoResolved) {
      const label = this._composeAddress(addr);
      if (!label) continue;
      const text = `(${label})`;
      this.shadowRoot.querySelectorAll(`[data-geo="${key}"]`)
        .forEach(el => { el.textContent = text; });
      const markers = this._geoMarkers.get(key);
      if (markers) markers.forEach(m => m.marker.setPopupContent(m.rebuild(label)));
    }
  }

  // The cluster radius is entered in the configured units (m or ft) but the
  // clustering math works in metres, so convert feet → metres when imperial.
  _radiusMeters() {
    const r = this._config.cluster_radius ?? LIMITS.cluster_radius.def;
    return this._config.units === 'imperial' ? r * 0.3048 : r;
  }

  // Dwell time for a stop, given a span in milliseconds (Date subtraction)
  // → "1 h 15 min". "min" (not "m") avoids clashing with metres in distances;
  // both units read the same across the supported locales.
  _fmtDuration(ms) {
    const mins = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h} h ${m} min`;
    if (h) return `${h} h`;
    return `${m} min`;
  }

  // ── Leaflet CSS injection ─────────────────────────────────────────────────

  async _injectLeafletCss() {
    if (this._leafletCssInjected) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS_URL;
    this.shadowRoot.insertBefore(link, this.shadowRoot.firstChild);
    await new Promise(r => { link.onload = r; link.onerror = r; });
    this._leafletCssInjected = true;
  }

  // ── Geometry ──────────────────────────────────────────────────────────────

  _totalKm(points) {
    let d = 0;
    for (let i = 1; i < points.length; i++) d += this._haversine(points[i - 1], points[i]);
    return d; // km
  }

  _smoothPath(latlngs, anchors = [], iterations = 3) {
    if (latlngs.length < 3) return latlngs;

    // Split the path at anchor indices (stops) and smooth each segment
    // independently. Chaikin preserves a segment's endpoints, so the line
    // always passes exactly through every anchor instead of cutting its corner.
    const bounds = Array.from(new Set([0, ...anchors, latlngs.length - 1]))
      .sort((a, b) => a - b);

    const out = [];
    for (let b = 0; b < bounds.length - 1; b++) {
      const seg = this._chaikin(latlngs.slice(bounds[b], bounds[b + 1] + 1), iterations);
      out.push(...(b === 0 ? seg : seg.slice(1)));
    }
    return out;
  }

  _chaikin(latlngs, iterations) {
    if (latlngs.length < 3) return latlngs;

    // Drop near-duplicate consecutive points so real corners stand out,
    // otherwise dense GPS samples leave nothing visible to round. The
    // segment's first and last points (anchors) are always kept.
    let pts = [latlngs[0]];
    for (let i = 1; i < latlngs.length - 1; i++) {
      if (this._haversine({ lat: pts[pts.length - 1][0], lng: pts[pts.length - 1][1] },
                          { lat: latlngs[i][0], lng: latlngs[i][1] }) * 1000 > 15) {
        pts.push(latlngs[i]);
      }
    }
    pts.push(latlngs[latlngs.length - 1]);
    if (pts.length < 3) return pts;

    // Chaikin corner-cutting: each pass replaces every segment with points at
    // 25% and 75%, visibly rounding sharp corners. Endpoints are preserved.
    for (let it = 0; it < iterations; it++) {
      const next = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [a0, a1] = pts[i];
        const [b0, b1] = pts[i + 1];
        next.push([a0 * 0.75 + b0 * 0.25, a1 * 0.75 + b1 * 0.25]);
        next.push([a0 * 0.25 + b0 * 0.75, a1 * 0.25 + b1 * 0.75]);
      }
      next.push(pts[pts.length - 1]);
      pts = next;
    }
    return pts;
  }

  _bearing(lat1, lng1, lat2, lng2) {
    const r = Math.PI / 180;
    const φ1 = lat1 * r, φ2 = lat2 * r;
    const Δλ = (lng2 - lng1) * r;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return Math.atan2(y, x) / r;
  }

  _haversine(a, b) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLng = (b.lng - a.lng) * rad;
    const x = Math.sin(dLat / 2) ** 2
            + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  _simplifyPath(points, toleranceMeters) {
    if (points.length <= 2) return points;
    const tol = toleranceMeters / 1000;

    const perpDist = (p, a, b) => {
      const dx = b.lng - a.lng;
      const dy = b.lat - a.lat;
      if (dx === 0 && dy === 0) {
        return this._haversine(p, a);
      }
      const t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy);
      const proj = {
        lng: a.lng + t * dx,
        lat: a.lat + t * dy,
      };
      return this._haversine(p, proj);
    };

    const simplifyDP = (pts, first, last, tol) => {
      if (last <= first + 1) return;
      let maxDist = 0;
      let maxIdx = 0;
      for (let i = first + 1; i < last; i++) {
        if (pts[i]._isAnchor) continue;
        const d = perpDist(pts[i], pts[first], pts[last]);
        if (d > maxDist) {
          maxDist = d;
          maxIdx = i;
        }
      }
      if (maxDist > tol && maxIdx > 0) {
        pts[maxIdx]._keep = true;
        simplifyDP(pts, first, maxIdx, tol);
        simplifyDP(pts, maxIdx, last, tol);
      }
    };

    const pts = points.map(p => ({ ...p, _keep: p._isAnchor || false }));
    pts[0]._keep = true;
    pts[pts.length - 1]._keep = true;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i]._isAnchor) pts[i]._keep = true;
    }
    simplifyDP(pts, 0, pts.length - 1, tol);
    return pts.filter(p => p._keep).map(({ _keep, _isAnchor, ...rest }) => rest);
  }

  _simplifyLatlngs(latlngs, toleranceMeters, anchors) {
    if (latlngs.length <= 2) return latlngs;
    const sortedAnchors = [...anchors].sort((a, b) => a - b);
    const bounds = Array.from(new Set([0, ...sortedAnchors, latlngs.length - 1]))
      .sort((a, b) => a - b);

    const result = [];
    for (let b = 0; b < bounds.length - 1; b++) {
      const segStart = bounds[b];
      const segEnd = bounds[b + 1];
      const seg = latlngs.slice(segStart, segEnd + 1);
      if (seg.length <= 2) {
        result.push(...(b === 0 ? seg : seg.slice(1)));
        continue;
      }
      const points = seg.map(ll => ({ lat: ll[0], lng: ll[1] }));
      const simplified = this._simplifyPath(points, toleranceMeters);
      const segResult = simplified.map(p => [p.lat, p.lng]);
      result.push(...(b === 0 ? segResult : segResult.slice(1)));
    }
    return result;
  }

  _remapAnchors(origLatlngs, simpLatlngs, anchors) {
    const result = [];
    const anchorPoints = anchors.map(i => ({ lat: origLatlngs[i][0], lng: origLatlngs[i][1] }));
    for (const ap of anchorPoints) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let j = 0; j < simpLatlngs.length; j++) {
        const d = this._haversine(ap, { lat: simpLatlngs[j][0], lng: simpLatlngs[j][1] });
        if (d < bestDist) {
          bestDist = d;
          bestIdx = j;
        }
      }
      if (!result.includes(bestIdx)) result.push(bestIdx);
    }
    return result.sort((a, b) => a - b);
  }
}

// ── Visual config editor ──────────────────────────────────────────────────────

class LovelaceTrackHistoryCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._showTitle = false;
    this._advancedOpen = false;
  }

  setConfig(config) {
    this._config = { ...config };
    this._showTitle = 'title' in config;
    this._render();
  }

  set hass(hass) {
    const langChanged = getLang(this._hass) !== getLang(hass);
    this._hass = hass;
    if (langChanged && this._config) {
      this._render();
    } else {
      // Propagate hass to already-rendered entity pickers without full re-render
      this.shadowRoot.querySelectorAll('ha-entity-picker').forEach(p => { p.hass = hass; });
    }
  }

  _t(key) {
    return TRANSLATIONS[getLang(this._hass)][key];
  }

  _render() {
    const { entities = [], default_entity = '' } = this._config;
    const hasTitle      = this._showTitle;
    const titleValue    = this._config.title || '';
    const hasDefault    = !!this._config.default_entity;
    const defaultValue  = this._config.default_entity || '';
    const clusterRadius = this._config.cluster_radius ?? LIMITS.cluster_radius.def;
    const minPoints     = this._config.min_points ?? LIMITS.min_points.def;
    const themeValue    = this._config.theme || 'system';
    const showTimeline  = !!this._config.show_timeline;
    const showArrows    = this._config.show_arrows !== false;
    const arrowCount    = this._config.arrow_count ?? LIMITS.arrow_count.def;
    const unitsValue    = this._config.units || 'metric';
    const unitSuffix    = unitsValue === 'imperial' ? 'ft' : 'm';
    const reverseGeo    = !!this._config.reverse_geocode;
    const amapKey       = this._config.amap_key || '';
    const cartoKey      = this._config.carto_key || '';
    // "(min–max)" suffix appended to each numeric field's label/placeholder.
    const range = (k) => `(${LIMITS[k].min}–${LIMITS[k].max})`;

    this.shadowRoot.innerHTML = `
      <style>
        .editor { display: flex; flex-direction: column; gap: 20px; padding: 4px 0; }
        .section-label {
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--secondary-text-color, #888);
          margin-bottom: 6px;
        }
        .entity-row {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 8px;
        }
        .entity-row ha-entity-picker { flex: 1; }
        .add-btn {
          width: 100%;
          padding: 8px;
          background: none;
          border: 1px dashed var(--divider-color, #ccc);
          border-radius: 6px;
          color: var(--primary-color, #03a9f4);
          cursor: pointer;
          font-size: 13px;
        }
        .add-btn:hover { opacity: 0.8; }
        .check-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-size: 14px;
          color: var(--primary-text-color, #333);
          user-select: none;
        }
        .check-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--primary-color, #03a9f4);
          flex-shrink: 0;
        }
        .text-input {
          display: block;
          width: 100%;
          margin-top: 10px;
          padding: 8px 10px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 6px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #333);
          font-size: 14px;
          box-sizing: border-box;
          font-family: inherit;
        }
        .text-input:focus { outline: 2px solid var(--primary-color, #03a9f4); }
        .check-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .check-row .text-input,
        .check-row select {
          flex: 1;
          margin-top: 0;
        }
        .radio-group {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .radio-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          color: var(--primary-text-color, #333);
          user-select: none;
        }
        .radio-label input[type="radio"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--primary-color, #03a9f4);
          flex-shrink: 0;
        }
        .advanced {
          border-top: 1px solid var(--divider-color, #e0e0e0);
          padding-top: 16px;
        }
        .advanced > summary {
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: var(--primary-text-color, #333);
          user-select: none;
          list-style: revert;
        }
        .advanced[open] > summary { margin-bottom: 16px; }
        .advanced > div + div { margin-top: 16px; }
        select {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 6px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #333);
          font-size: 14px;
          height: 40px;
          box-sizing: border-box;
        }
      </style>
      <div class="editor">
        <div>
          <div class="section-label" style="margin-bottom:12px">${this._t('tracked_devs')}</div>
          <div id="entities-list"></div>
          <button class="add-btn" id="add-entity">${this._t('add_device')}</button>
        </div>

        <div class="check-row">
          <label class="check-label">
            <input type="checkbox" id="default-check" ${hasDefault ? 'checked' : ''}>
            <span>${this._t('default_dev')}</span>
          </label>
          ${hasDefault ? `
            <select id="f-default">
              ${entities.map(e => `
                <option value="${e}" ${e === defaultValue ? 'selected' : ''}>
                  ${this._hass?.states[e]?.attributes?.friendly_name
                    || e.replace('device_tracker.', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </option>`).join('')}
            </select>
          ` : ''}
        </div>

        <div class="check-row">
          <label class="check-label">
            <input type="checkbox" id="title-check" ${hasTitle ? 'checked' : ''}>
            <span>${this._t('title_lbl')}</span>
          </label>
          <input type="text" id="f-title" class="text-input"
            placeholder="${this._t('default_title')}" value="${titleValue}"
            style="display:${hasTitle ? 'block' : 'none'}">
        </div>

        <div class="check-row">
          <label class="check-label">
            <input type="checkbox" id="arrows-check" ${showArrows ? 'checked' : ''}>
            <span>${this._t('arrows_lbl')} ${range('arrow_count')}</span>
          </label>
          <input type="number" id="f-arrow-count" class="text-input"
            value="${arrowCount}" min="${LIMITS.arrow_count.min}" max="${LIMITS.arrow_count.max}"
            title="${this._t('arrow_count_lbl')} ${range('arrow_count')}"
            placeholder="${this._t('arrow_count_lbl')} ${range('arrow_count')}"
            style="display:${showArrows ? 'block' : 'none'}">
        </div>

        <div>
          <label class="check-label">
            <input type="checkbox" id="timeline-check" ${showTimeline ? 'checked' : ''}>
            <span>${this._t('timeline_lbl')}</span>
          </label>
        </div>

        <div>
          <div class="section-label">${this._t('theme_lbl')}</div>
          <div class="radio-group">
            ${['system', 'light', 'dark'].map(v => `
              <label class="radio-label">
                <input type="radio" name="theme-radio" value="${v}" ${themeValue === v ? 'checked' : ''}>
                <span>${this._t('theme_' + v)}</span>
              </label>`).join('')}
          </div>
        </div>

        <details class="advanced" id="advanced" ${this._advancedOpen ? 'open' : ''}>
          <summary>${this._t('advanced_lbl')}</summary>
          <div>
            <div class="section-label">${this._t('units_lbl')}</div>
            <div class="radio-group">
              ${['metric', 'imperial'].map(v => `
                <label class="radio-label">
                  <input type="radio" name="units-radio" value="${v}" ${unitsValue === v ? 'checked' : ''}>
                  <span>${this._t('units_' + v)}</span>
                </label>`).join('')}
            </div>
          </div>

          <div>
            <div class="section-label">${this._t('cluster_radius_lbl')} (${unitSuffix}) ${range('cluster_radius')}</div>
            <input type="number" id="f-cluster-radius" class="text-input" style="margin-top:0"
              value="${clusterRadius}" min="${LIMITS.cluster_radius.min}" max="${LIMITS.cluster_radius.max}">
          </div>

          <div>
            <div class="section-label">${this._t('min_points_lbl')} ${range('min_points')}</div>
            <input type="number" id="f-min-points" class="text-input" style="margin-top:0"
              value="${minPoints}" min="${LIMITS.min_points.min}" max="${LIMITS.min_points.max}">
          </div>

          <div>
            <label class="check-label">
              <input type="checkbox" id="geo-check" ${reverseGeo ? 'checked' : ''}>
              <span>${this._t('reverse_geocode_lbl')}</span>
            </label>
          </div>

          <div>
            <div class="section-label">${this._t('geocode_provider_lbl')}</div>
            <select id="geo-provider" class="text-input" style="margin-top:0">
              <option value="amap" ${(this._config.geocode_provider || 'amap') === 'amap' ? 'selected' : ''}>AMap (高德地图)</option>
              <option value="bigdatacloud" ${this._config.geocode_provider === 'bigdatacloud' ? 'selected' : ''}>BigDataCloud</option>
            </select>
          </div>

          <div>
            <div class="section-label">${this._t('amap_key_lbl')}</div>
            <input type="text" id="f-amap-key" class="text-input" style="margin-top:0"
              value="${amapKey}" placeholder="${this._t('amap_key_hint')}">
          </div>

          <div>
            <div class="section-label">${this._t('carto_key_lbl')}</div>
            <input type="text" id="f-carto-key" class="text-input" style="margin-top:0"
              value="${cartoKey}" placeholder="${this._t('carto_key_hint')}">
          </div>
        </details>
      </div>
    `;

    this._buildEntityPickers(entities);

    this.shadowRoot.getElementById('title-check')
      .addEventListener('change', e => {
        this._showTitle = e.target.checked;
        const field = this.shadowRoot.getElementById('f-title');
        field.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked) {
          field.value = field.value || this._t('default_title');
          this._set('title', field.value);
        } else {
          this._set('title', null);
        }
      });

    this.shadowRoot.getElementById('f-title')
      .addEventListener('change', e => this._set('title', e.target.value.trim()));

    this.shadowRoot.getElementById('add-entity')
      .addEventListener('click', () => this._set('entities', [...(this._config.entities || []), '']));

    this.shadowRoot.getElementById('default-check')
      .addEventListener('change', e => {
        this._set('default_entity', e.target.checked ? (entities[0] || '') : null);
      });

    if (hasDefault) {
      this.shadowRoot.getElementById('f-default')
        .addEventListener('change', e => this._set('default_entity', e.target.value || null));
    }

    this.shadowRoot.querySelectorAll('input[name="theme-radio"]')
      .forEach(r => r.addEventListener('change', e => {
        if (e.target.checked) this._set('theme', e.target.value);
      }));

    this.shadowRoot.querySelectorAll('input[name="units-radio"]')
      .forEach(r => r.addEventListener('change', e => {
        if (e.target.checked) this._set('units', e.target.value === 'imperial' ? 'imperial' : null);
      }));

    this.shadowRoot.getElementById('timeline-check')
      .addEventListener('change', e => this._set('show_timeline', e.target.checked ? true : null));

    this.shadowRoot.getElementById('arrows-check')
      .addEventListener('change', e => {
        // Arrows on is the default, so store only the "off" state.
        const count = this.shadowRoot.getElementById('f-arrow-count');
        if (count) count.style.display = e.target.checked ? 'block' : 'none';
        this._set('show_arrows', e.target.checked ? null : false);
      });

    this.shadowRoot.getElementById('f-arrow-count')
      .addEventListener('change', e => {
        const v = this._clampInt(e.target, LIMITS.arrow_count);
        // The default is implied, so drop the key when it matches to keep config clean.
        this._set('arrow_count', v !== LIMITS.arrow_count.def ? v : null);
      });

    this.shadowRoot.getElementById('f-cluster-radius')
      .addEventListener('change', e => {
        this._set('cluster_radius', this._clampInt(e.target, LIMITS.cluster_radius));
      });

    this.shadowRoot.getElementById('f-min-points')
      .addEventListener('change', e => {
        this._set('min_points', this._clampInt(e.target, LIMITS.min_points));
      });

    this.shadowRoot.getElementById('geo-check')
      .addEventListener('change', e => this._set('reverse_geocode', e.target.checked ? true : null));

    this.shadowRoot.getElementById('geo-provider')
      .addEventListener('change', e => {
        this._set('geocode_provider', e.target.value === 'amap' ? null : e.target.value);
      });

    this.shadowRoot.getElementById('f-amap-key')
      .addEventListener('change', e => this._set('amap_key', e.target.value.trim() || null));

    this.shadowRoot.getElementById('f-carto-key')
      .addEventListener('change', e => this._set('carto_key', e.target.value.trim() || null));

    // Remember the Advanced section's open state so editing a field (which
    // re-renders the editor) doesn't collapse it.
    this.shadowRoot.getElementById('advanced')
      .addEventListener('toggle', e => { this._advancedOpen = e.target.open; });
  }

  // Parse a number field, clamp it to a field's [min, max] (falling back to its
  // default when empty or non-numeric), and reflect the corrected value back
  // into the input so a hand-typed out-of-range value is visibly snapped in.
  _clampInt(el, { min, max, def }) {
    const v = parseInt(el.value, 10);
    const clamped = isNaN(v) ? def : Math.min(max, Math.max(min, v));
    el.value = clamped;
    return clamped;
  }

  _buildEntityPickers(entities) {
    const container = this.shadowRoot.getElementById('entities-list');
    entities.forEach((entity, idx) => {
      const row = document.createElement('div');
      row.className = 'entity-row';

      const picker = document.createElement('ha-entity-picker');
      picker.hass = this._hass;
      picker.value = entity;
      picker.setAttribute('label', `${this._t('device_n')} ${idx + 1}`);
      picker.setAttribute('include-domains', '["device_tracker"]');
      picker.setAttribute('allow-custom-entity', '');
      picker.addEventListener('value-changed', e => {
        const updated = [...(this._config.entities || [])];
        if (e.detail.value) {
          updated[idx] = e.detail.value;
        } else {
          updated.splice(idx, 1);
        }
        this._set('entities', updated);
      });

      const removeBtn = document.createElement('ha-icon-button');
      removeBtn.setAttribute('label', this._t('remove'));
      removeBtn.innerHTML = `<ha-icon icon="mdi:delete-outline"></ha-icon>`;
      removeBtn.addEventListener('click', () => {
        const updated = (this._config.entities || []).filter((_, i) => i !== idx);
        this._set('entities', updated);
      });

      row.appendChild(picker);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });
  }

  _set(key, value) {
    const config = { ...this._config };
    if (value === null || value === undefined) {
      delete config[key];
    } else {
      config[key] = value;
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    this._render();
  }
}

customElements.define('lovelace-track-history-card-editor', LovelaceTrackHistoryCardEditor);

// ── Registration ──────────────────────────────────────────────────────────────

customElements.define('lovelace-track-history-card', LovelaceTrackHistoryCard);

window.customCards ??= [];
window.customCards.push({
  type:        'lovelace-track-history-card',
  name:        'Track History Card',
  description: 'Shows device_tracker movement history on a map for a selected day.',
  preview:     false,
});
