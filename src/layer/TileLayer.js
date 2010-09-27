/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */

L.TileLayer = L.Class.extend({
	includes: L.Mixin.Events,
	
	options: {
		tileSize: 256,
		minZoom: 0,
		maxZoom: 18,
		subdomains: 'abc',
		copyright: '',
		unloadInvisibleTiles: L.Browser.mobileWebkit,
		updateWhenIdle: L.Browser.mobileWebkit,
		errorTileUrl: ''
	},
	
	initialize: function(url, options) {
		L.Util.extend(this.options, options);
		
		this._url = url;
		
		if (typeof this.options.subdomains == 'string') {
			this.options.subdomains = this.options.subdomains.split('');
		}
	},
	
	onAdd: function(map) {
		this._map = map;
		
		// create a container div for tiles
		this._container = document.createElement('div');
		this._container.className = 'leaflet-layer';
		map.getPanes().tilePane.appendChild(this._container);
		
		// create an image to clone for tiles
		this._tileImg = document.createElement('img');
		
		this._tileImg.className = 'leaflet-tile';
		this._tileImg.galleryimg = 'no';
		
		var tileSize = this.options.tileSize;
		this._tileImg.style.width = tileSize + 'px';
		this._tileImg.style.height = tileSize + 'px';
		
		// set up events
		map.on('viewreset', this._reset, this);
		
		if (this.options.updateWhenIdle) {
			map.on('moveend', this._update, this);
		} else {
			this._limitedUpdate = L.Util.limitExecByInterval(this._update, 100, this);
			map.on('move', this._limitedUpdate, this);
		}
		
		this._reset();
		this._update();
	},
	
	onRemove: function(map) {
		this._map.getPanes().tilePane.removeChild(this._container);
		
		this._map.off('viewreset', this._reset);
		
		if (this.options.updateWhenIdle) {
			this._map.off('moveend', this._update);
		} else {
			this._map.off('move', this._limitedUpdate);
		}
	},
	
	_reset: function() {
		this._tiles = {};
		this._container.innerHTML = '';
	},
	
	_update: function() {
		var bounds = this._map.getPixelBounds(),
			tileSize = this.options.tileSize;
		
		var nwTilePoint = new L.Point(
				Math.floor(bounds.min.x / tileSize),
				Math.floor(bounds.min.y / tileSize)),
			seTilePoint = new L.Point(
				Math.floor(bounds.max.x / tileSize),
				Math.floor(bounds.max.y / tileSize));
		
		this._loadTiles(nwTilePoint, seTilePoint);
		
		if (this.options.unloadInvisibleTiles) {
			this._unloadOtherTiles(nwTilePoint, seTilePoint);
		}
		//TODO fire layerload?
	},
	
	getTileUrl: function(tilePoint, zoom) {
		var url = this._url;
		
		var subdomains = this.options.subdomains,
			s = this.options.subdomains[(tilePoint.x + tilePoint.y) % subdomains.length];

		return this._url
				.replace('{s}', s)
				.replace('{z}', zoom)
				.replace('{x}', tilePoint.x)
				.replace('{y}', tilePoint.y);
	},
	
	_loadTiles: function(nwTilePoint, seTilePoint) {
		//TODO load from center
		for (var j = nwTilePoint.y; j <= seTilePoint.y; j++) {
			for (var i = nwTilePoint.x; i <= seTilePoint.x; i++) {				
				if ((i+':'+j) in this._tiles) { continue; }
				this._loadTile(new L.Point(i, j));
			}
		}
	},
	
	_unloadOtherTiles: function(nwTilePoint, seTilePoint) {
		var k, x, y, key;
		for (key in this._tiles) {
			kArr = key.split(':'),
			x = parseInt(kArr[0]),
			y = parseInt(kArr[1]);
			
			if (x < nwTilePoint.x || x > seTilePoint.x || y < nwTilePoint.y || y > seTilePoint.y) {
				this._container.removeChild(this._tiles[key]);
				delete this._tiles[key];
			}
		}		
	},
	
	_loadTile: function(tilePoint) {
		var origin = this._map.getPixelOrigin(),
			tileSize = this.options.tileSize,
			tilePos = tilePoint.multiplyBy(tileSize).subtract(origin),
			zoom = this._map.getZoom();
			
		var tileLimit = (1 << zoom);
		tilePoint.x = ((tilePoint.x % tileLimit) + tileLimit) % tileLimit;
		if (tilePoint.y < 0 || tilePoint.y >= tileLimit) { return; }
		
		
		var tile = this._tileImg.cloneNode(false);
		this._tiles[tilePoint.x + ':' + tilePoint.y] = tile;
		
		L.DomUtil.setPosition(tile, tilePos);
		
		tile.onload = this._tileOnLoad;
		//TODO tile onerror
		tile.onselectstart = tile.onmousemove = L.Util.falseFn;
		tile._leaflet_layer = this;
		
		tile.src = this.getTileUrl(tilePoint, zoom);
		
		this._container.appendChild(tile);
	},
	
	_tileOnLoad: function() {
		this.className += ' leaflet-tile-loaded';
		this._leaflet_layer.fire('tileload', {tile: this});
	}
});