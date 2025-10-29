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
* *Masterportal version*: The major version (2 or 3) of the Masterportal instance used with the plugin
* *Geoserver account (read only): User name*: The name of the Geoserver account that is used to access the WFS in read-only mode
* *Geoserver account (read only): Password*: The password of the Geoserver account that is used to access the WFS in read-only mode
* *Geoserver account (write permissions): User name*: The name of the Geoserver account that is used to access the WFS for editing data
* *Geoserver account (write permissions): Password*: The password of the Geoserver account that is used to access the WFS for editing data
* *Name of the geometry ID field in the WFS*: The name of the WFS field that is used for storing the geometry UUIDs created by the plugin (default value: "ouuid")
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
        * *Masterportal: Vector layer ID (Default)*: The ID of the default layer used for displaying WFS data in Masterportal. This layer is used if no other layers are configured or if no geometries have been added yet to a geometry field. Only displayed when opening Masterportal via the editor. The default layer ID is selected based on the user groups the user belongs to: The list of possible layers is iterated until an entry is found that contains either the ID of a user group that the user belongs to or does not contain a user group ID. 
          * *User group ID (optional)*: The ID of the user group. If left entry, this layer is selected as the default layer if none of the predecessors in the list were selected.
          * *Layer ID*: The ID of the Masterportal layer to select as default layer if the user belongs to the specified user group (or if the user group field is left empty)
        * *Masterportal: Name of WFS field for assigning Masterportal vector layer ID*: The value of this field is used for selecting Masterportal layers based on WFS data (see next setting). Only displayed when opening Masterportal via the editor.
        * *Masterportal: Vector layer IDs (based on WFS field value)*:
           * *Field value*: If this value is found in the configured WFS field, the corresponding layer is shown in Masterportal
           * *Layer ID*: The ID of the layer to show in Masterportal
        * *Data transfer to Geoserver*: If activated, field data is transferred from the fylr object to the Geoserver (via the configured WFS).
        * *Field data to be transferred*: Mappings of a source field (fylr) to a target field (WFS). For each geometry field defined, entered field data is added to the corresponding geometry via a WFS provided by the configured Geoserver instance
           * *Name of WFS target field*: The target field of the WFS to which the data is transferred. If the same target field is used in multiple mapping entries, the values are concatenated with a space character as delimiter.
           * *Name of field in fylr object*: The source field that contains the data to be transferred
           * *JavaScript function for reading the value from the fylr object*: Alternatively to specifying a field name, a custom JavaScript function body for reading the value from the fylr object can be entered. The object data can be accessed via the variable "object" (e. g. "return object._id;")
        * *Tags to be transferred*: Mappings of a tag ID (fylr) to a target field (WFS). The target field has to be of type "boolean". For each geometry field defined, the target field of the corresponding geometry dataset is set to true (if the tag is set) or false (if it is not set) via a WFS provided by the configured Geoserver instance
           * *Name of WFS target field*: The target field (boolean) of the WFS which should be updated according to the tag
           * *Path to tags in fylr object*: The path to the tags field to be used for reading the tags. If empty, the default "_tags" field is used. This option can be used to refer to tags in linked objects.
           * *Tag ID*: The ID of the tag to check
        * *WFS target field for pool name* The field of the WFS where the name of the pool that the fylr object belongs to should be stored
        * *Pool names for data transfer*: This field can be used to define the level of the pool hierarchy that should be used for writing the pool name into the WFS target field. If the pool that the fylr object belongs to is a child of one of these pools, the pool (of the higher hierarchy level) specified here is used. Otherwise, the actual pool is used.
* *Linked objects*:

   This option can be used to trigger Geoserver updates in linked objects instead of the object itself.
   * *Object type*: If data is edited in an object of this type, the data in linked objects is transferred to the Geoserver.
   * *Link field name (including path)*: Path to the field used for linking objects
* *Masterportal configurations*:

   You can set up options for multiple Masterportal configurations here. These configuration options are then shown in the "Masterportal" section of the user settings. In this way, a Masterportal configuration can be assigned to each user.
   * *Identifier*: Interal identifier for this configuration (for usage by the Fylr plugin only)
   * *Name*: Name of the configuration (as displayed in the selection field in the user settings)
   * *Name of configuration file*: The file name of the configuration file. This file name is included in any Masterportal URL to apply the configuration.

### Data model configuration

* *Multi selection*: If toggled, multiple geometries can be added to the geometry field. All geometries are shown on a single map. Geometries can be selected on the map to edit or remove them.
