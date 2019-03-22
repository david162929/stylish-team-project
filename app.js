const cst = require("./util/constants.js");
// Utilities
const crypto = require("crypto");
const fs = require("fs");
const request = require("request");
const mysql2 = require("mysql2");
const Client = require('ssh2').Client;
const nodemailer = require('nodemailer');
const AWS = require('aws-sdk');

/* --------------- MySQL Initialization --------------- */
const mysql = {};
mysql.core = mysql2;

const ssh = new Client();
ssh.on('ready', function() {
	ssh.forwardOut(
		'127.0.0.1',
		12345,
		'127.0.0.1',
		3306,
		function (err, stream) {
			if (err) throw err;
			mysql.con = mysql2.createConnection({
			  user: 'root',
			  database: 'stylish',
			  password: '567TYUghj@$^*',
			  stream: stream,
			});		
				
			// use sql connection as usual
			mysql.con.query("SELECT id FROM product", function (err, result, fields) {
				if (err) throw err;
				console.log("Connect to MySQL succeed!");
			});
	
		});
	}).connect({
	// ssh connection config ...
	host: '52.15.89.192',
	port: 22,
	username: 'ec2-user',
	privateKey: require('fs').readFileSync(".ssh/2019-2-14-keyPair.pem")
}); 




/* --------------- Database Access Object --------------- */
const dao={
	product:{
		insert:function(req){
			return new Promise(function(resolve, reject){
				let colorCodes=req.body.color_codes.split(",");
				let colorNames=req.body.color_names.split(",");
				let sizes=req.body.sizes.split(",");
				mysql.con.beginTransaction(function(error){
					if(error){
						reject("Database Query Error");
						throw error;
					}
					let product={
						category:req.body.category,
						title:req.body.title,
						description:req.body.description,
						price:req.body.price,
						texture:req.body.texture,
						wash:req.body.wash,
						place:req.body.place,
						note:req.body.note,
						story:req.body.story
					};
					if(req.body.id){
						product.id=req.body.id;
					}
					mysql.con.query("insert into product set ?", product, function(error, results, fields){
						if(error){
							reject("Database Query Error: "+erorr);
							return mysql.con.rollback(function(){
								throw error;
							});
						}
						let productId=results.insertId;
						let variants=[];
						for(let i=0;i<colorCodes.length;i++){
							for(let j=0;j<sizes.length;j++){
								variants.push([
									colorCodes[i], colorNames[i], sizes[j], Math.round(Math.random()*10), productId
								]);
							}
						}
						mysql.con.query("insert into variant(color_code,color_name,size,stock,product_id) values ?", [variants], function(error, results, fields){
							if(error){
								reject("Database Query Error: "+erorr);
								return mysql.con.rollback(function(){
									throw error;
								});
							}
							mysql.con.commit(function(error){
								if(error){
									reject("Database Query Error: "+erorr);
									return mysql.con.rollback(function(){
										throw error;
									});
								}
								fs.mkdirSync(cst.STYLISH_HOME+"/public/assets/"+productId);
								fs.renameSync(req.files["main_image"][0].path, cst.STYLISH_HOME+"/public/assets/"+productId+"/main.jpg");
								for(let i=0;i<req.files["other_images"].length;i++){
									fs.renameSync(req.files["other_images"][i].path, cst.STYLISH_HOME+"/public/assets/"+productId+"/"+i+".jpg");
								}
								resolve("OK");
							});
						});					
					});
				});
			});
		},
		list:function(filters, size, paging){
			return new Promise(function(resolve, reject){
				let offset=paging*size;
				let filter="";
				if(filters!==null){
					if(filters.where){
						filter=filters.where;
					}else if(filters.keyword){
						filter=" where title like "+mysql.con.escape("%"+filters.keyword+"%");
					}else if(filters.category){
						filter=" where category="+mysql.con.escape(filters.category);
					}
				}
				let query="select count(*) as total from product";
				mysql.con.query(query+filter, function(error, results, fields){
					if(error){
						reject("Database Query Error");
					}else{
						let maxPage=Math.floor((results[0].total-1)/size);
						let body={};
						if(paging<maxPage){
							body.paging=paging+1;
						}
						query="select * from product";
						mysql.con.query(query+filter+" limit ?,?", [offset,size], function(error, results, fields){
							if(error){
								reject("Database Query Error");
							}else{
								if(results.length===0){
									body.data=[];
									resolve(body);
								}else{
									let products=results;
									query="select * from variant where product_id in ("+products.map((product)=>{
										return product.id;
									}).join(",")+")";
									mysql.con.query(query, function(error, results, fields){
										if(error){
											reject("Database Query Error");
										}else{
											products.forEach((product)=>{
												product.colors=[];
												product.sizes=[];
												product.variants=[];
												product.main_image=cst.PROTOCOL+cst.HOST_NAME+"/assets/"+product.id+"/main.jpg";
												product.images=[
													cst.PROTOCOL+cst.HOST_NAME+"/assets/"+product.id+"/0.jpg",
													cst.PROTOCOL+cst.HOST_NAME+"/assets/"+product.id+"/1.jpg",
													cst.PROTOCOL+cst.HOST_NAME+"/assets/"+product.id+"/0.jpg",
													cst.PROTOCOL+cst.HOST_NAME+"/assets/"+product.id+"/1.jpg"
												];
											});
											let product, variant;
											for(let i=0;i<results.length;i++){
												variant=results[i];
												product=products.find((product)=>{
													return product.id===variant.product_id;
												});
												if(product.colors.findIndex((color)=>{
													return color.code===variant.color_code
												})===-1){
													product.colors.push({
														code:variant.color_code, name:variant.color_name
													});
												}
												if(product.sizes.indexOf(variant.size)===-1){
													product.sizes.push(variant.size);
												}
												product.variants.push({
													color_code:variant.color_code,
													size:variant.size,
													stock:variant.stock
												});
											}
											body.data=products;
											resolve(body);
										}
									});
								}
							}
						});
					}
				});
			});
		},
		get:function(productId){
			return new Promise(function(resolve, reject){
				let query="select * from product where id = ?";
				mysql.con.query(query, [productId], function(error, results, fields){
					if(error){
						reject("Database Query Error");
					}else{
						if(results.length===0){
							resolve(null);
						}else{
							let product=results[0];
							query="select * from variant where product_id = ?";
							mysql.con.query(query, [product.id], function(error, results, fields){
								if(error){
									reject("Database Query Error");
								}else{
									console.log(productId, "3");
									product.colors=[];
									product.sizes=[];
									product.variants=[];
									product.main_image=cst.PROTOCOL+cst.HOST_NAME+"/assets/"+product.id+"/main.jpg";
									product.images=[
										cst.PROTOCOL+cst.HOST_NAME+"/assets/"+product.id+"/0.jpg",
										cst.PROTOCOL+cst.HOST_NAME+"/assets/"+product.id+"/1.jpg",
										cst.PROTOCOL+cst.HOST_NAME+"/assets/"+product.id+"/0.jpg",
										cst.PROTOCOL+cst.HOST_NAME+"/assets/"+product.id+"/1.jpg"
									];
									let variant;
									for(let i=0;i<results.length;i++){
										variant=results[i];
										if(product.colors.findIndex((color)=>{
											return color.code===variant.color_code
										})===-1){
											product.colors.push({
												code:variant.color_code, name:variant.color_name
											});
										}
										if(product.sizes.indexOf(variant.size)===-1){
											product.sizes.push(variant.size);
										}
										product.variants.push({
											color_code:variant.color_code,
											size:variant.size,
											stock:variant.stock
										});
									}
									resolve(product);
								}
							});
						}
					}
				});
			});
		}
	
	
	
	
	}
};




// Express Initialization
const express = require("express");
const bodyparser = require("body-parser");
const multer = require("multer");
const app = express();

//set pug
app.set("view engine", "pug");

app.use(express.static("public"));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended:true}));

//multer set storing files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
	cb(null, './public/uploads')
  },
  filename: function (req, file, cb) {
	cb(null, Date.now() + "-" + file.originalname)
  }
});
const upload = multer({ storage: storage });



// CORS Control
app.use("/api/", function(req, res, next){
	res.set("Access-Control-Allow-Origin", "*");
	res.set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization");
	res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
	res.set("Access-Control-Allow-Credentials", "true");
	next();
});


/* ---------------Route--------------- */
//for test
function testVariable () {

/* 	function A () {
		let tmp = {}
	} */
	
}

//const testHostName = "http://localhost:3000";
const testHostName = "https://davidadm.com";
//const testAuthorization = "Bearer 53b23a2b5f3e79fdb03f2b43141e56a68ee32787f76129cc6deedab4d4fdbb29";
const testAuthorization = "Bearer iamacoolguyilovetaiwan";

app.get("/test", (req, res)=>{
	res.render("testlist");
});

app.get("/test-upload", (req, res) => {
	res.render("upload-img");
});

app.get("/test-postfb", (req, res) => {
	// Set the headers
	let headers = {
		'User-Agent':       'Super Agent/0.0.1',
		'content-type':     'application/json'
	}
	let data = {
		"provider":"facebook",
		"access_token":"EAAFqxw9GAHQBALTvHGRsGkjrq9Y7ZBZBgQ5FzimQCIhrOvvz7Vdeo0gazXYgXhRNeAAohLFUoxY7cJ7swV5XekudDgrQqpfHh7QcDmJuNZCeQLuzVzceZBBZCQBY8PVUijser11gNUcf02ngGzkXh8g9BGPvZCdIkqYlhwGRiTZAcctZAMo2KoAcQWFzwqO45VwZD",
	};
	
	// Configure the request
	let options = {
		url: `${testHostName}/api/1.0/user/signin`,
		method: 'POST',
		headers: headers,
		json:data
	}

	// Start the request
	request(options, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			// Print out the response body
			console.log(body);
			res.send(body);
		}
	})
});

app.get("/test-signup", (req, res) => {
	// Set the headers
	let headers = {
		'User-Agent':       'Super Agent/0.0.1',
		'content-type':     'application/json'
	}
	let data = {
		"name":"大衛陳",
		"email":"en16292902@gmail.com",
		"password":"12345"
	};
	
	// Configure the request
	let options = {
		url: `${testHostName}/api/1.0/user/signup`,
		method: 'POST',
		headers: headers,
		json:data
	}

	// Start the request
	request(options, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			// Print out the response body
			console.log(body);
			res.send(body);
		}
	})
	
	
	/*//test none JSON POST request
	console.log("test none JSON POST request:");
	request({
			url: 'http://localhost:3000/api/1.0/user/signup',
			method: 'POST',
			headers: {'User-Agent':'Super Agent/0.0.1','content-type':'application/x-www-form-urlencoded'},
			form:{test:"1",test2:"2"}
		}, (e, r, b) => {
			if (!e && r.statusCode == 200) {
			console.log(b);
		}
	}); */
	
	//res.send("POST request done.");
});

app.get("/test-signin", (req, res) => {
	// Set the headers
	let headers = {
		'User-Agent':       'Super Agent/0.0.1',
		'content-type':     'application/json'
	}
	let data = {
		"provider":"native",
		"email":"en16292902@gmail.com",
		"password":"12345"
	};
	
	// Configure the request
	let options = {
		url: `${testHostName}/api/1.0/user/signin`,
		method: 'POST',
		headers: headers,
		json:data
	}

	// Start the request
	request(options, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			// Print out the response body
			console.log(body);
			res.send(body);
		}
	})
});

app.get("/test-get-profile", (req, res) => {
	// Set the headers
	let headers = {
		Authorization: testAuthorization
	}

	// Configure the request
	let options = {
		url: `${testHostName}/api/1.0/user/profile`,
		method: 'GET',
		headers: headers,
	}

	// Start the request
	request(options, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			// Print out the response body
			console.log(body);
			res.send(body);
		}
	})
	
/* 	let x = HttpRequest(headers, options);
	console.log(x);
	res.send(x); */	
});

app.get("/test-favor-s", (req, res) => {
	// Set the headers
	let headers = {
		Authorization: testAuthorization
	}
	
	// Configure the request
	let options = {
		url: `${testHostName}/api/1.0/user/favorite-save?id=201807242211`,
		method: 'GET',
		headers: headers
	}
	
	
	// Start the request
	request(options, (error, response, body)=>{
		if (!error && response.statusCode == 200) {
			console.log(body);
			res.send(body);
		}
	
	});

	
});

app.get("/test-favor-d", (req, res) => {
	// Set the headers
	let headers = {
		Authorization: testAuthorization
	}
	
	// Configure the request
	let options = {
		url: `${testHostName}/api/1.0/user/favorite-delete?id=201807242211`,
		method: 'GET',
		headers: headers
	}
	
	// Start the request
	request(options, (error, response, body)=>{
		if (!error && response.statusCode == 200) {
			console.log(body);
			res.send(body);
		}
		
	});
	
});

app.get("/test-favor-g", (req, res) => {
	// Set the headers
	let headers = {
		Authorization: testAuthorization
	}
	
	// Configure the request
	let options = {
		url: `${testHostName}/api/1.0/user/favorite-get`,
		method: 'GET',
		headers: headers
	}
	
	// Start the request
	request(options, (error, response, body)=>{
		if (!error && response.statusCode == 200) {
			console.log(body);
			res.send(body);
		}
		
	});
	
});

app.get("/test-favor-loop", (req, res) => {
	// Set the headers
	let headerA = {
		Authorization: "Bearer dc8f3175bf11b0d3ee31434ec092c135717fd55a8f9e1e4bc730da79e8e7b433"
	}
	
	// Configure the request
	let optionA = {
		url: 'http://localhost:3000/api/1.0/user/favorite-save?id=201807242211',
		method: 'GET',
		headers: headerA
	}
	
	// Set the headers
	let headerB = {
		Authorization: "Bearer dc8f3175bf11b0d3ee31434ec092c135717fd55a8f9e1e4bc730da79e8e7b433"
	}
	
	// Configure the request
	let optionB = {
		url: 'http://localhost:3000/api/1.0/user/favorite-delete?id=201807242211',
		method: 'GET',
		headers: headerB
	}
	

		
	
	for (let i=0; i<1; i++) {
		// Start the request
		request(optionA, (error, response, body)=>{
			if (!error && response.statusCode == 200) {
				console.log(body);
				//res.send(body);
			}		
		});
		// Start the request
		request(optionB, (error, response, body)=>{
			if (!error && response.statusCode == 200) {
				console.log(body);
				//res.send(body);
			}
			
		});
	}
	res.redirect("/test");
});

app.get("/test-video-g", (req, res) => {
	// Set the headers
	let headers = {
		Authorization: testAuthorization
	}
	
	// Configure the request
	let options = {
		url: `${testHostName}/api/1.0/products/video-get?id=201807201824`,
		method: 'GET',
		headers: headers
	}
	
	// Start the request
	request(options, (error, response, body)=>{
		if (!error && response.statusCode == 200) {
			console.log(body);
			res.send(body);
		}
		
	});
});

app.get("/test-video-a", (req, res) => {
	// Set the headers
	let headers = {
		Authorization: testAuthorization
	}
	
	// Configure the request
	let options = {
		url: `${testHostName}/api/1.0/products/video-add?id=201807201824&link=https://www.youtube.com/watch?v=Tas1h6rqHDE`,
		method: 'GET',
		headers: headers
	}
	
	// Start the request
	request(options, (error, response, body)=>{
		if (!error && response.statusCode == 200) {
			console.log(body);
			res.send(body);
		}
		
	});
});

app.get("/test-mail", (req, res)=>{
/* 	const transporter = nodemailer.createTransport({
		service: "gmail",
		auth: {
			user: "en162929@gmail.com",
			pass: "mdcumxaqmvkxjvon"
		}
	}); */
	
	const transporter = nodemailer.createTransport( {
			host: 'smtp.gmail.com',
			secureConnecton: true,
			port: 587,
			auth: {
			user: "en162929@gmail.com",
			pass: "peapzayqccphviun"
		}
	});
	
	let html = "<h1>Welcome!</h1><p>感謝您的購買!</p>";
	
	const mailOptions = {
		from: "en162929@gmail.com",
		to:"en162929@gmail.com",
		subject: "Sending Email using Node.js",
		html: html
	};
	
	
	
	transporter.sendMail(mailOptions, (err, info)=>{
		if (err) {
			console.log(err);
			res.send(err);
		}
		else {
			console.log("Email sent: "+ info.response);
			res.send(info.response);
		}
	});
});

app.get("/test1", (req, res)=> {
	let html = fs.readFileSync("./public/test-fetch.html", "utf8");
	res.send(html);
});

app.get("/test-email-s", (req, res) => {
	// Set the headers
	let headers = {
		'content-type':     'application/json',
		authorization: testAuthorization
	}
	let data = {
		"user_token":"80018e24d600b79272e7a602d71d16bb0a7e214f306239f72d2cae4065d6de39",
		"order_number":"125334407290"
	};
	
	// Configure the request
	let options = {
		url: `${testHostName}/api/1.0/admin/email-send`,
		method: 'POST',
		headers: headers,
		json:data
	}

	// Start the request
	request(options, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			// Print out the response body
			console.log(body);
			res.send(body);
		}
	})
});

app.get("/test-sqs", (req, res) => {
	//set access key id and access key
	const credentials = new AWS.SharedIniFileCredentials({profile: 'stylish-sqs'});
	AWS.config.credentials = credentials;
	
	AWS.config.update({region: 'us-west-2'});
	
	// Create an SQS service object
	var sqs = new AWS.SQS({apiVersion: '2012-11-05'});
	
/* 	//send
	var params = {
	  DelaySeconds: 10,
	  MessageAttributes: {
		"Title": {
		  DataType: "String",
		  StringValue: "The Whistler"
		},
		"Author": {
		  DataType: "String",
		  StringValue: "John Grisham"
		},
		"WeeksOn": {
		  DataType: "Number",
		  StringValue: "6"
		}
	  },
	  //MessageGroupId: "stylish-test",
	  //MessageDeduplicationId: "stylish-test-deduplication",
	  MessageBody: "Information about current NY Times fiction bestseller for week of 12/11/2016.",
	  QueueUrl: "https://sqs.us-east-2.amazonaws.com/091043113581/stylis-test"
	};

	sqs.sendMessage(params, function(err, data) {
	  if (err) {
		console.log("Error", err);
	  } else {
		console.log("Success", data.MessageId);
	  }
	}); */
	
	//receive
	var queueURL = "https://sqs.us-east-2.amazonaws.com/091043113581/stylis-test";

	var params = {
	 AttributeNames: [
		"SentTimestamp"
	 ],
	 MaxNumberOfMessages: 1,
	 MessageAttributeNames: [
		"All"
	 ],
	 QueueUrl: queueURL,
	 VisibilityTimeout: 20,
	 WaitTimeSeconds: 0
	};

	sqs.receiveMessage(params, function(err, data) {
	  if (err) {
		console.log("Receive Error", err);
	  } else if (data.Messages) {
		//console.log(data);
		console.log(data.Messages);
		
		
/* 		var deleteParams = {
		  QueueUrl: queueURL,
		  ReceiptHandle: data.Messages[0].ReceiptHandle
		};
		sqs.deleteMessage(deleteParams, function(err, data) {
		  if (err) {
			console.log("Delete Error", err);
		  } else {
			console.log("Message Deleted", data);
		  }
		}); */
	  }
	});
	
	
});

app.get("/test-chat-bot", (req, res) => {
	//init watson-developer-cloud
	const AssistantV2 = require('watson-developer-cloud/assistant/v2');

	const assistant = new AssistantV2({
		version: '2019-02-28',
		iam_apikey: 'S_k3B0nmkvm_hwlCGzFXgCbUkuCjfNaTDKedhh_sBKks',
		url: 'https://gateway.watsonplatform.net/assistant/api'
	});
	
	//const assistantId = '407cb56c-018a-4b47-a18c-4719e59741c3';
	const assistantId = 'ce62aa0b-0872-45d0-8cc3-8bef17cba113';
	
	//create session
	assistant.createSession({
		assistant_id: assistantId,
	}, function(err, response) {
		if (err) {
			console.error(err);
		}
		else {
			console.log(JSON.stringify(response, null, 2));
			const sessionId = response.session_id;
			
			//send message
			assistant.message({
				assistant_id: assistantId,
				session_id: sessionId,
				input: {
					'message_type': 'text',
					'text': '你好'
				}
			}, (err, response) => {
				if (err) {
					console.log(err);
				}
				else {
					console.log(JSON.stringify(response, null, 2));
					const botRes = response.output.generic[0].text;
					console.log(botRes);
					res.redirect("/test");
				}
			});
		}
	});
});

app.get("/test-chat-bot-api", (req, res) => {
	// Set the headers
	let headers = {
		'content-type':     'application/json',
		authorization: testAuthorization
	}
	let data = {
		"user_message":"你好",
	};
	
	// Configure the request
	let options = {
		url: `${testHostName}/api/1.0/chat-bot`,
		method: 'POST',
		headers: headers,
		json:data
	}

	// Start the request
	request(options, (error, response, body) => {
		if (!error && response.statusCode == 200) {
			// Print out the response body
			console.log(body);
			res.send(body);
		}
	})
});



/* --------------- Upload avatar API --------------- */
app.post("/api/1.0/admin/avatar", upload.single('avatar'), async (req, res) => {
	console.log(req.file);
	console.log(req.body);
	console.log("got upload img.");
	
	let imgPath = "https://davidadm.com/uploads/" + req.file.filename;
	console.log(imgPath);
		
	//check accessToken
	console.log(req.headers);
	let authorization = req.headers.authorization;
	
	//check authorization
	if (authorization) {
		authorization = authorization.split(" ");
		console.log(authorization, authorization[0], authorization[1]);
		//check Bearer
		if(authorization[0] === "Bearer") {
			let result1 = await sqlQuery(`SELECT COUNT(*) FROM user WHERE access_token = "${authorization[1]}"`);
			result1 = result1[0]["COUNT(*)"];
			//check token in database
			if (result1 != 0) {
				let result2 = await sqlQuery(`SELECT access_expired FROM user WHERE access_token = "${authorization[1]}"`);
				result2 = result2[0]["access_expired"];
				console.log(result1, result2, Date.now());
				//check expired date in database
				if (Date.now() < result2) {
					//succeed
					//insert img path in database
					let result3 = await sqlQuery(`UPDATE user SET img_upload = "${imgPath}" WHERE access_token = "${authorization[1]}"`);
					console.log(result3.affectedRows + " record(s) updated");
					
					res.send(result3.affectedRows + " record(s) updated");
				}
				else {
					res.send(errorFormat("expired token."));
				}
			}
			else {
				res.send(errorFormat("Wrong token."));
			}			
		}
		else {
			res.send(errorFormat("Please use Bearer schemes."));
		}
	}
	else {
		res.send(errorFormat("authorization is required."));
	}
});

/* --------------- Favorite product API --------------- */
app.get("/api/1.0/user/favorite-save", async (req, res) => {
	console.log(req.query.id);
	const productId = req.query.id;
	
	//check accessToken
	console.log(req.headers);
	let authorization = req.headers.authorization;
	
	//check authorization
	if (authorization) {
		authorization = authorization.split(" ");
		console.log(authorization[0], authorization[1]);
		try {
			//check Bearer
			if(authorization[0] === "Bearer") {
				let result1 = await sqlQuery(`SELECT COUNT(*) FROM user WHERE access_token = "${authorization[1]}"`);
				result1 = result1[0]["COUNT(*)"];
				//check token in database
				if (result1 != 0) {
					let result2 = await sqlQuery(`SELECT id, access_expired FROM user WHERE access_token = "${authorization[1]}"`);
					const userId = result2[0].id;
					result2 = result2[0]["access_expired"];
					console.log(result1, result2, Date.now());
					//check expired date in database
					if (Date.now() < result2) {
						//succeed
						//insert product id in database
						//check table favorite
						let result3 = await sqlQuery(`SELECT id FROM favorite WHERE user_id = "${userId}"`);
						console.log(result3);
						if (result3.length == 0) {
							//add user in favorite
							let result4 = await sqlQuery(`INSERT INTO favorite (user_id) values ("${userId}")`);
							const favoriteProductId = result4.insertId;
							console.log("1 record inserted(table favorite), ID: " + result4.insertId);
							//add product id in favorite_product
							let result5 = await sqlQuery(`SELECT COUNT(*) FROM favorite_product WHERE product_id = "${productId}" AND id = "${favoriteProductId}"`);
							result5 = result5[0]["COUNT(*)"];
							console.log(result5);
							//check product_id in table favorite_product
							if (result5 === 0) {
								let result6 = await sqlQuery(`INSERT INTO favorite_product (id, product_id) values ("${favoriteProductId}", "${productId}")`);
								console.log("1 record inserted(table favorite_product), ID: " + result6.insertId);
								//response all favorite product list
								let result7 = await sqlQuery(`SELECT product_id FROM favorite_product WHERE id = "${favoriteProductId}"`);

								res.send(dataFormat({"id":pavoriteFormat(result7)}));
							}
							else {
								//response all favorite product list
								let result6 = await sqlQuery(`SELECT product_id FROM favorite_product WHERE id = "${favoriteProductId}"`);
								
								res.send(dataFormat({"id":pavoriteFormat(result6)}));
							}
						}
						else {
							const favoriteProductId = result3[0].id;
							console.log(favoriteProductId);
							//add product id in favorite_product
							let result5 = await sqlQuery(`SELECT COUNT(*) FROM favorite_product WHERE product_id = "${productId}" AND id = "${favoriteProductId}"`);
							result5 = result5[0]["COUNT(*)"];
							console.log(result5);
							//check product_id in table favorite_product
							if (result5 === 0) {
								let result6 = await sqlQuery(`INSERT INTO favorite_product (id, product_id) values ("${favoriteProductId}", "${productId}")`);
								console.log("1 record inserted(table favorite_product), ID: " + result6.insertId);
								//response all favorite product list
								let result7 = await sqlQuery(`SELECT product_id FROM favorite_product WHERE id = "${favoriteProductId}"`);
								
								res.send(dataFormat({"id":pavoriteFormat(result7)}));
							}
							else {
								//response all favorite product list
								let result6 = await sqlQuery(`SELECT product_id FROM favorite_product WHERE id = "${favoriteProductId}"`);
								
								res.send(dataFormat({"id":pavoriteFormat(result6)}));
							}
						}
					}
					else {
						res.send(errorFormat("Expired token."));
					}
				}
				else {
					res.send(errorFormat("Wrong token."));
				}			
			}
			else {
				res.send(errorFormat("Please use Bearer schemes."));
			}
		}catch(e) {
			res.send(e);
		}
	}
	else {
		res.send(errorFormat("Authorization is required."));
	}
});

app.get("/api/1.0/user/favorite-delete", async (req, res) => {
	console.log(req.query.id);
	const productId = req.query.id;
	
	//check accessToken
	console.log(req.headers);
	let authorization = req.headers.authorization;
	
	//check authorization
	if (authorization) {
		authorization = authorization.split(" ");
		console.log(authorization[0], authorization[1]);
		try {
			//check Bearer
			if(authorization[0] === "Bearer") {
				let result1 = await sqlQuery(`SELECT COUNT(*) FROM user WHERE access_token = "${authorization[1]}"`);
				result1 = result1[0]["COUNT(*)"];
				//check token in database
				if (result1 != 0) {
					let result2 = await sqlQuery(`SELECT id, access_expired FROM user WHERE access_token = "${authorization[1]}"`);
					const userId = result2[0].id;
					result2 = result2[0]["access_expired"];
					console.log(result1, result2, Date.now());
					//check expired date in database
					if (Date.now() < result2) {
						//succeed
						console.log(userId);
						//check table favorite
						let result3 = await sqlQuery(`SELECT id FROM favorite WHERE user_id = "${userId}"`);
						console.log(result3);
						if (result3.length === 0) {
							//do nothing
							res.send(dataFormat({"id":[]}));
						}
						else {
							const favoriteProductId = result3[0].id;
							console.log(favoriteProductId);

							//check table favorite_product
							let result4 = await sqlQuery(`SELECT product_id FROM favorite_product WHERE id = "${favoriteProductId}" AND product_id = "${productId}"`);
							console.log(result4);
							if (result4.length === 0) {
								//Can't find product id
								console.log("Can't find product id.");
								//response all favorite product list
								let result6 = await sqlQuery(`SELECT product_id FROM favorite_product WHERE id = "${favoriteProductId}"`);
								
								res.send(dataFormat({"id":pavoriteFormat(result6)}));
							}
							else {
								//delete product in database
								let result5 = await sqlQuery(`DELETE FROM favorite_product WHERE id = "${favoriteProductId}" AND product_id = "${productId}"`);
								console.log(result5.affectedRows + " record deleted.");
								
								//response all favorite product list
								let result6 = await sqlQuery(`SELECT product_id FROM favorite_product WHERE id = "${favoriteProductId}"`);
								
								res.send(dataFormat({"id":pavoriteFormat(result6)}));
							}
						}
					}
					else {
						res.send(errorFormat("Expired token."));
					}
				}
				else {
					res.send(errorFormat("Wrong token."));
				}			
			}
			else {
				res.send(errorFormat("Please use Bearer schemes."));
			}
		}catch(e) {
			res.send(e);
		}
	}
	else {
		res.send(errorFormat("Authorization is required."));
	}
});

app.get("/api/1.0/user/favorite-get", async (req, res) => {
	//check accessToken
	console.log(req.headers);
	let authorization = req.headers.authorization;
	
	//check authorization
	if (authorization) {
		authorization = authorization.split(" ");
		console.log(authorization[0], authorization[1]);
		try {
			//check Bearer
			if(authorization[0] === "Bearer") {
				let result1 = await sqlQuery(`SELECT COUNT(*) FROM user WHERE access_token = "${authorization[1]}"`);
				result1 = result1[0]["COUNT(*)"];
				//check token in database
				if (result1 != 0) {
					let result2 = await sqlQuery(`SELECT id, access_expired FROM user WHERE access_token = "${authorization[1]}"`);
					const userId = result2[0].id;
					result2 = result2[0]["access_expired"];
					console.log(result1, result2, Date.now());
					//check expired date in database
					if (Date.now() < result2) {
						//succeed
						//check table favorite
						let result3 = await sqlQuery(`SELECT id FROM favorite WHERE user_id = "${userId}"`);
						console.log(result3);
						if (result3.length === 0) {
							//don't find favorite list
							//do nothing
							res.send(dataFormat({"id":[]}));
							
						}
						else {
							const favoriteProductId = result3[0].id;
							console.log(favoriteProductId);
							//response all favorite product list
							let result6 = await sqlQuery(`SELECT product_id FROM favorite_product WHERE id = "${favoriteProductId}"`);
							
							res.send(dataFormat({"id":pavoriteFormat(result6)}));
						}
					}
					else {
						res.send(errorFormat("Expired token."));
					}
				}
				else {
					res.send(errorFormat("Wrong token."));
				}			
			}
			else {
				res.send(errorFormat("Please use Bearer schemes."));
			}
		}catch(e) {
			res.send(e);
		}
	}
	else {
		res.send(errorFormat("Authorization is required."));
	}
});

/* --------------- Product Video API --------------- */
app.get("/api/1.0/products/video-get", (req, res) => {
	const productId = req.query.id;
	
	sqlQuery(`SELECT video_link FROM product WHERE id = "${productId}"`)
	.then((result1)=>{
		let videoLink = result1[0].video_link;
		videoLink = videoLinkFormat(videoLink);
		
		res.send(dataFormat([`${videoLink}`]));
	})
	.catch((err)=>{
		res.send(errorFormat(err));
	});
	
});

app.get("/api/1.0/products/video-add", (req, res) => {
	const productId = req.query.id;
	const videoLink = req.query.link;
	const authorization = req.headers.authorization;
	
	//check id and link
	if (productId && videoLink) {
		//check authorization
		if (authorization) {
			const superToken = authorization.split(" ");
			console.log(superToken);
			//check Bearer
			if(superToken[0] === "Bearer") {
				//check super token
				if (superToken[1] === "iamacoolguyilovetaiwan") {
					//UPDATE link in product table
					sqlQuery(`UPDATE product SET video_link = "${videoLink}" WHERE id = "${productId}"`)
					.then((result1)=>{
						console.log(result1.affectedRows + " record(s) updated.");
					})
					.then(()=>{
						sqlQuery(`SELECT video_link FROM product WHERE id = "${productId}"`)
						.then((result1)=>{
							let videoLink = result1[0].video_link;
							videoLink = videoLinkFormat(videoLink);
							
							res.send(dataFormat([`${videoLink}`]));
						});
					})
					.catch((err)=>{
						res.send(err);
					});
				}
				else{
					res.send("Permission denied.");
				}
			}
			else {
				res.send(errorFormat("Please use Bearer schemes."));
			}
		}
		else {
			res.send(errorFormat("Authorization is required."));
		}
	}
	else {
		res.send(errorFormat("Please enter product id and link in query string."));
	}
});

/* --------------- Email API --------------- */
app.post("/api/1.0/admin/email-send", async(req, res) => {
	const userToken = req.body.user_token;
	const orderNumber = req.body.order_number;
	console.log(userToken, orderNumber);
	
	//check accessToken
	let authorization = req.headers.authorization;
	
	//check authorization
	if (authorization) {
		authorization = authorization.split(" ");
		console.log(authorization[0], authorization[1]);
		try {
			//check Bearer
			if(authorization[0] === "Bearer") {
				//check token 
				if (authorization[1] === "iamacoolguyilovetaiwan") {
					//check req.headers and req.body
					if (req.headers['content-type'].search('application/json') >= 0 && userToken && orderNumber) {
						//get userName
						let result1 = await sqlQuery(`SELECT id, email, name FROM user WHERE access_token = "${userToken}"`);
						console.log(result1);
						const userName = result1[0].name;
						const userEmail = result1[0].email;
						
						//get order
						let result2 = await sqlQuery(`SELECT number, details FROM order_table WHERE number = "${orderNumber}"`);
						console.log(result2);
						const orderDetails = JSON.stringify(result2[0].details, null, 4);
						
						//set SMTP server
						const transporter = nodemailer.createTransport( {
								host: 'smtp.gmail.com',
								secureConnecton: true,
								port: 587,
								auth: {
								user: "en162929@gmail.com",
								pass: "peapzayqccphviun"
							}
						});
						
						//set email content
						const html = `<h1>Welcome! ${userName}</h1><h2>感謝您的購買!</h2>
										<h3>您的訂單編號：   </h3><p>${orderNumber}</p><br>
										<h3>訂單內容：</h3><br>
										<p>${orderDetails}</p>`;
						const mailOptions = {
							from: "en162929@gmail.com",
							to: `${userEmail}`,
							subject: "Stylish 感謝您的購買",
							html: html
						};
						
						
						//send Email
						transporter.sendMail(mailOptions, (err, info)=>{
							if (err) {
								console.log(err);
								res.send(err);
							}
							else {
								console.log("Email sent: "+ info.response);
								res.send(dataFormat("Send succeed."));
							}
						});
						
					}
					else {
						res.send(errorFormat("Wrong headers or body."));
					}
				}
				else {
					res.send(errorFormat("Wrong token."));
				}			
			}
			else {
				res.send(errorFormat("Please use Bearer schemes."));
			}
		}catch(e) {
			res.send(e);
		}
	}
	else {
		res.send(errorFormat("Authorization is required."));
	}
});

/* --------------- Chat Bot API --------------- */
app.post("/api/1.0/chat-bot", (req, res) => {
	const userMessage = req.body.user_message;
	console.log(userMessage);
	
	let authorization = req.headers.authorization;
	
	//check authorization
	if (authorization) {
		authorization = authorization.split(" ");
		console.log(authorization[0], authorization[1]);
		try {
			//check Bearer
			if(authorization[0] === "Bearer") {
				//check token 
				if (authorization[1] === "iamacoolguyilovetaiwan") {
					//check req.headers and req.body
					if (req.headers['content-type'].search('application/json') >= 0) {
						
						//init watson-developer-cloud
						const AssistantV2 = require('watson-developer-cloud/assistant/v2');
						const assistant = new AssistantV2({
							version: '2019-02-28',
							iam_apikey: 'S_k3B0nmkvm_hwlCGzFXgCbUkuCjfNaTDKedhh_sBKks',
							url: 'https://gateway.watsonplatform.net/assistant/api'
						});
						//const assistantId = '407cb56c-018a-4b47-a18c-4719e59741c3';
						const assistantId = 'ce62aa0b-0872-45d0-8cc3-8bef17cba113';
						
						//create session
						assistant.createSession({
							assistant_id: assistantId,
						}, function(err, response) {
							if (err) {
								console.error(err);
							}
							else {
								console.log(JSON.stringify(response, null, 2));
								const sessionId = response.session_id;
								
								//send message
								assistant.message({
									assistant_id: assistantId,
									session_id: sessionId,
									input: {
										'message_type': 'text',
										'text': `${userMessage}`
									}
								}, (err, response) => {
									if (err) {
										console.log(err);
									}
									else {
										console.log(JSON.stringify(response, null, 2));
										const botRes = response.output.generic[0].text;
										console.log(botRes);
										res.send(dataFormat(botRes));
									}
								});
							}
						});
						
					}
					else {
						res.send(errorFormat("Please use application/json."));
					}
				}
				else {
					res.send(errorFormat("Wrong token."));
				}			
			}
			else {
				res.send(errorFormat("Please use Bearer schemes."));
			}
		}catch(e) {
			res.send(e);
		}
	}
	else {
		res.send(errorFormat("Authorization is required."));
	}
});





// Admin API
app.post("/api/"+cst.API_VERSION+"/admin/product", function(req, res){
	let upload=multer({dest:"./tmp"}).fields([
		{name:"main_image", maxCount:1},
		{name:"other_images", maxCount:3}
	]);	
	upload(req, res, function(error){
		if(error){
			res.send({error:"Upload Images Error"});
		}else{
			dao.product.insert(req).then(function(message){
				res.send({status:message});
			}).catch(function(error){
				res.send({error:error});
			});
		}
	});
});
app.post("/api/"+cst.API_VERSION+"/admin/campaign", function(req, res){
	let campaign={
		product_id:parseInt(req.body.product_id),
		picture:req.body.picture,
		story:req.body.story
	};
	mysql.con.query("insert into campaign set ?", campaign, function(error, results, fields){
		if(error){
			res.send({error:"Add Campaign Error"});
		}else{
			res.send({status:"OK"});
		}
	});
});
app.post("/api/"+cst.API_VERSION+"/admin/hot", function(req, res){
	let title=req.body.title;
	let productIds=req.body.product_ids.split(",");
	mysql.con.beginTransaction(function(error){
		if(error){
			throw error;
		}
		let hot={
			title:title,
		};
		mysql.con.query("insert into hot set ?", hot, function(error, results, fields){
			if(error){
				res.send({error:"Database Query Error"});
				return mysql.con.rollback(function(){
					throw error;
				});
			}
			let hotId=results.insertId;
			let hotProductMapping=[];
			for(let i=0;i<productIds.length;i++){
				hotProductMapping.push([
					hotId, parseInt(productIds[i])
				]);
			}
			mysql.con.query("insert into hot_product(hot_id,product_id) values ?", [hotProductMapping], function(error, results, fields){
				if(error){
					res.send({error:"Database Query Error"});
					return mysql.con.rollback(function(){
						throw error;
					});
				}
				mysql.con.commit(function(error){
					if(error){
						res.send({error:"Database Query Error"});
						return mysql.con.rollback(function(){
							throw error;
						});
					}
					res.send({status:"OK"});
				});
			});					
		});
	});
});

// Marketing Campaign API for Front-End
app.get("/api/"+cst.API_VERSION+"/marketing/campaigns", function(req, res){
	let query="select * from campaign order by id";
	mysql.con.query(query, function(error, results, fields){
		if(error){
			res.send({error:"Database Query Error"});
		}else{
			res.send({data:results});
		}
	});
});

// Marketing Hots API for Apps
app.get("/api/"+cst.API_VERSION+"/marketing/hots", function(req, res){
	let query="select hot.title as title,hot_product.product_id as product_id from hot,hot_product where hot.id=hot_product.hot_id order by hot.id";
	mysql.con.query(query, function(error, results, fields){
		if(error){
			res.send({error:"Database Query Error"});
		}else{
			let data=[];
			let hot;
			for(let i=0;i<results.length;i++){
				hot=data.find((hot)=>{return hot.title===results[i].title});
				if(hot){
					hot.products.push(results[i].product_id);
				}else{
					data.push({title:results[i].title, products:[results[i].product_id]});
				}
			}
			let total=data.length;
			let loaded=0;
			for(let i=0;i<data.length;i++){
				listProducts({where:" where id in ("+data[i].products.join(",")+")"}, data[i].products.length, 0, function(body){
					data[i].products=body.data;
					loaded++;
					if(loaded>=total){
						res.send({data:data});
					}
				});
			}
		}
	});
});

// Product API
app.get("/api/"+cst.API_VERSION+"/products/details", function(req, res){
	let productId=parseInt(req.query.id);
	if(!Number.isInteger(productId)){
		res.send({error:"Wrong Request"});
		return;
	}
	else{
		dao.product.get(productId).then(function(data){
			res.send({data:data});
		}).catch(function(error){
			res.send({error:error});
		});
	}
});

app.get("/api/"+cst.API_VERSION+"/products/:category", function(req, res){
	let paging=parseInt(req.query.paging);
	if(!Number.isInteger(paging)){
		paging=0;
	}
	let size=6;
	let category=req.params.category;
	let result={error:"Wrong Request"};
	let listCallback=function(data){
		res.send(data);
	};
	switch(category){
		case "hots":
			break;
		case "all":
			listProducts(null, size, paging, listCallback);
			break;
		case "men": case "women": case "accessories":
			listProducts({
				category:category
			}, size, paging, listCallback);
			break;
		case "search":
			if(req.query.keyword){
				listProducts({
					keyword:req.query.keyword
				}, size, paging, listCallback);
			}else{
				res.send({error:"Wrong Request"});
			}
			break;
		default:
			res.send({error:"Wrong Request"});
	}
});
	function listProducts(filters, size, paging, callback){
		dao.product.list(filters, size, paging).then(function(body){
			callback(body);
		}).catch(function(error){
			callback({error:error});
		});		
	}

// User API
app.post("/api/"+cst.API_VERSION+"/user/signup", function(req, res){
	let data=req.body;
	if(!data.name||!data.email||!data.password){
		res.send({error:"Request Error: name, email and password are required."});
		return;
	}
	mysql.con.beginTransaction(function(error){
		if(error){
			throw error;
		}
		mysql.con.query("select * from user where email = ?", [data.email], function(error, results, fields){
			if(error){
				res.send({error:"Database Query Error"});
				return mysql.con.rollback(function(){
					throw error;
				});
			}
			if(results.length>0){
				res.send({error:"Email Already Exists"});
				return;
			}
			let commitCallback=function(error){
				if(error){
					res.send({error:"Database Query Error"});
					return mysql.con.rollback(function(){
						throw error;
					});
				}
				res.send({data:{
					access_token:user.access_token,
					access_expired:Math.floor((user.access_expired-now)/1000),
					user:{
						id:user.id,
						provider:user.provider,
						name:user.name,
						email:user.email,
						picture:user.picture
					}
				}});
			};
			let now=Date.now();
			let sha=crypto.createHash("sha256");
			sha.update(data.email+data.password+now);
			let accessToken=sha.digest("hex");
			let user={
				provider:"native",
				email:data.email,
				password:data.password,
				name:data.name,
				picture:null,
				access_token:accessToken,
				access_expired:now+(30*24*60*60*1000) // 30 days
			};
			let query="insert into user set ?";
			mysql.con.query(query, user, function(error, results, fields){
				if(error){
					res.send({error:"Database Query Error"});
					return mysql.con.rollback(function(){
						throw error;
					});
				}
				user.id=results.insertId;
				mysql.con.commit(commitCallback);
			});
		});
	});
});

app.post("/api/"+cst.API_VERSION+"/user/signin", function(req, res){
	
	let data=req.body;
	if(data.provider==="native"){
		if(!data.email||!data.password){
			res.send({error:"Request Error: email and password are required."});
			return;
		}
		mysql.con.beginTransaction(function(error){
			if(error){
				throw error;
			}
			console.log(data.email,data.password);
			mysql.con.query("select * from user where email = ? and password = ?", [data.email,data.password], function(error, results, fields){
				if(error){
					res.send({error:"Database Query Error"});
					return mysql.con.rollback(function(){
						throw error;
					});
				}
				let user;
				let now=Date.now();
				let sha=crypto.createHash("sha256");
				sha.update(data.email+data.password+now);
				let accessToken=sha.digest("hex");
				let commitCallback=function(error){
					if(error){
						res.send({error:"Database Query Error"});
						return mysql.con.rollback(function(){
							throw error;
						});
					}
					if(user===null){
						res.send({error:"Sign In Error"});
					}else{
						res.send({data:{
							access_token:user.access_token,
							access_expired:Math.floor((user.access_expired-now)/1000),
							user:{
								id:user.id,
								provider:user.provider,
								name:user.name,
								email:user.email,
								picture:user.picture
							}
						}});
					}
				};
				if(results.length===0){ // error
					user=null;
					mysql.con.commit(commitCallback);
				}else{ // update
					user={
						id:results[0].id,
						provider:results[0].provider,
						email:results[0].email,
						name:results[0].name,
						picture:results[0].picture,
						access_token:accessToken,
						access_expired:now+(30*24*60*60*1000) // 30 days
					};
					//check img_upload
					if (results[0].img_upload != undefined) {
						user.picture = results[0].img_upload
					}
					else {
						user.picture = results[0].picture;
					}
					
					let query="update user set access_token = ?, access_expired = ? where id = ?";
					mysql.con.query(query, [user.access_token, user.access_expired, user.id], function(error, results, fields){
						if(error){
							res.send({error:"Database Query Error"});
							return mysql.con.rollback(function(){
								throw error;
							});
						}
						mysql.con.commit(commitCallback);
					});
				}
			});
		});
	}else if(data.provider==="facebook"){
		if(!data.access_token){
			res.send({error:"Request Error: access token is required."});
			return;
		}
		// Get profile from facebook
		getFacebookProfile(data.access_token).then(function(profile){
			if(!profile.id||!profile.name||!profile.email){
				res.send({error:"Permissions Error: id, name, email are required."});
				return;
			}
			mysql.con.beginTransaction(function(error){
				if(error){
					throw error;
				}
				mysql.con.query("select id from user where email = ? and provider = ?", [profile.email,data.provider], function(error, results, fields){
					if(error){
						res.send({error:"Database Query Error"});
						return mysql.con.rollback(function(){
							throw error;
						});
					}
					let query;
					let now=Date.now();
					let user={
						provider:data.provider,
						email:profile.email,
						name:profile.name,
						picture:"https://graph.facebook.com/"+profile.id+"/picture?type=large",
						access_token:data.access_token,
						access_expired:now+(30*24*60*60*1000) // 30 days
					};
					if(results.length===0){ // insert
						query="insert into user set ?";
						query=mysql.core.format(query, user);
					}else{ // update
						user.id=results[0].id;
						query="update user set name = ?, access_token = ?, access_expired = ? where email = ?";
						query=mysql.core.format(query, [user.name, user.access_token, user.access_expired, user.email]);
					}
					mysql.con.query(query, function(error, results, fields){
						if(error){
							res.send({error:"Database Query Error"});
							return mysql.con.rollback(function(){
								throw error;
							});
						}
						if(!user.id){
							user.id=results.insertId;
						}
						mysql.con.commit(function(error){
							if(error){
								res.send({error:"Database Query Error"});
								return mysql.con.rollback(function(){
									throw error;
								});
							}
							res.send({data:{
								access_token:user.access_token,
								access_expired:Math.floor((user.access_expired-now)/1000),
								user:{
									id:user.id,
									provider:user.provider,
									name:user.name,
									email:user.email,
									picture:user.picture
								}
							}});
						});
					});					
				});
			});
		}).catch(function(error){
			res.send({error:error});
		});
	}else{
		res.send({error:"Wrong Request"});
	}
});
	let getFacebookProfile=function(accessToken){
		return new Promise((resolve, reject)=>{
			if(!accessToken){
				resolve(null);
				return;
			}
			request({
				url:"https://graph.facebook.com/me?fields=id,name,email&access_token="+accessToken,
				method:"GET"
			}, function(error, response, body){
				body=JSON.parse(body);
				if(body.error){
					reject(body.error);
				}else{
					resolve(body);
				}
			});
		});
	};

app.get("/api/"+cst.API_VERSION+"/user/profile", function(req, res){
	let accessToken=req.get("Authorization");
	if(accessToken){
		accessToken=accessToken.replace("Bearer ", "");
	}else{
		res.send({error:"Wrong Request: authorization is required."});
		return;
	}
	mysql.con.query("select * from user where access_token = ?", [accessToken], function(error, results, fields){
		if(error){
			res.send({error:"Database Query Error"});
		}else{
			if(results.length===0){
				res.send({error:"Invalid Access Token"});
			}else{
				const user = {
					id:results[0].id,
					provider:results[0].provider,
					name:results[0].name,
					email:results[0].email,
					picture:results[0].picture
				}				
				//check img_upload
				if (results[0].img_upload != undefined) {
					user.picture = results[0].img_upload
				}
				else {
					user.picture = results[0].picture;
				}
				
				res.send({data:user});
			}
		}
	});
});

// Check Out API
app.post("/api/"+cst.API_VERSION+"/order/checkout", function(req, res){
	let data=req.body;
	if(!data.order||!data.order.total||!data.order.list||!data.prime){
		res.send({error:"Create Order Error: Wrong Data Format"});
		return;
	}
	let accessToken=req.get("Authorization");
	if(accessToken){
		accessToken=accessToken.replace("Bearer ", "");
	}
	// Get user profile from database
	getUserProfile(accessToken).then(function(profile){
		let now=new Date();
		let number=now.getMonth()+""+now.getDate()+""+(now.getTime()%(24*60*60*1000))+""+Math.floor(Math.random()*10);
		let orderRecord={
			number:number,
			time:now.getTime(),
			status:-1, // -1 for init (not pay yet)
			details:JSON.stringify(data.order)
		};
		if(profile!==null&&profile.id){
			orderRecord.user_id=profile.id;
		}
		let query="insert into order_table set ?";
		mysql.con.query(query, orderRecord, function(error, results, fields){
			if(error){
				res.send({error:"Create Order Error"});
				return;
			}else{
				let orderId=results.insertId;
				// start payment
				request({
					url:"https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime",
					method:"POST",
					headers:{
						"Content-Type":"application/json",
						"x-api-key":cst.TAPPAY_PARTNER_KEY
					},
					json:{
						"prime": data.prime,
						"partner_key": cst.TAPPAY_PARTNER_KEY,
						"merchant_id": "AppWorksSchool_CTBC",
						"details": "Stylish Payment",
						"amount": data.order.total,
						"cardholder": {
							"phone_number": data.order.recipient.phone,
							"name": data.order.recipient.name,
							"email": data.order.recipient.email
						},
						"remember": false
					}
				}, function(error, response, body){
					if(body.status===0){ // OK
						let payment={
							order_id:orderId,
							details:JSON.stringify(body)
						};
						createPayment(payment, function(result){
							if(true){
								res.send({data:{number:orderRecord.number}});
							}else{
								res.send({error:"Create Payment Error"});
							}
						});
					}else{
						res.send({error:"Payment Failed: "+body.msg});
					}
				});
			}
		});
	}).catch(function(error){
		res.send({error:error});
	});
});
	let getUserProfile=function(accessToken){
		return new Promise((resolve, reject)=>{
			if(!accessToken){
				resolve(null);
				return;
			}
			mysql.con.query("select * from user where access_token = ?", [accessToken], function(error, results, fields){
				if(error){
					resolve({error:"Database Query Error"});
				}else{
					if(results.length===0){
						resolve({error:"Invalid Access Token"});
					}else{
						resolve({
							id:results[0].id,
							provider:results[0].provider,
							name:results[0].name,
							email:results[0].email,
							picture:results[0].picture
						});
					}
				}
			});
		});
	};
	let createPayment=function(payment, callback){
		mysql.con.beginTransaction(function(error){
			if(error){
				throw error;
			}
			mysql.con.query("insert into payment set ?", payment, function(error, results, fields){
				if(error){
					callback(false);
					return mysql.con.rollback(function(){
						throw error;
					});
				}
				mysql.con.query("update order_table set status = ?", [0], function(error, results, fields){
					if(error){
						callback(false);
						return mysql.con.rollback(function(){
							throw error;
						});
					}
					mysql.con.commit(function(error){
						if(error){
							callback(false);
							return mysql.con.rollback(function(){
								throw error;
							});
						}
						callback(true);
					});
				});					
			});
		});
	};


/* ---------------Promise--------------- */
//Use Promise for MySQL .query()
function sqlQuery (query1) {
	return new Promise ((reso, rej) => {
		mysql.con.query(query1,(err, result, fields) => {
			if (err) {
				rej(err);
			}
			else {
				reso(result);
			}
		});
	});
};

/* //Use Promise for MySQL .query() with transaction
function sqlQueryTransaction (query1) {
	return new Promise ((reso, rej)=>{
		
		mysql.con.query();
	}); 
} */



/* ---------------Response Format--------------- */
//data format
function dataFormat (str) {
	str = {data: str};
	return JSON.stringify(str);
}

//error massage format
function errorFormat (str) {
	str = {error: str};
	return JSON.stringify(str);
}

//video Link Format
function videoLinkFormat(link) {
	let resFin = link.split("=");
	console.log(resFin[1]);
	return resFin[1];
}


/* ---------------Favorite Format--------------- */
function pavoriteFormat (arr) {
	//correct format
	const arrayFin = [];								
	for (let i=0; i<arr.length; i++) {
		arrayFin.push(arr[i].product_id);
	}
	return arrayFin;
}



/* ---------------Error--------------- */
//catch 404 error
/* app.use((req, res)=>{
	console.log("adslhhadsglsadhg");
	res.status(404).send("Page not found.");
});

//error handler
app.use((err, req, res, next) => {
	console.log(err);
	if (!err.statusCode) {
		err.statusCode = 500;
	}
	res.statusCode(err.statusCode).send(err.message);
}); */


module.exports=app;
// git password: af7258ba52ea0bd3756239234f5f46812cc57510 

/* ---------------Port--------------- */
app.listen(3000, () => {
	console.log("this app is running on port 3000.");
});