# NFIS Geometry Fylr plugin

This plugin adds the new data type "NFIS Geometry" to a Fylr instance. The data type makes it possible to work with geometries via a Geoserver WFS and a Masterportal instance.


## Installation

1. Clone repository
2. Create server configuration file
```
cp serverConfiguration.json.template serverConfiguration.json
```
3. Fill in credentials of Geoserver account with write permissions in serverConfiguration.json
4. Build plugin:
```
make
```
5. Add path to plugin in fylr.yml

## Configuration

### Base configuration

* *Masterportal URL*: The base URL of the Masterportal instance to be used by the plugin
* *Geoserver: User name*: The name of the Geoserver account that is used to access the WFS in read-only mode
* *Geoserver: Password*: The password of the Geoserver account that is used to access the WFS in read-only mode
* *Data transfer to geoserver*: For each geometry field defined, entered field data is added to the corresponding geometry via a WFS provided by the configured Geoserver instance
    * *Object type*: The object type for which field data should be added
    * *Geometry fields*: The geometries for which data should be added
        * *Field name (including path)*: The path to the geometry field for which data should be added (e. g. "event.place.geometry")
        * *WFS URL*: The base URL of the WFS to be used. It has to be a WFS provided by the configured Geoserver instance.
        * *WFS feature type*: The feature type to use when writing data to the WFS
        * *Field data to be transferred*: Mappings of a source field (Fylr) to a target field (WFS) 
           * *Name of field in Fylr object*: The source field that contains the data to be transferred
           * *Name of WFS target field*: The target field of the WFS to which the data is transferred

### Data model configuration

* *WFS ID in Masterportal*: The ID of the layer used for displaying the WFS data in Masterportal. This ID can be found in the services configuration file of the Masterportal instance.
* *WFS URL*: The base URL of the WFS to be used. It has to be a WFS provided by the Geoserver instance configured in the base configuration.
* *WFS feature type*: The feature type to use when accessing the WFS
* *Style object ID*: The system ID of the style object to be used for this geometry field
* *Multi selection*: If toggled, multiple geometries can be added to the geometry field. All geometries are shown on a single map. Geometries can be selected on the map to edit or remove them.
