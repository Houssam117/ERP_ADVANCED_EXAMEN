/**
 * eslint-disable @sap/ui5-jsdocs/no-jsdoc
 */

sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device"
], function (UIComponent, Device) {
    "use strict";

    return UIComponent.extend("com.sap.mov.Component", {
        metadata: {
            manifest: "json",
            async: true
        },

        /**
         * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
         * @public
         * @override
         */
        init: function () {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // create the views based on the url/hash
            if (this.getRouter()) {
                this.getRouter().initialize();
            }
        }
    });
});