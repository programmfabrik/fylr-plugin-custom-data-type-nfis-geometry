var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };
var hasProp = {}.hasOwnProperty;

var UserPluginNFISGeometry = (function(superClass) {
    extend(UserPluginNFISGeometry, superClass);

    function UserPluginNFISGeometry() {
        return UserPluginNFISGeometry.__super__.constructor.apply(this, arguments);
    }

    const Plugin = UserPluginNFISGeometry.prototype;

    Plugin.getTabs = function(tabs) {
		const options = this.__getOptions();
		if (!options) return;

		tabs.push({
			name: 'masterportal',
			text: 'Masterportal',
			content: () => {
				form = new CUI.Form({
					data: this._user.data.user,
					name: 'custom_data',
					fields: [{
						type: CUI.Select,
						name: 'masterportal_configuration',
						form: {
							label: $$('userPlugin.nfisGeometry.masterportalConfiguration.label')
                        },
						options
					}]
                });
				return form.start();
            }
        });
    }

	Plugin.getSaveData = function(saveData) {
		saveData.user.custom_data.masterportal_configuration = this._user.data.user.custom_data.masterportal_configuration;
    }

	Plugin.isAllowed = function() {
        return true;
    }

	Plugin.__getOptions = function() {
		const configurations = this.__getBaseConfiguration().masterportal_configurations;
		if (!configurations?.length) return undefined;

		const options = [
			{ value: '', text: $$('userPlugin.nfisGeometry.masterportalConfiguration.default') }
		];		

		return options.concat(
			configurations.map(configuration => {
				return { value: configuration.id, text: configuration.name };
			})
		);
	}

	Plugin.__getBaseConfiguration = function() {
    	return ez5.session.getBaseConfig('plugin', 'custom-data-type-nfis-geometry')['nfisGeoservices'];
	}

    return UserPluginNFISGeometry;
})(ez5.UserPlugin);


User.plugins.registerPlugin(UserPluginNFISGeometry);
