sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("com.sap.mov.controller.Detail", {

        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
            this.oRouter.getRoute("detail").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            var sMovId = oEvent.getParameter("arguments").movId;
            var oView = this.getView();
            var oODataModel = oView.getModel();

            var sPath = oODataModel.createKey("/MovementSet", {
                MovId: sMovId
            });

            oView.bindElement({
                path: sPath,
                parameters: {
                    expand: "ItemSet"
                },
                events: {
                    dataRequested: function () {
                        oView.getModel("appView").setProperty("/busy", true);
                    },
                    dataReceived: function () {
                        oView.getModel("appView").setProperty("/busy", false);
                    }
                }
            });
        },

        onNavBack: function () {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.oRouter.navTo("appHome", {}, true);
            }
        },

        onDeleteMovementPress: function () {
            var oContext = this.getView().getBindingContext();
            var sMovId = oContext.getProperty("MovId");
            var oODataModel = this.getView().getModel();
            var that = this;

            MessageBox.confirm(
                this.getResourceBundle().getText("deleteConfirmation", [sMovId]), {
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.DELETE,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.DELETE) {
                            that.getView().getModel("appView").setProperty("/busy", true);

                            var sPath = oODataModel.createKey("/MovementSet", {
                                MovId: sMovId
                            });

                            oODataModel.remove(sPath, {
                                success: function () {
                                    MessageToast.show(that.getResourceBundle().getText("movementDeletedSuccess", [sMovId]));
                                    that.getView().getModel("appView").setProperty("/busy", false);
                                    that.oRouter.navTo("appHome", {}, true);
                                }.bind(this),
                                error: function (oError) {
                                    MessageToast.show(that.getResourceBundle().getText("movementDeletionError", [sMovId]));
                                    console.error("Error deleting movement:", oError);
                                    that.getView().getModel("appView").setProperty("/busy", false);
                                }.bind(this)
                            });
                        }
                    }
                }
            );
        },

        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        }
    });
});