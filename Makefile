ZIP_NAME ?= "CustomDataTypeNFISGeometry.zip"
PLUGIN_NAME = custom-data-type-nfis-geometry

COFFEE_FILES = CustomDataTypeNFISGeometry.coffee
MAIN_CSS = src/webfrontend/css/main.css
OPENLAYERS = src/external/openLayers/ol.js
OPENLAYERS_CSS = src/external/openLayers/ol.css
PROJ4 = src/external/proj4js/proj4.js

all: build zip

build: clean
	mkdir -p build
	mkdir -p build/$(PLUGIN_NAME)
	mkdir -p build/$(PLUGIN_NAME)/webfrontend
	mkdir -p build/$(PLUGIN_NAME)/l10n

	mkdir -p src/tmp
	cp src/webfrontend/*.coffee src/tmp
	cd src/tmp && coffee -b --compile $(COFFEE_FILES)
	cat src/tmp/*.js > build/$(PLUGIN_NAME)/webfrontend/$(PLUGIN_NAME).js
	cat $(OPENLAYERS) >> build/$(PLUGIN_NAME)/webfrontend/$(PLUGIN_NAME).js
	cat $(PROJ4) >> build/$(PLUGIN_NAME)/webfrontend/$(PLUGIN_NAME).js
	rm -rf src/tmp

	cp $(MAIN_CSS) build/$(PLUGIN_NAME)/webfrontend/${PLUGIN_NAME}.css
	cat $(OPENLAYERS_CSS) >> build/$(PLUGIN_NAME)/webfrontend/${PLUGIN_NAME}.css

	cp l10n/$(PLUGIN_NAME).csv build/$(PLUGIN_NAME)/l10n/$(PLUGIN_NAME).csv

	cp manifest.yml build/$(PLUGIN_NAME)/manifest.yml

clean:
	rm -rf build

zip:
	cd build
	zip $(ZIP_NAME) -r $(PLUGIN_NAME)/
	cp -r build/$(PLUGIN_NAME)/* build/
	rm -rf build/${PLUGIN_NAME}
	rm build/manifest.yml
