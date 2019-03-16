const cst=require("../util/constants.js");

/* --------------- MySQL Initialization --------------- */
const mysql2 = require("mysql2");
const Client = require('ssh2').Client;

const mysql = {};

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



// Build DAO Object
module.exports={
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
			console.log(product.id, "8");
			mysql.con.query(query, [productId], function(error, results, fields){
				console.log(product.id, "7");
				if(error){
					console.log(product.id, "6");
					reject("Database Query Error");
				}else{
					console.log(product.id, "5");
					if(results.length===0){
						console.log(product.id, "4");
						resolve(null);
					}else{
						let product=results[0];
						query="select * from variant where product_id = ?";
						console.log(product.id, "adsgfagareg");
						mysql.con.query(query, [product.id], function(error, results, fields){
							if(error){
								console.log(product.id, "2");
								reject("Database Query Error");
							}else{
								console.log(product.id, "3");
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
};