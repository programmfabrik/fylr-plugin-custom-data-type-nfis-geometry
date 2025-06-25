> This Plugin / Repo is being maintained by a community of developers.
There is no warranty given or bug fixing guarantee; especially not by
Programmfabrik GmbH. Please use the GitHub issue tracking to report bugs
and self organize bug fixing. Feel free to directly contact the committing
developers.

# NFIS Geometry fylr plugin: Geometry link via WFS-T and Masterportal

This plugin adds the new data type "Geometry link via WFS-T and Masterportal" to a fylr instance. The data type makes it possible to work with geometries via a Geoserver WFS-T and a Masterportal instance.

## Installation

The latest version of this plugin can be found [here](https://github.com/programmfabrik/fylr-plugin-custom-data-type-nfis-geometry/releases/latest/download/CustomDataTypeNFISGeometry.zip).

The ZIP can be downloaded and installed using the plugin manager, or used directly (recommended).

## Configuration

### Base configuration

* *Masterportal URL*: The base URL of the Masterportal instance to be used by the plugin
* *Geoserver account (read only): User name*: The name of the Geoserver account that is used to access the WFS in read-only mode
* *Geoserver account (read only): Password*: The password of the Geoserver account that is used to access the WFS in read-only mode
* *Geoserver account (write permissions): User name*: The name of the Geoserver account that is used to access the WFS for editing data
* *Geoserver account (write permissions): Password*: The password of the Geoserver account that is used to access the WFS for editing data
* *Object types*: 
    * *Object type name*: The name of the object type
    * *Geometry fields*: The geometry fields to be configured
        * *Field name (including path)*: The path to the geometry field (e. g. "_nested:object__event.geometry")
        * *SLD file*: The SLD file containing the style definitions to use for displaying geometries on the map
        * *Legend image file*: The image file that is shown in the overlay that can be opened by clicking the legend button in the top right corner of the map
        * *WFS URL for map display*: The base URL of the WFS to be used for displaying data on the map provided by the plugin. It has to be a WFS provided by the configured Geoserver instance. No data is changed via this WFS.
        * *WFS feature type for map display*: The feature type to use when displaying data on the map
        * *WFS URL for editing data*: The base URL of the WFS to be used for editing and deleting geometries. It has to be a WFS-T provided by the configured Geoserver instance.
        * *WFS feature type for editing data*: The feature type to use when editing or deleting geometries via WFS
        * *Masterportal: Raster layer ID*: The ID of a raster layer that should be displayed in addition to the vector data in Masterportal. Only displayed when opening Masterportal via the editor.
        * *Masterportal: Vector layer ID (Default)*: The ID of the default layer used for displaying WFS data in Masterportal. This layer is used if no other layers are configured or if no geometries have been added yet to a geometry field. Only displayed when opening Masterportal via the editor.
        * *Masterportal: Name of WFS field for assigning Masterportal vector layer ID*: The value of this field is used for selecting Masterportal layers based on WFS data (see next setting). Only displayed when opening Masterportal via the editor.
        * *Masterportal: Vector layer IDs (based on WFS field value)*:
           * *Field value*: If this value is found in the configured WFS field, the corresponding layer is shown in Masterportal
           * *Layer ID*: The ID of the layer to show in Masterportal
        * *Data transfer to geoserver*: If activated, field data is transferred from the fylr object to the Geoserver (via the configured WFS).
        * *Field data to be transferred*: Mappings of a source field (fylr) to a target field (WFS). For each geometry field defined, entered field data is added to the corresponding geometry via a WFS provided by the configured Geoserver instance
           * *Name of WFS target field*: The target field of the WFS to which the data is transferred
           * *Name of field in fylr object*: The source field that contains the data to be transferred
           * *JavaScript function for reading the value from the fylr object*: Alternatively to specifying a field name, a custom JavaScript function body for reading the value from the fylr object can be entered. The object data can be accessed via the variable "object" (e. g. "return object._id;")
        * *WFS target field for pool name* The field of the WFS where the name of the pool that the fylr object belongs to should be stored
        * *Pool names for data transfer*: This field can be used to define the level of the pool hierarchy that should be used for writing the pool name into the WFS target field. If the pool that the fylr object belongs to is a child of one of these pools, the pool (of the higher hierarchy level) specified here is used. Otherwise, the actual pool is used.

### Data model configuration

* *Multi selection*: If toggled, multiple geometries can be added to the geometry field. All geometries are shown on a single map. Geometries can be selected on the map to edit or remove them.
