# fylr plugins are built by fylr-build-plugin, the build driver that knows how
# a fylr plugin is put together (compile, assemble build/, zip, seal, loca).
# This Makefile is a thin shim for muscle memory — all logic lives in the
# tool. @latest always resolves the tool's newest release, so plugins pick up
# fixes without being touched; an incompatible tool change would come as a new
# major version (import path .../v2), which is the only event that changes
# this line.
#
# Tools needed (each only for the features this plugin uses):
#   go       runs fylr-build-plugin — https://go.dev/dl/
#   coffee   CoffeeScript 1.x:  npm install -g coffeescript@1.12.7
#   sass     npm install -g sass
FYLR_BUILD_PLUGIN ?= go run github.com/programmfabrik/fylr-build-plugin@latest

# The tool itself reads NO environment variables — everything is passed as
# flags. The release workflow's RELEASE_TAG env is translated into a flag
# right here. The zip's NAME is not passed: fylr-build-plugin always names it
# <repo>.zip, which is the naming rule for every fylr plugin release.
RELEASE_FLAGS = $(if $(RELEASE_TAG),-release "$(RELEASE_TAG)")

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

all: build ## build all

install:
	cd src/webfrontend && npm install

bundle:
	cp src/webfrontend/js/core/map.js src/webfrontend/js/core/map_original.js
	cp src/webfrontend/js/core/masterportal.js src/webfrontend/js/core/masterportal_original.js
	cat src/shared/shared.js >> src/webfrontend/js/core/map.js
	cat src/shared/shared.js >> src/webfrontend/js/core/masterportal.js
	cd src/webfrontend && npm run bundle

build: install bundle ## build the plugin into build/<name>/ — loadable by fylr via plugin.paths
	$(FYLR_BUILD_PLUGIN) build $(RELEASE_FLAGS)
	rm src/webfrontend/coreBundle.js
	mv src/webfrontend/js/core/map_original.js src/webfrontend/js/core/map.js
	mv src/webfrontend/js/core/masterportal_original.js src/webfrontend/js/core/masterportal.js

zip: install bundle ## build the release zip
	$(FYLR_BUILD_PLUGIN) zip $(RELEASE_FLAGS)
	rm src/webfrontend/coreBundle.js
	mv src/webfrontend/js/core/map_original.js src/webfrontend/js/core/map.js
	mv src/webfrontend/js/core/masterportal_original.js src/webfrontend/js/core/masterportal.js

seal: ## build + seal the release zip (fylr dev/CI key unless -pubkey is passed to the tool)
	$(FYLR_BUILD_PLUGIN) seal $(RELEASE_FLAGS)

loca: ## pull the loca CSV from its Google Sheets master (build.yml)
	$(FYLR_BUILD_PLUGIN) loca

check: ## validate the build tree against the manifest
	$(FYLR_BUILD_PLUGIN) check

clean: ## clean build files
	$(FYLR_BUILD_PLUGIN) clean

.PHONY: help all build zip seal loca check clean
