PLUGIN_NAME = custom-data-type-nfis-geometry

SERVER_FILE = sendDataToGeoserver.js
MAIN_CSS = src/webfrontend/css/main.css
OPENLAYERS_CSS = src/webfrontend/node_modules/ol/ol.css

all: install build

install:
	cd src/webfrontend && npm install

build: clean
	mkdir -p build
	mkdir -p build/$(PLUGIN_NAME)
	mkdir -p build/$(PLUGIN_NAME)/webfrontend
	mkdir -p build/$(PLUGIN_NAME)/server
	mkdir -p build/$(PLUGIN_NAME)/l10n

	cd src/webfrontend && npm run bundle
	cp src/webfrontend/contentLoaderBundle.js build/$(PLUGIN_NAME)/webfrontend/$(PLUGIN_NAME).js
	cat src/webfrontend/js/main.js >> build/$(PLUGIN_NAME)/webfrontend/${PLUGIN_NAME}.js
	rm src/webfrontend/contentLoaderBundle.js

	cp src/server/${SERVER_FILE} build/${PLUGIN_NAME}/server/${SERVER_FILE}

	cp $(MAIN_CSS) build/$(PLUGIN_NAME)/webfrontend/${PLUGIN_NAME}.css
	cat $(OPENLAYERS_CSS) >> build/$(PLUGIN_NAME)/webfrontend/${PLUGIN_NAME}.css

	cp l10n/$(PLUGIN_NAME).csv build/$(PLUGIN_NAME)/l10n/$(PLUGIN_NAME).csv

	cp serverConfiguration.json build/$(PLUGIN_NAME)/serverConfiguration.json

	cp manifest.master.yml build/$(PLUGIN_NAME)/manifest.yml

clean:
	rm -rf build
