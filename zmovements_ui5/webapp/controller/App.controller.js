sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/GroupHeaderListItem",
    "sap/ui/core/Fragment",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Text",
    "sap/m/library",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/util/RtaResourceSync"
], function (Controller, Filter, FilterOperator, MessageToast, GroupHeaderListItem, Fragment, Dialog, Button, Text, mobileLibrary, JSONModel, RtaResourceSync) {
    "use strict";

    var ButtonType = mobileLibrary.ButtonType;

    return Controller.extend("com.sap.mov.controller.App", {

        onInit: function () {
            var oAppViewModel = new JSONModel({
                busy: false,
                delay: 0
            });
            this.getView().setModel(oAppViewModel, "appView");

            this.oRouter = this.getOwnerComponent().getRouter();

            this.oRouter.getRoute("detail").attachPatternMatched(this._onDetailMatched, this);

            this._oCreateMovementDialog = null;
            this._oCreateMovementItemsTable = null;

            this._uuidGenerator = RtaResourceSync.createGuid;
        },

        onFilterChange: function (oEvent) {
            this._applyFilterAndSearch();
        },

        onSearch: function (oEvent) {
            this._applyFilterAndSearch();
        },

        _applyFilterAndSearch: function () {
            var oTable = this.byId("movementTable");
            var oBinding = oTable.getBinding("items");
            var aFilters = [];

            var sSelectedMovType = this.byId("movTypeFilter").getSelectedKey();
            if (sSelectedMovType !== "All") {
                aFilters.push(new Filter("MovType", FilterOperator.EQ, sSelectedMovType));
            }

            var sSearchQuery = this.byId("searchField").getValue();
            if (sSearchQuery) {
                var oSearchFilter = new Filter({
                    filters: [
                        new Filter("Description", FilterOperator.Contains, sSearchQuery),
                        new Filter("MovId", FilterOperator.Contains, sSearchQuery)
                    ],
                    and: false
                });
                aFilters.push(oSearchFilter);
            }

            oBinding.filter(aFilters);
        },

        createGroupHeader: function (oGroup) {
            return new GroupHeaderListItem({
                title: oGroup.key,
                upperCase: false
            });
        },

        onMovementPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sMovId = oContext.getProperty("MovId");

            this.oRouter.navTo("detail", {
                movId: sMovId
            });
        },

        onCreateMovementPress: function () {
            if (!this._oCreateMovementDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.sap.mov.view.CreateMovementDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oCreateMovementDialog = oDialog;
                    this.getView().addDependent(oDialog);

                    var oNewMovementModel = new JSONModel({
                        MovId: "",
                        MovType: "",
                        Description: "",
                        MovDate: new Date(),
                        Items: []
                    });
                    this._oCreateMovementDialog.setModel(oNewMovementModel, "newMovement");

                    this._oCreateMovementItemsTable = this.byId("createMovementItemsTable");
                    this._oCreateMovementItemsTable.setModel(oNewMovementModel, "newMovement");
                    this._oCreateMovementItemsTable.bindItems({
                        path: "newMovement>/Items",
                        template: new sap.m.ColumnListItem({
                            cells: [
                                new sap.m.Input({ value: "{newMovement>ProductId}", placeholder: "Product ID" }),
                                new sap.m.Input({ value: "{newMovement>Quantity}", type: "Number", placeholder: "Quantity" }),
                                new sap.m.Input({ value: "{newMovement>Unit}", placeholder: "Unit" }),
                                new sap.m.Button({ icon: "sap-icon://delete", type: "Transparent", press: this.onRemoveItemPress.bind(this) })
                            ]
                        })
                    });

                    this._oCreateMovementDialog.open();
                }.bind(this));
            } else {
                this._oCreateMovementDialog.getModel("newMovement").setData({
                    MovId: "",
                    MovType: "",
                    Description: "",
                    MovDate: new Date(),
                    Items: []
                });
                this._oCreateMovementDialog.open();
            }
        },

        onAddMovementItemPress: function () {
            var oNewMovementModel = this._oCreateMovementDialog.getModel("newMovement");
            var aItems = oNewMovementModel.getProperty("/Items");
            aItems.push({
                ItemId: this._uuidGenerator(),
                ProductId: "",
                Quantity: 0,
                Unit: ""
            });
            oNewMovementModel.setProperty("/Items", aItems);
        },

        onRemoveItemPress: function (oEvent) {
            var oItemToRemove = oEvent.getSource().getParent();
            var oContext = oItemToRemove.getBindingContext("newMovement");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.substring(sPath.lastIndexOf('/') + 1));

            var oNewMovementModel = this._oCreateMovementDialog.getModel("newMovement");
            var aItems = oNewMovementModel.getProperty("/Items");
            aItems.splice(iIndex, 1);
            oNewMovementModel.setProperty("/Items", aItems);
        },

        onSaveMovementPress: function () {
            var oNewMovementModel = this._oCreateMovementDialog.getModel("newMovement");
            var oNewMovementData = oNewMovementModel.getData();
            var oODataModel = this.getView().getModel();

            oNewMovementData.MovId = this._uuidGenerator();

            oNewMovementData.CreatedBy = sap.ushell ? sap.ushell.Container.getUser().getId() : "DEMO_USER";
            oNewMovementData.CreatedOn = new Date();
            oNewMovementData.CreatedAt = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            var oMovDate = oNewMovementData.MovDate;
            if (oMovDate instanceof Date) {
                oNewMovementData.MovDate = oMovDate.toISOString().split('T')[0];
            } else {
                oNewMovementData.MovDate = new Date().toISOString().split('T')[0];
            }

            this.getView().getModel("appView").setProperty("/busy", true);

            oODataModel.create("/MovementSet", oNewMovementData, {
                success: function (oData, oResponse) {
                    var sCreatedMovId = oData.MovId;

                    MessageToast.show(this.getResourceBundle().getText("movementCreatedSuccess", [sCreatedMovId]));

                    var aItemsToCreate = oNewMovementData.Items;
                    var iItemsCreated = 0;
                    var iTotalItems = aItemsToCreate.length;

                    if (iTotalItems > 0) {
                        aItemsToCreate.forEach(function (oItem) {
                            oItem.MovId = sCreatedMovId;
                            delete oItem.MovDate;

                            oODataModel.create("/ItemSet", oItem, {
                                success: function () {
                                    iItemsCreated++;
                                    if (iItemsCreated === iTotalItems) {
                                        MessageToast.show(this.getResourceBundle().getText("itemsCreatedSuccess", [iTotalItems]));
                                        this._oCreateMovementDialog.close();
                                        this.getView().getModel().refresh(true);
                                        this.getView().getModel("appView").setProperty("/busy", false);
                                    }
                                }.bind(this),
                                error: function (oError) {
                                    MessageToast.show(this.getResourceBundle().getText("itemCreationError", [oItem.ProductId]));
                                    console.error("Error creating item:", oError);
                                    this.getView().getModel("appView").setProperty("/busy", false);
                                }.bind(this)
                            });
                        }.bind(this));
                    } else {
                        this._oCreateMovementDialog.close();
                        this.getView().getModel().refresh(true);
                        this.getView().getModel("appView").setProperty("/busy", false);
                    }
                }.bind(this),
                error: function (oError) {
                    MessageToast.show(this.getResourceBundle().getText("movementCreationError"));
                    console.error("Error creating movement:", oError);
                    this.getView().getModel("appView").setProperty("/busy", false);
                }.bind(this)
            });
        },

        onCancelMovementPress: function () {
            this._oCreateMovementDialog.close();
        },

        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        }
    });
});