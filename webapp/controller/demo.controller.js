sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageBox"
], function(Controller, MessageBox) {
	"use strict";

	return Controller.extend("demosapui5ml-img-similarityscoring.controller.demo", {
		callService: function(oController, service, url, type, mode, apiKey, formData, fnPrecessResult) {
			var ajaxSuccess = function(data, status, jqXHR) {
				// set the response as JSON in the demo model
				var fileName = formData.fd.values().next().value.name;
				var file = formData.fd.get("files");
				fnPrecessResult(oController, data, file, fileName);

				// close the busy indicator if all request have completed
				oController.requestCount--;
				if (oController.requestCount <= 0) {
					// close the busy indicator
					oController.oBusyIndicator.close();
				}
			};
			var ajaxError = function(jqXHR, status, message) {
				oController.getView().getModel("demo").setProperty("/resultVisible-" + service, null);
				MessageBox.show("Error for file : " + formData.fd.values().next().value.name + " \n status: " + status + "\n message: " + JSON.parse(
					jqXHR.responseText).error_description);
				oController.oBusyIndicator.close();
			};
			var xhrReadyStateChange = function() {
				if (this.readyState === this.DONE) {
					if (this.status === 200) {
						// set the response as JSON in the demo model
						var data = JSON.parse(this.response);
						var fileName = formData.fd.values().next().value.name;
						var file = formData.fd.get("files");
						fnPrecessResult(oController, data, file, fileName);
						// fnPrecessResult(oController, data, formData.fd.values().next().value.name);
					} else {
						oController.getView().getModel("demo").setProperty("/resultVisible-" + service, null);
						MessageBox.show("Error for file : " + formData.fd.values().next().value.name + " \n status: " + this.status + "\n message: " +
							JSON.parse(this.responseText).error_description);

					}
					// close the busy indicator if all request have completed
					oController.requestCount--;
					if (oController.requestCount <= 0) {
						// close the busy indicator
						oController.oBusyIndicator.close();
					}
				}
			};

			if (mode === "ajax") {
				$.ajax({
					type: type,
					url: url,
					headers: {
						'Accept': 'application/json',
						'APIKey': apiKey
					},
					success: ajaxSuccess,
					error: ajaxError,
					contentType: false,
					async: true,
					data: formData.fd,
					cache: false,
					processData: false
				});
			} else if (mode === "xhr") {
				var xhr = new XMLHttpRequest();
				xhr.withCredentials = false;
				xhr.addEventListener("readystatechange", xhrReadyStateChange);
				// setting request method & API endpoint, the last parameter is to set the calls as synchyronous
				xhr.open(type, url, false);
				// adding request headers
				xhr.setRequestHeader("Accept", "application/json");
				// API Key for API Sandbox
				xhr.setRequestHeader("APIKey", apiKey);
				// sending request
				xhr.send(formData);
			} else {
				oController.oBusyIndicator.close();
			}
		},
		onPressExtractFeatures: function(oControlEvent) {
			// get the current controller & view
			var oView = this.getView();

			// start the busy indicator
			this.oBusyIndicator = new sap.m.BusyDialog();
			this.oBusyIndicator.open();

			this.requestCount = 0;

			// clear previous results from the model
			oView.getModel("demo").setProperty("/result-featureextraction", null);
			oView.getModel("demo").setProperty("/resultVisible-featureextraction", null);
			oView.getModel("demo").setProperty("/resultVisible-similarityscoring", null);

			var srcFileIsImage = false;
			var result = oView.getModel("demo").getProperty("/result-featureextraction");
			if (!result) {
				result = [];
			}
			var processResult = function(oController, data, file, fileName) {
				if (!srcFileIsImage) {
					JSZip.loadAsync(file).then(function(zip) {
						Object.keys(zip.files).forEach(function(zipEntry) {
							zip.files[zipEntry].async("blob").then(function(zipEntryFile) {
								for (var i = 0; i < data.predictions.length; i++) {
									if (zipEntry === data.predictions[i].name) {
										// Set the URL and file name
										data.predictions[i].fileURL = URL.createObjectURL(zipEntryFile);
										data.predictions[i].name = fileName + " --- " + data.predictions[i].name;
										// push the result
										result.push(data.predictions[i]);
										// set the result back
										oController.getView().getModel("demo").setProperty("/result-featureextraction", result);
										// display the result table
										oController.getView().getModel("demo").setProperty("/resultVisible-featureextraction", true);
									}
								}
							});
						});
					});
				} else {
					// Set the URL
					data.predictions[0].fileURL = URL.createObjectURL(file);
					data.predictions[0].name = fileName;
					// push the result
					result.push(data.predictions[0]);
					console.log(result);
					// set the result back
					oController.getView().getModel("demo").setProperty("/result-featureextraction", result);
					// display the result table
					oController.getView().getModel("demo").setProperty("/resultVisible-featureextraction", true);
				}
			};

			// keep a reference of the uploaded files
			var mode = oControlEvent.getSource().data("mode");
			var url = oView.getModel("demo").getProperty("/url_featureextraction");
			var type = "POST";
			var apiKey = oView.getModel("demo").getProperty("/APIKey");
			for (var fileIndex = 0; fileIndex < oControlEvent.getParameters().files.length; fileIndex++) {
				var srcFile = oControlEvent.getParameters().files[fileIndex];
				if (srcFile.type.match('image.*')) {
					srcFileIsImage = true;
				} else {
					srcFileIsImage = false;
				}
				// create the form data to be sent in the request
				var formData = new window.FormData();
				formData.fd.append("files", srcFile, srcFile.name);
				console.log(srcFile.name);
				// increase request countor to close busy indicator
				this.requestCount++;

				// call the service
				this.callService(this, "featureextraction", url, type, mode, apiKey, formData, processResult);
			}
		},
		onPressScoreSimilarity: function(oControlEvent) {
			// get the current view
			var oView = this.getView();
			var oThis = this;

			// start the busy indicator
			this.oBusyIndicator = new sap.m.BusyDialog();
			this.oBusyIndicator.open();

			// clear previous results from the model
			oView.getModel("demo").setProperty("/resultVisible-similarityscoring", null);

			var zip = new JSZip();
			// create the files
			var result = oView.getModel("demo").getProperty("/result-featureextraction");
			for (var i = 0; i < result.length; i++) {
				zip.file(result[i].name + ".json", JSON.stringify(result[i].featureVectors));
				result[i].result = [];
			}
			zip.file(result[0].name+ '.json').async("string").then(function(data) {
				// data is "Hello World\n"
				console.log(data);
			});
			zip.file(result[1].name+ '.json').async("string").then(function(data) {
				// data is "Hello World\n"
				console.log(data);
			});
			var url = oView.getModel("demo").getProperty("/url_similarityscoring");
			var type = "POST";
			var apiKey = oView.getModel("demo").getProperty("/APIKey");
			var mode = oControlEvent.getSource().data("mode");
			var options = "{\"numSimilarVectors\" : " + (result.length - 1) + "}";
			var processResult = function(oController, data, file, fileName) {
				for (var ii = 0; ii < data.predictions.length; ii++) {
					for (var jj = 0; jj < result.length; jj++) {
						if (data.predictions[ii].id === result[jj].name + ".json") {
							result[jj].result = data.predictions[ii].similarVectors;
							break;
						}
					}
				}
				// set the result back
				oController.getView().getModel("demo").setProperty("/result-featureextraction", result);
				// display the result table
				oController.getView().getModel("demo").setProperty("/resultVisible-similarityscoring", true);
			};
			var processServiceCall = function(blob) {
				saveAs(blob, "score.zip");
				var formData = new window.FormData();
				formData.fd.append("files", blob, "score.zip");
				formData.fd.append("options", options);

				oThis.callService(oThis, "similarityscoring", url, type, mode, apiKey, formData, processResult);
			};
			// call processServiceCall with the extracted features
			zip.generateAsync({
					type: "blob"
				})
				.then(processServiceCall);
		},
		fileTypeMissmatch: function(oControlEvent) {
			MessageBox.show("Wrong file type!");
		}

	});
});