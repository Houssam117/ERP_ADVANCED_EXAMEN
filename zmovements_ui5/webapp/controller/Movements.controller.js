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
            this._currentMovPath = null;

            // model for the create popup
            var oItemsModel = new JSONModel({ items: [] });
            this.getView().setModel(oItemsModel, "itemsModel");
        },

        applyFilters: function () {
            var oSelect = this.byId("typeSelect");
            var sSelectedKey = oSelect.getSelectedKey();
            var oDatePicker = this.byId("datePickerFilter");
            var oDate = oDatePicker ? oDatePicker.getDateValue() : null;

            var aFilters = [];
            if (sSelectedKey && sSelectedKey !== "all") {
                aFilters.push(new Filter("Mov_Type", FilterOperator.EQ, sSelectedKey));
            }
            if (oDate) {
                var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({ pattern: "yyyy-MM-dd'T'HH:mm:ss" });
                var formattedDate = oDateFormat.format(oDate);
                aFilters.push(new Filter("Mov_Date", FilterOperator.EQ, formattedDate));
            }

            var oList = this.byId("entryList");
            var oBinding = oList.getBinding("items");
            oBinding.filter(aFilters);

            console.log("Applied filters: ", aFilters);
        },

        onSelectionChange: function (oEvent) {
            var oList = oEvent.getSource();
            var oSelectedItem = oList.getSelectedItem();

            if (oSelectedItem) {
                var oBindingContext = oSelectedItem.getBindingContext();
                var sMovId = oBindingContext.getProperty("Mov_Id");
                this._currentMovPath = oBindingContext.getPath();
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

            // Apply filter to the items list based on selected Mov_Id
            var oItemsList = this.byId("itemsListDetail");
            var aFilters = [new Filter("Mov_Id", FilterOperator.EQ, sMovId)];
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
            var description = location || "";
            var finished = false;

            // Format OData datetime (ISO 8601)
            var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({ pattern: "yyyy-MM-dd'T'HH:mm:ss" });
            var formattedDate = date ? oDateFormat.format(date) : null;
            var currentDate = new Date();
            var formattedCurrentDate = oDateFormat.format(currentDate);

            function toODataTime(dateObj) {
                var h = dateObj.getHours().toString().padStart(2, '0');
                var m = dateObj.getMinutes().toString().padStart(2, '0');
                var s = dateObj.getSeconds().toString().padStart(2, '0');
                return `PT${h}H${m}M${s}S`;
            }
            var formattedTime = toODataTime(currentDate);

            var newMovement = {
                Mov_Type: type,
                Mov_Date: formattedDate,
                Created_By: user,
                Created_On: formattedCurrentDate,
                Created_At: formattedTime,
                Description: description
            };

            var oModel = this.getView().getModel();
            var oView = this.getView();

            oModel.create("/MovementSetSet", newMovement, {
                success: function (oData) {
                    MessageToast.show("New movement created successfully");
                    var movId = oData.Mov_Id; // backend generated
                    var items = this._items;
                    items.forEach(function (item, index) {
                        var itemId = this._generateItemRandomId ? this._generateItemRandomId() : (index + 1).toString();
                        var newItem = {
                            Mov_Id: movId,
                            Item_Id: itemId,
                            Product_Id: item.materialNumber,
                            Quantity: item.quantity,
                            Unit: item.unit,
                            Created_By: user,
                            Created_On: formattedCurrentDate,
                            Created_At: formattedTime
                        };
                        oModel.create("/ItemSetSet", newItem, {
                            success: function () {
                                if (index === items.length - 1) {
                                    oView.byId("createMovementDialog").close();
                                }
                            },
                            error: function () {
                                MessageToast.show("Error creating item: " + item.materialNumber);
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
            this._deleteEntryId = oDetailPage.getBindingContext().getProperty("Mov_Id");

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
        },

        onEditMovement: function () {
            if (!this._currentMovPath) { return; }
            var oModel = this.getView().getModel();
            var oData = oModel.getProperty(this._currentMovPath);
            this.byId("editTypeSelect").setSelectedKey(oData.Mov_Type);
            this.byId("editDatePicker").setDateValue(new Date(oData.Mov_Date));
            this.byId("editPartnerInput").setValue(oData.Created_By);
            this.byId("editDescriptionInput").setValue(oData.Description);
            this.byId("editMovementDialog").open();
        },

        onCloseEditDialog: function () {
            this.byId("editMovementDialog").close();
        },

        _formatDate: function (d) {
            return sap.ui.core.format.DateFormat.getDateTimeInstance({ pattern: "yyyy-MM-dd'T'HH:mm:ss" }).format(d);
        },

        onSaveEdit: function () {
            if (!this._currentMovPath) { return; }
            var oModel = this.getView().getModel();
            var oPayload = {
                Mov_Type: this.byId("editTypeSelect").getSelectedKey(),
                Mov_Date: this._formatDate(this.byId("editDatePicker").getDateValue()),
                Created_By: this.byId("editPartnerInput").getValue(),
                Description: this.byId("editDescriptionInput").getValue()
            };
            oModel.update(this._currentMovPath, oPayload, {
                success: function () {
                    MessageToast.show("Movement updated");
                    this.byId("editMovementDialog").close();
                }.bind(this),
                error: function () {
                    MessageToast.show("Update failed");
                }
            });
        },

        onToggleFinished: function (oEvent) {
            if (!this._currentMovPath) { return; }
            var bState = oEvent.getSource().getState();
            var oModel = this.getView().getModel();
            oModel.update(this._currentMovPath, { Finished: bState }, {
                success: function () { MessageToast.show("Status updated"); },
                error: function () { MessageToast.show("Status change failed"); }
            });
        }
    });
});
