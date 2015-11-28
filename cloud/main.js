
// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
Parse.Cloud.define("hello", function(request, response) {
  response.success("Hello world!");
});

Parse.Cloud.define("getCurrentSeason", function(request, response) {
	var query = new Parse.Query("Season");
	query.equalTo("current",true);
	query.first({
		success: function(result){
			console.log(result);
			response.success(result);
		},
		error: function() {
			response.error("Unable to query current season.");
		}
	});
});