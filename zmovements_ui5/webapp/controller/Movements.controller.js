sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast) {
    "use strict";

    return Controller.extend("movementsapp.controller.Movements", {

        onInit: function () {
            this.uri = "/MovementSet";
            this._items = []; // items for create popup 

            // model for the create popup
            var oItemsModel = new JSONModel({ items: [] });
            this.getView().setModel(oItemsModel, "itemsModel");
        },

        applyFilters: function () {
            var oSelect = this.byId("typeSelect");
            var sSelectedKey = oSelect.getSelectedKey();

            var aFilters = [];
            if (sSelectedKey && sSelectedKey !== "all") {
                aFilters.push(new Filter("Type", FilterOperator.EQ, sSelectedKey));
            }

            var oList = this.byId("entryList");
            var oBinding = oList.getBinding("items");
            oBinding.filter(aFilters);

            console.log("Applied filter: ", sSelectedKey);
        },

        onSelectionChange: function (oEvent) {
            var oList = oEvent.getSource();
            var oSelectedItem = oList.getSelectedItem();

            if (oSelectedItem) {
                var oBindingContext = oSelectedItem.getBindingContext();
                var sMovId = oBindingContext.getProperty("Id");
                this._showDetail(oBindingContext, sMovId);
            } else {
                this._clearDetail();
            }
        },

        _showDetail: function (oBindingContext, sMovId) {
            var oDetailPage = this.byId("detailPage");
            var oDetailContent = this.byId("detailContent");
            var oNoDataText = this.byId("noDataText");

            oDetailContent.setVisible(true);
            oNoDataText.setVisible(false);

            oDetailPage.bindElement(oBindingContext.getPath());
            this.byId("SplitApp").toDetail(oDetailPage);

            // Apply filter to the items list based on selected MovId
            var oItemsList = this.byId("itemsListDetail");
            var aFilters = [new Filter("MovId", FilterOperator.EQ, sMovId)];
            var oBinding = oItemsList.getBinding("items");
            oBinding.filter(aFilters);
        },

        _clearDetail: function () {
            var oDetailPage = this.byId("detailPage");
            var oDetailContent = this.byId("detailContent");
            var oNoDataText = this.byId("noDataText");

            oDetailContent.setVisible(false);
            oNoDataText.setVisible(true);

            oDetailPage.unbindElement();
            this.byId("SplitApp").toDetail(oDetailPage);

            // Clear the items list filter
            var oItemsList = this.byId("itemsListDetail");
            var oBinding = oItemsList.getBinding("items");
            oBinding.filter([]);
        },

        onOpenCreateDialog: function () {
            this._items = []; // clear the items array for new input
            this.getView().getModel("itemsModel").setProperty("/items", this._items); // clear the items model

            if (!this._createDialog) {
                this._createDialog = this.byId("createMovementDialog");
            }
            this._createDialog.open();
        },

        onCloseCreateDialog: function () {
            if (this._createDialog) {
                this._createDialog.close();
            }
        },

        _generateRandomId: function () {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            var id = '';
            for (var i = 0; i < 4; i++) {
                id += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return id;
        },

        // New function to generate random numerical ID for items
        _generateItemRandomId: function () {
            return Math.floor(100000 + Math.random() * 900000).toString();
        },

        onSaveNewMovement: function () {
            var location = this.byId("locationSelect").getSelectedKey();
            var type = this.byId("typeSelectDialog").getSelectedKey();
            var date = this.byId("datePicker").getDateValue();
            var partner = this.byId("partnerInput").getValue();
            var id = this._generateRandomId(); // Generate unique ID for the movement
            var user = sap.ushell.Container.getUser().getId();
            var mandt = 238;
            var finished = false;

            // Ensure date is in correct format
            var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({ pattern: "yyyy-MM-dd'T'HH:mm:ss" });
            var formattedDate = oDateFormat.format(date);

            // Get the current date and time
            var currentDate = new Date();
            var formattedCurrentDate = oDateFormat.format(currentDate);

            var newMovement = {
                Id: id,
                Type: type,
                MovDate: formattedDate,
                ChgDate: formattedCurrentDate,
                ChgUser: user,
                Partner: partner,
                Location: location,
                Finished: finished
            };

            var oModel = this.getView().getModel();
            var oView = this.getView();

            // Create the movement
            oModel.create("/MovementSet", newMovement, {
                success: function () {
                    MessageToast.show("New movement created successfully");

                    // Create items associated with this movement one by one
                    var items = this._items;
                    items.forEach(function (item, index) {
                        var newItem = {
                            MovId: id,
                            Matnr: item.materialNumber,
                            Umziz: item.quantity,
                            Meins: item.unit,
                            ItemId: this._generateItemRandomId()
                        };
                        console.log("Item: ", newItem);

                        // Use a unique groupId for each item creation request
                        var groupId = "batchRequest" + index;
                        oModel.create("/ItemSet", newItem, {
                            groupId: groupId,
                            success: function () {
                                console.log("Item created successfully: ", newItem);
                                // Check if all items are created successfully
                                if (index === items.length - 1) {
                                    oView.byId("createMovementDialog").close();
                                }
                            },
                            error: function () {
                                MessageToast.show("Error creating item: " + item.materialNumber);
                            }
                        });

                        // Submit the changes for this item
                        oModel.submitChanges({
                            groupId: groupId,
                            success: function () {
                                console.log("Batch request successful for groupId: ", groupId);
                            },
                            error: function () {
                                console.log("Batch request failed for groupId: ", groupId);
                            }
                        });
                    }.bind(this));

                }.bind(this),
                error: function () {
                    MessageToast.show("Error creating new movement");
                }
            });

            console.log("New Movement: ", newMovement);
        },



        onOpenAddItemDialog: function () {
            if (!this._addItemDialog) {
                this._addItemDialog = this.byId("addItemDialog");
            }
            this._addItemDialog.open();
        },

        onCloseAddItemDialog: function () {
            if (this._addItemDialog) {
                this._addItemDialog.close();
            }
        },

        onAddItem: function () {
            var materialNumber = this.byId("materialNumberInput").getValue();
            var quantity = this.byId("quantityInput").getValue();
            var unit = this.byId("unitInput").getValue();

            var newItem = { materialNumber, quantity, unit };
            this._items.push(newItem);

            var oItemsModel = this.getView().getModel("itemsModel");
            oItemsModel.setProperty("/items", this._items);

            this.onCloseAddItemDialog();
        },

        onDeleteEntry: function () {
            if (!this._deleteEntryId) {
                this._deleteEntryId = null;
            }
            var oDetailPage = this.byId("detailPage");
            this._deleteEntryId = oDetailPage.getBindingContext().getProperty("Id");

            if (!this._confirmDeleteDialog) {
                this._confirmDeleteDialog = this.byId("confirmDeleteDialog");
            }
            this._confirmDeleteDialog.open();
        },

        onCloseConfirmDeleteDialog: function () {
            if (this._confirmDeleteDialog) {
                this._confirmDeleteDialog.close();
            }
        },

        onConfirmDelete: function () {
            var sPath = "/MovementSet('" + this._deleteEntryId + "')";
            var oModel = this.getView().getModel();

            oModel.remove(sPath, {
                success: function () {
                    MessageToast.show("Movement deleted successfully");
                    this.onCloseConfirmDeleteDialog();
                }.bind(this),
                error: function () {
                    MessageToast.show("Error deleting movement");
                }
            });

            console.log("Delete Movement ID: ", this._deleteEntryId);
        }
    });
});
