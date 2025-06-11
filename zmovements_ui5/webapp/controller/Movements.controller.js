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
            this.uri = "/MovementSetSet";
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
            var user = sap.ushell.Container.getUser().getId();
            var description = ""; // Vul aan indien je een input hebt voor description
            var finished = false;

            // Format OData datetime (ISO 8601)
            var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({ pattern: "yyyy-MM-dd'T'HH:mm:ss" });
            var formattedDate = date ? oDateFormat.format(date) : null;
            var currentDate = new Date();
            var formattedCurrentDate = oDateFormat.format(currentDate);

            // Format OData time (PTxxHxxMxxS)
            function toODataTime(dateObj) {
                var h = dateObj.getHours().toString().padStart(2, '0');
                var m = dateObj.getMinutes().toString().padStart(2, '0');
                var s = dateObj.getSeconds().toString().padStart(2, '0');
                return `PT${h}H${m}M${s}S`;
            }
            var formattedTime = toODataTime(currentDate);

            // Alleen creatable properties meesturen!
            var newMovement = {
                MovType: type,
                MovDate: formattedDate,
                CreatedBy: user,
                CreatedOn: formattedCurrentDate,
                CreatedAt: formattedTime,
                Description: description
            };

            var oModel = this.getView().getModel();
            var oView = this.getView();

            oModel.create("/MovementSetSet", newMovement, {
                success: function (oData) {
                    MessageToast.show("New movement created successfully");
                    var movId = oData.MovId; // backend generated
                    // Create items associated with this movement one by one
                    var items = this._items;
                    items.forEach(function (item, index) {
                        // Controleer of ItemId verplicht is, zo ja, genereer een unieke waarde
                        var itemId = this._generateItemRandomId ? this._generateItemRandomId() : (index + 1).toString();
                        var newItem = {
                            MovId: movId,
                            ItemId: itemId,
                            ProductId: item.materialNumber,
                            Quantity: item.quantity,
                            Unit: item.unit,
                            CreatedBy: user,
                            CreatedOn: formattedCurrentDate,
                            CreatedAt: formattedTime
                        };
                        var groupId = "batchRequest" + index;
                        oModel.create("/ItemSetSet", newItem, {
                            groupId: groupId,
                            success: function () {
                                if (index === items.length - 1) {
                                    oView.byId("createMovementDialog").close();
                                }
                            },
                            error: function () {
                                MessageToast.show("Error creating item: " + item.materialNumber);
                            }
                        });
                        oModel.submitChanges({
                            groupId: groupId
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
            var sPath = "/MovementSetSet('" + this._deleteEntryId + "')";
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
