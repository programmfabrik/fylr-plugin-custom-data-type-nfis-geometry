> This Plugin / Repo is being maintained by a community of developers.
There is no warranty given or bug fixing guarantee; especially not by
Programmfabrik GmbH. Please use the GitHub issue tracking to report bugs
and self organize bug fixing. Feel free to directly contact the committing
developers.

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
* *Object types*: 
    * *Object type name*: The name of the object type
    * *Geometry fields*: The geometry fields to be configured
        * *Field name (including path)*: The path to the geometry field (e. g. "_nested:object__event.geometry")
        * *Style object UUID*: The UUID of the style object to be used for this geometry field
        * *WFS URL for map display*: The base URL of the WFS to be used for displaying data on the map provided by the plugin. It has to be a WFS provided by the configured Geoserver instance. No data is changed via this WFS.
        * *WFS feature type for map display*: The feature type to use when displaying data on the map
        * *Masterportal: Raster layer ID*: The ID of a raster layer that should be displayed in addition to the vector data in Masterportal.
        * *Masterportal: Vector layer ID (Default)*: The ID of the default layer used for displaying WFS data in Masterportal. This layer is used if no other layers are configured or if no geometries have been added yet to a geometry field.
        * *Masterportal: Name of WFS field for assigning Masterportal vector layer ID*: The value of this field is used for selecting Masterportal layers based on WFS data (see next setting)
        * *Masterportal: Vector layer IDs (based on WFS field value)*:
           * *Field value*: If this value is found in the configured WFS field, the corresponding layer is shown in Masterportal
           * *Layer ID*: The ID of the layer to show in Masterportal
        * *Data transfer to geoserver*: If activated, field data is transferred from the Fylr object to the Geoserver (via the configured WFS).
        * *WFS URL for data transfer*: The base URL of the WFS to be used for transferring data to the Geoserver. It has to be a WFS-T provided by the configured Geoserver instance.
        * *WFS feature type for data transfer*: The feature type to use when writing data to the WFS
        * *Field data to be transferred*: Mappings of a source field (Fylr) to a target field (WFS). For each geometry field defined, entered field data is added to the corresponding geometry via a WFS provided by the configured Geoserver instance
           * *Name of field in Fylr object*: The source field that contains the data to be transferred
           * *Name of WFS target field*: The target field of the WFS to which the data is transferred
        * *WFS target field for pool name* The field of the WFS where the name of the pool that the Fylr object belongs to should be stored
        * *Allowed pool names for data transfer*: Data is only transferred if the Fylr object belongs to a pool with one of the specified pool names

### Data model configuration

* *Multi selection*: If toggled, multiple geometries can be added to the geometry field. All geometries are shown on a single map. Geometries can be selected on the map to edit or remove them.
