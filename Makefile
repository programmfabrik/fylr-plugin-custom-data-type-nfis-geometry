PLUGIN_NAME = custom-data-type-nfis-geometry
ZIP_NAME = "CustomDataTypeNFISGeometry.zip"

SERVER_FILE = sendDataToGeoserver.js
MAIN_CSS = src/webfrontend/css/main.css
OPENLAYERS_CSS = src/webfrontend/node_modules/ol/ol.css

all: install build zip

install:
	cd src/webfrontend && npm install

build: clean buildinfojson
	mkdir -p build
	mkdir -p build/$(PLUGIN_NAME)
	mkdir -p build/$(PLUGIN_NAME)/webfrontend
	mkdir -p build/$(PLUGIN_NAME)/server
	mkdir -p build/$(PLUGIN_NAME)/l10n

	cd src/webfrontend && npm run bundle
	cp src/webfrontend/contentLoaderBundle.js build/$(PLUGIN_NAME)/webfrontend/$(PLUGIN_NAME).js
	cat src/webfrontend/js/customDataType/main.js >> build/$(PLUGIN_NAME)/webfrontend/${PLUGIN_NAME}.js
	cat src/webfrontend/js/userPlugin/userPlugin.js >> build/$(PLUGIN_NAME)/webfrontend/${PLUGIN_NAME}.js
	rm src/webfrontend/contentLoaderBundle.js

	cp src/server/${SERVER_FILE} build/${PLUGIN_NAME}/server/${SERVER_FILE}

	cp $(MAIN_CSS) build/$(PLUGIN_NAME)/webfrontend/${PLUGIN_NAME}.css
	cat $(OPENLAYERS_CSS) >> build/$(PLUGIN_NAME)/webfrontend/${PLUGIN_NAME}.css

	cp l10n/$(PLUGIN_NAME).csv build/$(PLUGIN_NAME)/l10n/$(PLUGIN_NAME).csv

	cp manifest.master.yml build/$(PLUGIN_NAME)/manifest.yml

	cp build-info.json build/$(PLUGIN_NAME)/build-info.json

clean:
	rm -rf build

zip:
	cd build && zip $(ZIP_NAME) -r $(PLUGIN_NAME)/
	cp -r build/$(PLUGIN_NAME)/* build/
	rm -rf build/${PLUGIN_NAME}

buildinfojson:
	repo=`git remote get-url origin | sed -e 's/\.git$$//' -e 's#.*[/\\]##'` ;\
	rev=`git show --no-patch --format=%H` ;\
	lastchanged=`git show --no-patch --format=%ad --date=format:%Y-%m-%dT%T%z` ;\
	builddate=`date +"%Y-%m-%dT%T%z"` ;\
	echo '{' > build-info.json ;\
	echo '  "repository": "'$$repo'",' >> build-info.json ;\
	echo '  "rev": "'$$rev'",' >> build-info.json ;\
	echo '  "lastchanged": "'$$lastchanged'",' >> build-info.json ;\
	echo '  "builddate": "'$$builddate'"' >> build-info.json ;\
	echo '}' >> build-info.json
