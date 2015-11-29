var _ = require('underscore');


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

Parse.Cloud.define("authenticatedSignin", function(request, response) {
	Parse.Cloud.httpRequest({
		url: 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token='+request.params.access_token
	}).then(function(httpResponse){
		if (httpResponse.data.user_id){
			//got a valid user_id, find the TokenStorage object
			locateOrCreateUser(httpResponse.data.user_id,request.params.access_token).then(function(user){
				console.log(user);
				response.success(user);
			}, function(error){
				response.error(error);
			});
		}
		else{
			response.error("Sign in failed.  Invalid response while validating with Google.")
		}
	}, function(httpResponse){
		response.error("Sign in failed.  Unable to validate token with Google.");
	});
});


locateOrCreateUser = function(userId,token){
	var promise = new Parse.Promise();

	Parse.Cloud.useMasterKey();
	//see if any entries match the userId
	var query = new Parse.Query("TokenStorage");
	query.equalTo("userId",userId);
	query.count().then(function(count){
		if (count > 0){
			//find the user with the given id
			userWithUserId(query,token).then(function(user){
				promise.resolve(user);
			}, function(error){
				promise.reject(error);
			});
		}
		else{
			//create a new user
			newUser(userId,token).then(function(user){
				promise.resolve(user);
			}, function(error){
				promise.reject(error);
			});
		}
	});
		

	return promise;
}

userWithUserId = function(userIdQuery,token){
	var promise = new Parse.Promise();

	var tokenStorageObject;

	//get the matching TokenStorage object
	userIdQuery.first().then(function(object){
		tokenStorageObject = object;
		tokenStorageObject.set("accessToken",token);
		return tokenStorageObject.save();
	}).then(function(){
		//find the user with the TokenStorage object
		var query = new Parse.Query(Parse.User);
		query.equalTo("tokenStorage",tokenStorageObject);
		return query.first();
	}).then(function(user){
		promise.resolve(user);
	}, function(error){
		promise.reject(error)
	});

	return promise;
}

newUser = function(userId,token){
	var promise = new Parse.Promise();

	var user = new Parse.User();
	var Buffer = require('buffer').Buffer;

	//create new TokenStorage object
	var tokenStorage = new Parse.Object("TokenStorage");
	tokenStorage.set("accessToken",token);
	tokenStorage.set("userId",userId);
	//restricted ACL
	var restrictedAcl = new Parse.ACL();
	restrictedAcl.setPublicReadAccess(false);
	restrictedAcl.setPublicWriteAccess(false);
	tokenStorage.setACL(restrictedAcl);

	tokenStorage.save().then(function(){
		//generate random username and password, as users are located using TokenStorage
		var username = new Buffer(24);
		var password = new Buffer(24);
		_.times(24, function(i) {
		  username.set(i, _.random(0, 255));
		  password.set(i, _.random(0, 255));
		});
		user.set("username", username.toString('base64'));
		user.set("password", password.toString('base64'));
		user.set("tokenStorage",tokenStorage);
		return user.signUp();
	}).then(function(){
		promise.resolve(user);
	}, function(error){
		tokenStorage.destroy();
		promise.reject();
	});

	return promise;
}

